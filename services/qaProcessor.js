// services/qaProcessor.js
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);
const { InteractionTranscription, QAForm, Interactions, InteractionAIQA } = require('../config/mongodb');
const mongoose = require('mongoose');

/**
 * Download a file from URL to local filesystem
 * @param {string} url - URL of the file to download
 * @param {string} interactionId - Interaction ID for naming
 * @returns {Promise<string>} Path to the downloaded file
 */
async function downloadRecording(url, interactionId) {
  try {
    // Create temp directory if it doesn't exist
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      await mkdirAsync(tempDir, { recursive: true });
    }
    
    // Extract file extension from URL
    const fileExt = path.extname(url) || '.wav';
    const localPath = path.join(tempDir, `${interactionId}${fileExt}`);
    
    console.log(`Downloading recording from ${url} to ${localPath}`);
    
    // Determine protocol
    const protocol = url.startsWith('https') ? require('https') : require('http');
    
    return new Promise((resolve, reject) => {
      protocol.get(url, response => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download file, status code: ${response.statusCode}`));
          return;
        }
        
        const fileStream = fs.createWriteStream(localPath);
        response.pipe(fileStream);
        
        fileStream.on('finish', () => {
          fileStream.close();
          console.log(`Download completed: ${localPath}`);
          resolve(localPath);
        });
        
        fileStream.on('error', err => {
          fs.unlink(localPath, () => {}); // Delete file in case of error
          reject(err);
        });
      }).on('error', err => {
        reject(err);
      });
    });
  } catch (error) {
    console.error(`Error downloading recording for interaction ${interactionId}:`, error);
    throw error;
  }
}

/**
 * Upload recording to temporary storage for public access
 * @param {string} localFilePath - Path to local recording file
 * @param {string} interactionId - Interaction ID
 * @returns {Promise<string>} Public URL of uploaded file or false on failure
 */
async function uploadToPublicStorage(localFilePath, interactionId) {
  try {
    const baseUrl = process.env.STORAGE_BASE_URL || 'https://democc.contegris.com';
    const apiUrl = process.env.STORAGE_API_URL || 'https://democc.contegris.com:8443';
    
    const data = new FormData();
    data.append('file', fs.createReadStream(localFilePath));
    
    const response = await axios({
      method: 'post',
      url: `${apiUrl}/store/single/voice_recording/${interactionId}`,
      headers: {
        ...data.getHeaders()
      },
      data: data,
      maxBodyLength: Infinity
    });
    
    const publicUrl = `${baseUrl}/store${response.data.url}`;
    console.log(`File uploaded successfully, public URL: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error(`Error uploading file for interaction ${interactionId}:`, error);
    throw error;
  }
}

/**
 * Delete file from public storage
 * @param {string} publicUrl - Public URL of the file
 * @param {string} interactionId - Interaction ID
 */
async function deleteFromPublicStorage(publicUrl, interactionId) {
  try {
    const baseUrl = process.env.STORAGE_BASE_URL || 'https://democc.contegris.com';
    const apiUrl = process.env.STORAGE_API_URL || 'https://democc.contegris.com:8443';
    
    // Extract the file path from the URL
    const filePath = publicUrl.replace(`${baseUrl}/store`, '');
    
    await axios({
      method: 'delete',
      url: `${apiUrl}/store/delete`,
      headers: {
        'Content-Type': 'application/json'
      },
      data: JSON.stringify({
        filesPath: [filePath]
      })
    });
    
    console.log(`File deleted from public storage: ${filePath}`);
  } catch (error) {
    console.error(`Error deleting file for interaction ${interactionId}:`, error);
    // Continue execution even if deletion fails
  }
}

/**
 * Delete local temporary file
 * @param {string} filePath - Path to local file
 */
async function deleteLocalFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      await unlinkAsync(filePath);
      console.log(`Local file deleted: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error deleting local file ${filePath}:`, error);
    // Continue execution even if deletion fails
  }
}

/**
 * Get sentiment analysis for a text segment
 * @param {string} text - Text to analyze
 * @returns {Promise<Object>} - Sentiment analysis result
 */
