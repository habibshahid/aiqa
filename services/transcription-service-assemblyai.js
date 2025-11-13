// transcription-service-assemblyai.js
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// API configuration
const ASSEMBLYAI_API_URL = 'https://api.assemblyai.com/v2';

// Available AssemblyAI models
const ASSEMBLYAI_MODELS = {
  UNIVERSAL: 'universal',    // $0.0025/min - Best balance
  NANO: 'nano'          // Fastest, lower accuracy
};

class AssemblyAITranscriptionService {
  
  constructor(apiKey = process.env.ASSEMBLYAI_API_KEY) {
    this.apiKey = apiKey;
    if (!this.apiKey) {
      throw new Error('AssemblyAI API key is required');
    }
  }

  /**
   * Detect number of audio channels
   */
  async detectAudioChannels(audioPath) {
    try {
      const { stdout } = await execAsync(`ffprobe -v error -select_streams a:0 -show_entries stream=channels -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`);
      const channels = parseInt(stdout.trim());
      console.log(`Audio channels detected: ${channels}`);
      return channels;
    } catch (error) {
      console.error('Error detecting channels:', error.message);
      return 0;
    }
  }

  /**
   * Check if audio is stereo
   */
  async isStereo(audioPath) {
    const channels = await this.detectAudioChannels(audioPath);
    return channels === 2;
  }

