// services/transcriptionService.js
const { InteractionTranscription } = require('../config/mongodb');

const transcriptionService = {
  async getTranscriptionAnalysis(interactionId) {
    try {
      const transcription = await InteractionTranscription.findOne({ interactionId });
      if (!transcription || !transcription.transcription || !Array.isArray(transcription.transcription)) {
        return null;
      }

      // Initialize analysis objects
      const analysis = {
        overallSentiment: {
          positive: 0,
          negative: 0,
          neutral: 0
        },
        languageDistribution: new Map(),
        speakerStats: new Map(),
        intents: new Set(),
        profanityLevel: 0,
        totalTokens: 0,
        messageCount: 0
      };

      // Process each message in transcription
      transcription.transcription.forEach(messageObj => {
        // Get the timestamp (key) from the object
        const timestamp = Object.keys(messageObj)[0];
        if (!timestamp || !messageObj[timestamp]) {
          return; // Skip if invalid format
        }
        
        const message = messageObj[timestamp];
        analysis.messageCount++;
        
        // Sentiment analysis
        if (message.sentiment) {
          const sentiment = message.sentiment.sentiment || 'neutral';
          analysis.overallSentiment[sentiment] = (analysis.overallSentiment[sentiment] || 0) + 1;
        }

        // Language tracking
        if (message.language) {
          analysis.languageDistribution.set(
            message.language,
            (analysis.languageDistribution.get(message.language) || 0) + 1
          );
        }

        // Speaker statistics
        if (message.speaker_id) {
          if (!analysis.speakerStats.has(message.speaker_id)) {
            analysis.speakerStats.set(message.speaker_id, {
              messageCount: 0,
              totalSentiment: 0,
              languages: new Set()
            });
          }
          const speakerStats = analysis.speakerStats.get(message.speaker_id);
          speakerStats.messageCount++;
          if (message.sentiment?.score) {
            speakerStats.totalSentiment += message.sentiment.score;
          }
          if (message.language) {
            speakerStats.languages.add(message.language);
          }
        }

        // Intent collection
        if (message.intent && Array.isArray(message.intent) && message.intent.length > 0) {
          message.intent.forEach(intent => analysis.intents.add(intent));
        }

        // Profanity tracking
        if (message.profanity?.score) {
          analysis.profanityLevel += message.profanity.score;
        }

        // Token counting
        if (message.usage?.total_tokens) {
          analysis.totalTokens += message.usage.total_tokens;
        }
      });

      const normalizeIntents = (intents) => {
        if (!intents || !Array.isArray(intents)) return [];
        
        return intents.map(intent => {
          if (typeof intent === 'string') {
            return intent;
          } else if (intent && typeof intent === 'object' && intent.intent) {
            return intent.intent; // Extract the string from the object
          } else {
            return 'unknown'; // Fallback for any other unexpected format
          }
        });
      };
      
      // Calculate averages and format for response
      const formatAnalysis = {
        sentimentDistribution: {
          positive: analysis.messageCount ? (analysis.overallSentiment.positive / analysis.messageCount) * 100 : 0,
          negative: analysis.messageCount ? (analysis.overallSentiment.negative / analysis.messageCount) * 100 : 0,
          neutral: analysis.messageCount ? (analysis.overallSentiment.neutral / analysis.messageCount) * 100 : 0
        },
        languages: Object.fromEntries(analysis.languageDistribution),
        speakers: Array.from(analysis.speakerStats).map(([id, stats]) => ({
          id,
          messageCount: stats.messageCount,
          averageSentiment: stats.messageCount ? stats.totalSentiment / stats.messageCount : 0,
          languages: Array.from(stats.languages)
        })),
        intents: normalizeIntents(Array.from(analysis.intents)),
        averageProfanityLevel: analysis.messageCount ? analysis.profanityLevel / analysis.messageCount : 0,
        totalTokens: analysis.totalTokens,
        messageCount: analysis.messageCount
      };

      return formatAnalysis;
    } catch (error) {
      console.error('Transcription analysis error:', error);
      return null; // Return null instead of throwing to prevent route handler errors
    }
  },

  async getTranscriptionText(interactionId) {
    try {
      const transcription = await InteractionTranscription.findOne({ interactionId });
      if (!transcription || !transcription.transcription || !Array.isArray(transcription.transcription)) {
        return null;
      }

      // Format transcription as chronological text
      const messages = [];
      transcription.transcription.forEach(messageObj => {
        // Get the timestamp (key) from the object
        const timestamp = Object.keys(messageObj)[0];
        if (!timestamp || !messageObj[timestamp]) {
          return; // Skip if invalid format
        }
        
        const message = messageObj[timestamp];
        messages.push({
          timestamp: Number(timestamp),
          speaker: message.speaker_id,
          text: message.translated_text || message.original_text,
          originalText: message.original_text,
          language: message.language
        });
      });

      // Sort by timestamp
      messages.sort((a, b) => a.timestamp - b.timestamp);

      return messages;
    } catch (error) {
      console.error('Transcription text error:', error);
      return null; // Return null instead of throwing to prevent route handler errors
    }
  }
};

async function getPaginatedTranscription(evaluationId, page, limit) {
  const skip = (page - 1) * limit;
  
  // First find the interaction ID from the evaluation
  const evaluation = await InteractionAIQA.findById(evaluationId)
    .select('interactionId')
    .lean();
    
  if (!evaluation) {
    throw new Error('Evaluation not found');
  }
  
  // Then find the transcription
  const transcription = await InteractionTranscription.findOne({
    interactionId: evaluation.interactionId
  });
  
  if (!transcription) {
    return { 
      items: [], 
      totalItems: 0,
      page,
      totalPages: 0
    };
  }
  
  // Get total count
  const totalItems = transcription.transcription?.length || 0;
  const totalPages = Math.ceil(totalItems / limit);
  
  // Get subset of transcription with pagination
  const items = transcription.transcription
    .slice(skip, skip + limit)
    .map(message => {
      // Normalize data here
      const timestamp = Object.keys(message)[0];
      if (timestamp && message[timestamp]) {
        const data = { ...message[timestamp] };
        
        // Normalize intent data
        if (data.intent) {
          data.intent = normalizeIntents(data.intent);
        }
        
        return { [timestamp]: data };
      }
      return message;
    });
  
  return {
    items,
    totalItems,
    page,
    totalPages
  };
}

module.exports = transcriptionService;