async function getSentiment(text) {
  try {
    // Use environment variable for sentiment API URL
    const sentimentApiUrl = process.env.SENTIMENT_API_URL || 'http://democc.contegris.com:60027/callTranscription';
    
    const response = await axios.post(sentimentApiUrl, 
      { text }, 
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    return response.data;
  } catch (error) {
    console.error(`Error getting sentiment for text: ${text.substring(0, 30)}...`, error.message);
    // Return default values if sentiment API fails
    return {
      sentiment: {
        score: 0.5,
        sentiment: "neutral"
      },
      profanity: {
        score: 0,
        words: []
      },
      intents: [],
      language: "en",
      translationInEnglish: text,
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
        prompt_tokens_details: {
          cached_tokens: 0,
          audio_tokens: 0
        },
        completion_tokens_details: {
          reasoning_tokens: 0,
          audio_tokens: 0,
          accepted_prediction_tokens: 0,
          rejected_prediction_tokens: 0
        }
      }
    };
  }
}

//----------------------------------------------------------------
// Original format processing functions (for backward compatibility)
//----------------------------------------------------------------

/**
 * Process Deepgram transcript to simplified format (Original version)
 * @param {Object} transcript - Deepgram transcript object
 * @returns {Object} Simplified transcript in original format
 */
function processTranscript(transcript) {
  // Create the output structure
  const output = {
    transcription: []
  };
  
  // Process utterances if available (preferred for complete sentences)
  if (transcript.results.utterances && transcript.results.utterances.length > 0) {
    processUtterances(transcript.results.utterances, output);
  } 
  // Fallback to processing words directly from channels if no utterances
  else {
    processChannels(transcript.results.channels, output);
  }
  
  // Sort the transcription entries by start time
  sortTranscriptionByTimestamp(output);
  
  return output;
}

/**
 * Process utterances from the Deepgram transcript (Original version)
 * @param {Array} utterances - Utterances from Deepgram
 * @param {Object} output - Output object to populate
 */
function processUtterances(utterances, output) {
  utterances.forEach(utterance => {
    // Format the timestamps with fixed precision
    const startTime = utterance.start.toFixed(2);
    const endTime = utterance.end.toFixed(2);
    
    // Create a key in the format "start-end" - Note: this format has issues with Mongo
    const timeKey = `${startTime}-${endTime}`;
    
    // Add the entry to our output
    const entry = {
      [timeKey]: {
        channel: utterance.channel,
        speaker_id: `speaker_${utterance.speaker || 0}`, // Add speaker_ prefix
        original_text: utterance.transcript
      }
    };
    
    output.transcription.push(entry);
  });
}

/**
 * Process channels when utterances are not available (Original version)
 * @param {Array} channels - Channels from Deepgram
 * @param {Object} output - Output object to populate
 */
function processChannels(channels, output) {
  channels.forEach((channel, channelIndex) => {
    if (!channel.alternatives || !channel.alternatives[0]) return;
    
    const alternative = channel.alternatives[0];
    
    // Group words into sentences or paragraphs if possible
    if (alternative.paragraphs && alternative.paragraphs.paragraphs) {
      processParagraphs(alternative.paragraphs.paragraphs, channelIndex, output);
    }
    // If no paragraph structure, go through sentences
    else if (alternative.words) {
      // Group words into sentences based on punctuation
      const sentences = groupWordsIntoSentences(alternative.words);
      sentences.forEach(sentence => {
        const startTime = sentence.start.toFixed(2);
        const endTime = sentence.end.toFixed(2);
        const timeKey = `${startTime}-${endTime}`;
        
        const entry = {
          [timeKey]: {
            channel: channelIndex,
            speaker_id: `speaker_${sentence.speaker || 0}`,
            original_text: sentence.text
          }
        };
        
        output.transcription.push(entry);
      });
    }
  });
}

/**
 * Process paragraphs from the transcript (Original version)
 * @param {Array} paragraphs - Paragraphs from Deepgram
 * @param {number} channelIndex - Channel index
 * @param {Object} output - Output object to populate
 */
function processParagraphs(paragraphs, channelIndex, output) {
  paragraphs.forEach(paragraph => {
    if (paragraph.sentences) {
      paragraph.sentences.forEach(sentence => {
        const startTime = sentence.start.toFixed(2);
        const endTime = sentence.end.toFixed(2);
        const timeKey = `${startTime}-${endTime}`;
        
        const entry = {
          [timeKey]: {
            channel: channelIndex,
            speaker_id: `speaker_${paragraph.speaker || 0}`,
            original_text: sentence.text
          }
        };
        
        output.transcription.push(entry);
      });
    }
  });
}

