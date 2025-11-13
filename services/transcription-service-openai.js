// transcription-service-openai.js
require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// API configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/audio/transcriptions';

// Available OpenAI models
const OPENAI_MODELS = {
  WHISPER: 'whisper-1',                      // $0.006/min - Legacy, no diarization
  GPT4O: 'gpt-4o-transcribe',                // $0.006/min - With diarization
  GPT4O_MINI: 'gpt-4o-mini-transcribe'       // $0.003/min - With diarization
};

class OpenAITranscriptionService {
  
  constructor(apiKey = process.env.OPENAI_API_KEY) {
    this.apiKey = apiKey;
    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }
  }

  /**
   * Check if model supports verbose_json format
   */
  supportsVerboseJson(model) {
    return model === OPENAI_MODELS.WHISPER;
  }

  /**
   * Check if model supports diarization
   */
  supportsDiarization(model) {
    return model === OPENAI_MODELS.GPT4O || model === OPENAI_MODELS.GPT4O_MINI;
  }

  /**
   * Get appropriate response format for model
   */
  getResponseFormat(model) {
    return this.supportsVerboseJson(model) ? 'verbose_json' : 'json';
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

      if (leftSize === 0 || rightSize === 0) {
        throw new Error('One or more channel files are empty');
      }

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
   * Compress audio file if needed
   */
  async compressAudioFile(inputPath) {
    try {
      const dir = path.dirname(inputPath);
      const ext = path.extname(inputPath);
      const basename = path.basename(inputPath, ext);
      const compressedPath = path.join(dir, `${basename}_compressed.mp3`);

      console.log('Compressing audio file...');

      const cmd = `ffmpeg -i "${inputPath}" -ac 1 -ar 16000 -b:a 64k -c:a libmp3lame -y "${compressedPath}"`;
      await execAsync(cmd);

      const originalSize = fs.statSync(inputPath).size;
      const compressedSize = fs.statSync(compressedPath).size;

      console.log(`Original: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Compressed: ${(compressedSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Reduction: ${(((originalSize - compressedSize) / originalSize) * 100).toFixed(1)}%`);

      return compressedPath;

    } catch (error) {
      console.error('Compression error:', error.message);
      throw error;
    }
  }

  /**
   * Split audio into chunks for transcription
   */
  async splitIntoChunks(inputPath, chunkDuration = 300) {
    try {
      const duration = await this.getAudioDuration(inputPath);
      
      if (duration <= chunkDuration) {
        return [inputPath];
      }

      console.log(`Splitting ${duration.toFixed(2)}s audio into ${chunkDuration}s chunks...`);
      
      const dir = path.dirname(inputPath);
      const ext = path.extname(inputPath);
      const basename = path.basename(inputPath, ext);
      const chunks = [];
      
      const numChunks = Math.ceil(duration / chunkDuration);
      
      for (let i = 0; i < numChunks; i++) {
        const startTime = i * chunkDuration;
        const chunkPath = path.join(dir, `${basename}_chunk${i}${ext}`);
        
        const cmd = `ffmpeg -i "${inputPath}" -ss ${startTime} -t ${chunkDuration} -c copy -y "${chunkPath}"`;
        await execAsync(cmd);
        
        chunks.push(chunkPath);
        console.log(`Created chunk ${i + 1}/${numChunks}`);
      }
      
      return chunks;

    } catch (error) {
      console.error('Error splitting into chunks:', error.message);
      throw error;
    }
  }

  /**
   * Create segments from plain text response
   */
  createSegmentsFromText(text, duration) {
    if (!text) return [];

    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const segments = [];
    const avgSegmentDuration = duration / sentences.length;

    sentences.forEach((sentence, index) => {
      const start = index * avgSegmentDuration;
      const end = (index + 1) * avgSegmentDuration;
      
      segments.push({
        start: start,
        end: end,
        text: sentence.trim()
      });
    });

    return segments;
  }

  /**
   * Transcribe audio using OpenAI with model selection
   */
  async transcribeWithOpenAI(audioFilePath, options = {}) {
    try {
      const model = options.model || OPENAI_MODELS.WHISPER;
      const responseFormat = this.getResponseFormat(model);
      
      console.log(`Transcribing with model: ${model}...`);
      console.log(`Response format: ${responseFormat}`);
      console.log(`File: ${path.basename(audioFilePath)}`);
      
      if (!fs.existsSync(audioFilePath)) {
        throw new Error(`File not found: ${audioFilePath}`);
      }

      const fileSize = fs.statSync(audioFilePath).size;
      const duration = await this.getAudioDuration(audioFilePath);
      
      console.log(`File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Duration: ${duration.toFixed(2)}s`);

      if (fileSize === 0) {
        throw new Error('File is empty');
      }

      if (fileSize > 25 * 1024 * 1024) {
        throw new Error('File size exceeds OpenAI limit of 25MB');
      }

      const form = new FormData();
      
      const fileBuffer = fs.readFileSync(audioFilePath);
      form.append('file', fileBuffer, {
        filename: path.basename(audioFilePath),
        contentType: 'audio/mpeg'
      });
      
      form.append('model', model);
      
      if (options.language) {
        form.append('language', options.language);
      }
      
      const enhancedPrompt = options.prompt || 'This is a continuous phone conversation with natural pauses and silence between speaking turns.';
      form.append('prompt', enhancedPrompt);
      
      form.append('response_format', responseFormat);
      form.append('temperature', options.temperature || 0);

      // Add timestamp_granularities for GPT-4o models (supports speaker diarization)
      if (this.supportsDiarization(model) && options.enableDiarization) {
        form.append('timestamp_granularities[]', 'segment');
        console.log('Diarization enabled for mono audio');
      }

      console.log('Sending to OpenAI API...');
      const response = await axios.post(OPENAI_API_URL, form, {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${this.apiKey}`
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 300000
      });

      console.log('Transcription completed');

      let segments = [];
      let text = '';
      let transcribedDuration = duration;

      if (responseFormat === 'verbose_json') {
        text = response.data.text;
        segments = response.data.segments || [];
        transcribedDuration = response.data.duration || duration;
        
        console.log(`Segments received: ${segments.length}`);
        console.log(`Transcribed duration: ${transcribedDuration}s`);
        
        if (duration > 0 && transcribedDuration < duration * 0.8) {
          console.warn(`⚠️  Warning: Transcription may be incomplete. File duration: ${duration.toFixed(2)}s, Transcribed: ${transcribedDuration}s`);
        }
      } else {
        text = response.data.text;
        segments = this.createSegmentsFromText(text, duration);
        console.log(`Text received, created ${segments.length} approximate segments`);
      }
      
      return {
        success: true,
        provider: 'openai',
        model: model,
        text: text,
        segments: segments,
        duration: transcribedDuration,
        language: response.data.language || options.language || 'en',
        fileDuration: duration,
        responseFormat: responseFormat
      };

    } catch (error) {
      console.error('OpenAI transcription error:', error.response?.data || error.message);
      
      let errorMessage = error.message;
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error.message || error.response.data.error;
      }
      
      return {
        success: false,
        provider: 'openai',
        model: options.model || OPENAI_MODELS.WHISPER,
        error: errorMessage,
        filePath: audioFilePath
      };
    }
  }

  /**
   * Transcribe mono audio with diarization (GPT-4o models only)
   */
  async transcribeMonoWithDiarization(audioFilePath, options = {}) {
    try {
      const model = options.model || OPENAI_MODELS.GPT4O;
      
      if (!this.supportsDiarization(model)) {
        console.warn(`⚠️  Model ${model} does not support diarization. Use ${OPENAI_MODELS.GPT4O} or ${OPENAI_MODELS.GPT4O_MINI}`);
        return {
          success: false,
          error: `Model ${model} does not support diarization`
        };
      }

      console.log('\n=== Starting Mono Transcription with Diarization ===\n');
      console.log(`Model: ${model}`);
      console.log('⚠️  Note: OpenAI diarization is basic. For better results, use AssemblyAI or dual-channel setup.');

      const result = await this.transcribeWithOpenAI(audioFilePath, {
        ...options,
        model: model,
        enableDiarization: true
      });

      if (!result.success) {
        return result;
      }

      // Note: OpenAI's current API doesn't provide speaker labels in response
      // The segments are just text without speaker identification
      // This is a limitation of their API as of now
      
      const conversation = result.segments.map((segment, index) => ({
        timestamp: segment.start,
        speaker_id: 'unknown', // OpenAI doesn't provide speaker labels yet
        original_text: segment.text.trim(),
        end_time: segment.end,
        duration: segment.end - segment.start,
        segment_id: `segment_${index}`
      }));

      return {
        success: true,
        provider: 'openai',
        model: model,
        audioFile: path.basename(audioFilePath),
        duration: result.duration,
        language: result.language,
        totalSegments: conversation.length,
        conversation: conversation,
        warning: 'OpenAI API does not currently return speaker labels. Consider using AssemblyAI for true diarization.'
      };

    } catch (error) {
      console.error('Mono transcription error:', error.message);
      return {
        success: false,
        provider: 'openai',
        error: error.message
      };
    }
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
        console.log('✅ Mono audio detected');
        
        const model = options.model || OPENAI_MODELS.WHISPER;
        
        if (this.supportsDiarization(model) && options.enableDiarization !== false) {
          console.log('Using diarization for speaker detection');
          return await this.transcribeMonoWithDiarization(audioFilePath, {
            ...options,
            model: model
          });
        } else {
          console.log('⚠️  No diarization available - transcribing without speaker labels');
          console.log(`Tip: Use model '${OPENAI_MODELS.GPT4O}' or '${OPENAI_MODELS.GPT4O_MINI}' with enableDiarization: true for speaker detection`);
          
          const result = await this.transcribeAudioFile(audioFilePath, options);
          
          if (result.success) {
            const conversation = result.segments.map((segment, index) => ({
              timestamp: segment.start,
              speaker_id: 'unknown',
              original_text: segment.text.trim(),
              end_time: segment.end,
              duration: segment.end - segment.start,
              segment_id: `segment_${index}`
            }));

            return {
              success: true,
              provider: 'openai',
              model: options.model || OPENAI_MODELS.WHISPER,
              audioFile: path.basename(audioFilePath),
              duration: result.duration,
              language: result.language,
              totalSegments: conversation.length,
              conversation: conversation
            };
          }
          
          return result;
        }
      }

    } catch (error) {
      console.error('Auto-transcription error:', error.message);
      return {
        success: false,
        provider: 'openai',
        error: error.message
      };
    }
  }

  /**
   * Transcribe audio file (with chunking for long files)
   */
  async transcribeAudioFile(audioFilePath, options = {}) {
    try {
      const duration = await this.getAudioDuration(audioFilePath);
      
      if (duration > 300) {
        console.log(`Long audio detected (${duration.toFixed(2)}s), splitting into chunks...`);
        
        const chunks = await this.splitIntoChunks(audioFilePath, 300);
        const allSegments = [];
        let cumulativeOffset = 0;
        let fullText = '';
        
        for (let i = 0; i < chunks.length; i++) {
          console.log(`\nTranscribing chunk ${i + 1}/${chunks.length}...`);
          
          const result = await this.transcribeWithOpenAI(chunks[i], options);
          
          if (result.success) {
            fullText += (fullText ? ' ' : '') + result.text;
            
            if (result.segments) {
              const adjustedSegments = result.segments.map(seg => ({
                ...seg,
                start: seg.start + cumulativeOffset,
                end: seg.end + cumulativeOffset
              }));
              
              allSegments.push(...adjustedSegments);
            }
            
            cumulativeOffset += result.duration;
          }
          
          if (chunks[i] !== audioFilePath) {
            fs.unlinkSync(chunks[i]);
          }
        }
        
        return {
          success: true,
          provider: 'openai',
          model: options.model || OPENAI_MODELS.WHISPER,
          text: fullText,
          segments: allSegments,
          duration: cumulativeOffset,
          language: options.language || 'en',
          chunked: true,
          numChunks: chunks.length
        };
        
      } else {
        return await this.transcribeWithOpenAI(audioFilePath, options);
      }
      
    } catch (error) {
      console.error('Transcription error:', error.message);
      return {
        success: false,
        provider: 'openai',
        error: error.message
      };
    }
  }

  /**
   * Transcribe dual-channel audio
   */
  async transcribeDualChannel(audioFilePath, options = {}) {
    try {
      console.log('\n=== Starting Dual-Channel Transcription ===\n');
      console.log(`Model: ${options.model || OPENAI_MODELS.WHISPER}`);

      const channels = await this.splitStereoChannels(audioFilePath);
      
      if (!channels.success) {
        return channels;
      }

      let leftChannelPath = channels.leftChannel;
      let rightChannelPath = channels.rightChannel;
      const filesToCleanup = [leftChannelPath, rightChannelPath];

      const leftSize = fs.statSync(leftChannelPath).size;
      const rightSize = fs.statSync(rightChannelPath).size;
      const maxSize = 25 * 1024 * 1024;

      if (leftSize > maxSize * 0.9 || rightSize > maxSize * 0.9) {
        console.log('\n⚠️  Files are large, compressing for OpenAI...');
        
        if (leftSize > maxSize * 0.9) {
          leftChannelPath = await this.compressAudioFile(leftChannelPath);
          filesToCleanup.push(leftChannelPath);
        }
        
        if (rightSize > maxSize * 0.9) {
          rightChannelPath = await this.compressAudioFile(rightChannelPath);
          filesToCleanup.push(rightChannelPath);
        }
      }

      console.log('\nTranscribing AGENT channel...');
      const agentTranscription = await this.transcribeAudioFile(
        leftChannelPath,
        {
          ...options,
          prompt: options.agentPrompt || 'This is a continuous call center agent speaking throughout the entire call with natural pauses between customer responses.'
        }
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
      const customerTranscription = await this.transcribeAudioFile(
        rightChannelPath,
        {
          ...options,
          prompt: options.customerPrompt || 'This is a continuous customer speaking throughout the entire call with natural pauses between agent responses.'
        }
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
        customerTranscription.segments
      );

      console.log('\n=== Dual-Channel Transcription Complete ===\n');
      console.log(`Total conversation segments: ${conversation.length}`);

      return {
        success: true,
        provider: 'openai',
        model: options.model || OPENAI_MODELS.WHISPER,
        audioFile: path.basename(audioFilePath),
        audioType: 'stereo',
        duration: Math.max(
          agentTranscription.duration || 0,
          customerTranscription.duration || 0
        ),
        language: agentTranscription.language,
        totalSegments: conversation.length,
        conversation: conversation
      };

    } catch (error) {
      console.error('Dual-channel transcription error:', error.message);
      return {
        success: false,
        provider: 'openai',
        error: error.message
      };
    }
  }

  /**
   * Build conversation array with timestamp-sorted segments
   */
  buildConversationArray(agentSegments, customerSegments) {
    const conversation = [];

    agentSegments.forEach((segment, index) => {
      conversation.push({
        timestamp: segment.start,
        speaker_id: 'agent',
        original_text: segment.text.trim(),
        end_time: segment.end,
        duration: segment.end - segment.start,
        segment_id: `agent_${index}`
      });
    });

    customerSegments.forEach((segment, index) => {
      conversation.push({
        timestamp: segment.start,
        speaker_id: 'customer',
        original_text: segment.text.trim(),
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

module.exports = { OpenAITranscriptionService, OPENAI_MODELS };