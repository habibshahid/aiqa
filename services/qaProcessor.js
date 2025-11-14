// services/qaProcessor.js
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);
const { InteractionTranscription, QAForm, Interactions, InteractionAIQA } = require('../config/mongodb');
const { calculateEvaluationCost } = require('./costProcessor');
const mongoose = require('mongoose');
const { AssemblyAITranscriptionService, ASSEMBLYAI_MODELS } = require('./transcription-service-assemblyai');
const { OpenAITranscriptionService, OPENAI_MODELS } = require('./transcription-service-openai');
const { SonioxTranscriptionService, SONIOX_MODELS } = require('./transcription-service-soniox');

const TEXT_CHANNELS = ['whatsapp', 'fb_messenger', 'facebook', 'instagram_dm', 'chat', 'email', 'sms'];

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
    
    // FIXED: Configure options for HTTPS requests to bypass SSL verification for internal URLs
    const options = url.startsWith('https') ? {
      rejectUnauthorized: false  // Disable SSL certificate verification for self-signed/internal certificates
    } : {};
    
    return new Promise((resolve, reject) => {
      protocol.get(url, options, response => {
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
    console.error(`************* Error getting sentiment for text: ${text.substring(0, 30)}...`, error.message);
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

/**
 * Transcribe audio with provider fallback - respects TRANSCRIPTION_PROVIDER setting
 * Now includes Soniox support
 * All providers use sentiment API for translation (consistent behavior)
 */
async function transcribeAudioWithFallback(audioFilePath, agent, caller, interactionStartTime) {
  const preferredProvider = (process.env.TRANSCRIPTION_PROVIDER || 'assemblyai').toLowerCase();
  
  console.log(`\n=== Starting Transcription (Preferred Provider: ${preferredProvider}) ===\n`);
  console.log(`Audio file: ${audioFilePath}`);
  
  // Define provider order based on preference
  let providerOrder = [];
  
  switch (preferredProvider) {
    case 'soniox':
      providerOrder = ['soniox', 'assemblyai', 'openai', 'deepgram'];
      break;
    case 'openai':
      providerOrder = ['openai', 'soniox', 'assemblyai', 'deepgram'];
      break;
    case 'deepgram':
      providerOrder = ['deepgram', 'soniox', 'assemblyai', 'openai'];
      break;
    case 'assemblyai':
    default:
      providerOrder = ['soniox', 'assemblyai', 'openai', 'deepgram'];
      break;
  }
  
  console.log(`Provider fallback order: ${providerOrder.join(' → ')}`);
  
  // Try each provider in order
  for (const provider of providerOrder) {
    try {
      if (provider === 'soniox') {
        console.log('\n📍 Attempting transcription with Soniox...');
        const result = await trySoniox(audioFilePath, agent, caller, interactionStartTime);
        if (result) return result;
      } else if (provider === 'assemblyai') {
        console.log('\n📍 Attempting transcription with AssemblyAI...');
        const result = await tryAssemblyAI(audioFilePath, agent, caller, interactionStartTime);
        if (result) return result;
      } else if (provider === 'openai') {
        console.log('\n📍 Attempting transcription with OpenAI...');
        const result = await tryOpenAI(audioFilePath, agent, caller, interactionStartTime);
        if (result) return result;
      } else if (provider === 'deepgram') {
        console.log('\n📍 Attempting transcription with Deepgram...');
        const result = await tryDeepgram(audioFilePath, agent, caller, interactionStartTime);
        if (result) return result;
      }
    } catch (error) {
      console.error(`❌ ${provider} failed:`, error.message);
      // Continue to next provider
    }
  }
  
  // If all providers failed
  throw new Error('All transcription providers failed');
}

/**
 * Try AssemblyAI transcription - WITHOUT built-in translation
 * Translation handled by sentiment API (same as OpenAI/Deepgram)
 */
async function tryAssemblyAI(audioFilePath, agent, caller, interactionStartTime) {
  try {
    const assemblyAI = new AssemblyAITranscriptionService();
    
    // Transcribe WITHOUT translation - sentiment API will handle it
    const result = await assemblyAI.transcribe(audioFilePath, {
      model: process.env.ASSEMBLYAI_MODEL || ASSEMBLYAI_MODELS.UNIVERSAL,
      language_detection: true,
      punctuate: true,
      format_text: true,
      // NO speech_understanding - translation via sentiment API
      cleanup: true
    });
    
    if (!result.success) {
      throw new Error(result.error || 'AssemblyAI transcription failed');
    }
    
    console.log('✅ AssemblyAI transcription successful');
    
    // Convert AssemblyAI format to our application format
    const processedTranscript = await convertAssemblyAIToAppFormat(
      result, 
      agent, 
      caller, 
      interactionStartTime
    );
    
    return {
      success: true,
      provider: 'assemblyai',
      model: result.model,
      transcript: processedTranscript,
      metadata: {
        provider: 'assemblyai',
        model: result.model,
        audioType: result.audioType,
        duration: result.duration,
        language: result.language,
        confidence: result.confidence || result.agentConfidence,
        transcribedAt: new Date()
      }
    };
  } catch (error) {
    console.error('AssemblyAI error:', error.message);
    return null; // Return null to try next provider
  }
}

/**
 * Try OpenAI transcription
 */
async function tryOpenAI(audioFilePath, agent, caller, interactionStartTime) {
  try {
    const openAI = new OpenAITranscriptionService();
    
    const result = await openAI.transcribe(audioFilePath, {
      model: process.env.OPENAI_WHISPER_MODEL || OPENAI_MODELS.WHISPER,
      language: 'hi',
      temperature: 0,
      cleanup: true
    });
    
    if (!result.success) {
      throw new Error(result.error || 'OpenAI transcription failed');
    }
    
    console.log('✅ OpenAI transcription successful');
    
    // Convert OpenAI format to our application format
    const processedTranscript = await convertOpenAIToAppFormat(
      result, 
      agent, 
      caller, 
      interactionStartTime
    );
    
    return {
      success: true,
      provider: 'openai',
      model: result.model,
      transcript: processedTranscript,
      metadata: {
        provider: 'openai',
        model: result.model,
        audioType: result.audioType,
        duration: result.duration,
        language: result.language,
        transcribedAt: new Date()
      }
    };
  } catch (error) {
    console.error('OpenAI error:', error.message);
    return null; // Return null to try next provider
  }
}

/**
 * Try Deepgram transcription
 */
async function tryDeepgram(audioFilePath, agent, caller, interactionStartTime) {
  try {
    // Need to upload to public storage for Deepgram
    const publicUrl = await uploadToPublicStorage(audioFilePath, 'temp-' + Date.now());
    
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    
    if (!deepgramApiKey) {
      throw new Error('Deepgram API key not configured');
    }
    
    const deepgramResponse = await axios.post(
      'https://api.deepgram.com/v1/listen',
      { url: publicUrl },
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
    
    console.log('✅ Deepgram transcription successful');
    
    // Process with existing Deepgram logic
    const processedTranscript = await processTranscriptV2(
      deepgramResponse.data, 
      agent, 
      caller,
      interactionStartTime
    );
    
    // Clean up public URL
    try {
      await deleteFromPublicStorage(publicUrl, 'temp-cleanup');
    } catch (cleanupError) {
      console.warn('Failed to cleanup Deepgram public URL:', cleanupError.message);
    }
    
    return {
      success: true,
      provider: 'deepgram',
      model: 'nova-2',
      transcript: processedTranscript,
      metadata: {
        provider: 'deepgram',
        model: 'nova-2',
        duration: deepgramResponse.data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.length || 0,
        language: 'hi-latn',
        transcribedAt: new Date()
      }
    };
  } catch (error) {
    console.error('Deepgram error:', error.message);
    return null; // Return null to indicate failure
  }
}


/**
 * Convert AssemblyAI response to application format - WITHOUT built-in translation
 * Uses sentiment API for translation (same as OpenAI/Deepgram)
 * @param {Object} assemblyAIResult - AssemblyAI transcription result
 * @param {Object} agent - Agent information
 * @param {Object} caller - Caller information
 * @param {Date} interactionStartTime - Interaction start time
 * @returns {Object} Processed transcript in application format
 */
async function convertAssemblyAIToAppFormat(assemblyAIResult, agent, caller, interactionStartTime) {
  const output = { transcription: [] };
  
  const agentId = agent?.id || "Agent";
  const agentName = agent?.name || "Agent";
  const callerId = caller?.id || "Customer";
  
  const agentSpeakerId = `agent_${agentName.replace(/\s+/g, '.')}`;
  const callerSpeakerId = `customer_${callerId}`;
  
  const baseTimestamp = interactionStartTime ? new Date(interactionStartTime).getTime() : Date.now();
  
  // AssemblyAI provides conversation array with speaker_id and original_text
  const conversation = assemblyAIResult.conversation || [];
  
  console.log(`Processing ${conversation.length} conversation segments from AssemblyAI...`);
  
  for (const segment of conversation) {
    // Calculate timestamp
    const timestamp = baseTimestamp + Math.round(segment.timestamp * 1000);
    
    // Map speaker_id: 'agent' or 'customer' from AssemblyAI
    const speaker_id = segment.speaker_id === 'agent' ? agentSpeakerId : callerSpeakerId;
    
    // Use sentiment API for translation (same as OpenAI/Deepgram)
    const sentimentAnalysis = await getSentiment(segment.original_text);
	
    const entry = {
      [timestamp.toString()]: {
        speaker_id: speaker_id,
        original_text: segment.original_text,
        // Translation from sentiment API (not from AssemblyAI)
        translated_text: sentimentAnalysis.translationInEnglish || sentimentAnalysis.tranlationInEnglish || segment.original_text,
        sentiment: sentimentAnalysis.sentiment || {
          sentiment: "neutral",
          score: 0.5
        },
        profanity: sentimentAnalysis.profanity || {
          words: [],
          score: 0
        },
        intent: sentimentAnalysis.intents || [],
        language: assemblyAIResult.language || "hi",
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
        port: 10000 + Math.floor(Math.random() * 10000),
        confidence: segment.confidence || 0.8
      }
    };
    
    output.transcription.push(entry);
  }
  
  console.log(`Converted ${output.transcription.length} segments to application format`);
  
  return output;
}

/**
 * Convert OpenAI response to application format
 * Uses sentiment API for translation
 * @param {Object} openAIResult - OpenAI transcription result
 * @param {Object} agent - Agent information
 * @param {Object} caller - Caller information
 * @param {Date} interactionStartTime - Interaction start time
 * @returns {Object} Processed transcript in application format
 */
async function convertOpenAIToAppFormat(openAIResult, agent, caller, interactionStartTime) {
  const output = { transcription: [] };
  
  const agentId = agent?.id || "Agent";
  const agentName = agent?.name || "Agent";
  const callerId = caller?.id || "Customer";
  
  const agentSpeakerId = `agent_${agentName.replace(/\s+/g, '.')}`;
  const callerSpeakerId = `customer_${callerId}`;
  
  const baseTimestamp = interactionStartTime ? new Date(interactionStartTime).getTime() : Date.now();
  
  // OpenAI provides conversation array with speaker_id and original_text
  const conversation = openAIResult.conversation || [];
  
  console.log(`Processing ${conversation.length} conversation segments from OpenAI...`);
  
  for (const segment of conversation) {
    // Calculate timestamp
    const timestamp = baseTimestamp + Math.round(segment.timestamp * 1000);
    
    // Map speaker_id
    let speaker_id;
    if (segment.speaker_id === 'agent') {
      speaker_id = agentSpeakerId;
    } else if (segment.speaker_id === 'customer') {
      speaker_id = callerSpeakerId;
    } else {
      // Unknown speaker - alternate based on index
      speaker_id = output.transcription.length % 2 === 0 ? agentSpeakerId : callerSpeakerId;
    }
    
    // Use sentiment API for translation
    const sentimentAnalysis = await getSentiment(segment.original_text);
    
    const entry = {
      [timestamp.toString()]: {
        speaker_id: speaker_id,
        original_text: segment.original_text,
        translated_text: sentimentAnalysis.translationInEnglish || segment.original_text,
        sentiment: sentimentAnalysis.sentiment || {
          sentiment: "neutral",
          score: 0.5
        },
        profanity: sentimentAnalysis.profanity || {
          words: [],
          score: 0
        },
        intent: sentimentAnalysis.intents || [],
        language: openAIResult.language || "hi",
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
  }
  
  console.log(`Converted ${output.transcription.length} segments to application format`);
  
  return output;
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
    
    if (!recordingUrl && evaluation.channel == 'call') {
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
    let queue = '';

    try {
      const interaction = await Interactions.findById(interactionId);
      const interactionData = interaction ? interaction.toObject ? interaction.toObject() : interaction : null;
      channel = interactionData.channel;
      direction = interactionData.direction;
      duration = interactionData.connect.duration || 0;
      interactionStartTime = interactionData?.connect?.startDtTime || new Date();
      queue = interactionData.queue?.name || '';
      
      if (interactionData) {
        channel = interactionData.channel || 'call';
        direction = interactionData.direction || 0;
        duration = interactionData.connect?.duration || 0;
        interactionStartTime = interactionData?.connect?.startDtTime || new Date();
        queue = interactionData.queue?.name || '';
        
        console.log(`\n=== QA Processor: Processing interaction ${interactionId} ===`);
        console.log(`Channel: ${channel}`);
        console.log(`Direction: ${direction}`);
        console.log(`Duration: ${duration}`);
        console.log(`Queue: ${queue}`);
      }
    } catch (error) {
      console.warn(`Could not find interaction start time: ${error.message}`);
      interactionStartTime = new Date();
    }
    
    if (TEXT_CHANNELS.includes(channel)) {
      console.log(`\n=== Routing to Message Processor for channel: ${channel} ===`);
      // Create proper evaluation object for text processor
      const textEvaluation = {
        interactionId,
        qaFormId,
        evaluator,
        agent,
        caller,
        channel,
        direction,
        duration,
        queue,
        processingType: 'text',  // Set correct processing type
        isTextChannel: true     // Add this flag
      };
      // Route to text/message processor
      const { processTextInteraction } = require('./messageProcessor');
      const result = await processTextInteraction(textEvaluation);
      
      if (result.success) {
        console.log(`\n=== Successfully processed text interaction ${interactionId} ===`);
        return {
          success: true,
          interactionId,
          evaluationId: result.evaluationId,
          processingType: 'text',
          channel: channel,
          messageCount: result.messageCount
        };
      } else {
        console.error(`\n=== Failed to process text interaction ${interactionId} ===`);
        return {
          success: false,
          interactionId,
          error: result.error,
          processingType: 'text',  // Return correct processing type even on failure
          channel: channel
        };
      }
    } 
    else {
      // Step 1: Download the recording file locally
      console.log(`Processing recording for interaction: ${interactionId}`);
      localFilePath = await downloadRecording(recordingUrl, interactionId);
      
      // Step 2: Upload to democc for public access
      //publicUrl = await uploadToPublicStorage(localFilePath, interactionId);
      
      // Step 3: Process with Deepgram
      console.log(`Transcribing audio file: ${localFilePath}`);

      const transcriptionResult = await transcribeAudioWithFallback(
        localFilePath,
        agent,
        caller,
        interactionStartTime
      );

      if (!transcriptionResult.success) {
        throw new Error('Transcription failed with all providers');
      }

      console.log(`✅ Transcription successful using ${transcriptionResult.provider}`);

      // Step 4: Use the processed transcription
      const processedTranscription = transcriptionResult.transcript;
      
      // Step 5: Save to database
      const transcriptionDoc = {
        interactionId,
        transcriptionVersion: 'recorded',
        transcription: processedTranscription.transcription,
        transcriptionMetadata: {
          provider: transcriptionResult.provider,
          model: transcriptionResult.model,
          audioType: transcriptionResult.metadata?.audioType,
          duration: transcriptionResult.metadata?.duration,
          language: transcriptionResult.metadata?.language,
          confidence: transcriptionResult.metadata?.confidence,
          transcribedAt: transcriptionResult.metadata?.transcribedAt || new Date()
        }
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
              transcription: processedTranscription.transcription,
              transcriptionMetadata: transcriptionDoc.transcriptionMetadata
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
          scoringType: param.scoringType,
          classification: param.classification
        })),
        classifications: qaForm.classifications 
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
        evaluator,
        queue
      );
      
      //console.log('processedDocument', processedDocument);
      
      // Step 11: insert into collection
      const aiqaDoc = await InteractionAIQA.create(processedDocument);
      console.log('InteractionAIQA Document Created with ID:', aiqaDoc._id);
      console.log('Total Score:', aiqaDoc.evaluationData.evaluation.totalScore);
      console.log('Max Score:', aiqaDoc.evaluationData.evaluation.maxScore);
      
      updateEvaluationForClassification(evaluationResult, aiqaDoc, qaFormId);
      
      try {
        // Calculate and save cost data
        await calculateEvaluationCost(aiqaDoc._id);
        console.log('Cost data calculated and saved for evaluation:', aiqaDoc._id);
      } catch (costError) {
        console.error('Error calculating cost data:', costError);
        // Continue without cost data if calculation fails
      }

      const interactionObjectId = mongoose.Types.ObjectId.isValid(interactionId) 
        ? new mongoose.Types.ObjectId(interactionId) 
        : interactionId;

      // Mark the interaction as evaluated
      await Interactions.updateOne(
        { _id: interactionObjectId },
        { 
          $set: { 
            "extraPayload.evaluated": true,
            "extraPayload.evaluationId": aiqaDoc['_id'].toString() // Store the evaluation ID for linking
          } 
        }
      );

      return { 
        success: true, 
        qaForm: { 
          formId: qaForm._id, 
          formName: qaForm.name, 
          evaluationId: aiqaDoc._id.toString() 
        },
        scores: {
          totalScore: aiqaDoc.evaluationData.evaluation.totalScore,
          maxScore: aiqaDoc.evaluationData.evaluation.maxScore,
          percentage: aiqaDoc.sectionScores?.overall?.percentage || 0
        }
      };
    }
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

const updateEvaluationForClassification = async (evaluationResult, aiqaDoc, qaFormId) => {
  try {
    console.log('Applying classification impacts directly...');
    const qaForm = await QAForm.findById(qaFormId);
    // Create moderation data structure
    const moderationData = {
      parameters: {},
      isModerated: true,
      isPublished: false  // Don't publish automatically
    };
    
    // Extract parameters with their classifications from evaluation result
    if (evaluationResult.evaluation && evaluationResult.evaluation.parameters) {
      Object.entries(evaluationResult.evaluation.parameters).forEach(([name, data]) => {
        // Skip invalid entries
        if (!data) return;
        
        moderationData.parameters[name] = {
          score: data.score,
          explanation: data.explanation || '',
          humanScore: data.score,  // Use AI score as human score initially
          classification: data.classification || 'none'
        };
      });
    }
    
    // Calculate scores based on classifications using the scoring service
    const { calculateEvaluationScores } = require('../services/scoringService');
    
    // Create temporary document with necessary properties for scoring
    const tempDoc = {
      qaFormId: qaForm._id,
      humanEvaluation: {
        parameters: moderationData.parameters
      }
    };
    
    // Calculate the scores with classification impacts
    const calculatedScores = await calculateEvaluationScores(tempDoc, qaForm._id);
    console.log('Calculated scores with classification impacts:', 
      JSON.stringify(calculatedScores.overall, null, 2));
    
    // Update the document directly with the new scores and moderation data
    const updatedDoc = await InteractionAIQA.findByIdAndUpdate(
      aiqaDoc._id,
      {
        $set: {
          'evaluationData.evaluation.totalScore': calculatedScores.overall.adjustedScore,
          'evaluationData.evaluation.maxScore': calculatedScores.overall.maxScore,
          'sectionScores': calculatedScores,
          'humanEvaluation': {
            parameters: moderationData.parameters,
            additionalComments: '',
            agentComments: '',
            isModerated: true,
            isPublished: false,
            moderatedBy: 'System',
            moderatedByUserId: '1',
            moderatedAt: new Date()
          },
          'status': 'moderated'
        }
      },
      { new: true }
    );
    
    console.log('Classification impacts applied successfully');
    console.log('Updated total score:', updatedDoc.evaluationData.evaluation.totalScore);   
    return true; 
  } catch (moderationError) {
    console.error('Error applying classification impacts:', moderationError);
    // Continue without classification impacts if the call fails
    return false;
  }
}

/**
 * Calculate group scores for the evaluation
 * @param {Object} qaForm - The QA form
 * @param {Object} parameters - Evaluation parameters
 */
const calculateGroupScores = (qaForm, parameters) => {
  const result = {
    sections: {},
    overall: { rawScore: 0, adjustedScore: 0, maxScore: 0, percentage: 0 }
  };
  
  // Initialize sections based on groups in QA form
  if (qaForm.groups && Array.isArray(qaForm.groups)) {
    qaForm.groups.forEach(group => {
      result.sections[group.id] = {
        name: group.name,
        rawScore: 0,
        maxScore: 0,
        adjustedScore: 0,
        percentage: 0,
        parameters: [],
        classifications: {
          minor: false,
          moderate: false,
          major: false
        },
        highestClassification: null,
        highestClassificationImpact: 0
      };
    });
  } else {
    // Default group if none exists
    result.sections.default = {
      name: "Default Group",
      rawScore: 0,
      maxScore: 0,
      adjustedScore: 0,
      percentage: 0,
      parameters: [],
      classifications: {
        minor: false,
        moderate: false,
        major: false
      },
      highestClassification: null,
      highestClassificationImpact: 0
    };
  }
  
  // Process parameters
  let totalRawScore = 0;
  let totalMaxScore = 0;
  
  Object.entries(parameters).forEach(([paramName, paramData]) => {
    // Skip N/A scores
    if (paramData.score === -1) return;
    
    // Find parameter definition in QA form
    const paramDef = qaForm.parameters.find(p => p.name === paramName);
    if (!paramDef) return;
    
    // Get group and max score
    const groupId = paramDef.group || 'default';
    const maxScore = paramDef.maxScore || 5;
    
    // Get section for this group
    const section = result.sections[groupId] || result.sections.default;
    
    // Add parameter to section
    section.parameters.push({
      name: paramName,
      score: paramData.score || 0,
      maxScore: maxScore,
      classification: paramDef.classification || 'none'
    });
    
    // Update section scores
    section.rawScore += paramData.score || 0;
    section.maxScore += maxScore;
    
    // Update overall totals
    totalRawScore += paramData.score || 0;
    totalMaxScore += maxScore;
  });
  
  // Calculate percentages and adjusted scores (no classification impacts for now)
  Object.values(result.sections).forEach(section => {
    if (section.maxScore > 0) {
      section.adjustedScore = section.rawScore; // No classification impact for now
      section.percentage = Math.round((section.adjustedScore / section.maxScore) * 100);
    }
  });
  
  // Calculate overall scores
  result.overall.rawScore = totalRawScore;
  result.overall.adjustedScore = totalRawScore; // No classification impact for now
  result.overall.maxScore = totalMaxScore;
  if (totalMaxScore > 0) {
    result.overall.percentage = Math.round((totalRawScore / totalMaxScore) * 100);
  }
  
  return result;
};

const calculateTotalScore = (groupScores) => {
  return Object.values(groupScores).reduce((total, group) => total + group.adjustedScore, 0);
};

/**
 * Calculate scores based on parameters with proper scoring type handling
 * @param {Object} parameters - Evaluation parameters
 * @param {Object} qaForm - QA form with parameter definitions
 * @returns {Object} Raw score, max score, and percentage
 */
const calculateScoresWithTypes = (parameters, qaForm) => {
  let rawScore = 0;
  let maxScore = 0;
  let validParams = 0;

  // Process each parameter
  Object.entries(parameters).forEach(([paramName, paramData]) => {
    // Skip N/A parameters
    if (paramData.score === -1) {
      console.log(`Parameter ${paramName} has N/A score, skipping`);
      return;
    }
    
    // Find parameter definition in QA form
    const paramDef = qaForm.parameters.find(p => p.name === paramName);
    if (!paramDef) {
      console.log(`Parameter ${paramName} not found in QA form, using defaults`);
      rawScore += paramData.score || 0;
      maxScore += 5; // Default
      validParams++;
      return;
    }
    
    // Get max score from definition
    const paramMaxScore = paramDef.maxScore || 5;
    
    // Handle different scoring types
    let finalScore = paramData.score || 0;
    
    // For binary scoring type, only 0 or maxScore is valid
    if (paramDef.scoringType === 'binary') {
      // Round to nearest valid value (0 or maxScore)
      finalScore = finalScore > (paramMaxScore / 2) ? paramMaxScore : 0;
      console.log(`Binary parameter ${paramName}: Adjusted score from ${paramData.score} to ${finalScore}`);
    } 
    // For variable scoring type, any value from 0 to maxScore is valid
    else {
      // Ensure the score doesn't exceed maxScore
      finalScore = Math.min(finalScore, paramMaxScore);
      console.log(`Variable parameter ${paramName}: Score ${finalScore}/${paramMaxScore}`);
    }
    
    // Add to totals
    rawScore += finalScore;
    maxScore += paramMaxScore;
    validParams++;
  });

  // Calculate percentage
  const percentage = maxScore > 0 ? Math.round((rawScore / maxScore) * 100) : 0;
  
  console.log(`Calculated scores: ${rawScore}/${maxScore} (${percentage}%, ${validParams} valid parameters)`);
  
  return { rawScore, maxScore, percentage, validParams };
};

/**
 * Process evaluation response with proper scoring type handling
 */
const processEvaluationResponse = async (apiResponse, interactionId, qaFormId, qaFormName, agent, caller, channel, direction, duration, evaluator, queue) => {
  try {
    // Load the QA form to properly calculate scores
    const qaForm = await QAForm.findById(qaFormId);
    if (!qaForm) {
      throw new Error('QA Form not found');
    }

    // Ensure parameters exist
    const parameters = apiResponse.evaluation.parameters || {};

    // Calculate scores with proper scoring type handling
    const { 
      rawScore, 
      maxScore, 
      percentage, 
      scoringMechanism, 
      totalDeductions,
      deductionDetails 
    } = calculateScoresWithTypes(parameters, qaForm);

    // Prepare the QA document
    const qaDocument = {
      interactionId,
      qaFormName,
      qaFormId, 
      evaluator: evaluator || { id: 'system', name: 'AI System' },
      scoringMechanism: qaForm.scoringMechanism || 'award',
      formTotalScore: qaForm.totalScore || maxScore,
      evaluationData: {
        usage: apiResponse.usage || {},
        evaluation: {
          parameters,
          // Set scores correctly
          totalScore: rawScore,
          maxScore: maxScore,
          scoringMechanism: qaForm.scoringMechanism || 'award',
          totalDeductions: totalDeductions,
          deductionDetails: deductionDetails,
          // Include other evaluation details
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
          whatTheAgentDidWell: Array.isArray(apiResponse.evaluation.whatTheAgentDidWell) 
            ? apiResponse.evaluation.whatTheAgentDidWell 
            : [],
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
        direction: direction || 0,
        channel: channel || 'call',
        duration: duration || 0,
        queue: {name: queue || 'unknown'}
      },
      status: 'completed',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Initialize sectionScores with default group
    qaDocument.sectionScores = {
      sections: {},
      overall: {
        rawScore: rawScore,
        adjustedScore: rawScore,
        maxScore: maxScore,
        percentage: percentage,
        scoringMechanism: scoringMechanism,
        totalDeductions: totalDeductions
      }
    };
    
    // Group parameters by their group
    const groupedParameters = {};
    
    // Process each parameter
    Object.entries(parameters).forEach(([paramName, paramData]) => {
      // Skip N/A parameters
      if (paramData.score === -1) return;
      
      // Find parameter definition in QA form
      const paramDef = qaForm.parameters.find(p => p.name === paramName);
      if (!paramDef) return;
      
      // Get group and max score
      const groupId = paramDef.group || 'default';
      const paramMaxScore = paramDef.maxScore || 5;
      
      // Initialize group if not exists
      if (!groupedParameters[groupId]) {
        groupedParameters[groupId] = {
          name: qaForm.groups.find(g => g.id === groupId)?.name || 'Default Group',
          parameters: [],
          rawScore: 0,
          maxScore: 0
        };
      }
      
      // Calculate final score based on scoring type
      let finalScore = paramData.score || 0;
      if (paramDef.scoringType === 'binary') {
        finalScore = finalScore > (paramMaxScore / 2) ? paramMaxScore : 0;
      } else {
        finalScore = Math.min(finalScore, paramMaxScore);
      }
      
      // Add parameter to group
      groupedParameters[groupId].parameters.push({
        name: paramName,
        score: finalScore,
        maxScore: paramMaxScore,
        classification: paramDef.classification || 'none'
      });
      
      // Update group totals
      groupedParameters[groupId].rawScore += finalScore;
      groupedParameters[groupId].maxScore += paramMaxScore;
    });
    
    // Create section scores from grouped parameters
    Object.entries(groupedParameters).forEach(([groupId, groupData]) => {
      qaDocument.sectionScores.sections[groupId] = {
        name: groupData.name,
        rawScore: groupData.rawScore,
        maxScore: groupData.maxScore,
        adjustedScore: groupData.rawScore, // No classification impact for new evaluations
        percentage: groupData.maxScore > 0 ? Math.round((groupData.rawScore / groupData.maxScore) * 100) : 0,
        parameters: groupData.parameters,
        classifications: {
          minor: false,
          moderate: false,
          major: false
        },
        highestClassification: null,
        highestClassificationImpact: 0
      };
    });
    
    // If no groups created, use a default group
    if (Object.keys(qaDocument.sectionScores.sections).length === 0) {
      qaDocument.sectionScores.sections.default = {
        name: "Default Group",
        rawScore: rawScore,
        maxScore: maxScore,
        adjustedScore: rawScore,
        percentage: percentage,
        parameters: [],
        classifications: {
          minor: false,
          moderate: false,
          major: false
        },
        highestClassification: null,
        highestClassificationImpact: 0
      };
    }

    console.log('Processed QA Document:');
    console.log('Total Score:', qaDocument.evaluationData.evaluation.totalScore);
    console.log('Max Score:', qaDocument.evaluationData.evaluation.maxScore);
    console.log('Section Scores:', Object.keys(qaDocument.sectionScores.sections).length, 'sections');

    return qaDocument;
  } catch (error) {
    console.error('Error processing evaluation response:', error);
    throw error;
  }
};

/**
 * Format QA form parameters into instructions
 * @param {Object} form - QA form data
 * @returns {string} Formatted instructions for AI evaluation
 */
function formatInstructions(form) {
  let instructions = `You are a quality analyst evaluating a call center interaction. Please evaluate the following transcription based on these criteria:\n\n`;
  
  const parametersByGroup = {};
  form.parameters.forEach(param => {
    if (!parametersByGroup[param.group]) {
      parametersByGroup[param.group] = [];
    }
    parametersByGroup[param.group].push(param);
  });
  
  // Find group names
  const groupMap = {};
  if (form.groups && form.groups.length > 0) {
    form.groups.forEach(group => {
      groupMap[group.id] = group.name;
    });
  }
  
  // Process each group and its parameters
  Object.entries(parametersByGroup).forEach(([groupId, parameters], groupIndex) => {
    const groupName = groupMap[groupId] || 'Unknown Group';
    instructions += `Group ${groupIndex + 1}: ${groupName}\n`;
    
    // Process parameters in this group
    parameters.forEach((param, paramIndex) => {
      instructions += `Question ${paramIndex + 1}: ${param.label}\n`;
      instructions += `Classification: ${param.classification.toUpperCase()}\n`;
      instructions += `Evaluation Context: ${param.evaluationContext}\n`;
      instructions += `Scoring Type: ${param.scoringType}\n`;
      instructions += `Scoring Type Meaning: ${param.scoringType === 'binary' ? 
        `binary = either 0 or ${param.maxScore} (max score)` : 
        `variable = between 0 and ${param.maxScore} (max score)`}\n`;
      instructions += `If this question is not relevant to the call, mark it with a score of -1.\n\n`;
    });
  });
  
  instructions += 'callSummary: Generate a comprehensive summary of the interaction based on the transcription. The summary should contain what the interaction was about, what the customer was asking and how the agent responded. or it could be an outbound call from the agent side and the agent might be calling to update on some problem or probing more about a problem or it can be a CSAT Call. IT SHOULD NOT INCLUDE praises about the agent or customer. but need summary of conversation only.';
  instructions += 'intents: the intents should be 1 to 2 words like complaint, sales call, CSAT call, service request, potential lead, feedback call etc';
  instructions += 'silencePeriods: analyse the silence periods in the call based on the timestamps available in the transcription and add it to the response, this indicates the unprofessional hold during the call';
  instructions += 'areasOfImprovement: find the areas Of Improvements from the transcription. the things the agent could have done better. It should be in an array';
  instructions += 'whatTheAgentDidWell: find the areas Of where the agent did well in the call from the transcription. It should be in an array';
  instructions += 'Please provide your evaluation with a score for each question, along with an explanation of your reasoning. Also include an overall assessment of the interaction.';
  
  // Additional instructions for handling question classifications
  instructions += '\nassign a classification tag to the question response. The classification tags are none, minor, moderate, major. If the instructions have none then do not apply any classification';
  instructions += '\nwhen returning the response do not include the text Question in parameter name, just the label name';
  
  instructions += process.env.AIQA_SAMPLE_RESPONSE;
  
  //console.log('Formatted Instructions:', instructions);
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

/**
 * Try Soniox transcription - CORRECTED speaker labeling
 * Soniox uses STRING speaker IDs: '1', '2', '3' etc.
 * Translation handled by sentiment API (same as other providers)
 */
async function trySoniox(audioFilePath, agent, caller, interactionStartTime) {
  let fileId = null;
  let transcriptionId = null;

  try {
    const soniox = new SonioxTranscriptionService();
    
    console.log('Uploading audio to Soniox...');
    const duration = await soniox.getAudioDuration(audioFilePath);
    console.log(`Duration: ${duration.toFixed(2)}s`);
    
    // Step 1: Upload the audio file
    fileId = await soniox.uploadAudio(audioFilePath);
    
    // Step 2: Create transcription config
    const config = {
      model: process.env.SONIOX_MODEL || SONIOX_MODELS.ASYNC_V3,
      file_id: fileId,
      
      // Language hints: English, Hindi, Urdu
      language_hints: ['en', 'hi', 'ur'],
      enable_language_identification: true,
      
      // Speaker diarization
      enable_speaker_diarization: true,
      
      // Optional: Add context for better accuracy
      context: {
        terms: ['AIVA', 'Intellicon', 'Contegris']
      }
    };
    
    // Step 3: Create transcription job
    transcriptionId = await soniox.createTranscription(config);
    
    // Step 4: Wait for completion
    await soniox.waitForCompletion(transcriptionId);
    
    // Step 5: Get results
    console.log('Fetching transcription results...');
    const result = await soniox.getTranscriptionResult(transcriptionId);
    
    if (!result || !result.tokens || result.tokens.length === 0) {
      throw new Error('No transcription results returned');
    }
    
    console.log('✅ Soniox transcription successful');
    
    // Step 6: Process tokens into conversation segments (CORRECTED speaker mapping)
    const conversation = buildConversationFromTokens(result.tokens);
    
    // Step 7: Convert to our application format
    const processedTranscript = await convertSonioxToAppFormat(
      {
        conversation: conversation,
        duration: duration,
        language: result.language || 'en'
      },
      agent,
      caller,
      interactionStartTime
    );
    
    // Step 8: Cleanup
    console.log('Cleaning up Soniox resources...');
    await soniox.deleteTranscription(transcriptionId);
    await soniox.deleteFile(fileId);
    
    return {
      success: true,
      provider: 'soniox',
      model: config.model,
      transcript: processedTranscript,
      metadata: {
        provider: 'soniox',
        model: config.model,
        audioType: 'auto-detected',
        duration: duration,
        language: result.language || 'en',
        transcribedAt: new Date()
      }
    };
    
  } catch (error) {
    console.error('Soniox error:', error.message);
    
    // Cleanup on error
    if (transcriptionId) {
      try {
        const soniox = new SonioxTranscriptionService();
        await soniox.deleteTranscription(transcriptionId);
      } catch (cleanupError) {
        console.warn('Failed to cleanup transcription:', cleanupError.message);
      }
    }
    
    if (fileId) {
      try {
        const soniox = new SonioxTranscriptionService();
        await soniox.deleteFile(fileId);
      } catch (cleanupError) {
        console.warn('Failed to cleanup file:', cleanupError.message);
      }
    }
    
    return null;
  }
}

/**
 * Build conversation segments from Soniox tokens - CORRECTED
 * Groups tokens by speaker and sentence boundaries
 * 
 * IMPORTANT: Soniox speaker IDs are STRINGS: '1', '2', '3', etc.
 * Mapping: '1' → agent, '2' → customer
 * 
 * @param {Array} tokens - Soniox token array
 * @returns {Array} Conversation segments
 */
function buildConversationFromTokens(tokens) {
  const conversation = [];
  let currentSpeaker = null;
  let currentText = '';
  let currentStart = 0;
  let currentEnd = 0;
  let currentLanguage = null;

  tokens.forEach((token) => {
    // CRITICAL: Speaker is a STRING: '1', '2', '3', etc. (not number)
    const speaker = token.speaker || '1';
    
    // Check if we should start a new segment:
    // 1. Speaker changed
    // 2. End of sentence (punctuation)
    const speakerChanged = speaker !== currentSpeaker;
    const endOfSentence = token.text.match(/[.!?]$/);
    
    if (speakerChanged || (endOfSentence && currentText)) {
      // Save previous segment
      if (currentText) {
        // Map speaker STRING '1' to 'agent', '2' to 'customer'
        const speakerId = currentSpeaker === '1' ? 'agent' : 'customer';
        
        conversation.push({
          timestamp: currentStart,
          speaker_id: speakerId,
          speaker_number: currentSpeaker, // Keep original for reference
          original_text: currentText.trim(),
          end_time: currentEnd,
          duration: currentEnd - currentStart,
          segment_id: `${speakerId}_${conversation.length}`,
          language: currentLanguage
        });
      }
      
      // Start new segment
      currentSpeaker = speaker;
      currentText = token.text;
      currentStart = token.start_ms / 1000;
      currentEnd = token.end_ms / 1000;
      currentLanguage = token.language || 'en';
    } else {
      // Continue current segment
      currentText += token.text;
      currentEnd = token.end_ms / 1000;
      if (token.language) {
        currentLanguage = token.language;
      }
    }
  });

  // Add final segment
  if (currentText) {
    // Map speaker STRING '1' to 'agent', '2' to 'customer'
    const speakerId = currentSpeaker === '1' ? 'agent' : 'customer';
    
    conversation.push({
      timestamp: currentStart,
      speaker_id: speakerId,
      speaker_number: currentSpeaker, // Keep original for reference
      original_text: currentText.trim(),
      end_time: currentEnd,
      duration: currentEnd - currentStart,
      segment_id: `${speakerId}_${conversation.length}`,
      language: currentLanguage
    });
  }

  return conversation;
}

/**
 * Convert Soniox response to application format
 * Uses sentiment API for translation (same as other providers)
 */
async function convertSonioxToAppFormat(sonioxResult, agent, caller, interactionStartTime) {
  const output = { transcription: [] };
  
  const agentId = agent?.id || "Agent";
  const agentName = agent?.name || "Agent";
  const callerId = caller?.id || "Customer";
  
  const agentSpeakerId = `agent_${agentName.replace(/\s+/g, '.')}`;
  const callerSpeakerId = `customer_${callerId}`;
  
  const baseTimestamp = interactionStartTime ? new Date(interactionStartTime).getTime() : Date.now();
  
  const conversation = sonioxResult.conversation || [];
  
  console.log(`Processing ${conversation.length} conversation segments from Soniox...`);
  
  for (const segment of conversation) {
    const timestamp = baseTimestamp + Math.round(segment.timestamp * 1000);
    const speaker_id = segment.speaker_id === 'agent' ? agentSpeakerId : callerSpeakerId;
    
    // Use sentiment API for translation
    const sentimentAnalysis = await getSentiment(segment.original_text);
    
    const entry = {
      [timestamp.toString()]: {
        speaker_id: speaker_id,
        original_text: segment.original_text,
        translated_text: sentimentAnalysis.translationInEnglish || segment.original_text,
        sentiment: sentimentAnalysis.sentiment || {
          sentiment: "neutral",
          score: 0.5
        },
        profanity: sentimentAnalysis.profanity || {
          words: [],
          score: 0
        },
        intent: sentimentAnalysis.intents || [],
        language: segment.language || sonioxResult.language || "en",
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
  }
  
  console.log(`Converted ${output.transcription.length} segments to application format`);
  
  return output;
}

module.exports = {
  processEvaluationResponse,
  updateEvaluationForClassification,
  processEvaluation,
  processTranscript,
  processTranscriptV2,
  getFormattedQAForm,
  calculateGroupScores,
  calculateTotalScore
};