//----------------------------------------------------------------
// New format processing functions (matches your specified structure)
//----------------------------------------------------------------

/**
 * Process utterances with timestamp-based format and sentiment analysis
 * @param {Array} utterances - Utterances from Deepgram
 * @param {Object} output - Output object to populate
 * @param {string} agentSpeakerId - Agent speaker ID
 * @param {string} callerSpeakerId - Caller speaker ID
 * @param {number} baseTimestamp - Base timestamp from interaction start time
 */
async function processUtterancesV2(utterances, output, agentSpeakerId, callerSpeakerId, baseTimestamp) {
  // Process each utterance sequentially
  await Promise.all(utterances.map(async (utterance) => {
    // Calculate timestamp based on interaction start time plus utterance start time
    const utteranceStartMs = Math.round(utterance.start * 1000);
    const timestamp = baseTimestamp + utteranceStartMs;
    
    // Determine speaker based on channel (0 = left/agent, 1 = right/customer)
    const speaker_id = utterance.channel === 0 ? agentSpeakerId : callerSpeakerId;
    
    // Get sentiment analysis
    const sentimentAnalysis = await getSentiment(utterance.transcript);
    
    // Create entry with exact format requested
    const entry = {
      [timestamp.toString()]: {
        speaker_id: speaker_id,
        original_text: utterance.transcript,
        translated_text: sentimentAnalysis.translationInEnglish || utterance.transcript,
        sentiment: sentimentAnalysis.sentiment || {
          sentiment: "neutral",
          score: 0.5
        },
        profanity: sentimentAnalysis.profanity || {
          words: [],
          score: 0
        },
        intent: sentimentAnalysis.intents || [],
        language: sentimentAnalysis.language || utterance.language || "en",
        usage: sentimentAnalysis.usage || {
          prompt_tokens: 0,
          completion_tokens: 0,
          total_tokens: 0,
          prompt_tokens_details: {
            cached_tokens: 0,
            audio_tokens: 0
          },
          completion_tokens_details: {
            reasoning_tokens: 0,
            audio_tokens: 0,
            accepted_prediction_tokens: 0,
            rejected_prediction_tokens: 0
          }
        },
        port: 10000 + Math.floor(Math.random() * 10000)
      }
    };
    
    output.transcription.push(entry);
  }));
}

/**
 * Process channels with timestamp-based format and sentiment analysis
 * @param {Array} channels - Channels from Deepgram
 * @param {Object} output - Output object to populate
 * @param {string} agentSpeakerId - Agent speaker ID
 * @param {string} callerSpeakerId - Caller speaker ID
 * @param {number} baseTimestamp - Base timestamp from interaction start time
 */
async function processChannelsV2(channels, output, agentSpeakerId, callerSpeakerId, baseTimestamp) {
  // Process each channel
  for (let channelIndex = 0; channelIndex < channels.length; channelIndex++) {
    const channel = channels[channelIndex];
    if (!channel.alternatives || !channel.alternatives[0]) continue;
    
    const alternative = channel.alternatives[0];
    
    // Group words into sentences or paragraphs if possible
    if (alternative.paragraphs && alternative.paragraphs.paragraphs) {
      await processParagraphsV2(alternative.paragraphs.paragraphs, channelIndex, output, 
                              agentSpeakerId, callerSpeakerId, baseTimestamp);
    }
    // If no paragraph structure, go through sentences
    else if (alternative.words) {
      // Group words into sentences based on punctuation
      const sentences = groupWordsIntoSentences(alternative.words);
      
      // Process each sentence with sentiment analysis
      await Promise.all(sentences.map(async (sentence) => {
        const utteranceStartMs = Math.round(sentence.start * 1000);
        const timestamp = baseTimestamp + utteranceStartMs;
        
        // Determine speaker based on channel
        const speaker_id = channelIndex === 0 ? agentSpeakerId : callerSpeakerId;
        
        // Get sentiment analysis
        const sentimentAnalysis = await getSentiment(sentence.text);
        
        // Create entry matching requested format
        const entry = {
          [timestamp.toString()]: {
            speaker_id: speaker_id,
            original_text: sentence.text,
            translated_text: sentimentAnalysis.translationInEnglish || sentence.text,
            sentiment: sentimentAnalysis.sentiment || {
              sentiment: "neutral",
              score: 0.5
            },
            profanity: sentimentAnalysis.profanity || {
              words: [],
              score: 0
            },
            intent: sentimentAnalysis.intents || [],
            language: sentimentAnalysis.language || "en",
            usage: sentimentAnalysis.usage || {
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0,
              prompt_tokens_details: {
                cached_tokens: 0,
                audio_tokens: 0
              },
              completion_tokens_details: {
                reasoning_tokens: 0,
                audio_tokens: 0,
                accepted_prediction_tokens: 0,
                rejected_prediction_tokens: 0
              }
            },
            port: 10000 + Math.floor(Math.random() * 10000)
          }
        };
        
        output.transcription.push(entry);
      }));
    }
  }
}

