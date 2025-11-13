// transcription-service-soniox.js
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');
const FormData = require('form-data');

const execAsync = promisify(exec);

// API configuration
const SONIOX_API_BASE_URL = 'https://api.soniox.com';

// Available Soniox models
const SONIOX_MODELS = {
  ASYNC_V3: 'stt-async-v3',      // Latest async model
  ASYNC_V2: 'stt-async-v2',      // Previous version
  STREAM: 'stt-stream-preview'    // For real-time streaming
};

class SonioxTranscriptionService {
  
  constructor(apiKey = process.env.SONIOX_API_KEY) {
    this.apiKey = apiKey;
    if (!this.apiKey) {
      throw new Error('Soniox API key is required. Get yours at https://console.soniox.com');
    }
  }

  /**
   * Generic API fetch helper
   */
  async apiFetch(endpoint, options = {}) {
    const { method = 'GET', body, headers = {} } = options;

    try {
      const response = await axios({
        method: method,
        url: `${SONIOX_API_BASE_URL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          ...headers
        },
        data: body
      });

      return response.data;
    } catch (error) {
      const errorMsg = error.response?.data || error.message;
      throw new Error(`Soniox API Error: ${JSON.stringify(errorMsg)}`);
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
   * Upload audio file to Soniox
   */
  async uploadAudio(audioFilePath) {
    try {
      console.log('Uploading audio to Soniox...');
      
      const form = new FormData();
      form.append('file', fs.createReadStream(audioFilePath), path.basename(audioFilePath));

      const response = await axios.post(
        `${SONIOX_API_BASE_URL}/v1/files`,
        form,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            ...form.getHeaders()
          }
        }
      );

      console.log(`File uploaded. File ID: ${response.data.id}`);
      return response.data.id;

    } catch (error) {
      console.error('Upload error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Delete uploaded file
   */
  async deleteFile(fileId) {
    try {
      await this.apiFetch(`/v1/files/${fileId}`, { method: 'DELETE' });
      console.log(`File deleted: ${fileId}`);
    } catch (error) {
      console.error(`Error deleting file ${fileId}:`, error.message);
    }
  }

  /**
   * Create transcription job
   */
  async createTranscription(config) {
    try {
      console.log('Creating transcription...');
      
      const response = await this.apiFetch('/v1/transcriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      console.log(`Transcription created. ID: ${response.id}`);
      return response.id;

    } catch (error) {
      console.error('Create transcription error:', error.message);
      throw error;
    }
  }

  /**
   * Wait for transcription to complete
   */
  async waitForCompletion(transcriptionId, pollInterval = 2000) {
    console.log('Waiting for transcription to complete...');
    
    let attempts = 0;
    const maxAttempts = 300; // 10 minutes max

    while (attempts < maxAttempts) {
      const status = await this.apiFetch(`/v1/transcriptions/${transcriptionId}`);
      
      if (status.status === 'completed') {
        console.log('Transcription completed!');
        return status;
      }
      
      if (status.status === 'error') {
        throw new Error(`Transcription failed: ${status.error_message}`);
      }

      process.stdout.write(`\rStatus: ${status.status}... (${attempts + 1})`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    }

    throw new Error('Transcription timeout');
  }

  /**
   * Get transcription result
   */
  async getTranscriptionResult(transcriptionId) {
    try {
      const result = await this.apiFetch(`/v1/transcriptions/${transcriptionId}/transcript`);
      return result;
    } catch (error) {
      console.error('Get transcription error:', error.message);
      throw error;
    }
  }

  /**
   * Delete transcription
   */
  async deleteTranscription(transcriptionId) {
    try {
      await this.apiFetch(`/v1/transcriptions/${transcriptionId}`, { method: 'DELETE' });
      console.log(`\nTranscription deleted: ${transcriptionId}`);
    } catch (error) {
      console.error(`Error deleting transcription ${transcriptionId}:`, error.message);
    }
  }

  /**
   * Convert tokens to segments format
   */
  convertTokensToSegments(tokens) {
    if (!tokens || tokens.length === 0) return [];

    const segments = [];
    let currentSegment = null;

    for (const token of tokens) {
      const speaker = token.speaker !== undefined ? token.speaker : null;
      const language = token.language || null;
      const isTranslation = token.translation_status === 'translation';
      
      // Check if we need to start a new segment
      const speakerChanged = currentSegment && currentSegment.speaker !== speaker;
      const hasPunctuation = token.text.match(/[.!?]$/);
      
      if (!currentSegment || speakerChanged || hasPunctuation) {
        // Save previous segment
        if (currentSegment) {
          segments.push({
            start: currentSegment.start,
            end: currentSegment.end,
            text: currentSegment.text.trim(),
            speaker: currentSegment.speaker,
            language: currentSegment.language,
            is_translation: currentSegment.is_translation
          });
        }
        
        // Start new segment
        currentSegment = {
          start: token.start_ms / 1000,
          end: token.end_ms / 1000,
          text: token.text,
          speaker: speaker,
          language: language,
          is_translation: isTranslation
        };
      } else {
        // Add to current segment
        currentSegment.text += token.text;
        currentSegment.end = token.end_ms / 1000;
      }
    }

    // Add final segment
    if (currentSegment) {
      segments.push({
        start: currentSegment.start,
        end: currentSegment.end,
        text: currentSegment.text.trim(),
        speaker: currentSegment.speaker,
        language: currentSegment.language,
        is_translation: currentSegment.is_translation
      });
    }

    return segments;
  }

  /**
   * Transcribe audio with Soniox
   */
  async transcribeWithSoniox(audioFilePath, options = {}) {
    let fileId = null;
    let transcriptionId = null;

    try {
      const model = options.model || SONIOX_MODELS.ASYNC_V3;
      console.log(`\nTranscribing with Soniox model: ${model}`);
      console.log(`File: ${path.basename(audioFilePath)}`);
      
      if (!fs.existsSync(audioFilePath)) {
        throw new Error(`File not found: ${audioFilePath}`);
      }

      const duration = await this.getAudioDuration(audioFilePath);
      console.log(`Duration: ${duration.toFixed(2)}s`);

      // Upload file
      fileId = await this.uploadAudio(audioFilePath);

      // Build transcription config
      const config = {
        model: model,
        file_id: fileId,
        
        // Language and speaker settings
        language_hints: options.language_hints || ['en'],
        enable_language_identification: options.enable_language_identification ?? true,
        enable_speaker_diarization: options.enable_speaker_diarization ?? true,
        
        // Context (optional)
        context: options.context || null,
        
        // Client reference (optional)
        client_reference_id: options.client_reference_id || null
      };

      // Translation
      if (options.translation) {
        config.translation = options.translation;
      }

      // Remove null values
      Object.keys(config).forEach(key => {
        if (config[key] === null || config[key] === undefined) {
          delete config[key];
        }
      });

      // Create transcription
      transcriptionId = await this.createTranscription(config);

      // Wait for completion
      await this.waitForCompletion(transcriptionId);

      // Get result
      const result = await this.getTranscriptionResult(transcriptionId);

      // Convert tokens to segments
      const segments = this.convertTokensToSegments(result.tokens || []);

      // Extract full text
      const fullText = result.tokens.map(t => t.text).join('');

      return {
        success: true,
        provider: 'soniox',
        model: model,
        text: fullText,
        segments: segments,
        tokens: result.tokens,
        duration: duration,
        language: result.language || options.language_hints?.[0] || 'en',
        transcriptionId: transcriptionId,
        fileId: fileId
      };

    } catch (error) {
      console.error('\nSoniox transcription error:', error.message);
      
      return {
        success: false,
        provider: 'soniox',
        model: options.model || SONIOX_MODELS.ASYNC_V3,
        error: error.message,
        filePath: audioFilePath
      };
    } finally {
      // Cleanup
      if (options.cleanup !== false) {
        if (transcriptionId) {
          await this.deleteTranscription(transcriptionId);
        }
        if (fileId) {
          await this.deleteFile(fileId);
        }
      }
    }
  }

  /**
   * Transcribe mono with diarization
   */
  async transcribeMonoWithDiarization(audioFilePath, options = {}) {
    try {
      console.log('\n=== Starting Mono Transcription with Diarization (Soniox) ===');

      const result = await this.transcribeWithSoniox(audioFilePath, {
        ...options,
        enable_speaker_diarization: true,
        enable_language_identification: true
      });

      if (!result.success) {
        return result;
      }

      // Build conversation from segments
      const conversation = this.buildConversationFromSegments(result.segments);

      console.log('\n=== Mono Transcription Complete ===');
      console.log(`Total segments: ${conversation.length}`);

      return {
        success: true,
        provider: 'soniox',
        model: options.model || SONIOX_MODELS.ASYNC_V3,
        audioFile: path.basename(audioFilePath),
        audioType: 'mono',
        duration: result.duration,
        language: result.language,
        totalSegments: conversation.length,
        conversation: conversation,
        
        // Full text
        fullText: result.text,
        
        // Raw tokens
        tokens: result.tokens
      };

    } catch (error) {
      console.error('Mono transcription error:', error.message);
      return {
        success: false,
        provider: 'soniox',
        error: error.message
      };
    }
  }

  /**
   * Build conversation from segments
   */
  buildConversationFromSegments(segments) {
    const conversation = [];

    segments.forEach((segment, index) => {
      // Map speaker numbers to agent/customer
      const speakerId = segment.speaker === 0 ? 'agent' : 
                       segment.speaker === 1 ? 'customer' : 
                       segment.speaker !== null ? `speaker_${segment.speaker}` : 'unknown';

      conversation.push({
        timestamp: segment.start,
        speaker_id: speakerId,
        original_text: segment.text.trim(),
        translated_text: segment.is_translation ? segment.text.trim() : null,
        end_time: segment.end,
        duration: segment.end - segment.start,
        segment_id: `${speakerId}_${index}`,
        speaker_number: segment.speaker,
        language: segment.language,
        is_translation: segment.is_translation || false
      });
    });

    return conversation;
  }

  /**
   * Auto-detect and transcribe
   */
  async transcribe(audioFilePath, options = {}) {
    try {
      console.log('\n=== Auto-Detecting Audio Configuration ===');
      
      const stereo = await this.isStereo(audioFilePath);
      
      if (stereo) {
        console.log('✅ Stereo audio detected - using dual-channel transcription');
        return await this.transcribeDualChannel(audioFilePath, options);
      } else {
        console.log('✅ Mono audio detected - using diarization');
        return await this.transcribeMonoWithDiarization(audioFilePath, options);
      }

    } catch (error) {
      console.error('Auto-transcription error:', error.message);
      return {
        success: false,
        provider: 'soniox',
        error: error.message
      };
    }
  }

  /**
   * Transcribe dual-channel audio
   */
  async transcribeDualChannel(audioFilePath, options = {}) {
    try {
      console.log('\n=== Starting Dual-Channel Transcription (Soniox) ===');

      const channels = await this.splitStereoChannels(audioFilePath);
      
      if (!channels.success) {
        return channels;
      }

      const leftChannelPath = channels.leftChannel;
      const rightChannelPath = channels.rightChannel;
      const filesToCleanup = [leftChannelPath, rightChannelPath];

      console.log('\nTranscribing AGENT channel...');
      const agentTranscription = await this.transcribeWithSoniox(
        leftChannelPath,
        { ...options, enable_speaker_diarization: false }
      );

      if (!agentTranscription.success) {
        if (options.cleanup !== false) {
          filesToCleanup.forEach(file => {
            if (fs.existsSync(file)) fs.unlinkSync(file);
          });
        }
        return agentTranscription;
      }

      console.log('\nTranscribing CUSTOMER channel...');
      const customerTranscription = await this.transcribeWithSoniox(
        rightChannelPath,
        { ...options, enable_speaker_diarization: false }
      );

      if (!customerTranscription.success) {
        if (options.cleanup !== false) {
          filesToCleanup.forEach(file => {
            if (fs.existsSync(file)) fs.unlinkSync(file);
          });
        }
        return customerTranscription;
      }

      // Cleanup temp files
      if (options.cleanup !== false) {
        filesToCleanup.forEach(file => {
          if (fs.existsSync(file)) fs.unlinkSync(file);
        });
        console.log('\nTemp files cleaned up');
      }

      const conversation = this.buildConversationArray(
        agentTranscription.segments,
        customerTranscription.segments
      );

      console.log('\n=== Dual-Channel Transcription Complete ===');
      console.log(`Total segments: ${conversation.length}`);

      return {
        success: true,
        provider: 'soniox',
        model: options.model || SONIOX_MODELS.ASYNC_V3,
        audioFile: path.basename(audioFilePath),
        audioType: 'stereo',
        duration: Math.max(agentTranscription.duration, customerTranscription.duration),
        language: agentTranscription.language,
        totalSegments: conversation.length,
        conversation: conversation,
        fullText: `${agentTranscription.text} ${customerTranscription.text}`
      };

    } catch (error) {
      console.error('Dual-channel transcription error:', error.message);
      return {
        success: false,
        provider: 'soniox',
        error: error.message
      };
    }
  }

  /**
   * Build conversation from dual-channel segments
   */
  buildConversationArray(agentSegments, customerSegments) {
    const conversation = [];

    agentSegments.forEach((segment, index) => {
      conversation.push({
        timestamp: segment.start,
        speaker_id: 'agent',
        original_text: segment.text.trim(),
        translated_text: segment.is_translation ? segment.text.trim() : null,
        end_time: segment.end,
        duration: segment.end - segment.start,
        segment_id: `agent_${index}`,
        language: segment.language
      });
    });

    customerSegments.forEach((segment, index) => {
      conversation.push({
        timestamp: segment.start,
        speaker_id: 'customer',
        original_text: segment.text.trim(),
        translated_text: segment.is_translation ? segment.text.trim() : null,
        end_time: segment.end,
        duration: segment.end - segment.start,
        segment_id: `customer_${index}`,
        language: segment.language
      });
    });

    conversation.sort((a, b) => a.timestamp - b.timestamp);

    return conversation;
  }

  /**
   * Format timestamp
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

module.exports = { SonioxTranscriptionService, SONIOX_MODELS };