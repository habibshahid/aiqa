// services/qaDetailService.js - Fix for score retrieval
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

      // Get the evaluation
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
        'evaluationData.usage': 1,
        'interactionData.queue': 1,
        humanEvaluation: 1,
        sectionScores: 1 // Include section scores
      })
      .lean();

      if (!evaluation) {
        console.log('No evaluation found for ID:', id);
        return null;
      }

      // Debug scoring information
      console.log('Evaluation found:');
      console.log('  evaluationData.totalScore:', evaluation.evaluationData?.evaluation?.totalScore);
      console.log('  evaluationData.maxScore:', evaluation.evaluationData?.evaluation?.maxScore);
      
      if (evaluation.sectionScores?.overall) {
        console.log('  sectionScores.overall.rawScore:', evaluation.sectionScores.overall.rawScore);
        console.log('  sectionScores.overall.adjustedScore:', evaluation.sectionScores.overall.adjustedScore);
        console.log('  sectionScores.overall.maxScore:', evaluation.sectionScores.overall.maxScore);
        console.log('  sectionScores.overall.percentage:', evaluation.sectionScores.overall.percentage);
      }

      // Get transcription and other related data
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
        'queue.name': 1,
        'queue.duration': 1,
        'connect.duration': 1,
        'wrapUp.duration': 1,
        'extraPayload.callRecording': 1,
        _id: 0
      }).lean();

      // Normalize data
      const transcriptionAnalysis = transcription?.transcriptionAnalysis;
      const normalizedTranscription = transcription?.transcription ? 
        transcription.transcription : [];
      const normalizedRecordedTranscription = transcription?.recordedTranscription ? 
        transcription.recordedTranscription : [];

      // CRITICAL: Use the correct scores with classification impacts
      // Default to scores from evaluation data
      let totalScore = evaluation.evaluationData?.evaluation?.totalScore || 0;
      let maxScore = evaluation.evaluationData?.evaluation?.maxScore || 0;

      // If we have section scores, use the adjusted score that includes classification impacts
      if (evaluation.sectionScores && evaluation.sectionScores.overall) {
        // Use adjustedScore which has classification impacts applied
        totalScore = evaluation.sectionScores.overall.adjustedScore || totalScore;
        maxScore = evaluation.sectionScores.overall.maxScore || maxScore;
        
        console.log('Using sectionScores (includes classification impacts):');
        console.log('  adjustedScore:', totalScore);
        console.log('  maxScore:', maxScore);
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
        humanEvaluation: evaluation.humanEvaluation,
        // For backward compatibility
        agent: evaluation.interactionData?.agent,
        evaluation: {
          scores: {
            overall: {
              average: totalScore, // Use the adjusted score with classification impacts
              summary: evaluation.evaluationData?.evaluation?.summary,
              maxScore: maxScore,
            },
            categories: evaluation.evaluationData?.evaluation?.parameters || {}
          },
          areasOfImprovement: evaluation.evaluationData?.evaluation?.areasOfImprovements || [],
          whatTheAgentDidWell: evaluation.evaluationData?.evaluation?.whatTheAgentDidWell || [],
          problemAreas: evaluation.evaluationData?.evaluation?.problemAreas || [],
          summary: evaluation.evaluationData?.evaluation?.summary,
          intent: evaluation.evaluationData?.evaluation?.intent || [],
          customerSentiment: evaluation.evaluationData?.evaluation?.customerSentiment || [],
          agentSentiment: evaluation.evaluationData?.evaluation?.agentSentiment || [],
          silencePeriods: evaluation.evaluationData?.evaluation?.silencePeriods || [],
          // Add top-level properties for easier access - use the adjusted scores
          totalScore: totalScore,
          maxScore: maxScore
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
        transcriptionAnalysis: transcriptionAnalysis,
        evaluationData: evaluation.evaluationData || {},
        interactionData: evaluation.interactionData || {},
        // Include the section scores if available - important for classification impacts
        sectionScores: evaluation.sectionScores || null
      };
      
      // Final debug output showing scores in processed data
      console.log('Final processed data scores:');
      console.log('  totalScore:', processed.evaluation.totalScore);
      console.log('  maxScore:', processed.evaluation.maxScore);
      console.log('  percentage:', (processed.evaluation.totalScore / processed.evaluation.maxScore * 100) || 0);
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