// services/qaDetailService.js
const { InteractionAIQA, InteractionTranscription, Interactions } = require('../config/mongodb');
const mongoose = require('mongoose');

/**
 * Normalizes intent data to handle both string and object formats
 * @param {Array} intents - Array of intents which might contain strings or objects
 * @returns {Array} - Array of string intents
 */
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

const qaDetailService = {
  async getQAEvaluationDetail(id) {
    try {
      console.log('\n=== QA Detail Service: Start ===');
      console.log('Looking up QA evaluation with ID:', id);

      // Convert string ID to ObjectId
      const objectId = new mongoose.Types.ObjectId(id);

      // Get the evaluation using aggregation to ensure we get all fields
      const evaluation = await InteractionAIQA.findById(objectId)
      .select({
        interactionId: 1, 
        qaFormName: 1, 
        qaFormId: 1, 
        createdAt: 1, 
        updatedAt: 1, 
        status: 1,
        evaluator: 1,
        'interactionData.agent': 1,
        'interactionData.caller': 1,
        'interactionData.direction': 1,
        'interactionData.channel': 1,
        'evaluationData.evaluation': 1,
        'evaluationData.usage': 1
      })
      .lean();

      if (!evaluation) {
        console.log('No evaluation found for ID:', id);
        return null;
      }

      const transcription = await InteractionTranscription.findOne({
        interactionId: evaluation.interactionId
      })
      .select({
        transcription: 1,
        transcriptionVersion: 1,
        recordedTranscription: 1,
        _id: 0
      })
      .lean();

      const interactionObjectId = mongoose.Types.ObjectId.isValid(evaluation.interactionId) 
      ? new mongoose.Types.ObjectId(evaluation.interactionId) 
      : evaluation.interactionId;
      
      const interaction = await Interactions.findOne({
        _id: interactionObjectId
      }, {
        'queue.duration': 1,
        'connect.duration': 1,
        'wrapUp.duration': 1,
        'extraPayload.callRecording': 1,
        _id: 0
      }).lean();

      console.log('Interaction found:', !!interaction);

      // Normalize intent data for transcriptionAnalysis
      let transcriptionAnalysis = null;
      if (transcription?.transcriptionAnalysis) {
        transcriptionAnalysis = { ...transcription.transcriptionAnalysis };
        
        // Normalize intents in transcriptionAnalysis
        if (transcriptionAnalysis.intents) {
          transcriptionAnalysis.intents = normalizeIntents(transcriptionAnalysis.intents);
        }
      }

      // Normalize transcription data
      let normalizedTranscription = [];
      if (transcription?.transcription && Array.isArray(transcription.transcription)) {
        normalizedTranscription = transcription.transcription.map(message => {
          const timestamp = Object.keys(message)[0];
          if (timestamp && message[timestamp]) {
            const data = { ...message[timestamp] };
            
            // Normalize intent data in each message
            if (data.intent) {
              data.intent = normalizeIntents(data.intent);
            }
            
            return { [timestamp]: data };
          }
          return message;
        });
      }

      // Normalize recorded transcription if it exists
      let normalizedRecordedTranscription = [];
      if (transcription?.recordedTranscription && Array.isArray(transcription.recordedTranscription)) {
        normalizedRecordedTranscription = transcription.recordedTranscription.map(entry => {
          const newEntry = { ...entry };
          
          // Normalize intent data in each entry
          if (newEntry.intent) {
            newEntry.intent = normalizeIntents(newEntry.intent);
          }
          
          return newEntry;
        });
      }

      // Process the evaluation data
      const processed = {
        id: evaluation._id,
        interactionId: evaluation.interactionId,
        qaFormName: evaluation.qaFormName,
        qaFormId: evaluation.qaFormId,
        createdAt: evaluation.createdAt,
        updatedAt: evaluation.updatedAt,
        status: evaluation.status,
        evaluator: evaluation.evaluator || { id: 'system', name: 'AI System' },
        // Keep the original data structure for backward compatibility 
        agent: evaluation.interactionData?.agent,
        evaluation: {
          scores: {
            overall: {
              average: evaluation.evaluationData?.evaluation?.totalScore || 0, // Updated path
              summary: evaluation.evaluationData?.evaluation?.summary,        // Updated path
              maxScore: evaluation.evaluationData?.evaluation?.maxScore || 0, // Updated path
            },
            categories: evaluation.evaluationData?.evaluation?.parameters || {} // Updated path
          },
          areasOfImprovement: evaluation.evaluationData?.evaluation?.areasOfImprovements || [], // Updated path
          whatTheAgentDidWell: evaluation.evaluationData?.evaluation?.whatTheAgentDidWell || [], 
          problemAreas: evaluation.evaluationData?.evaluation?.problemAreas || [],
          summary: evaluation.evaluationData?.evaluation?.summary, // Updated path
          intent: normalizeIntents(evaluation.evaluationData?.evaluation?.intent || []), // Normalize intent
          customerSentiment: evaluation.evaluationData?.evaluation?.customerSentiment || [], // Updated path
          agentSentiment: evaluation.evaluationData?.evaluation?.agentSentiment || [], // Updated path
          silencePeriods: evaluation.evaluationData?.evaluation?.silencePeriods || [] // Updated path
        },
        interaction: {
          id: evaluation.interactionId,
          agent: evaluation.interactionData?.agent,
          timestamps: {
            createdAt: evaluation.createdAt,
            queueDuration: interaction?.queue?.duration || 0,
            talkDuration: interaction?.connect?.duration || 0,
            wrapUpDuration: interaction?.wrapUp?.duration || 0
          },
          direction: evaluation.interactionData?.direction,
          caller: evaluation.interactionData?.caller || {},
          queue: interaction?.queue || {},
          recording: interaction?.extraPayload?.callRecording || null,
          channel: evaluation.interactionData?.channel || 'call'
        },
        transcription: normalizedTranscription,
        transcriptionVersion: transcription?.transcriptionVersion || 'realtime',
        recordedTranscription: normalizedRecordedTranscription,
        // Add normalized transcription analysis
        transcriptionAnalysis: transcriptionAnalysis,
        // Add original data structure
        evaluationData: evaluation.evaluationData || {},
        interactionData: evaluation.interactionData || {}
      };
      
      // Add debug logging for processed data
      console.log('Processed data structure:', {
        hasAgentInfo: !!processed.agent,
        hasEvaluationScores: !!processed.evaluation.scores,
        categoriesCount: Object.keys(processed.evaluation.scores.categories).length,
        hasTranscription: processed.transcription.length > 0,
        hasEvaluationData: !!processed.evaluationData,
        sentiment: {
          agent: processed.evaluation.agentSentiment,
          customer: processed.evaluation.customerSentiment
        }
      });

      console.log('=== QA Detail Service: Complete ===\n');

      return processed;
    } catch (error) {
      console.error('\n=== QA Detail Service: Error ===');
      console.error('Error:', error);
      throw error;
    }
  }
};

module.exports = qaDetailService;