/**
 * Process paragraphs with timestamp-based format and sentiment analysis
 * @param {Array} paragraphs - Paragraphs from Deepgram
 * @param {number} channelIndex - Channel index
 * @param {Object} output - Output object to populate
 * @param {string} agentSpeakerId - Agent speaker ID
 * @param {string} callerSpeakerId - Caller speaker ID
 * @param {number} baseTimestamp - Base timestamp
 */
async function processParagraphsV2(paragraphs, channelIndex, output, agentSpeakerId, callerSpeakerId, baseTimestamp) {
  // Process each paragraph
  for (const paragraph of paragraphs) {
    if (paragraph.sentences) {
      // Process each sentence in the paragraph
      await Promise.all(paragraph.sentences.map(async (sentence) => {
        const utteranceStartMs = Math.round(sentence.start * 1000);
        const timestamp = baseTimestamp + utteranceStartMs;
        
        // Determine speaker based on channel
        const speaker_id = channelIndex === 0 ? agentSpeakerId : callerSpeakerId;
        
        // Get sentiment analysis
        const sentimentAnalysis = await getSentiment(sentence.text);
        
        // Create entry matching requested format
        const entry = {
          [timestamp.toString()]: {
            speaker_id: speaker_id,
            original_text: sentence.text,
            translated_text: sentimentAnalysis.translationInEnglish || sentence.text,
            sentiment: sentimentAnalysis.sentiment || {
              sentiment: "neutral",
              score: 0.5
            },
            profanity: sentimentAnalysis.profanity || {
              words: [],
              score: 0
            },
            intent: sentimentAnalysis.intents || [],
            language: sentimentAnalysis.language || "en",
            usage: sentimentAnalysis.usage || {
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0,
              prompt_tokens_details: {
                cached_tokens: 0,
                audio_tokens: 0
              },
              completion_tokens_details: {
                reasoning_tokens: 0,
                audio_tokens: 0,
                accepted_prediction_tokens: 0,
                rejected_prediction_tokens: 0
              }
            },
            port: 10000 + Math.floor(Math.random() * 10000)
          }
        };
        
        output.transcription.push(entry);
      }));
    }
  }
}

/**
 * Process the transcript with accurate timestamps and sentiment analysis
 * @param {Object} transcript - Deepgram transcript 
 * @param {Object} agent - Agent information
 * @param {Object} caller - Caller information
 * @param {Date} interactionStartTime - Interaction start time
 * @returns {Object} Processed transcript
 */
async function processTranscriptV2(transcript, agent, caller, interactionStartTime) {
  // Create the output structure to match existing format
  const output = {
    transcription: []
  };
  
  // Get agent and caller info for speaker_id
  const agentId = agent?.id || "Agent";
  const agentName = agent?.name || "Agent";
  const callerId = caller?.id || "Customer";
  
  // Construct speaker IDs to match existing format
  const agentSpeakerId = `agent_${agentName.replace(/\s+/g, '.')}`;
  const callerSpeakerId = `customer_${callerId}`;
  
  // Get base timestamp (interaction start time in milliseconds)
  const baseTimestamp = interactionStartTime ? new Date(interactionStartTime).getTime() : Date.now();
  
  // Process utterances if available
  if (transcript.results.utterances && transcript.results.utterances.length > 0) {
    await processUtterancesV2(transcript.results.utterances, output, agentSpeakerId, callerSpeakerId, baseTimestamp);
  } 
  // Fallback to processing channels
  else if (transcript.results.channels) {
    await processChannelsV2(transcript.results.channels, output, agentSpeakerId, callerSpeakerId, baseTimestamp);
  }
  
  // Sort transcription by timestamp
  output.transcription.sort((a, b) => {
    const timestampA = Number(Object.keys(a)[0]);
    const timestampB = Number(Object.keys(b)[0]);
    return timestampA - timestampB;
  });
  
  return output;
}