  /**
   * Get audio duration using ffprobe
   */
  async getAudioDuration(audioPath) {
    try {
      const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`);
      return parseFloat(stdout.trim());
    } catch (error) {
      console.error('Error getting duration:', error.message);
      return 0;
    }
  }

  /**
   * Split stereo audio into left and right channels
   */
  async splitStereoChannels(inputPath) {
    try {
      console.log('Splitting stereo channels...');
      
      const dir = path.dirname(inputPath);
      const basename = path.basename(inputPath, path.extname(inputPath));
      
      const leftChannelPath = path.join(dir, `${basename}_left.mp3`);
      const rightChannelPath = path.join(dir, `${basename}_right.mp3`);

      const leftCmd = `ffmpeg -i "${inputPath}" -map 0:a -af "pan=mono|c0=c0,loudnorm=I=-16:TP=-1.5:LRA=7" -ac 1 -c:a libmp3lame -b:a 128k -ar 16000 -y "${leftChannelPath}"`;
      await execAsync(leftCmd);
      console.log('Left channel extracted');
      
      const rightCmd = `ffmpeg -i "${inputPath}" -map 0:a -af "pan=mono|c0=c1,loudnorm=I=-16:TP=-1.5:LRA=7" -ac 1 -c:a libmp3lame -b:a 128k -ar 16000 -y "${rightChannelPath}"`;
      await execAsync(rightCmd);
      console.log('Right channel extracted');

      const leftDuration = await this.getAudioDuration(leftChannelPath);
      const rightDuration = await this.getAudioDuration(rightChannelPath);

      console.log(`Left channel duration: ${leftDuration.toFixed(2)}s`);
      console.log(`Right channel duration: ${rightDuration.toFixed(2)}s`);

      if (!fs.existsSync(leftChannelPath) || !fs.existsSync(rightChannelPath)) {
        throw new Error('Failed to create channel files');
      }

      const leftSize = fs.statSync(leftChannelPath).size;
      const rightSize = fs.statSync(rightChannelPath).size;

      console.log(`Left channel size: ${(leftSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Right channel size: ${(rightSize / 1024 / 1024).toFixed(2)} MB`);

      console.log('Channels split successfully');
      
      return {
        success: true,
        leftChannel: leftChannelPath,
        rightChannel: rightChannelPath,
        leftDuration: leftDuration,
        rightDuration: rightDuration
      };

    } catch (error) {
      console.error('Error splitting channels:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Upload audio file to AssemblyAI
   */
  async uploadAudio(audioFilePath) {
    try {
      console.log('Uploading audio to AssemblyAI...');
      
      const audioData = fs.readFileSync(audioFilePath);
      
      const response = await axios.post(
        `${ASSEMBLYAI_API_URL}/upload`,
        audioData,
        {
          headers: {
            'authorization': this.apiKey,
            'content-type': 'application/octet-stream'
          }
        }
      );

      console.log('Upload complete');
      return response.data.upload_url;

    } catch (error) {
      console.error('Upload error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Transcribe audio using AssemblyAI
   */
  async transcribeWithAssemblyAI(audioFilePath, options = {}) {
    try {
      const model = options.model || ASSEMBLYAI_MODELS.UNIVERSAL;
      console.log(`Transcribing with AssemblyAI model: ${model}...`);
      console.log(`File: ${path.basename(audioFilePath)}`);
      
      if (!fs.existsSync(audioFilePath)) {
        throw new Error(`File not found: ${audioFilePath}`);
      }

      const duration = await this.getAudioDuration(audioFilePath);
      console.log(`Duration: ${duration.toFixed(2)}s`);

      // Upload audio file
      const audioUrl = await this.uploadAudio(audioFilePath);

      // For dual-channel split files, adjust speech_understanding settings
      let speechUnderstanding = options.speech_understanding || null;
      
      // If this is a split channel file (part of dual-channel processing)
      // We need to enable speaker_labels for match_original_utterance to work
      const isSplitChannel = options._isSplitChannel || false;
      const speakerLabels = isSplitChannel ? true : (options.speaker_labels ?? false);
      
      if (isSplitChannel && speechUnderstanding?.request?.translation?.match_original_utterance) {
        // For split channels with translation, enable speaker_labels
        console.log('Enabling speaker_labels for split channel with translation');
      }

      // Create transcription request with all features
      const transcriptConfig = {
        audio_url: audioUrl,
        speech_model: model,
        punctuate: options.punctuate ?? true,
        format_text: options.format_text ?? true,
        speaker_labels: speakerLabels,
        speakers_expected: options.speakers_expected || null,
        
        // Additional features
        language_detection: options.language_detection ?? false,
        
        // Speech understanding (translation)
        speech_understanding: speechUnderstanding
      };

      console.log('Requesting transcription...');
      const response = await axios.post(
        `${ASSEMBLYAI_API_URL}/transcript`,
        transcriptConfig,
        {
          headers: {
            'authorization': this.apiKey,
            'content-type': 'application/json'
          }
        }
      );

      const transcriptId = response.data.id;
      console.log(`Transcript ID: ${transcriptId}`);
      console.log('Waiting for transcription to complete...');

      // Poll for completion
      let transcript = await this.pollTranscript(transcriptId);

      if (transcript.status === 'error') {
        throw new Error(transcript.error);
      }

      console.log('Transcription completed');

      // Convert to segments format
      const segments = this.convertWordsToSegments(transcript.words || []);

      return {
        success: true,
        provider: 'assemblyai',
        model: model,
        text: transcript.text,
        segments: segments,
        words: transcript.words || [],
        duration: transcript.audio_duration,
        language: transcript.language_code,
        confidence: transcript.confidence,
        transcriptId: transcriptId,
        utterances: transcript.utterances,
        
        // Additional data
        rawTranscript: transcript
      };

    } catch (error) {
      console.error('AssemblyAI transcription error:', error.response?.data || error.message);
      
      return {
        success: false,
        provider: 'assemblyai',
        model: options.model || ASSEMBLYAI_MODELS.UNIVERSAL,
        error: error.message,
        filePath: audioFilePath
      };
    }
  }

  /**
   * Poll transcript status until complete
   */
  async pollTranscript(transcriptId, interval = 3000) {
    while (true) {
      const response = await axios.get(
        `${ASSEMBLYAI_API_URL}/transcript/${transcriptId}`,
        {
          headers: {
            'authorization': this.apiKey
          }
        }
      );

      const transcript = response.data;

      if (transcript.status === 'completed') {
        return transcript;
      } else if (transcript.status === 'error') {
        return transcript;
      }

      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  /**
   * Convert AssemblyAI words to segments format
   */
  convertWordsToSegments(words) {
    if (!words || words.length === 0) return [];

    const segments = [];
    let currentSegment = {
      start: words[0].start / 1000,
      end: words[0].end / 1000,
      text: words[0].text
    };

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const prevWord = words[i - 1];
      
      const pause = (word.start - prevWord.end) / 1000;
      const hasPunctuation = /[.!?]$/.test(prevWord.text);
      
      if (pause > 1.0 || hasPunctuation) {
        segments.push({
          start: currentSegment.start,
          end: currentSegment.end,
          text: currentSegment.text.trim()
        });
        
        currentSegment = {
          start: word.start / 1000,
          end: word.end / 1000,
          text: word.text
        };
      } else {
        currentSegment.end = word.end / 1000;
        currentSegment.text += ' ' + word.text;
      }
    }

    if (currentSegment.text) {
      segments.push({
        start: currentSegment.start,
        end: currentSegment.end,
        text: currentSegment.text.trim()
      });
    }

    return segments;
  }

  /**
   * Transcribe mono channel with built-in diarization
   */
  async transcribeMonoWithDiarization(audioFilePath, options = {}) {
    try {
      console.log('\n=== Starting Mono Transcription with Diarization (AssemblyAI) ===\n');
      console.log(`Model: ${options.model || ASSEMBLYAI_MODELS.UNIVERSAL}`);

      const duration = await this.getAudioDuration(audioFilePath);
      console.log(`Duration: ${duration.toFixed(2)}s`);

      // Upload audio file
      const audioUrl = await this.uploadAudio(audioFilePath);

      // Create transcription request with all features
      const transcriptConfig = {
        audio_url: audioUrl,
        speech_model: options.model || ASSEMBLYAI_MODELS.UNIVERSAL,
        language_detection: options.language_detection ?? true,
        punctuate: options.punctuate ?? true,
        format_text: options.format_text ?? true,
        speaker_labels: true,  // Enable diarization
        speakers_expected: options.speakers_expected || 2,
        
        // Speech understanding (translation)
        speech_understanding: options.speech_understanding || null
      };

      console.log('Requesting transcription with diarization...');
      const response = await axios.post(
        `${ASSEMBLYAI_API_URL}/transcript`,
        transcriptConfig,
        {
          headers: {
            'authorization': this.apiKey,
            'content-type': 'application/json'
          }
        }
      );

      const transcriptId = response.data.id;
      console.log(`Transcript ID: ${transcriptId}`);
      console.log('Waiting for transcription to complete...');

      // Poll for completion
      let transcript = await this.pollTranscript(transcriptId);

      if (transcript.status === 'error') {
        throw new Error(transcript.error);
      }

      console.log('Transcription completed');

      // Build conversation from utterances
      const conversation = this.buildConversationFromUtterances(
        transcript.utterances || [],
        transcript.translated_texts || {}
      );

      console.log('\n=== Mono Transcription with Diarization Complete ===\n');
      console.log(`Total conversation segments: ${conversation.length}`);

      return {
        success: true,
        provider: 'assemblyai',
        model: options.model || ASSEMBLYAI_MODELS.UNIVERSAL,
        audioFile: path.basename(audioFilePath),
        audioType: 'mono',
        transcriptId: transcriptId,
        duration: transcript.audio_duration,
        language: transcript.language_code,
        detectedLanguage: transcript.language_detection ? transcript.language_code : null,
        languageConfidence: transcript.language_confidence || null,
        totalSegments: conversation.length,
        conversation: conversation,
        confidence: transcript.confidence,
        
        // Full text
        fullText: transcript.text,
        fullTranslatedText: transcript.translated_texts?.en || null,
        
        // Additional features
        
        // All words with timestamps
        words: transcript.words || [],
        
        // Metadata
        metadata: {
          punctuate: transcript.punctuate,
          format_text: transcript.format_text,
          speaker_labels: transcript.speaker_labels,
          speakers_expected: transcript.speakers_expected,
          language_detection: transcript.language_detection,
          audio_start_from: transcript.audio_start_from,
          audio_end_at: transcript.audio_end_at
        }
      };

    } catch (error) {
      console.error('Mono transcription error:', error);
      return {
        success: false,
        provider: 'assemblyai',
        error: error.message
      };
    }
  }

  /**
   * Build conversation from AssemblyAI utterances (diarized)
   */
  buildConversationFromUtterances(utterances, translatedTexts = {}) {
    const conversation = [];

    utterances.forEach((utterance, index) => {
      // Map speaker letters to agent/customer
      const speakerId = utterance.speaker === 'A' ? 'agent' : 'customer';

      conversation.push({
        timestamp: utterance.start / 1000,
        speaker_id: speakerId,
        original_text: utterance.text.trim(),
        translated_text: utterance.translated_texts?.en || null,
        end_time: utterance.end / 1000,
        duration: (utterance.end - utterance.start) / 1000,
        segment_id: `${speakerId}_${index}`,
        confidence: utterance.confidence
      });
    });

    return conversation;
  }

  /**
   * Auto-detect and transcribe (stereo or mono)
   */
  async transcribe(audioFilePath, options = {}) {
    try {
      console.log('\n=== Auto-Detecting Audio Configuration ===\n');
      
      const stereo = await this.isStereo(audioFilePath);
      
      if (stereo) {
        console.log('✅ Stereo audio detected - using dual-channel transcription');
        return await this.transcribeDualChannel(audioFilePath, options);
      } else {
        console.log('✅ Mono audio detected - using diarization for speaker detection');
        return await this.transcribeMonoWithDiarization(audioFilePath, {
          ...options,
          speakers_expected: options.speakers_expected || 2
        });
      }

    } catch (error) {
      console.error('Auto-transcription error:', error.message);
      return {
        success: false,
        provider: 'assemblyai',
        error: error.message
      };
    }
  }

  /**
   * Transcribe dual-channel audio
   */
  async transcribeDualChannel(audioFilePath, options = {}) {
    try {
      console.log('\n=== Starting Dual-Channel Transcription (AssemblyAI) ===\n');
      console.log(`Model: ${options.model || ASSEMBLYAI_MODELS.UNIVERSAL}`);

      const channels = await this.splitStereoChannels(audioFilePath);
      
      if (!channels.success) {
        return channels;
      }

      const leftChannelPath = channels.leftChannel;
      const rightChannelPath = channels.rightChannel;
      const filesToCleanup = [leftChannelPath, rightChannelPath];

      // Mark that these are split channel files
      const channelOptions = {
        ...options,
        _isSplitChannel: true,
        speaker_labels: true, // Required for translation with match_original_utterance
        speakers_expected: 1  // Each channel has only one speaker
      };

      console.log('\nTranscribing AGENT channel...');
      const agentTranscription = await this.transcribeWithAssemblyAI(
        leftChannelPath,
        channelOptions
      );

      if (!agentTranscription.success) {
        console.error('Agent transcription failed:', agentTranscription.error);
        if (options.cleanup !== false) {
          filesToCleanup.forEach(file => {
            if (fs.existsSync(file)) fs.unlinkSync(file);
          });
        }
        return agentTranscription;
      }

      console.log('\nTranscribing CUSTOMER channel...');
      const customerTranscription = await this.transcribeWithAssemblyAI(
        rightChannelPath,
        channelOptions
      );

      if (!customerTranscription.success) {
        console.error('Customer transcription failed:', customerTranscription.error);
        if (options.cleanup !== false) {
          filesToCleanup.forEach(file => {
            if (fs.existsSync(file)) fs.unlinkSync(file);
          });
        }
        return customerTranscription;
      }

      if (options.cleanup !== false) {
        filesToCleanup.forEach(file => {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        });
        console.log('\nTemporary channel files cleaned up');
      }

      const conversation = this.buildConversationArray(
        agentTranscription.segments,
        customerTranscription.segments,
        agentTranscription.rawTranscript,
        customerTranscription.rawTranscript
      );

      console.log('\n=== Dual-Channel Transcription Complete ===\n');
      console.log(`Total conversation segments: ${conversation.length}`);

      return {
        success: true,
        provider: 'assemblyai',
        model: options.model || ASSEMBLYAI_MODELS.UNIVERSAL,
        audioFile: path.basename(audioFilePath),
        audioType: 'stereo',
        duration: Math.max(
          agentTranscription.duration || 0,
          customerTranscription.duration || 0
        ),
        language: agentTranscription.language,
        detectedLanguage: agentTranscription.rawTranscript?.language_detection ? agentTranscription.language : null,
        languageConfidence: agentTranscription.rawTranscript?.language_confidence || null,
        totalSegments: conversation.length,
        conversation: conversation,
        agentConfidence: agentTranscription.confidence,
        customerConfidence: customerTranscription.confidence,
        
        // Full text
        fullText: `${agentTranscription.text} ${customerTranscription.text}`,
        fullTranslatedText: this.mergeTranslatedText(
          agentTranscription.rawTranscript,
          customerTranscription.rawTranscript
        ),
        
        speechUnderstanding: {
          agent: agentTranscription.rawTranscript?.speech_understanding || null,
          customer: customerTranscription.rawTranscript?.speech_understanding || null
        },
        
        // Metadata
        metadata: {
          agentTranscriptId: agentTranscription.transcriptId,
          customerTranscriptId: customerTranscription.transcriptId,
          punctuate: agentTranscription.rawTranscript?.punctuate,
          format_text: agentTranscription.rawTranscript?.format_text,
          language_detection: agentTranscription.rawTranscript?.language_detection
        }
      };

    } catch (error) {
      console.error('Dual-channel transcription error:', error.message);
      return {
        success: false,
        provider: 'assemblyai',
        error: error.message
      };
    }
  }

  /**
   * Merge translated text from both channels
   */
  mergeTranslatedText(agentTranscript, customerTranscript) {
    const agentTranslated = agentTranscript?.translated_texts?.en || '';
    const customerTranslated = customerTranscript?.translated_texts?.en || '';
    
    if (agentTranslated && customerTranslated) {
      return `${agentTranslated} ${customerTranslated}`;
    }
    
    return agentTranslated || customerTranslated || null;
  }

  /**
   * Build conversation array from dual-channel segments
   */
  buildConversationArray(agentSegments, customerSegments, agentTranscript = null, customerTranscript = null) {
    const conversation = [];

    // Get translated utterances if available
    const agentUtterances = agentTranscript?.utterances || [];
    const customerUtterances = customerTranscript?.utterances || [];

    agentSegments.forEach((segment, index) => {
      // Find matching utterance for translation
      const matchingUtterance = agentUtterances.find(u => 
        Math.abs((u.start / 1000) - segment.start) < 0.5
      );

      conversation.push({
        timestamp: segment.start,
        speaker_id: 'agent',
        original_text: segment.text.trim(),
        translated_text: matchingUtterance?.translated_texts?.en || null,
        end_time: segment.end,
        duration: segment.end - segment.start,
        segment_id: `agent_${index}`
      });
    });

    customerSegments.forEach((segment, index) => {
      // Find matching utterance for translation
      const matchingUtterance = customerUtterances.find(u => 
        Math.abs((u.start / 1000) - segment.start) < 0.5
      );

      conversation.push({
        timestamp: segment.start,
        speaker_id: 'customer',
        original_text: segment.text.trim(),
        translated_text: matchingUtterance?.translated_texts?.en || null,
        end_time: segment.end,
        duration: segment.end - segment.start,
        segment_id: `customer_${index}`
      });
    });

    conversation.sort((a, b) => a.timestamp - b.timestamp);

    return conversation;
  }

  /**
   * Format seconds to HH:MM:SS or MM:SS
   */
  formatTimestamp(seconds) {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }
}

module.exports = { AssemblyAITranscriptionService, ASSEMBLYAI_MODELS };