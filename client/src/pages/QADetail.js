import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const formatDuration = (duration) => {
  if (!duration || duration === '0:00') return '0:00';
  return duration;
};

const ScoreCard = ({ title, value, bgColor = 'bg-primary' }) => (
  <div className="col-md-3">
    <div className="card mb-3">
      <div className={`card-body ${bgColor} text-white`}>
        <h6 className="card-subtitle mb-2">{title}</h6>
        <h2 className="card-title mb-0">{value}</h2>
      </div>
    </div>
  </div>
);

// Original format Transcription Row (for 'realtime' version)
const TranscriptionRow = ({ message, timestamp }) => {
  try {
    const formatTimestamp = (timestamp) => {
      if (!timestamp) return 'N/A';
      
      // Check if timestamp is a valid number (epoch time in milliseconds)
      const timestampNum = parseInt(timestamp);
      if (!isNaN(timestampNum)) {
        try {
          // Format the date into a human-readable time format
          const date = new Date(timestampNum);
          return date.toLocaleTimeString();
        } catch (e) {
          console.error('Error parsing timestamp as integer:', e);
        }
      }
      
      // Return the original timestamp if parsing fails
      return timestamp;
    };

    // Ensure data exists
    if (!message || !message[timestamp]) {
      console.log('Invalid message data for timestamp:', timestamp);
      return (
        <tr>
          <td colSpan="6" className="text-center text-muted">
            Invalid message data
          </td>
        </tr>
      );
    }
    const data = message[timestamp];
    
    return (
      <tr>
        <td className="text-nowrap">
          {formatTimestamp(timestamp)}
        </td>
        <td>
          <span className={`badge bg-${data.speaker_id?.includes('agent') ? 'primary' : 'success'}`}>
            {data.speaker_id?.includes('agent') ? 'Agent' : 'Customer'}
          </span>
        </td>
        <td>
          <div>{data.translated_text || data.original_text}</div>
          {data.translated_text && data.original_text !== data.translated_text && (
            <small className="text-muted d-block">
              Original: {data.original_text}
            </small>
          )}
        </td>
        <td>
          <span className="badge bg-info">
            {data.language?.toUpperCase()}
          </span>
        </td>
        <td>
          <div className={`badge bg-${
            data.sentiment?.sentiment === 'positive' ? 'success' :
            data.sentiment?.sentiment === 'negative' ? 'danger' : 'warning'
          }`}>
            {data.sentiment?.sentiment || 'neutral'}
          </div>
          {data.sentiment?.score && (
            <small className="d-block text-muted mt-1">
              {(data.sentiment.score * 100).toFixed(0)}%
            </small>
          )}
        </td>
        <td>
          {data.intent?.map((intent, i) => (
            <span key={i} className="badge bg-secondary d-block mb-1">
              {intent}
            </span>
          ))}
        </td>
      </tr>
    );
  } catch (error) {
    console.error('Error rendering transcription row:', error);
    return (
      <tr>
        <td colSpan="6" className="text-center text-danger">
          Error displaying message
        </td>
      </tr>
    );
  }
};

// New format Transcription Row (for 'recorded' version)
const RecordedTranscriptionRow = ({ entry }) => {
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    // Check if timestamp is a valid number (epoch time in milliseconds)
    const timestampNum = parseInt(timestamp);
    if (!isNaN(timestampNum)) {
      try {
        // Format the date into a human-readable time format
        const date = new Date(timestampNum);
        return date.toLocaleTimeString();
      } catch (e) {
        console.error('Error parsing timestamp as integer:', e);
      }
    }
    
    // Return the original timestamp if parsing fails
    return timestamp;
  };
  console.log(entry)
  return (
    <tr>
      <td className="text-nowrap">
        {formatTimestamp(entry.timestamp)}
      </td>
      <td>
        <span className={`badge bg-${entry.speaker_id.includes('agent') ? 'primary' : 'success'}`}>
          {entry.speaker_id.includes('agent') ? 'Agent' : 'Customer'}
        </span>
      </td>
      <td>
        <div>{entry.translated_text || entry.original_text}</div>
        {entry.translated_text && entry.original_text !== entry.translated_text && (
          <small className="text-muted d-block">
            Original: {entry.original_text}
          </small>
        )}
      </td>
      <td>
        <span className="badge bg-info">
          {entry.language?.toUpperCase()}
        </span>
      </td>
      <td>
        <div className={`badge bg-${
          entry.sentiment?.sentiment === 'positive' ? 'success' :
          entry.sentiment?.sentiment === 'negative' ? 'danger' : 'warning'
        }`}>
          {entry.sentiment?.sentiment || 'neutral'}
        </div>
        {entry.sentiment?.score && (
          <small className="d-block text-muted mt-1">
            {(entry.sentiment.score * 100).toFixed(0)}%
          </small>
        )}
      </td>
      <td>
        {entry.intent?.map((intent, i) => (
          <span key={i} className="badge bg-secondary d-block mb-1">
            {intent}
          </span>
        ))}
      </td>
    </tr>
  );
};

const QADetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTranscription, setShowTranscription] = useState(false);

  useEffect(() => {
    const fetchEvaluation = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/qa/evaluation/${id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch evaluation');
        }

        const data = await response.json();
        console.log('Evaluation Data:', data);
        setEvaluation(data);
      } catch (err) {
        console.error('Error fetching evaluation:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEvaluation();
  }, [id]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !evaluation) {
    return (
      <div className="text-center my-5">
        <div className="alert alert-danger">
          <h4>Failed to load evaluation</h4>
          <p>{error || 'Evaluation not found'}</p>
          <button 
            className="btn btn-primary mt-3"
            onClick={() => navigate('/dashboard')}
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Enhanced transcription detection
  const hasTranscription = () => {
    if (!evaluation) return false;
    
    // Check multiple possible transcription sources
    const transcriptionSources = [
      evaluation.transcription,
      evaluation.recordedTranscription,
      evaluation.transcriptionAnalysis
    ];

    return transcriptionSources.some(source => 
      source && 
      ((Array.isArray(source) && source.length > 0) || 
       (typeof source === 'object' && Object.keys(source).length > 0))
    );
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    // Check if timestamp is a valid number (epoch time in milliseconds)
    const timestampNum = parseInt(timestamp);
    if (!isNaN(timestampNum)) {
      try {
        // Format the date into a human-readable time format
        const date = new Date(timestampNum);
        return date.toLocaleTimeString();
      } catch (e) {
        console.error('Error parsing timestamp as integer:', e);
      }
    }
    
    // Return the original timestamp if parsing fails
    return timestamp;
  };

  const formatDurationHumanReadable = (seconds) => {
    if (!seconds || isNaN(seconds)) return 'N/A';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    let result = '';
    
    if (hours > 0) {
      result += `${hours} ${hours === 1 ? 'hr' : 'hrs'} `;
    }
    
    if (minutes > 0 || hours > 0) {
      result += `${minutes} ${minutes === 1 ? 'min' : 'mins'} `;
    }
    
    if (remainingSeconds > 0 || (hours === 0 && minutes === 0)) {
      result += `${remainingSeconds} ${remainingSeconds === 1 ? 'sec' : 'secs'}`;
    }
    
    return result.trim();
  };
  
  // Helper function to select the appropriate transcription data
  const getTranscriptionData = () => {
    if (!evaluation) return [];

    // Prioritize recordedTranscription, then transcription, then fall back to empty array
    if (Array.isArray(evaluation.recordedTranscription) && evaluation.recordedTranscription.length > 0) {
      return evaluation.recordedTranscription;
    }

    if (Array.isArray(evaluation.transcription) && evaluation.transcription.length > 0) {
      // If transcription is an array of objects with timestamps
      return evaluation.transcription.map(message => {
        const timestamp = Object.keys(message)[0];
        let msg = message[timestamp];
        msg.timestamp = formatTimestamp(timestamp);
        return msg;
      });
    }

    return [];
  };

  // Helper to get agent sentiment
  const getAgentSentiment = () => {
    if (!evaluation?.evaluation?.agentSentiment) return 'neutral';
    
    return Array.isArray(evaluation.evaluation.agentSentiment) 
      ? evaluation.evaluation.agentSentiment[0] 
      : evaluation.evaluation.agentSentiment;
  };

  // Helper to get customer sentiment
  const getCustomerSentiment = () => {
    if (!evaluation?.evaluation?.customerSentiment) return 'neutral';
    
    return Array.isArray(evaluation.evaluation.customerSentiment) 
      ? evaluation.evaluation.customerSentiment[0] 
      : evaluation.evaluation.customerSentiment;
  };

  // Helper to get sentiment badge color
  const getSentimentColor = (sentiment) => {
    return sentiment === 'positive' ? 'bg-success' :
           sentiment === 'negative' ? 'bg-danger' : 'bg-warning';
  };

  const getOverallScore = () => {
    //return evaluation.evaluation?.scores?.overall?.average || 0;
    return evaluation.evaluation?.scores?.overall?.average ? `${evaluation.evaluation?.scores?.overall?.average} / ${evaluation.evaluation?.scores?.overall?.maxScore}` : 0;
  };

  const getTranslatedText = (entry) => {
    if (!entry) return '';
    
    // If translated_text is an object with translatedText property
    if (entry.translated_text && typeof entry.translated_text === 'object' && entry.translated_text.translatedText) {
      return entry.translated_text.translatedText;
    }
    
    // Otherwise return translated_text if it's a string, or fall back to original_text
    return typeof entry.translated_text === 'string' ? entry.translated_text : entry.original_text;
  };

  return (
    <div className="container-fluid py-4">
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">QA Evaluation Details</h1>
        <button 
          className="btn btn-outline-primary"
          onClick={() => navigate('/dashboard')}
        >
          Back to Dashboard
        </button>
      </div>

      {/* Stats Cards */}
      <div className="row g-3 mb-4">
        <ScoreCard 
          title="Overall Score" 
          value={getOverallScore()}
          bgColor="bg-primary"
        />
        <ScoreCard 
          title="Agent Sentiment" 
          value={getAgentSentiment()}
          bgColor={getSentimentColor(getAgentSentiment())}
        />
        <ScoreCard 
          title="Customer Sentiment" 
          value={getCustomerSentiment()}
          bgColor={getSentimentColor(getCustomerSentiment())}
        />
        <ScoreCard 
          title="Intent" 
          value={evaluation.evaluation?.intent?.[0] || 'N/A'}
          bgColor="bg-secondary"
        />
      </div>

      {/* Sentiment Analysis Section */}
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title mb-0">Sentiment Analysis</h5>
        </div>
        <div className="card-body">
          <div className="row">
            <div className="col-md-6">
              <h6 className="mb-3">Agent Sentiment</h6>
              <div className="d-flex align-items-center">
                <div className={`badge ${getSentimentColor(getAgentSentiment())} me-2`}>
                  {getAgentSentiment()}
                </div>
                <span className="text-muted small">Overall Call Sentiment</span>
              </div>
            </div>
            <div className="col-md-6">
              <h6 className="mb-3">Customer Sentiment</h6>
              <div className="d-flex align-items-center">
                <div className={`badge ${getSentimentColor(getCustomerSentiment())} me-2`}>
                  {getCustomerSentiment()}
                </div>
                <span className="text-muted small">Overall Call Sentiment</span>
              </div>
            </div>
          </div>
          
          <div className="mt-4">
            <h6 className="mb-3">Sentiment Trends</h6>
            <div className="table-responsive">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Start</th>
                    <th>Middle</th>
                    <th>End</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Agent</td>
                    <td>
                      <span className={`badge ${getSentimentColor(
                        Array.isArray(evaluation.evaluation?.agentSentiment) ?
                          evaluation.evaluation.agentSentiment[0] : getAgentSentiment()
                      )}`}>
                        {Array.isArray(evaluation.evaluation?.agentSentiment) ? 
                          (evaluation.evaluation.agentSentiment[0] || 'neutral') : 
                          getAgentSentiment()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getSentimentColor(
                        Array.isArray(evaluation.evaluation?.agentSentiment) ?
                          evaluation.evaluation.agentSentiment[1] : 'neutral'
                      )}`}>
                        {Array.isArray(evaluation.evaluation?.agentSentiment) ? 
                          (evaluation.evaluation.agentSentiment[1] || 'neutral') : 
                          'neutral'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getSentimentColor(
                        Array.isArray(evaluation.evaluation?.agentSentiment) ?
                          evaluation.evaluation.agentSentiment[2] : 'neutral'
                      )}`}>
                        {Array.isArray(evaluation.evaluation?.agentSentiment) ? 
                          (evaluation.evaluation.agentSentiment[2] || 'neutral') : 
                          'neutral'}
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td>Customer</td>
                    <td>
                      <span className={`badge ${getSentimentColor(
                        Array.isArray(evaluation.evaluation?.customerSentiment) ?
                          evaluation.evaluation.customerSentiment[0] : getCustomerSentiment()
                      )}`}>
                        {Array.isArray(evaluation.evaluation?.customerSentiment) ? 
                          (evaluation.evaluation.customerSentiment[0] || 'neutral') : 
                          getCustomerSentiment()}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getSentimentColor(
                        Array.isArray(evaluation.evaluation?.customerSentiment) ?
                          evaluation.evaluation.customerSentiment[1] : 'neutral'
                      )}`}>
                        {Array.isArray(evaluation.evaluation?.customerSentiment) ? 
                          (evaluation.evaluation.customerSentiment[1] || 'neutral') : 
                          'neutral'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getSentimentColor(
                        Array.isArray(evaluation.evaluation?.customerSentiment) ?
                          evaluation.evaluation.customerSentiment[2] : 'neutral'
                      )}`}>
                        {Array.isArray(evaluation.evaluation?.customerSentiment) ? 
                          (evaluation.evaluation.customerSentiment[2] || 'neutral') : 
                          'neutral'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Call Summary */}
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title mb-0">Call Summary</h5>
        </div>
        <div className="card-body">
          <div className="row mb-4">
            <div className="col-md-6">
              <h6 className="mb-3">Duration Details</h6>
              <table className="table table-sm">
                <tbody>
                  <tr>
                    <td><strong>Queue Duration:</strong></td>
                    <td>{formatDurationHumanReadable(evaluation.interaction?.timestamps?.queueDuration)}</td>
                  </tr>
                  <tr>
                    <td><strong>Talk Duration:</strong></td>
                    <td>{formatDurationHumanReadable(evaluation.interaction?.timestamps?.talkDuration)}</td>
                  </tr>
                  <tr>
                    <td><strong>Wrap Up Duration:</strong></td>
                    <td>{formatDurationHumanReadable(evaluation.interaction?.timestamps?.wrapUpDuration)}</td>
                  </tr>
                  {evaluation.interaction?.workCodes && evaluation.interaction.workCodes.length > 0 && (
                    <tr>
                      <td><strong>Work Codes:</strong></td>
                      <td>
                        {evaluation.interaction.workCodes.map((code, index) => (
                          <span key={index} className="badge bg-light text-dark me-1 mb-1">
                            {code.name || code.code}
                          </span>
                        ))}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="col-md-6">
              <h6 className="mb-3">Contact Details</h6>
              <table className="table table-sm">
                <tbody>
                  <tr>
                    <td><strong>Agent:</strong></td>
                    <td>{evaluation.agent?.name || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td><strong>Direction:</strong></td>
                    <td className="text-capitalize">{evaluation.interaction?.direction || 'inbound'}</td>
                  </tr>
                  <tr>
                    <td><strong>Channel:</strong></td>
                    <td className="text-capitalize">{evaluation.interaction?.channel || 'voice'}</td>
                  </tr>
                  <tr>
                    <td><strong>Customer ID:</strong></td>
                    <td>{evaluation.interaction?.caller?.id || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td><strong>Evaluated By:</strong></td>
                    <td>{evaluation.evaluator?.name || 'AI System'}</td>
                  </tr>
                  <tr>
                    <td><strong>Evaluation Date:</strong></td>
                    <td>{evaluation.createdAt ? format(new Date(evaluation.createdAt), 'MMM d, yyyy h:mm a') : 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="mt-4">
            <h6 className="mb-3">Evaluation Summary</h6>
            <p className="text-muted mb-0">
              {evaluation.evaluation?.summary || 'No summary available'}
            </p>
          </div>
        </div>
      </div>

      {/* Call Recording */}
      {evaluation.interaction?.recording?.webPath && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="card-title mb-0">Call Recording</h5>
          </div>
          <div className="card-body">
            <audio 
              controls 
              className="w-100" 
              controlsList="nodownload"
              preload="metadata"
            >
              <source 
                src={`/api/audio-proxy?url=${encodeURIComponent(evaluation.interaction.recording.webPath)}`}
                type="audio/mpeg"
              />
              <p>Your browser does not support the audio element.</p>
            </audio>
          </div>
        </div>
      )}

      {/* Areas of Improvement */}
      {evaluation.evaluation?.areasOfImprovement?.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="card-title mb-0">Areas of Improvement</h5>
          </div>
          <div className="card-body p-0">
            <ul className="list-group list-group-flush">
              {evaluation.evaluation.areasOfImprovement.map((area, index) => (
                <li key={index} className="list-group-item">
                  <i className="bi bi-exclamation-triangle text-warning me-2"></i>
                  {area}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      
      {/* What the Agent Did Well */}
      {evaluation.evaluation?.whatTheAgentDidWell?.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="card-title mb-0">What the Agent Did Well</h5>
          </div>
          <div className="card-body p-0">
            <ul className="list-group list-group-flush">
              {evaluation.evaluation.whatTheAgentDidWell.map((strength, index) => (
                <li key={index} className="list-group-item">
                  <i className="bi bi-check-circle text-success me-2"></i>
                  {strength}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Evaluation Criteria Section */}
      {evaluation.evaluation?.scores?.categories && Object.keys(evaluation.evaluation.scores.categories).length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="card-title mb-0">Evaluation Criteria</h5>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Criterion</th>
                    <th>Score</th>
                    <th>Confidence</th>
                    <th>Explanation</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(evaluation.evaluation.scores.categories).map(([criterion, data]) => (
                    <tr key={criterion}>
                      <td>{criterion}</td>
                      <td>
                        <span className={`badge bg-${
                          data.score >= 4 ? 'success' :
                          data.score >= 3 ? 'warning' : 'danger'
                        }`}>
                          {data.score}/5
                        </span>
                      </td>
                      <td>
                        <span className="text-capitalize">{data.confidence}</span>
                      </td>
                      <td>{data.explanation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Silence Periods */}
      {evaluation.evaluation?.silencePeriods?.length > 0 && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="card-title mb-0">Silence Periods</h5>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>To</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluation.evaluation.silencePeriods.map((period, index) => (
                    <tr key={index}>
                      <td>{period.fromTimeStamp}</td>
                      <td>{period.toTimeStamp}</td>
                      <td>{period.silenceDuration} seconds</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Transcription */}
      {hasTranscription() && (
        <div className="card mb-4">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="card-title mb-0">
              Conversation Transcription 
              {evaluation.transcriptionVersion && (
                <span className="ms-2 badge bg-info">
                  {evaluation.transcriptionVersion}
                </span>
              )}
            </h5>
            <button
              className="btn btn-sm btn-outline-primary"
              onClick={() => setShowTranscription(!showTranscription)}
            >
              {showTranscription ? 'Hide Transcription' : 'Show Transcription'}
            </button>
          </div>
          
          {showTranscription && (
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Speaker</th>
                      <th>Message</th>
                      <th>Language</th>
                      <th>Sentiment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getTranscriptionData().map((entry, index) => (
                      <tr key={index}>
                        <td className="text-nowrap">
                          {entry.timestamp || 'N/A'}
                        </td>
                        <td>
                          <span className={`badge bg-${
                            entry.speaker_id?.includes('agent') ? 'primary' : 'success'
                          }`}>
                            {entry.speaker_id?.includes('agent') ? 'Agent' : 'Customer'}
                          </span>
                        </td>
                        <td>
                          <div>{getTranslatedText(entry)}</div>
                          {entry.original_text && getTranslatedText(entry) !== entry.original_text && (
                            <small className="text-muted d-block">
                              Original: {entry.original_text}
                            </small>
                          )}
                        </td>
                        <td>
                          <span className="badge bg-info">
                            {entry.language?.toUpperCase() || 'N/A'}
                          </span>
                        </td>
                        <td>
                          <div className={`badge bg-${
                            entry.sentiment?.sentiment === 'positive' ? 'success' :
                            entry.sentiment?.sentiment === 'negative' ? 'danger' : 'warning'
                          }`}>
                            {entry.sentiment?.sentiment || 'neutral'}
                          </div>
                          {entry.sentiment?.score && (
                            <small className="d-block text-muted mt-1">
                              {(entry.sentiment.score * 100).toFixed(0)}%
                            </small>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transcription Analysis Section */}
      {evaluation.transcriptionAnalysis && (
        <div className="card mb-4">
          <div className="card-header">
            <h5 className="card-title mb-0">Transcription Analysis</h5>
          </div>
          <div className="card-body">
            {/* Sentiment Distribution */}
            <div className="row mb-4">
              <div className="col-md-12">
                <h6 className="mb-3">Sentiment Distribution</h6>
                <div className="d-flex justify-content-between">
                  <div className="text-center flex-grow-1">
                    <span className="badge bg-success">Positive</span>
                    <h3>{evaluation.transcriptionAnalysis.sentimentDistribution?.positive?.toFixed(1) || 0}%</h3>
                  </div>
                  <div className="text-center flex-grow-1">
                    <span className="badge bg-danger">Negative</span>
                    <h3>{evaluation.transcriptionAnalysis.sentimentDistribution?.negative?.toFixed(1) || 0}%</h3>
                  </div>
                  <div className="text-center flex-grow-1">
                    <span className="badge bg-warning">Neutral</span>
                    <h3>{evaluation.transcriptionAnalysis.sentimentDistribution?.neutral?.toFixed(1) || 0}%</h3>
                  </div>
                </div>
              </div>
            </div>

            {/* Languages */}
            <div className="row mb-4">
              <div className="col-md-12">
                <h6 className="mb-3">Languages Detected</h6>
                <div>
                  {Object.entries(evaluation.transcriptionAnalysis.languages || {})
                    .sort((a, b) => b[1] - a[1])
                    .map(([language, count]) => (
                      <span key={language} className="badge bg-info me-2 mb-2">
                        {language.toUpperCase()}: {count}
                      </span>
                    ))
                  }
                </div>
              </div>
            </div>

            {/* Speakers Analysis */}
            <div className="row mb-4">
              <div className="col-md-12">
                <h6 className="mb-3">Speakers Analysis</h6>
                <div className="table-responsive">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Speaker</th>
                        <th>Messages</th>
                        <th>Average Sentiment</th>
                        <th>Languages</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evaluation.transcriptionAnalysis.speakers?.map((speaker, index) => (
                        <tr key={index}>
                          <td>{speaker.id}</td>
                          <td>{speaker.messageCount}</td>
                          <td>
                            <span className={`badge ${
                              speaker.averageSentiment > 0.2 ? 'bg-success' :
                              speaker.averageSentiment < -0.2 ? 'bg-danger' : 'bg-warning'
                            }`}>
                              {speaker.averageSentiment.toFixed(2)}
                            </span>
                          </td>
                          <td>
                            {speaker.languages.map((lang, langIndex) => (
                              <span key={langIndex} className="badge bg-secondary me-1">
                                {lang.toUpperCase()}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Intents */}
            <div className="row">
              <div className="col-md-12">
                <h6 className="mb-3">Detected Intents</h6>
                <div>
                  {evaluation.transcriptionAnalysis.intents?.map((intent, index) => (
                    <span key={index} className="badge bg-secondary me-2 mb-2">
                      {intent}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Additional Metrics */}
            <div className="row mt-4">
              <div className="col-md-6">
                <div className="card">
                  <div className="card-body">
                    <h6 className="card-subtitle mb-2 text-muted">Total Tokens</h6>
                    <h4>{evaluation.transcriptionAnalysis.totalTokens || 0}</h4>
                  </div>
                </div>
              </div>
              <div className="col-md-6">
                <div className="card">
                  <div className="card-body">
                    <h6 className="card-subtitle mb-2 text-muted">Message Count</h6>
                    <h4>{evaluation.transcriptionAnalysis.messageCount || 0}</h4>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QADetail;