//----------------------------------------------------------------
// Shared helper functions
//----------------------------------------------------------------

/**
 * Group words into sentences based on punctuation and timing
 * @param {Array} words - Words from Deepgram
 * @returns {Array} - Sentences grouped from words
 */
function groupWordsIntoSentences(words) {
  const sentences = [];
  let currentSentence = {
    text: '',
    start: 0,
    end: 0,
    speaker: 0,
    words: []
  };
  
  words.forEach((word, index) => {
    // Initialize sentence start time with first word
    if (currentSentence.words.length === 0) {
      currentSentence.start = word.start;
      currentSentence.speaker = word.speaker || 0;
    }
    
    // Add word to the current sentence
    currentSentence.words.push(word);
    
    // Update the sentence text with appropriate spacing
    if (currentSentence.text) {
      currentSentence.text += ' ';
    }
    currentSentence.text += word.punctuated_word || word.word;
    
    // Update end time with each word
    currentSentence.end = word.end;
    
    // Check if this word ends a sentence or is the last word
    const endsWithPunctuation = (word.punctuated_word || '').match(/[.?!;]$/);
    const isLastWord = index === words.length - 1;
    
    // Long pause (more than 1 second) can also indicate sentence break
    const nextWord = index < words.length - 1 ? words[index + 1] : null;
    const longPause = nextWord && (nextWord.start - word.end > 1.0);
    
    // Different speaker indicates a new sentence
    const speakerChange = nextWord && (nextWord.speaker !== word.speaker);
    
    if (endsWithPunctuation || isLastWord || longPause || speakerChange) {
      // Remove any trailing spaces
      currentSentence.text = currentSentence.text.trim();
      
      // Add the completed sentence to our list
      sentences.push({ ...currentSentence });
      
      // Reset for the next sentence
      currentSentence = {
        text: '',
        start: 0,
        end: 0,
        speaker: 0,
        words: []
      };
    }
  });
  
  return sentences;
}

/**
 * Sort the transcription entries by start timestamp
 * @param {Object} output - Output object to sort
 */
function sortTranscriptionByTimestamp(output) {
  output.transcription.sort((a, b) => {
    const timeKeyA = Object.keys(a)[0];
    const timeKeyB = Object.keys(b)[0];
    
    const startTimeA = parseFloat(timeKeyA.split('-')[0]);
    const startTimeB = parseFloat(timeKeyB.split('-')[0]);
    
    return startTimeA - startTimeB;
  });
}

/**
 * Get QA Form parameters in the required format
 * @param {String} formId - QA Form ID
 * @returns {Object} Formatted QA Form
 */
const getFormattedQAForm = async (formId) => {
  const form = await QAForm.findById(formId);
  if (!form) {
    throw new Error('QA Form not found');
  }
  
  const formattedParams = form.parameters.map(param => ({
    label: param.name,
    evaluationContext: param.context,
    maxScore: param.maxScore,
    scoringType: param.scoringType
  }));
  
  return {
    formId: form._id,
    formName: form.name,
    parameters: formattedParams
  };
};

/**
 * Main function to process a single evaluation
 * @param {Object} evaluation - Evaluation data
 * @returns {Object} Processing result
 */
const processEvaluation = async (evaluation) => {
  let localFilePath = null;
  let publicUrl = null;
  let transcriptionFilePath = null;
  let transcriptionPublicUrl = null;
  
  try {
    // Extract required data
    const { interactionId, recordingUrl, agent, caller, qaFormId, evaluator } = evaluation;
    
    if (!recordingUrl) {
      throw new Error('Recording URL is required');
    }
    
    if (!qaFormId) {
      throw new Error('QA Form ID is required');
    }
    
    // Get interaction start time from db or use default
    let interactionStartTime;
    let channel = 'call';
    let direction = 0;
    let duration = 0;

    try {
      const interaction = await Interactions.findById(interactionId);
	  const interactionData = interaction ? interaction.toObject ? interaction.toObject() : interaction : null;
	  channel = interactionData.channel;
      direction = interactionData.direction;
      duration = interactionData.connect.duration || 0;
      interactionStartTime = interactionData?.connect?.startDtTime || new Date();
    } catch (error) {
      console.warn(`Could not find interaction start time: ${error.message}`);
      interactionStartTime = new Date();
    }
    
    // Step 1: Download the recording file locally
    console.log(`Processing recording for interaction: ${interactionId}`);
    localFilePath = await downloadRecording(recordingUrl, interactionId);
    
    // Step 2: Upload to democc for public access
    publicUrl = await uploadToPublicStorage(localFilePath, interactionId);
    
    // Step 3: Process with Deepgram
    console.log(`Sending to Deepgram: ${publicUrl}`);
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    
    const deepgramResponse = await axios.post(
      'https://api.deepgram.com/v1/listen',
      {
        url: publicUrl
      },
      {
        headers: {
          'Authorization': `Token ${deepgramApiKey}`,
          'Content-Type': 'application/json'
        },
        params: {
          smart_format: true,
          punctuate: true,
          diarize: true,
          language: 'hi-latn',
          model: 'nova-2',
          multichannel: true,
          utterances: true
        }
      }
    );
    
    // Step 4: Process transcription
    const processedTranscription = await processTranscriptV2(
      deepgramResponse.data, 
      agent, 
      caller,
      interactionStartTime
    );
    
    // Step 5: Save to database
    const transcriptionDoc = {
      interactionId,
	    transcriptionVersion: 'recorded',
      transcription: processedTranscription.transcription
    };

    // Check if a transcription already exists
    const existingTranscription = await InteractionTranscription.findOne({ interactionId });
    
    if (existingTranscription) {
      // Update existing transcription
      await InteractionTranscription.updateOne(
        { interactionId },
        { 
          $set: { 
			    transcriptionVersion: 'recorded',
            transcription: processedTranscription.transcription 
          }
        }
      );
    } else {
      // Create new transcription
      await InteractionTranscription.create(transcriptionDoc);
    }
    
    // Step 6: Get QA form data
    const qaForm = await QAForm.findById(qaFormId);
    if (!qaForm) {
      throw new Error('QA Form not found');
    }
    
    // Step 7: Format QA form parameters into instructions
    const formattedQAForm = {
      formId: qaForm._id,
      formName: qaForm.name,
      parameters: qaForm.parameters.map(param => ({
        label: param.name,
        evaluationContext: param.context,
        maxScore: param.maxScore,
        scoringType: param.scoringType
      }))
    };
    
    const instructions = formatInstructions(formattedQAForm);
    
    // Step 8: Create simplified transcription
    const simplifiedTranscription = createFormattedTranscriptionText(processedTranscription.transcription);
    
    // Step 9: Call QA evaluation API
    const evaluationResult = await callQAEvaluationApi(
      simplifiedTranscription,
      instructions,
      interactionId
    );
    
    // Step 10: process evaluation response
	  const processedDocument = await processEvaluationResponse(
      evaluationResult,
      interactionId,
      qaForm._id,
      qaForm.name,
	    agent, 
      caller, 
      channel, 
      direction,
      duration,
      evaluator 
    );
    
    //console.log('processedDocument', processedDocument);
    
    // Step 11: insert into collection
    const aiqaDoc = await InteractionAIQA.create(processedDocument);
    
    console.log('InteractionAIQA Document Created');
	
    const interactionObjectId = mongoose.Types.ObjectId.isValid(interactionId) 
      ? new mongoose.Types.ObjectId(interactionId) 
      : interactionId;

    // Mark the interaction as evaluated
    await Interactions.updateOne(
      { _id: interactionObjectId },
      { 
        $set: { 
          "extraPayload.evaluated": true,
          "extraPayload.evaluationId": aiqaDoc._id.toString() // Store the evaluation ID for linking
        } 
      }
    );

    return { success: true, qaForm: { 
      formId: qaForm._id, 
      formName: qaForm.name, 
      evaluationId: aiqaDoc._id.toString() 
    } };
    
  } catch (error) {
    console.error(`Error processing evaluation for interaction ${evaluation.interactionId}:`, error);
    return {
      success: false,
      interactionId: evaluation.interactionId,
      error: error.message
    };
  } finally {
    // Clean up all temporary files
    try {
      if (localFilePath) {
        await deleteLocalFile(localFilePath);
      }
      
      if (publicUrl) {
        await deleteFromPublicStorage(publicUrl, evaluation.interactionId);
      }
      
      if (transcriptionFilePath) {
        await deleteLocalFile(transcriptionFilePath);
      }
      
      if (transcriptionPublicUrl) {
        await deleteFromPublicStorage(transcriptionPublicUrl, evaluation.interactionId);
      }
    } catch (cleanupError) {
      console.error(`Error during cleanup: ${cleanupError.message}`);
      // Continue even if cleanup fails
    }
  }
};

const processEvaluationResponse = (apiResponse, interactionId, qaFormId, qaFormName, agent, caller, channel, direction, duration, evaluator) => {
  return new Promise(async (resolve, reject) => {
  try {
    // Validate the response has the expected structure
    if (!apiResponse.evaluation || typeof apiResponse.evaluation !== 'object') {
      throw new Error('Invalid evaluation response structure');
    }

    const qaForm = await QAForm.findById(qaFormId);
    if (!qaForm) {
      throw new Error('QA Form not found');
    }
    
    let totalMaxScore = 0;
    let totalScore = Number(apiResponse.evaluation.totalScore) || 0;
    
    // Get parameters from the response
    const responseParameters = apiResponse.evaluation.parameters || {}
    // For each parameter in the QA form
    qaForm.parameters.forEach(param => {
      const paramName = param.name;
      const paramMaxScore = param.maxScore;
      
      // Check if this parameter exists in the response and has a valid score
      if (responseParameters[paramName]) {
        const score = responseParameters[paramName].score;
        
        // Only add to maxScore if question is relevant (score is not -1)
        if (score !== -1) {
          totalMaxScore += paramMaxScore;
        }
      } else {
        // Parameter was in form but not in response, add to maxScore anyway
        totalMaxScore += paramMaxScore;
      }
    });

    // Create the structured document for MongoDB
    const qaDocument = {
      interactionId,
      qaFormName,
      qaFormId, 
      evaluator: evaluator || { id: 'system', name: 'AI System' },
      evaluationData: {
        usage: apiResponse.usage || {},
        evaluation: {
          parameters: apiResponse.evaluation.parameters || {},
          silencePeriods: Array.isArray(apiResponse.evaluation.silencePeriods) 
            ? apiResponse.evaluation.silencePeriods.map(period => ({
                fromTimeStamp: period.fromTimeStamp,
                toTimeStamp: period.toTimeStamp,
                silenceDuration: period.silenceDuration
              }))
            : [],
          summary: apiResponse.evaluation.summary || '',
          intent: Array.isArray(apiResponse.evaluation.intent) 
            ? apiResponse.evaluation.intent 
            : [],
          areasOfImprovements: Array.isArray(apiResponse.evaluation.areasOfImprovements) 
            ? apiResponse.evaluation.areasOfImprovements 
            : [],
            totalScore: Number(totalScore),
            maxScore: Number(totalMaxScore),
          whatTheAgentDidWell: Array.isArray(apiResponse.evaluation.whatTheAgentDidWell) 
            ? apiResponse.evaluation.whatTheAgentDidWell 
            : [], // Add this new field
          customerSentiment: Array.isArray(apiResponse.evaluation.customerSentiment) 
            ? apiResponse.evaluation.customerSentiment 
            : ['neutral'],
          agentSentiment: Array.isArray(apiResponse.evaluation.agentSentiment) 
            ? apiResponse.evaluation.agentSentiment 
            : ['neutral']
        }
      },
	    interactionData: {
        agent: agent || {},
        caller: caller || {},
        direction: direction || 0, // Default value
        channel: channel || 'call',     // Default value
        duration: duration || 0     // Default value
      },
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    resolve(qaDocument);
  } catch (error) {
    console.error('Error processing evaluation response:', error);
	resolve(false);
    throw error;
  }
  })
};

/**
 * Format QA form parameters into instructions
 * @param {Object} form - QA form data
 * @returns {string} Formatted instructions for AI evaluation
 */
function formatInstructions(form) {
  let instructions = `You are a quality analyst evaluating a call center interaction. Please evaluate the following transcription based on these criteria:\n\n`;
  
  // Process each parameter
  form.parameters.forEach((param, index) => {
    instructions += `Question ${index + 1}: ${param.label}\n`;
    instructions += `Evaluation Context: ${param.evaluationContext}\n`;
    instructions += `Scoring Type: ${param.scoringType}\n`;
    instructions += `Scoring Type Meaning: ${param.scoringType === 'binary' ? 
      `binary = either 0 or ${param.maxScore} (max score)` : 
      `variable = between 0 and ${param.maxScore} (max score)`}\n`;
    instructions += `If this question is not relevant to the call, mark it with a score of -1.\n\n`;
  });
  
  instructions += 'callSummary: Generate a comprehensive summary of the interaction based on the transcription. The summary should contain what the interaction was about, what the customer was asking and how the agent responded. or it could be an outbound call from the agent side and the agent might be calling to update on some problem or probing more about a problem or it can be a CSAT Call. IT SHOULD NOT INCLUDE praises about the agent or customer. but need summary of conversation only.';
  instructions += 'intents: the intents should be 1 to 2 words like complaint, sales call, CSAT call, service request, potential lead, feedback call etc';
  instructions += 'silencePeriods: analyse the silence periods in the call based on the timestamps available in the transcription and add it to the response, this indicates the unprofessional hold during the call';
  instructions += 'areasOfImprovement: find the areas Of Improvements from the transcription. the things the agent could have done better. It should be in an array';
  instructions += 'whatTheAgentDidWell: find the areas Of where the agent did well in the call from the transcription. It should be in an array';
  instructions += 'Please provide your evaluation with a score for each question, along with an explanation of your reasoning. Also include an overall assessment of the interaction.';
  instructions += process.env.AIQA_SAMPLE_RESPONSE;
  
  return instructions;
}

/**
 * Create text-based formatted transcription for QA evaluation
 * @param {Array} transcription - Full transcription data
 * @returns {string} Formatted transcription as text
 */
function createFormattedTranscriptionText(transcription) {
  // Sort transcription entries by timestamp
  const sortedEntries = [...transcription].sort((a, b) => {
    const keyA = parseInt(Object.keys(a)[0]);
    const keyB = parseInt(Object.keys(b)[0]);
    return keyA - keyB;
  });
  
  // Create formatted string
  let formattedText = '';
  
  sortedEntries.forEach(entry => {
    const timestamp = Object.keys(entry)[0];
    const data = entry[timestamp];
    
    formattedText += `timestamp: ${timestamp}, speaker_id: ${data.speaker_id}, text: ${data.translated_text || data.original_text}\r\n`;
  });
  
  return formattedText;
}

/**
 * Create simplified transcription for QA evaluation
 * @param {Array} transcription - Full transcription data
 * @returns {Array} Simplified transcription
 */
function createSimplifiedTranscription(transcription) {
  const qaTranscription = [];
  
  transcription.forEach(entry => {
    const timestamp = Object.keys(entry)[0];
    const data = entry[timestamp];
    
    qaTranscription.push({
      [timestamp]: {
        speaker_id: data.speaker_id,
        text: data.translated_text || data.original_text
      }
    });
  });
  
  // Sort by timestamp
  qaTranscription.sort((a, b) => {
    const keyA = parseInt(Object.keys(a)[0]);
    const keyB = parseInt(Object.keys(b)[0]);
    return keyA - keyB;
  });
  
  return qaTranscription;
}

/**
 * Save JSON to a file
 * @param {Object} data - Data to save
 * @param {string} filePath - Path to save file
 * @returns {Promise<void>}
 */
async function saveJsonToFile(data, filePath) {
  try {
    await writeFileAsync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(`File saved: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error(`Error saving file: ${error.message}`);
    throw error;
  }
}

/**
 * Call the QA evaluation API with transcription data and instructions
 * @param {Array} transcription - Simplified transcription data
 * @param {string} instructions - Evaluation instructions
 * @param {string} interactionId - Interaction ID for logging
 * @returns {Promise<Object>} API response
 */
async function callQAEvaluationApi(transcription, instructions, interactionId) {
  try {
    const qaEvaluationUrl = process.env.QAEVALUATION_URL || 'http://democc.contegris.com:60027/aiqa';
    
    const data = {
      instructions: instructions,
      transcription: transcription // Send the transcription directly as JSON
    };
    
    const response = await axios.post(qaEvaluationUrl, data, {
      headers: { 'Content-Type': 'application/json' },
      maxBodyLength: Infinity
    });
    
    console.log(`QA evaluation completed for interaction ${interactionId}`);
    return response.data;
  } catch (error) {
    console.error(`Error calling QA evaluation API for interaction ${interactionId}:`, error.message);
    throw error;
  }
}

module.exports = {
  processEvaluation,
  processTranscript,
  processTranscriptV2,
  getFormattedQAForm
};