import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Edit, Eye, EyeOff, MessageSquare, CheckCircle, XCircle, AlertTriangle, Save, Lock, AlertCircle, Clock, Users, Hash } from 'lucide-react';
import Select from 'react-select';

const TEXT_CHANNELS = ['whatsapp', 'fb_messenger', 'facebook', 'instagram_dm', 'chat', 'email', 'sms'];

const CHANNEL_DISPLAY_NAMES = {
  'call': 'Voice Call',
  'whatsapp': 'WhatsApp',
  'fb_messenger': 'Facebook Messenger',
  'facebook': 'Facebook Comments', 
  'instagram_dm': 'Instagram DM',
  'email': 'Email',
  'chat': 'Live Chat',
  'sms': 'SMS'
};

// Classification Badge Component with improved visibility and interaction
const ClassificationBadge = ({ classification, onRemove = null, disabled = false }) => {
  if (!classification) return <span className="badge bg-secondary">None</span>;
  
  const classificationMap = {
    minor: { label: 'Minor', color: 'info', impact: 10 },
    moderate: { label: 'Moderate', color: 'warning', impact: 25 },
    major: { label: 'Major', color: 'danger', impact: 50 },
    none: { label: 'None', color: 'secondary', impact: 0 }
  };
  
  const config = classificationMap[classification] || { label: classification, color: 'secondary', impact: 0 };
  
  return (
    <div className="d-inline-flex align-items-center">
      <span
        className={`badge bg-${config.color} me-1`}
        title={`${config.label} issues deduct up to ${config.impact}% of score`}
      >
        {config.label}
      </span>
      {onRemove && !disabled && (
        <button 
          className="btn btn-sm btn-link text-muted p-0 ms-1" 
          onClick={onRemove} 
          title="Remove classification"
        >
          <XCircle size={14} />
        </button>
      )}
    </div>
  );
};

// Enhanced Score Card Component
const ScoreCard = ({ title, value, maxValue, percentage, bgColor = 'bg-primary', subtitle = null }) => (
  <div className="col-md-3">
    <div className="card mb-3">
      <div className={`card-body ${bgColor} text-white`}>
        <h6 className="card-subtitle mb-2">{title}</h6>
        <h2 className="card-title mb-0">{value} / {maxValue} ({percentage}%)</h2>
        {subtitle && <small>{subtitle}</small>}
      </div>
    </div>
  </div>
);

const EnhancedScoreCard = ({ evaluation, scores }) => {
  const scoringMechanism = evaluation.scoringMechanism || 'award';
  const isDeductMode = scoringMechanism === 'deduct';
  const formTotalScore = evaluation.formTotalScore || scores.overall.maxScore;
  const totalDeductions = evaluation.evaluationData?.evaluation?.totalDeductions || 0;
  
  if (isDeductMode) {
    return (
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card mb-3">
            <div className="card-body bg-primary text-white">
              <h6 className="card-subtitle mb-2">Starting Score</h6>
              <h2 className="card-title mb-0">{formTotalScore}</h2>
              <small>Total available points</small>
            </div>
          </div>
        </div>
        
        <div className="col-md-3">
          <div className="card mb-3">
            <div className="card-body bg-danger text-white">
              <h6 className="card-subtitle mb-2">Total Deductions</h6>
              <h2 className="card-title mb-0">-{totalDeductions}</h2>
              <small>Points deducted</small>
            </div>
          </div>
        </div>
        
        <div className="col-md-3">
          <div className="card mb-3">
            <div className="card-body bg-warning text-dark">
              <h6 className="card-subtitle mb-2">Classification Impact</h6>
              <h2 className="card-title mb-0">
                -{(scores.overall.rawScore - scores.overall.adjustedScore).toFixed(1)}
              </h2>
              <small>Additional deductions</small>
            </div>
          </div>
        </div>
        
        <div className="col-md-3">
          <div className="card mb-3">
            <div className={`card-body ${
              scores.overall.percentage >= 80 ? 'bg-success' :
              scores.overall.percentage >= 60 ? 'bg-warning' : 'bg-danger'
            } text-white`}>
              <h6 className="card-subtitle mb-2">Final Score</h6>
              <h2 className="card-title mb-0">
                {scores.overall.adjustedScore.toFixed(1)} / {formTotalScore}
              </h2>
              <small>{scores.overall.percentage}%</small>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Award mode - existing display
  return (
    <div className="row mb-4">
      <ScoreCard 
        title="Raw Score" 
        value={scores.overall.rawScore.toFixed(1)} 
        maxValue={scores.overall.maxScore} 
        percentage={Math.round((scores.overall.rawScore / scores.overall.maxScore) * 100)}
        bgColor="bg-info"
        subtitle="Before classification impacts"
      />
      <ScoreCard 
        title="Classification Impact" 
        value={`-${(scores.overall.rawScore - scores.overall.adjustedScore).toFixed(1)}`} 
        maxValue="" 
        percentage=""
        bgColor="bg-warning"
        subtitle="Points deducted"
      />
      <ScoreCard 
        title="Final Score" 
        value={scores.overall.adjustedScore.toFixed(1)} 
        maxValue={scores.overall.maxScore} 
        percentage={scores.overall.percentage}
        bgColor={scores.overall.percentage >= 80 ? 'bg-success' : 
                scores.overall.percentage >= 60 ? 'bg-warning' : 'bg-danger'}
        subtitle="After all adjustments"
      />
    </div>
  );
};

// NEW: Channel Info Component
const ChannelInfoSection = ({ evaluation, messageData }) => {
  const channel = evaluation.interactionData?.channel || evaluation.interaction?.channel || 'call';
  const channelName = CHANNEL_DISPLAY_NAMES[channel] || channel;
  const isText = TEXT_CHANNELS.includes(channel);
  const isEmail = channel === 'email';
  
  return (
    <div className="col-md-6">
      <h5>Channel Information</h5>
      <div className="d-flex align-items-center mb-2">
        <span className={`badge ${isText ? 'bg-info' : 'bg-primary'} me-2`}>
          {channelName}
        </span>
        <small className="text-muted">
          {isText ? (isEmail ? 'Email Conversation' : 'Text Conversation') : 'Voice Call'}
        </small>
      </div>
      
      {isText && messageData && (
        <>
          <p className="mb-1">
            <strong>{isEmail ? 'Emails' : 'Messages'}:</strong> {messageData.stats?.totalMessages || 0}
          </p>
          <p className="mb-1">
            <strong>Duration:</strong> {Math.round(messageData.stats?.duration || 0)}s
          </p>
          <p className="mb-1">
            <strong>Avg Response Time:</strong> {Math.round(messageData.stats?.averageResponseTime || 0)}s
          </p>
          
          {/* Email-specific info */}
          {isEmail && (
            <>
              {messageData.stats?.firstResponseTime && (
                <p className="mb-1">
                  <strong>First Response:</strong> {messageData.stats.firstResponseTime}s
                </p>
              )}
              {messageData.stats?.uniqueSubjectCount > 1 && (
                <p className="mb-1">
                  <strong>Subjects:</strong> {messageData.stats.uniqueSubjectCount}
                </p>
              )}
            </>
          )}
          
          {/* Non-email text channels */}
          {!isEmail && messageData.stats?.multimediaMessages > 0 && (
            <p className="mb-1">
              <span className="badge bg-warning">{messageData.stats.multimediaMessages} Multimedia</span>
            </p>
          )}
        </>
      )}
      
      {!isText && (
        <>
          <p className="mb-1">
            <strong>Duration:</strong> {evaluation.interactionData?.duration || evaluation.interaction?.duration || 'N/A'}s
          </p>
          <p className="mb-1">
            <strong>Direction:</strong> {evaluation.interactionData?.direction === 0 || evaluation.interactionData?.direction === '0' ? 'Inbound' : 'Outbound'}
          </p>
        </>
      )}
    </div>
  );
};

const TicketInformationSection = ({ interactionId }) => {
  const [ticketData, setTicketData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasTicket, setHasTicket] = useState(null); // null = unknown, true = has ticket, false = no ticket
  const [showFull, setShowFull] = useState(false);

  useEffect(() => {
    if (interactionId && isExpanded && hasTicket === null) {
      fetchTicketData();
    }
  }, [interactionId, isExpanded]);

  const fetchTicketData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/tickets/by-interaction/${interactionId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.hasTicket === false) {
          // Interaction has no ticket
          setHasTicket(false);
          setError('No ticket associated with this interaction');
        } else {
          // Error fetching ticket
          throw new Error(data.message || 'Failed to fetch ticket information');
        }
      } else {
        // Successfully fetched ticket
        setHasTicket(true);
        setTicketData(data.ticket);
      }
    } catch (err) {
      console.error('Error fetching ticket:', err);
      setError(err.message);
      setHasTicket(false);
    } finally {
      setLoading(false);
    }
  };

  // Don't render if we know there's no ticket
  if (hasTicket === false) {
    return null;
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getStatusBadgeColor = (status) => {
    return status === 'Open' ? 'bg-success' : 'bg-secondary';
  };

  const getPriorityBadgeColor = (priority) => {
    if (!priority) return 'bg-secondary';
    const lowerPriority = priority.toLowerCase();
    if (lowerPriority.includes('high') || lowerPriority.includes('urgent')) return 'bg-danger';
    if (lowerPriority.includes('medium')) return 'bg-warning';
    return 'bg-info';
  };

  return (
    <div className="card mb-4">
      <div 
        className="card-header d-flex justify-content-between align-items-center"
        style={{ cursor: 'pointer' }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h5 className="card-title mb-0">
          <i className="fas fa-ticket-alt me-2"></i>
          Support Ticket Information
        </h5>
        <div className="d-flex align-items-center">
          {ticketData && (
            <span className={`badge ${getStatusBadgeColor(ticketData.status)} me-2`}>
              {ticketData.status}
            </span>
          )}
          <button 
            className="btn btn-sm btn-link text-decoration-none p-0"
            type="button"
          >
            <i className={`fas fa-chevron-${isExpanded ? 'up' : 'down'}`}></i>
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="card-body">
          {loading ? (
            <div className="text-center py-4">
              <div className="spinner-border spinner-border-sm me-2" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              Loading ticket information...
            </div>
          ) : error ? (
            <div className="alert alert-warning">
              <i className="fas fa-info-circle me-2"></i>
              {error}
            </div>
          ) : ticketData ? (
            <>
              {/* Ticket Header Info */}
              <div className="row mb-3">
                <div className="col-md-6">
                  <h6 className="text-muted mb-2">Ticket Number</h6>
                  <h5 className="mb-0">#{ticketData.ticketNumber}</h5>
                </div>
                <div className="col-md-6">
                  <h6 className="text-muted mb-2">Subject</h6>
                  <h5 className="mb-0">{ticketData.subject || 'No Subject'}</h5>
                </div>
              </div>

              <hr />

              {/* Ticket Details Grid */}
              <div className="row mb-3">
                <div className="col-md-3 mb-3">
                  <small className="text-muted">Status</small>
                  <div className="fw-bold">
                    <span className={`badge ${getStatusBadgeColor(ticketData.status)}`}>
                      {ticketData.status}
                    </span>
                  </div>
                </div>
                
                <div className="col-md-3 mb-3">
                  <small className="text-muted">Priority</small>
                  <div className="fw-bold">
                    <span className={`badge ${getPriorityBadgeColor(ticketData.priority)}`}>
                      {ticketData.priority || 'Not Set'}
                    </span>
                  </div>
                </div>
                
                <div className="col-md-3 mb-3">
                  <small className="text-muted">Pipeline</small>
                  <div className="fw-bold">{ticketData.pipeline || 'N/A'}</div>
                </div>
                
                <div className="col-md-3 mb-3">
                  <small className="text-muted">Stage</small>
                  <div className="fw-bold">{ticketData.pipelineStage || 'N/A'}</div>
                </div>
              </div>

              {/* Assignment Information */}
              <div className="row mb-3">
                <div className="col-md-3 mb-3">
                  <small className="text-muted">Team</small>
                  <div className="fw-bold">{ticketData.team || 'Not Assigned'}</div>
                </div>
                
                <div className="col-md-3 mb-3">
                  <small className="text-muted">Team Member</small>
                  <div className="fw-bold">{ticketData.teamMember || 'Not Assigned'}</div>
                </div>
                
                <div className="col-md-3 mb-3">
                  <small className="text-muted">Channel</small>
                  <div className="fw-bold text-capitalize">{ticketData.channel || 'N/A'}</div>
                </div>

                <div className="col-md-3 mb-3">
                  <small className="text-muted">SLA</small>
                  <div className="fw-bold text-capitalize">{ticketData.slaName || 'N/A'}</div>
                </div>
              </div>

              {/* Customer Information */}
              <div className="row mb-3">
                <div className="col-md-6 mb-3">
                  <small className="text-muted">Customer</small>
                  <div className="fw-bold">{ticketData.customer || 'N/A'}</div>
                </div>
                
                <div className="col-md-6 mb-3">
                  <small className="text-muted">Company</small>
                  <div className="fw-bold">{ticketData.company || 'N/A'}</div>
                </div>
              </div>

              {/* Description */}
              {ticketData.description && (
                <div className="mb-3">
                  <small className="text-muted">Description</small>
                  <div 
                    className="p-3 bg-light rounded"
                    style={{ 
                      whiteSpace: 'pre-wrap', 
                      wordBreak: 'break-word',
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}
                  >
                    {ticketData.description}
                  </div>
                </div>
              )}

              {/* Tags and Workflow */}
              <div className="row mb-3">
                {ticketData.tags && ticketData.tags.length > 0 && (
                  <div className="col-md-6 mb-3">
                    <small className="text-muted">Tags</small>
                    <div className="mt-1">
                      {ticketData.tags.map((tag, index) => (
                        <span key={index} className="badge bg-secondary me-1 mb-1">
                          <i className="fas fa-tag me-1"></i>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {ticketData.workflow && ticketData.workflow.length > 0 && (
                  <div className="col-md-6 mb-3">
                    <small className="text-muted">Workflow</small>
                    <div className="mt-1">
                      {ticketData.workflow.map((flow, index) => (
                        <span key={index} className="badge bg-info me-1 mb-1">
                          <i className="fas fa-project-diagram me-1"></i>
                          {flow}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Metrics */}
              <div className="row mb-3">
                <div className="col-md-3 mb-2">
                  <small className="text-muted">Activities</small>
                  <div className="fw-bold">{ticketData.noOfActivities}</div>
                </div>
                
                <div className="col-md-3 mb-2">
                  <small className="text-muted">Ticket Life</small>
                  <div className="fw-bold">{ticketData.ticketLife}</div>
                </div>
                
                <div className="col-md-3 mb-2">
                  <small className="text-muted">SLA Breach</small>
                  <div className="fw-bold">
                    <span className={`badge ${ticketData.slaBreach === 'Yes' ? 'bg-danger' : 'bg-success'}`}>
                      {ticketData.slaBreach}
                    </span>
                  </div>
                </div>
                
                {ticketData.dueDate && (
                  <div className="col-md-3 mb-2">
                    <small className="text-muted">Due Date</small>
                    <div className="fw-bold">{formatDate(ticketData.dueDate)}</div>
                  </div>
                )}
              </div>

              <hr />

              {/* Timestamps */}
              <div className="row">
                <div className="col-md-4 mb-2">
                  <small className="text-muted">Created</small>
                  <div className="small">
                    {formatDate(ticketData.timestamps.createdAt)}
                    {ticketData.timestamps.createdBy && (
                      <div className="text-muted">by {ticketData.timestamps.createdBy}</div>
                    )}
                  </div>
                </div>
                
                {ticketData.timestamps.updatedAt && (
                  <div className="col-md-4 mb-2">
                    <small className="text-muted">Last Updated</small>
                    <div className="small">
                      {formatDate(ticketData.timestamps.updatedAt)}
                      {ticketData.timestamps.updatedBy && (
                        <div className="text-muted">by {ticketData.timestamps.updatedBy}</div>
                      )}
                    </div>
                  </div>
                )}
                
                {ticketData.timestamps.closedAt && (
                  <div className="col-md-4 mb-2">
                    <small className="text-muted">Closed</small>
                    <div className="small">
                      {formatDate(ticketData.timestamps.closedAt)}
                      {ticketData.timestamps.closedBy && (
                        <div className="text-muted">by {ticketData.timestamps.closedBy}</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Custom/Dynamic Fields Section */}
              {ticketData.customFields && Object.keys(ticketData.customFields).length > 0 && (
                <>
                  <hr />
                  <div className="custom-fields-section">
                    <h6 className="text-muted mb-3">
                      <i className="fas fa-plus-circle me-2"></i>
                      Additional Custom Fields
                    </h6>
                    <div className="row">
                      {Object.entries(ticketData.customFields).map(([key, value], index) => {
                        // Skip null or undefined values
                        if (value === null || value === undefined) return null;
                        
                        // Format the field name (convert camelCase or snake_case to Title Case)
                        const fieldName = key
                          .replace(/([A-Z])/g, ' $1') // camelCase to spaces
                          .replace(/_/g, ' ') // snake_case to spaces
                          .replace(/\b\w/g, l => l.toUpperCase()) // capitalize first letters
                          .trim();
                        
                        // Format the value based on its type
                        let displayValue = value;
                        
                        // Check if it's a date (ISO string or timestamp)
                        if (typeof value === 'string' && 
                            (value.match(/^\d{4}-\d{2}-\d{2}/) || !isNaN(Date.parse(value)))) {
                          const date = new Date(value);
                          if (!isNaN(date.getTime())) {
                            displayValue = date.toLocaleString();
                          }
                        }
                        
                        // Check if it's a boolean
                        if (typeof value === 'boolean') {
                          displayValue = (
                            <span className={`badge ${value ? 'bg-success' : 'bg-secondary'}`}>
                              {value ? 'Yes' : 'No'}
                            </span>
                          );
                        }
                        
                        // Check if it's a number
                        if (typeof value === 'number') {
                          displayValue = value.toLocaleString();
                        }
                        
                        // Check if it's JSON (try to parse)
                        if (typeof value === 'string' && 
                            (value.startsWith('{') || value.startsWith('['))) {
                          try {
                            const parsed = JSON.parse(value);
                            displayValue = (
                              <pre className="mb-0" style={{ 
                                fontSize: '12px', 
                                backgroundColor: '#f8f9fa',
                                padding: '8px',
                                borderRadius: '4px',
                                maxHeight: '150px',
                                overflowY: 'auto'
                              }}>
                                {JSON.stringify(parsed, null, 2)}
                              </pre>
                            );
                          } catch (e) {
                            // Not valid JSON, display as-is
                          }
                        }
                        
                        // Check if it's a very long string (truncate with "show more")
                        if (typeof displayValue === 'string' && displayValue.length > 200) {
                          displayValue = (
                            <div>
                              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {showFull ? displayValue : displayValue.substring(0, 200) + '...'}
                              </div>
                              <button 
                                className="btn btn-sm btn-link p-0 mt-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowFull(!showFull);
                                }}
                              >
                                {showFull ? 'Show less' : 'Show more'}
                              </button>
                            </div>
                          );
                        }
                        
                        return (
                          <div key={key} className="col-md-6 col-lg-4 mb-3">
                            <div className="custom-field-item p-2 border rounded bg-light">
                              <small className="text-muted d-block mb-1">
                                <i className="fas fa-tag me-1" style={{ fontSize: '10px' }}></i>
                                {fieldName}
                              </small>
                              <div className="fw-bold">
                                {displayValue || 'N/A'}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="alert alert-info">
              <i className="fas fa-info-circle me-2"></i>
              Click to load ticket information.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// NEW: Message Conversation Component
const MessageConversationSection = ({ messageData, evaluation }) => {
  if (!messageData || !messageData.conversation) {
    return (
      <div className="card">
        <div className="card-header">
          <h5 className="mb-0">Conversation</h5>
        </div>
        <div className="card-body">
          <p className="text-muted">No conversation data available</p>
        </div>
      </div>
    );
  }

  const { conversation, stats } = messageData;
  const channel = evaluation.interactionData?.channel || evaluation.interaction?.channel || 'call';
  const isEmail = channel === 'email';

  // Format timestamp for messages
  const formatMessageTime = (timestamp) => {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format full date and time
  const formatFullDateTime = (timestamp) => {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleString([], { 
      weekday: 'short',
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Get speaker badge color
  const getSpeakerBadgeColor = (speakerRole) => {
    return speakerRole === 'customer' ? 'bg-info' : 'bg-success';
  };

  // Enhanced text processing for emails/messages
  const processText = (text) => {
    if (!text) return { parts: [], hasThreads: false };
    
    // Convert various newline formats to standard \n
    let processedText = text
      .replace(/\\r\\n/g, '\n')  // Handle escaped newlines from JSON
      .replace(/\\n/g, '\n')     // Handle escaped \n
      .replace(/\r\n/g, '\n')    // Handle Windows line endings
      .replace(/\r/g, '\n');     // Handle old Mac line endings
    
    // Detect email thread separators
    const separatorPatterns = [
      /_{5,}/,                    // Underscores
      /^From:.*?Sent:.*?To:/ms,  // Email header pattern
      /^On .+? wrote:/m,          // "On [date] [person] wrote:"
      /-{5,}/,                    // Dashes
    ];
    
    // Split by separator patterns
    let parts = [];
    let currentPart = '';
    let inThread = false;
    
    const lines = processedText.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isSeparator = separatorPatterns.some(pattern => pattern.test(line));
      
      if (isSeparator && currentPart.trim()) {
        parts.push({ text: currentPart.trim(), isThread: inThread });
        currentPart = line + '\n';
        inThread = true;
      } else {
        currentPart += line + '\n';
      }
    }
    
    if (currentPart.trim()) {
      parts.push({ text: currentPart.trim(), isThread: inThread });
    }
    
    if (parts.length === 0) {
      parts.push({ text: processedText, isThread: false });
    }
    
    return { parts, hasThreads: parts.length > 1 };
  };

  // Extract metadata from email text
  const extractEmailMetadata = (text) => {
    const lines = text.split('\n');
    const metadata = {
      from: null,
      sent: null,
      to: null,
      cc: null,
      subject: null
    };
    
    for (let line of lines) {
      if (line.match(/^From:/i)) {
        metadata.from = line.replace(/^From:\s*/i, '').trim();
      } else if (line.match(/^Sent:/i)) {
        metadata.sent = line.replace(/^Sent:\s*/i, '').trim();
      } else if (line.match(/^To:/i)) {
        metadata.to = line.replace(/^To:\s*/i, '').trim();
      } else if (line.match(/^Cc:/i)) {
        metadata.cc = line.replace(/^Cc:\s*/i, '').trim();
      } else if (line.match(/^Subject:/i)) {
        metadata.subject = line.replace(/^Subject:\s*/i, '').trim();
      }
    }
    
    return metadata;
  };

  // Convert text to clickable links
  const linkifyText = (text) => {
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
    
    let result = text;
    result = result.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    result = result.replace(emailRegex, (email) => {
      return `<a href="mailto:${email}">${email}</a>`;
    });
    
    return result;
  };

  // Render content with proper line breaks
  const renderContent = (text) => {
    if (!text) return null;
    
    const processedText = linkifyText(text);
    const lines = processedText.split('\n');
    
    return (
      <div>
        {lines.map((line, index) => (
          <div key={index} dangerouslySetInnerHTML={{ __html: line || '&nbsp;' }} />
        ))}
      </div>
    );
  };

  return (
    <div className="card mb-4">
      <div className="card-header d-flex justify-content-between align-items-center">
        <h5 className="mb-0">{isEmail ? 'Email Thread' : 'Message Conversation'}</h5>
        <div className="d-flex gap-2">
          <span className="badge bg-primary">{stats.totalMessages} {isEmail ? 'emails' : 'messages'}</span>
          {stats.multimediaMessages > 0 && (
            <span className="badge bg-warning">{stats.multimediaMessages} {isEmail ? 'with attachments' : 'multimedia'}</span>
          )}
        </div>
      </div>
      <div className="card-body">
        {/* Conversation Stats */}
        <div className="row mb-3">
          <div className="col-md-3">
            <small className="text-muted">{isEmail ? 'Inbound Emails' : 'Customer Messages'}</small>
            <div className="fw-bold">{stats.customerMessages}</div>
          </div>
          <div className="col-md-3">
            <small className="text-muted">{isEmail ? 'Outbound Emails' : 'Agent Messages'}</small>
            <div className="fw-bold">{stats.agentMessages}</div>
          </div>
          <div className="col-md-3">
            <small className="text-muted">Duration</small>
            <div className="fw-bold">{Math.round(stats.duration)}s</div>
          </div>
          <div className="col-md-3">
            <small className="text-muted">Avg Response</small>
            <div className="fw-bold">{Math.round(stats.averageResponseTime)}s</div>
          </div>
        </div>

        <hr />

        {/* Message/Email Thread */}
        <div className="conversation-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
          {conversation.transcription.map((entry, index) => {
            const timestamp = Object.keys(entry)[0];
            const messageData = entry[timestamp];
            const fullDateTime = formatFullDateTime(timestamp);
            const isCustomer = messageData.speaker_role === 'customer';
            
            // Process content for better display
            const content = processText(messageData.original_text);
            
            return (
              <div key={index} className="mb-4">
                {/* Email/Message Card */}
                <div className={`message-card border rounded shadow-sm ${isCustomer ? 'border-info' : 'border-success'}`}>
                  
                  {/* Header */}
                  <div className={`message-header p-3 ${isCustomer ? 'bg-light' : 'bg-primary bg-opacity-10'}`}>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div className="d-flex align-items-center flex-wrap">
                        <span className={`badge ${getSpeakerBadgeColor(messageData.speaker_role)} me-2 mb-1`}>
                          {messageData.speaker_role === 'customer' ? 'Customer' : 'Agent'}
                        </span>
                        <strong className="me-2">{messageData.speaker_id || 'Unknown'}</strong>
                        {messageData.direction && (
                          <small className={`badge ${messageData.direction === 'inbound' ? 'bg-info' : 'bg-success'} mb-1`}>
                            <i className={`fas fa-arrow-${messageData.direction === 'inbound' ? 'down' : 'up'} me-1`}></i>
                            {messageData.direction}
                          </small>
                        )}
                      </div>
                      <small className="text-muted text-nowrap">{fullDateTime}</small>
                    </div>
                    
                    {/* Subject for emails */}
                    {isEmail && messageData.subject && (
                      <div className="mb-0">
                        <small className="text-muted">
                          <i className="fas fa-envelope me-1"></i>
                          Subject:
                        </small>
                        <div className="fw-bold">{messageData.subject}</div>
                      </div>
                    )}
                  </div>
                  
                  {/* Body */}
                  <div className="message-body p-3">
                    {content.parts.map((part, partIndex) => {
                      const metadata = extractEmailMetadata(part.text);
                      const hasMetadata = metadata.from || metadata.sent || metadata.to;
                      
                      return (
                        <div key={partIndex} className={partIndex > 0 ? 'mt-4 pt-3 border-top' : ''}>
                          {/* Thread metadata */}
                          {part.isThread && hasMetadata && partIndex > 0 && (
                            <div className="thread-metadata bg-light p-3 rounded mb-3 border-start border-4 border-secondary">
                              <div className="text-muted mb-2">
                                <i className="fas fa-reply me-2"></i>
                                <strong>Previous {isEmail ? 'Email' : 'Message'} in Thread</strong>
                              </div>
                              {metadata.from && <div className="mb-1"><strong>From:</strong> {metadata.from}</div>}
                              {metadata.sent && <div className="mb-1"><strong>Sent:</strong> {metadata.sent}</div>}
                              {metadata.to && <div className="mb-1"><strong>To:</strong> {metadata.to}</div>}
                              {metadata.cc && <div className="mb-1"><strong>Cc:</strong> {metadata.cc}</div>}
                              {metadata.subject && <div className="mb-1"><strong>Subject:</strong> {metadata.subject}</div>}
                            </div>
                          )}
                          
                          {/* Content with proper line breaks */}
                          <div 
                            className="message-content"
                            style={{
                              lineHeight: '1.6',
                              fontFamily: 'Arial, sans-serif',
                              fontSize: '14px',
                              color: '#333',
                              wordBreak: 'break-word'
                            }}
                          >
                            {renderContent(part.text)}
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Attachments */}
                    {messageData.attachments && messageData.attachments.length > 0 && (
                      <div className="mt-3 pt-3 border-top">
                        <div className="d-flex align-items-center mb-2">
                          <i className="fas fa-paperclip me-2 text-muted"></i>
                          <small className="text-muted">
                            {messageData.attachments.length} attachment{messageData.attachments.length > 1 ? 's' : ''}
                          </small>
                        </div>
                        <div className="d-flex flex-wrap gap-2">
                          {messageData.attachments.map((attachment, i) => (
                            <div key={i} className="badge bg-secondary d-flex align-items-center">
                              <i className="fas fa-file me-1"></i>
                              {attachment.type || attachment.data?.extension || 'file'}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Forwarded indicator */}
                    {messageData.forwarded && (
                      <div className="mt-2">
                        <small className="badge bg-warning">
                          <i className="fas fa-share me-1"></i>Forwarded
                        </small>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Add styles */}
      <style jsx>{`
        .message-card {
          transition: box-shadow 0.2s;
        }

        .message-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        }

        .message-header {
          border-bottom: 2px solid #dee2e6;
        }

        .thread-metadata {
          font-size: 13px;
        }

        .message-content a {
          color: #0d6efd;
          text-decoration: underline;
          word-break: break-all;
        }

        .message-content a:hover {
          color: #0a58ca;
        }

        .conversation-container::-webkit-scrollbar {
          width: 10px;
        }

        .conversation-container::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 5px;
        }

        .conversation-container::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 5px;
        }

        .conversation-container::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }
      `}</style>
    </div>
  );
};

// Enhanced Section-wise Scores Component
const SectionWiseScores = ({ evaluation, qaForm, updatedScores = null }) => {
  // Ensure we have the necessary data
  if (!evaluation || !qaForm) return null;

  // Get section scores from evaluation or initialize if not present
  const sectionScores = evaluation.sectionScores || {
    sections: {},
    overall: { rawScore: 0, adjustedScore: 0, maxScore: 0, percentage: 0 }
  };

  // Incorporate any updated scores if provided
  const mergedScores = updatedScores ? {
    sections: { ...sectionScores.sections, ...updatedScores.sections },
    overall: updatedScores.overall || sectionScores.overall
  } : sectionScores;

  // Map all group IDs to names
  const groupMap = {};
  qaForm.groups.forEach(group => {
    groupMap[group.id] = group.name;
  });

  // Prepare classification impact information
  const classificationMap = {
    minor: { label: 'Minor', color: 'info', impact: 10 },
    moderate: { label: 'Moderate', color: 'warning', impact: 25 },
    major: { label: 'Major', color: 'danger', impact: 50 }
  };

  // Use custom classification definitions if available
  if (qaForm && qaForm.classifications) {
    qaForm.classifications.forEach(classification => {
      if (classificationMap[classification.type]) {
        classificationMap[classification.type].impact = classification.impactPercentage;
      }
    });
  }

  return (
    <div className="card mb-4">
      <div className="card-header">
        <h5 className="card-title mb-0">Section-Level Scores</h5>
      </div>
      <div className="card-body">
        <p className="text-muted mb-3">
          Section scores reflect the impact of classifications. When a section contains a question 
          with a classification, the section's actual earned points (not the maximum possible) are 
          reduced by the defined percentage.
        </p>
        
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Section</th>
                <th>Raw Score</th>
                <th>Classification Impact</th>
                <th>Deduction</th>
                <th>Final Score</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              {/* Render all groups from QA form, not just those with scores */}
              {qaForm.groups.map(group => {
                const sectionId = group.id;
                const sectionName = group.name;
                
                // Get section data if it exists, or create placeholder data
                const section = mergedScores.sections[sectionId] || {
                  name: sectionName,
                  rawScore: 0,
                  maxScore: 0,
                  adjustedScore: 0,
                  percentage: 0,
                  classifications: { minor: false, moderate: false, major: false },
                  highestClassification: null,
                  highestClassificationImpact: 0
                };
                
                // Calculate deduction amount
                const deduction = section.rawScore - section.adjustedScore;
                
                return (
                  <tr key={sectionId}>
                    <td>{section.name}</td>
                    <td>{section.rawScore.toFixed(1)} / {section.maxScore}</td>
                    <td>
                      {section.classifications?.major ? (
                        <span className="d-flex align-items-center">
                          <span className="badge bg-danger me-2">Major</span>
                          <span>({section.highestClassificationImpact}%)</span>
                        </span>
                      ) : section.classifications?.moderate ? (
                        <span className="d-flex align-items-center">
                          <span className="badge bg-warning me-2">Moderate</span>
                          <span>({section.highestClassificationImpact}%)</span>
                        </span>
                      ) : section.classifications?.minor ? (
                        <span className="d-flex align-items-center">
                          <span className="badge bg-info me-2">Minor</span>
                          <span>({section.highestClassificationImpact}%)</span>
                        </span>
                      ) : (
                        <span className="badge bg-secondary">None</span>
                      )}
                    </td>
                    <td>
                      {deduction > 0 ? (
                        <span className="text-danger">-{deduction.toFixed(1)}</span>
                      ) : (
                        <span>0</span>
                      )}
                    </td>
                    <td>{section.adjustedScore.toFixed(1)} / {section.maxScore}</td>
                    <td>
                      <div className={`badge bg-${
                        section.percentage >= 80 ? 'success' :
                        section.percentage >= 60 ? 'warning' : 'danger'
                      }`}>
                        {section.percentage}%
                      </div>
                    </td>
                  </tr>
                );
              })}
              <tr className="table-active fw-bold">
                <td>Overall</td>
                <td>{mergedScores.overall.rawScore.toFixed(1)} / {mergedScores.overall.maxScore}</td>
                <td>-</td>
                <td>
                  {(mergedScores.overall.rawScore - mergedScores.overall.adjustedScore) > 0 ? (
                    <span className="text-danger">
                      -{(mergedScores.overall.rawScore - mergedScores.overall.adjustedScore).toFixed(1)}
                    </span>
                  ) : (
                    <span>0</span>
                  )}
                </td>
                <td>{mergedScores.overall.adjustedScore.toFixed(1)} / {mergedScores.overall.maxScore}</td>
                <td>
                  <div className={`badge bg-${
                    mergedScores.overall.percentage >= 80 ? 'success' :
                    mergedScores.overall.percentage >= 60 ? 'warning' : 'danger'
                  }`}>
                    {mergedScores.overall.percentage}%
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div className="alert alert-info mt-3">
          <h6 className="mb-2">How Classification Impacts Are Applied:</h6>
          <ul className="mb-0">
            <li>When a section contains questions with different classifications, the highest classification is applied.</li>
            <li>The deduction is calculated based on the actual earned points in that section, not the maximum possible.</li>
            <li>For example, if a section has earned 20 points and contains a "moderate" question with a 25% impact, 5 points (25% of 20) will be deducted.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// Real-time score calculation function
const calculateScores = (parameters, qaForm) => {
  // Base structure for scores
  const result = {
    sections: {},
    overall: { rawScore: 0, adjustedScore: 0, maxScore: 0, percentage: 0 }
  };
  
  // Classification impact map
  const classificationImpacts = {};
  if (qaForm && qaForm.classifications) {
    qaForm.classifications.forEach(classification => {
      classificationImpacts[classification.type] = classification.impactPercentage / 100;
    });
  } else {
    // Default classification impacts
    classificationImpacts.minor = 0.1;    // 10%
    classificationImpacts.moderate = 0.25; // 25%
    classificationImpacts.major = 0.5;    // 50%
  }
  
  // Initialize sections based on groups in QA form
  if (qaForm && qaForm.groups) {
    qaForm.groups.forEach(group => {
      result.sections[group.id] = {
        name: group.name,
        parameters: [],
        rawScore: 0,
        maxScore: 0,
        adjustedScore: 0,
        percentage: 0,
        classifications: { minor: false, moderate: false, major: false },
        highestClassification: null,
        highestClassificationImpact: 0
      };
    });
  }
  
  // Process each parameter
  if (qaForm && qaForm.parameters && parameters) {
    qaForm.parameters.forEach(paramDef => {
      const paramName = paramDef.name;
      const paramData = parameters[paramName];
      
      if (!paramData) return;
      
      // Skip N/A scores
      if (paramData.humanScore === -1) return;
      
      const groupId = paramDef.group || 'default';
      if (!result.sections[groupId]) return;
      
      const section = result.sections[groupId];
      
      // Get score and classification
      const score = paramData.humanScore || 0;
      const maxScore = paramDef.maxScore || 5;
      const classification = paramData.classification || paramDef.classification || null;
      
      // Add to section data
      section.parameters.push({
        name: paramName,
        score: score,
        maxScore: maxScore,
        classification: classification
      });
      
      // Update section raw totals
      section.rawScore += score;
      section.maxScore += maxScore;
      
      // Track classifications
      if (classification) {
        section.classifications[classification] = true;
        
        // Track highest classification impact
        const currentClassificationImpact = classificationImpacts[classification] || 0;
        if (!section.highestClassification || 
            currentClassificationImpact > classificationImpacts[section.highestClassification]) {
          section.highestClassification = classification;
          section.highestClassificationImpact = currentClassificationImpact * 100; // Convert to percentage
        }
      }
    });
  }
  
  // Calculate adjusted scores and percentages for each section
  let overallRawScore = 0;
  let overallMaxScore = 0;
  let overallAdjustedScore = 0;
  
  Object.values(result.sections).forEach(section => {
    if (section.maxScore === 0) return; // Skip empty sections
    
    // Apply classification impact to calculate adjusted score
    const impact = section.highestClassificationImpact / 100; // Convert back to decimal
    const deduction = section.rawScore * impact;
    section.adjustedScore = Math.max(0, section.rawScore - deduction);
    
    // Calculate percentage
    section.percentage = Math.round((section.adjustedScore / section.maxScore) * 100);
    
    // Accumulate overall scores
    overallRawScore += section.rawScore;
    overallMaxScore += section.maxScore;
    overallAdjustedScore += section.adjustedScore;
  });
  
  // Set overall scores
  result.overall.rawScore = overallRawScore;
  result.overall.maxScore = overallMaxScore;
  result.overall.adjustedScore = overallAdjustedScore;
  result.overall.percentage = overallMaxScore > 0 
    ? Math.round((overallAdjustedScore / overallMaxScore) * 100) 
    : 0;
  
  return result;
};

// Classification Options for Dropdown
const classificationOptions = [
  { value: 'none', label: 'None', color: '#6c757d' },
  { value: 'minor', label: 'Minor', color: '#17a2b8' },
  { value: 'moderate', label: 'Moderate', color: '#ffc107' },
  { value: 'major', label: 'Major', color: '#dc3545' }
];

// Custom Select Component for Classifications
const ClassificationSelect = ({ value, onChange, isDisabled }) => {
  // Convert value for react-select
  const selectedOption = classificationOptions.find(option => option.value === value) || 
                         classificationOptions.find(option => option.value === 'none');
  
  // Custom styles
  const customStyles = {
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected ? state.data.color : provided.backgroundColor,
      color: state.isSelected ? 'white' : provided.color
    }),
    control: (provided, state) => ({
      ...provided,
      borderColor: value !== 'none' ? classificationOptions.find(o => o.value === value)?.color : provided.borderColor,
      boxShadow: state.isFocused ? `0 0 0 0.2rem rgba(0, 123, 255, 0.25)` : 'none'
    }),
    singleValue: (provided) => ({
      ...provided,
      color: value !== 'none' ? classificationOptions.find(o => o.value === value)?.color : provided.color,
      fontWeight: 'bold'
    })
  };
  
  return (
    <Select
      options={classificationOptions}
      value={selectedOption}
      onChange={(option) => onChange(option.value)}
      isDisabled={isDisabled}
      styles={customStyles}
      className="classification-select"
    />
  );
};

// Main QA Detail Component
const QADetail = ({ agentRestricted = false, agentId = null }) => {
  // Extract ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id') || window.location.pathname.split('/').pop();
  
  // State Management
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTranscription, setShowTranscription] = useState(false);
  const [isAdmin, setIsAdmin] = useState(true);
  const [isAgent, setIsAgent] = useState(false);
  const [formParams, setFormParams] = useState(null);
  const [qaForm, setQaForm] = useState(null);
  const [agentAccessChecked, setAgentAccessChecked] = useState(false);
  const [resolutionComment, setResolutionComment] = useState('');
  const [resolvingDispute, setResolvingDispute] = useState(false);
  
  // NEW: Multi-channel support states
  const [messageData, setMessageData] = useState(null);
  const [isTextChannel, setIsTextChannel] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const interactionId = evaluation?.interactionId || 
                       evaluation?.interaction?._id;

  const handleResolveDispute = async (resolution) => {
    try {
      setResolvingDispute(true);
      
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/qa/evaluation/${id}/resolve-dispute`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          resolution: resolution, // 'accept' or 'reject'
          comments: resolutionComment
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to ${resolution} dispute`);
      }
      
      // Update local state
      const updatedData = await response.json();
      setEvaluation(updatedData);
      
      // Show success message
      setSaveSuccess(`Dispute ${resolution === 'accept' ? 'accepted' : 'rejected'} successfully`);
      
      // Refresh data to ensure we have the latest
      await fetchEvaluation();
    } catch (err) {
      console.error(`Error ${resolution} dispute:`, err);
      setSaveError(err.message);
    } finally {
      setResolvingDispute(false);
    }
  };

  // Human Evaluation State
  const [humanEvaluation, setHumanEvaluation] = useState({
    parameters: {},
    additionalComments: '',
    agentComments: '',
    isModerated: false,
    isPublished: false,
    moderatedBy: null,
    moderatedAt: null
  });
  
  // Live calculation of scores based on current edits
  const [calculatedScores, setCalculatedScores] = useState(null);
  
  // Editing State
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(null);

  useEffect(() => {
    try {
      // Directly get user roles from localStorage
      const userRolesStr = localStorage.getItem('userRoles');
      if (userRolesStr) {
        const userRoles = JSON.parse(userRolesStr);
        console.log("User Roles from localStorage:", userRoles);
        
        // Only keep this part, which properly handles both true and false values
        setIsAgent(userRoles.isAgent === true);
        setIsAdmin(userRoles.isAdmin === true);
      }
    } catch (e) {
      console.error("Error retrieving user roles:", e);
    }
  }, []);

  // Fetch evaluation data
  const fetchEvaluation = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const userRoles = JSON.parse(localStorage.getItem('userRoles') || '{}');
      
      if (!token) {
        throw new Error('No authentication token found');
      }

      console.log(`Fetching evaluation ${id}, agent restricted: ${agentRestricted}, agent ID: ${agentId}`);
      
      // Fetch the evaluation data
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
      
      // If the user is an agent (not admin), check if this evaluation belongs to them
      if (agentRestricted && agentId) {
        console.log(`Agent check: evaluation agent ID: ${data.agent?.id}, current agent ID: ${agentId}`);
        
        if (data.agent?.id != agentId) {
          console.error('Agent access denied - evaluation belongs to another agent');
          setError('You do not have permission to view this evaluation');
          setAgentAccessChecked(true);
          setLoading(false);
          return;
        }
        
        // Agent is allowed to view their own evaluation
        console.log('Agent access granted - evaluation belongs to this agent');
      }
      
      // Set evaluation data
      setEvaluation(data);
      setAgentAccessChecked(true);
      
      // NEW: Determine if this is a text channel and load message data
      const channel = data.interactionData?.channel || data.interaction?.channel || 'call';
      const isText = TEXT_CHANNELS.includes(channel);
      setIsTextChannel(isText);
      
      // Load messages for text channels
      if (isText && data.interactionId) {
        try {
          console.log(`Loading messages for text channel: ${channel}, interaction: ${data.interactionId}`);
          const messageResponse = await fetch(`/api/interactions/${data.interactionId}/messages`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (messageResponse.ok) {
            const messages = await messageResponse.json();
            setMessageData(messages);
            console.log(`Loaded ${messages.count} messages for text conversation`);
          } else {
            console.warn('Could not load messages:', messageResponse.statusText);
          }
        } catch (error) {
          console.warn('Error loading messages:', error);
        }
      }
      
      // Initialize human evaluation state
      const initialParameters = {};
      if (data.evaluation?.scores?.categories) {
        Object.entries(data.evaluation.scores.categories).forEach(([criterion, criterionData]) => {
          // Safety check for null criterionData
          if (!criterionData) return;
          
          // Get existing human evaluation data if available
          const existingHumanData = data.humanEvaluation?.parameters?.[criterion] || {};
          
          initialParameters[criterion] = {
            score: criterionData.score || 0,
            explanation: criterionData.explanation || '',
            // Use existing human data if available, otherwise use AI data
            humanExplanation: existingHumanData.humanExplanation || '',
            humanScore: existingHumanData.humanScore !== undefined ? 
              existingHumanData.humanScore : (criterionData.score || 0),
            classification: existingHumanData.classification || 
              criterionData.classification || 'none'
          };
        });
      }
      
      const humanEvalData = {
        parameters: initialParameters,
        additionalComments: data.humanEvaluation?.additionalComments || '',
        agentComments: data.humanEvaluation?.agentComments || '',
        isModerated: data.humanEvaluation?.isModerated || false,
        isPublished: data.status === 'published',
        moderatedBy: data.humanEvaluation?.moderatedBy || null,
        moderatedAt: data.humanEvaluation?.moderatedAt || null
      };
      
      setHumanEvaluation(humanEvalData);
      
      // Fetch QA form if form ID exists
      if (data.qaFormId) {
        await fetchQAForm(data.qaFormId);
      }
      
      // Check user permissions
      await checkUserPermissions();
    } catch (err) {
      console.error('Error fetching evaluation:', err);
      setError(err.message);
      setAgentAccessChecked(true);
    } finally {
      setLoading(false);
    }
  }, [id, agentRestricted, agentId]);

  // Fetch QA Form details
  const fetchQAForm = async (formId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/qa-forms/${formId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch QA form');
      }
      
      const formData = await response.json();
      setQaForm(formData);
      
      // Map parameters for easy access
      const paramsMap = {};
      formData.parameters.forEach(param => {
        paramsMap[param.name] = param;
      });
      
      setFormParams(paramsMap);
    } catch (err) {
      console.error('Error fetching QA form:', err);
    }
  };

  // Check user permissions
  const checkUserPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/user/permissions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch permissions');
      }
      
      const permissions = await response.json();
      
      // Only update isAdmin from the API response if needed
      // But DON'T update isAgent - keep the value from localStorage
      const isUserAdmin = permissions["qa-forms"]?.write === true;
      setIsAdmin(isUserAdmin);
      
      // Don't set isAgent here anymore
      // const isUserAgent = permissions["qa-forms"]?.read === true && !isUserAdmin;
      // setIsAdmin(isUserAdmin);
      // setIsAgent(isUserAgent);
      
      console.log("Permissions check completed - keeping original isAgent value:", isAgent);
    } catch (err) {
      console.error('Error checking permissions:', err);
      // Don't override isAgent if the API call fails
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    console.log("Evaluation status:", evaluation?.status);
    console.log("Is published:", humanEvaluation?.isPublished);
    console.log("Is agent:", isAgent);
  }, [evaluation, humanEvaluation, isAgent]);

  // Recalculate scores whenever human evaluation changes in edit mode
  useEffect(() => {
    if (isEditMode && qaForm && humanEvaluation.parameters) {
      const scores = calculateScores(humanEvaluation.parameters, qaForm);
      setCalculatedScores(scores);
    } else {
      setCalculatedScores(null);
    }
  }, [isEditMode, qaForm, humanEvaluation.parameters]);

  // Fetch evaluation on component mount
  useEffect(() => {
    if (id) {
      fetchEvaluation();
    }
  }, [id, fetchEvaluation]);

  // Handler for human score changes
  const handleHumanScoreChange = (criterion, value) => {
    // Convert value to number or -1 for N/A
    const scoreValue = value === '-1' ? -1 : parseInt(value);
    
    setHumanEvaluation(prev => {
      // Make sure parameters object exists
      const currentParameters = prev.parameters || {};
      
      // Make sure parameter object exists for this criterion
      const currentParam = currentParameters[criterion] || {
        score: evaluation.evaluation?.scores?.categories?.[criterion]?.score || 0,
        explanation: evaluation.evaluation?.scores?.categories?.[criterion]?.explanation || ''
      };
      
      return {
        ...prev,
        parameters: {
          ...currentParameters,
          [criterion]: {
            ...currentParam,
            humanScore: scoreValue
          }
        }
      };
    });
  };

  const handleDisputeEvaluation = async () => {
    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(null);
      
      // Make sure the agent has provided comments
      if (!humanEvaluation.agentComments || humanEvaluation.agentComments.trim() === '') {
        setSaveError('Please provide comments explaining why you are disputing this evaluation.');
        setIsSaving(false);
        return;
      }
      
      // Make API call to update the evaluation with a disputed status
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/qa/evaluation/${id}/comment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentComments: humanEvaluation.agentComments,
          disputed: true
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to dispute evaluation');
      }
      
      // Update local state
      const updatedData = await response.json();
      setEvaluation(updatedData);
      
      // Show success message
      setSaveSuccess('Your dispute has been submitted. The QA team will review your comments and respond accordingly.');
      
      // Refresh data to ensure we have the latest
      await fetchEvaluation();
    } catch (err) {
      console.error('Error disputing evaluation:', err);
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Handler for human explanation changes
  const handleHumanExplanationChange = (criterion, value) => {
    setHumanEvaluation(prev => {
      // Make sure parameters object exists
      const currentParameters = prev.parameters || {};
      
      // Make sure parameter object exists for this criterion
      const currentParam = currentParameters[criterion] || {
        score: evaluation.evaluation?.scores?.categories?.[criterion]?.score || 0,
        explanation: evaluation.evaluation?.scores?.categories?.[criterion]?.explanation || '',
        humanScore: evaluation.evaluation?.scores?.categories?.[criterion]?.score || 0
      };
      
      return {
        ...prev,
        parameters: {
          ...currentParameters,
          [criterion]: {
            ...currentParam,
            humanExplanation: value
          }
        }
      };
    });
  };

  // Handler for classification changes
  const handleClassificationChange = (criterion, value) => {
    setHumanEvaluation(prev => {
      // Make sure parameters object exists
      const currentParameters = prev.parameters || {};
      
      // Make sure parameter object exists for this criterion
      const currentParam = currentParameters[criterion] || {
        score: evaluation.evaluation?.scores?.categories?.[criterion]?.score || 0,
        explanation: evaluation.evaluation?.scores?.categories?.[criterion]?.explanation || '',
        humanScore: evaluation.evaluation?.scores?.categories?.[criterion]?.score || 0
      };
      
      return {
        ...prev,
        parameters: {
          ...currentParameters,
          [criterion]: {
            ...currentParam,
            classification: value
          }
        }
      };
    });
  };

  // Handler for removing classification
  const handleRemoveClassification = (criterion) => {
    handleClassificationChange(criterion, 'none');
  };

  // Save human evaluation
  const saveHumanEvaluation = async (publish = false) => {
    try {
      setIsSaving(true);
      setSaveError(null);
      setSaveSuccess(null);
      
      // Prepare data for submission
      const updatedEvaluation = {
        ...humanEvaluation,
        isModerated: true,
        isPublished: publish,
        moderatedBy: 'Current User', // Replace with actual user identification
        moderatedAt: new Date().toISOString()
      };
      
      // Include calculated scores in the payload
      if (calculatedScores) {
        updatedEvaluation.calculatedScores = calculatedScores;
      }
      
      // Make API call to save evaluation
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/qa/evaluation/${id}/moderate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedEvaluation)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save evaluation');
      }
      
      // Update local state
      const updatedData = await response.json();
      setHumanEvaluation(updatedEvaluation);
      setEvaluation(updatedData);
      setIsEditMode(false);
      setSaveSuccess(publish ? 'Evaluation published successfully' : 'Evaluation saved successfully');
      
      // Refresh data to ensure we have the latest
      await fetchEvaluation();
    } catch (err) {
      console.error('Error saving evaluation:', err);
      setSaveError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle additional comments change
  const handleAdditionalCommentsChange = (value) => {
    setHumanEvaluation(prev => ({
      ...prev,
      additionalComments: value
    }));
  };

  // Handle agent comments change
  const handleAgentCommentsChange = (value) => {
    setHumanEvaluation(prev => ({
      ...prev,
      agentComments: value
    }));
  };

  // Utility Functions
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
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

  const getStatusBadge = () => {
    // First check for disputed status - this should take priority
    if (evaluation.status === 'disputed' || evaluation.disputed === true) {
      return <span className="badge bg-danger">Disputed</span>;
    } 
    // Then check other statuses
    else if (!humanEvaluation.isModerated) {
      return <span className="badge bg-warning">Awaiting Human Moderation</span>;
    } 
    else if (humanEvaluation.isPublished) {
      return <span className="badge bg-success">Published</span>;
    } 
    else {
      return <span className="badge bg-secondary">Not Published</span>;
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  // Render error state
  if (error || (!evaluation && agentAccessChecked)) {
    return (
      <div className="text-center my-5">
        <div className="alert alert-danger">
          <h4>Failed to load evaluation</h4>
          <p>{error || 'Evaluation not found or you do not have permission to view it'}</p>
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

  // Render method for evaluation criteria
  const renderEvaluationCriteria = () => {
    if (!evaluation?.evaluation?.scores?.categories) return null;
  
    return (
      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="card-title mb-0">Evaluation Criteria</h5>
          {isAdmin && !isEditMode && (
            <button 
              className="btn btn-sm btn-outline-primary"
              onClick={() => setIsEditMode(true)}
            >
              <Edit size={14} className="me-1" />
              Edit Criteria
            </button>
          )}
        </div>
        <div className="card-body">
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th style={{width: "20%"}}>Criterion</th>
                  <th style={{width: "15%"}}>Classification</th>
                  <th style={{width: "10%"}}>AI Score</th>
                  {(isEditMode || humanEvaluation.isModerated) && (
                    <th style={{width: "10%"}}>Human Score</th>
                  )}
                  <th style={{width: "45%"}}>Explanation</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(evaluation.evaluation.scores.categories).map(([criterion, data]) => {
                  // Find parameter definition in QA form
                  const paramDef = formParams?.[criterion];
                  
                  return (
                    <tr key={criterion}>
                      <td>
                        <div className="d-flex flex-column">
                          <strong>{criterion}</strong>
                          {paramDef && (
                            <small className="text-muted">
                              Group: {qaForm?.groups.find(g => g.id === paramDef.group)?.name || 'Unknown'}
                              <br/>
                              Scoring Type: {paramDef.scoringType || 'variable'}
                            </small>
                          )}
                        </div>
                      </td>
                      <td>
                        {isEditMode ? (
                          <ClassificationSelect
                            value={humanEvaluation.parameters[criterion]?.classification || 'none'}
                            onChange={(value) => handleClassificationChange(criterion, value)}
                            isDisabled={isSaving}
                          />
                        ) : (
                          <ClassificationBadge 
                            classification={humanEvaluation.parameters[criterion]?.classification || 'none'}
                            onRemove={isAdmin ? () => handleRemoveClassification(criterion) : null}
                            disabled={!isAdmin}
                          />
                        )}
                      </td>
                      <td>
                        <span className={`badge bg-${
                          data.score >= 4 ? 'success' :
                          data.score >= 3 ? 'warning' : 'danger'
                        }`}>
                          {data.score}/{paramDef?.maxScore || 5}
                        </span>
                      </td>
                      {(isEditMode || humanEvaluation.isModerated) && (
                        <td>
                          {isEditMode ? (
                            paramDef?.scoringType === 'binary' ? (
                              // Binary scoring type - only 0 or maxScore
                              <select 
                                className="form-select"
                                value={humanEvaluation.parameters[criterion]?.humanScore !== undefined ? 
                                  humanEvaluation.parameters[criterion].humanScore : 
                                  data.score}
                                onChange={(e) => handleHumanScoreChange(criterion, e.target.value)}
                                disabled={isSaving}
                              >
                                <option value="-1">N/A</option>
                                <option value="0">0 - Failed</option>
                                <option value={paramDef.maxScore || 5}>{paramDef.maxScore || 5} - Passed</option>
                              </select>
                            ) : (
                              // Variable scoring type - 0 to maxScore
                              <select 
                                className="form-select"
                                value={humanEvaluation.parameters[criterion]?.humanScore !== undefined ? 
                                  humanEvaluation.parameters[criterion].humanScore : 
                                  data.score}
                                onChange={(e) => handleHumanScoreChange(criterion, e.target.value)}
                                disabled={isSaving}
                              >
                                <option value="-1">N/A</option>
                                {[...Array(parseInt(paramDef?.maxScore || 5) + 1).keys()].map(score => (
                                  <option key={score} value={score}>
                                    {score} {score === 0 ? '- Failed' : score === parseInt(paramDef?.maxScore || 5) ? '- Excellent' : ''}
                                  </option>
                                ))}
                              </select>
                            )
                          ) : (
                            humanEvaluation.parameters[criterion]?.humanScore === -1 ? (
                              <span className="badge bg-secondary">N/A</span>
                            ) : (
                              <span className={`badge bg-${
                                (humanEvaluation.parameters[criterion]?.humanScore || 0) >= 4 ? 'success' :
                                (humanEvaluation.parameters[criterion]?.humanScore || 0) >= 3 ? 'warning' : 'danger'
                              }`}>
                                {humanEvaluation.parameters[criterion]?.humanScore !== undefined ? 
                                  humanEvaluation.parameters[criterion].humanScore : 
                                  data.score}
                                /{paramDef?.maxScore || 5}
                              </span>
                            )
                          )}
                        </td>
                      )}
                      <td>
                        {isEditMode ? (
                          <div>
                            <div className="mb-2">
                              <small className="text-muted">AI Explanation:</small>
                              <p className="mb-2">{data.explanation}</p>
                            </div>
                            <div>
                              <small className="text-muted">Human Explanation:</small>
                              <textarea
                                className="form-control mt-1"
                                rows="3"
                                value={humanEvaluation.parameters[criterion]?.humanExplanation || ''}
                                onChange={(e) => handleHumanExplanationChange(criterion, e.target.value)}
                                placeholder="Add your explanation here..."
                                disabled={isSaving}
                              />
                            </div>
                          </div>
                        ) : (
                          <div>
                            {humanEvaluation.isModerated && humanEvaluation.parameters[criterion]?.humanExplanation ? (
                              <div>
                                <div className="mb-2">
                                  <small className="text-muted">AI:</small>
                                  <p className="mb-0">{data.explanation}</p>
                                </div>
                                <div className="mt-2 p-2 border-start border-primary border-3 bg-light">
                                  <small className="text-primary">Human QA:</small>
                                  <p className="mb-0">{humanEvaluation.parameters[criterion].humanExplanation}</p>
                                </div>
                              </div>
                            ) : (
                              <p className="mb-0">{data.explanation}</p>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          
          {isEditMode && (
            <div className="alert alert-info mt-3">
              <AlertCircle size={16} className="me-2" />
              <strong>Important:</strong> 
              <ul className="mb-0 mt-1">
                <li>Binary questions can only be scored as 0 or full marks.</li>
                <li>Variable questions can be scored from 0 to the maximum score.</li>
                <li>Changes to scores and classifications will be immediately reflected in the section scores below.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  };

  const getEvaluationScores = () => {
    // If in edit mode and we have calculated scores, use those
    if (isEditMode && calculatedScores) {
      return calculatedScores;
    }
    
    // Otherwise, use the evaluation's section scores if available
    if (evaluation?.sectionScores) {
      return evaluation.sectionScores;
    }
    
    // Fallback to constructing scores from evaluation data
    const totalScore = evaluation?.evaluation?.totalScore || 
                      evaluation?.evaluationData?.evaluation?.totalScore || 0;
    const maxScore = evaluation?.evaluation?.maxScore || 
                    evaluation?.evaluationData?.evaluation?.maxScore || 
                    evaluation?.formTotalScore || 100;
    const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
    
    return {
      overall: {
        rawScore: totalScore,
        adjustedScore: totalScore,
        maxScore: maxScore,
        percentage: percentage
      },
      sections: {}
    };
  };

  // Render method for save/publish messages
  const renderSaveMessages = () => {
    return (
      <>
        {saveError && (
          <div className="alert alert-danger alert-dismissible fade show" role="alert">
            <AlertTriangle size={16} className="me-2" />
            {saveError}
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => setSaveError(null)}
            ></button>
          </div>
        )}
        
        {saveSuccess && (
          <div className="alert alert-success alert-dismissible fade show" role="alert">
            <CheckCircle size={16} className="me-2" />
            {saveSuccess}
            <button 
              type="button" 
              className="btn-close" 
              onClick={() => setSaveSuccess(null)}
            ></button>
          </div>
        )}
      </>
    );
  };

  // Utility function to get sentiment color
  const getSentimentColor = (sentiment) => {
    return sentiment === 'positive' ? 'bg-success' :
           sentiment === 'negative' ? 'bg-danger' : 'bg-warning';
  };

  // Render Sentiment Analysis Section
  const renderSentimentAnalysis = () => {
    // Get agent and customer sentiment
    const getAgentSentiment = () => {
      if (!evaluation?.evaluation?.agentSentiment) return 'neutral';
      
      return Array.isArray(evaluation.evaluation.agentSentiment) 
        ? evaluation.evaluation.agentSentiment[0] 
        : evaluation.evaluation.agentSentiment;
    };

    const getCustomerSentiment = () => {
      if (!evaluation?.evaluation?.customerSentiment) return 'neutral';
      
      return Array.isArray(evaluation.evaluation.customerSentiment) 
        ? evaluation.evaluation.customerSentiment[0] 
        : evaluation.evaluation.customerSentiment;
    };

    return (
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
                <span className="text-muted small">Overall {isTextChannel ? 'Conversation' : 'Call'} Sentiment</span>
              </div>
            </div>
            <div className="col-md-6">
              <h6 className="mb-3">Customer Sentiment</h6>
              <div className="d-flex align-items-center">
                <div className={`badge ${getSentimentColor(getCustomerSentiment())} me-2`}>
                  {getCustomerSentiment()}
                </div>
                <span className="text-muted small">Overall {isTextChannel ? 'Conversation' : 'Call'} Sentiment</span>
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
    );
  };

  // Enhanced Interaction Summary Section
  const renderInteractionSummary = () => {
    return (
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title mb-0">{isTextChannel ? 'Conversation' : 'Call'} Summary</h5>
        </div>
        <div className="card-body">
          <div className="row mb-4">
            {/* Channel Information */}
            <ChannelInfoSection evaluation={evaluation} messageData={messageData} />
            
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
                    <td className="text-capitalize">
                      {(evaluation.interactionData?.direction === 0 || evaluation.interaction?.direction === 0) || (evaluation.interactionData?.direction === "0" || evaluation.interaction?.direction === "0") ? 'Inbound' : 'Outbound'}
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Queue:</strong></td>
                    <td>{evaluation.interactionData?.queue?.name || evaluation.interaction?.queue?.name || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td><strong>Customer ID:</strong></td>
                    <td>{evaluation.interactionData?.caller?.id || evaluation.interaction?.caller?.id || 'N/A'}</td>
                  </tr>
                  <tr>
                    <td><strong>Evaluated By:</strong></td>
                    <td>{evaluation.evaluator?.name || 'AI System'}</td>
                  </tr>
                  <tr>
                    <td><strong>Evaluation Date:</strong></td>
                    <td>{evaluation.createdAt ? new Date(evaluation.createdAt).toLocaleString() : 'N/A'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Duration Details - Only for calls */}
          {!isTextChannel && (
            <div className="row mb-4">
              <div className="col-md-12">
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
            </div>
          )}
          
          <div className="mt-4">
            <h6 className="mb-3">Evaluation Summary</h6>
            <p className="text-muted mb-0">
              {evaluation.evaluation?.summary || 'No summary available'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Enhanced Transcription Section that handles both audio and text
  const renderTranscriptionSection = () => {
    if (isTextChannel && messageData) {
      return <MessageConversationSection messageData={messageData} evaluation={evaluation} />;
    }
    
    // Return existing audio transcription component
    const hasTranscription = () => {
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

    // Get transcription data
    const getTranscriptionData = () => {
      if (!evaluation) return [];

      // Prioritize recordedTranscription, then transcription
      if (Array.isArray(evaluation.recordedTranscription) && evaluation.recordedTranscription.length > 0) {
        return evaluation.recordedTranscription;
      }

      if (Array.isArray(evaluation.transcription) && evaluation.transcription.length > 0) {
        return evaluation.transcription.map(message => {
          const timestamp = Object.keys(message)[0];
          let msg = message[timestamp];
          msg.timestamp = new Date(parseInt(timestamp)).toLocaleTimeString();
          return msg;
        });
      }

      return [];
    };

    // If no transcription, return null
    if (!hasTranscription()) return null;

    return (
      <div className="card mb-4">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="card-title mb-0">
            Call Transcription 
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
            {showTranscription ? (
              <>
                <EyeOff size={16} className="me-1" />
                Hide Transcription
              </>
            ) : (
              <>
                <Eye size={16} className="me-1" />
                Show Transcription
              </>
            )}
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
                        <div>{entry.translated_text || entry.original_text}</div>
                        {entry.original_text && entry.translated_text !== entry.original_text && (
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
    );
  };

  // Render Areas of Improvement Section
  const renderAreasOfImprovement = () => {
    if (!evaluation.evaluation?.areasOfImprovement?.length) return null;

    return (
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
    );
  };

  // Render What the Agent Did Well Section
  const renderAgentStrengths = () => {
    if (!evaluation.evaluation?.whatTheAgentDidWell?.length) return null;

    return (
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
    );
  };

  // Render Silence Periods Section (only for calls)
  const renderSilencePeriods = () => {
    if (isTextChannel || !evaluation.evaluation?.silencePeriods?.length) return null;

    return (
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
    );
  };

  // Render Transcription Analysis Section
  const renderTranscriptionAnalysis = () => {
    if (!evaluation.transcriptionAnalysis) return null;

    return (
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
                  <h6 className="card-subtitle mb-2 text-muted">{isTextChannel ? 'Message' : 'Transcription'} Count</h6>
                  <h4>{evaluation.transcriptionAnalysis.messageCount || 0}</h4>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render QA Evaluator Comments Section
  const renderQAEvaluatorComments = () => {
    return (
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title mb-0">QA Evaluator Comments</h5>
        </div>
        <div className="card-body">
          {isEditMode ? (
            <div className="form-group">
              <textarea
                className="form-control"
                rows="4"
                value={humanEvaluation.additionalComments}
                onChange={(e) => handleAdditionalCommentsChange(e.target.value)}
                placeholder="Enter additional comments or feedback for this evaluation..."
                disabled={isSaving}
              />
            </div>
          ) : (
            <div>
              {humanEvaluation.additionalComments ? (
                <div className="p-3 border rounded bg-light">
                  <p className="mb-0">{humanEvaluation.additionalComments}</p>
                </div>
              ) : (
                <p className="text-muted mb-0">No additional comments from QA evaluator.</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDisputeResolutionSection = () => {
    // Only show for admins and when the evaluation is disputed
    if (!isAdmin || !(evaluation.status === 'disputed' || evaluation.disputed === true)) {
      return null;
    }
  
    return (
      <div className="card mb-4 border-danger">
        <div className="card-header bg-danger text-white d-flex justify-content-between align-items-center">
          <h5 className="card-title mb-0">
            <AlertTriangle size={18} className="me-2" />
            Dispute Resolution
          </h5>
        </div>
        <div className="card-body">
          <div className="alert alert-danger">
            <AlertTriangle size={16} className="me-2" />
            <strong>This evaluation has been disputed by the agent.</strong>
            <p className="mt-2 mb-0">Review the agent's comments above and decide whether to accept or reject the dispute.</p>
          </div>
          
          <div className="form-group mt-3">
            <label className="form-label">Resolution Comments</label>
            <textarea
              className="form-control"
              rows="4"
              value={resolutionComment}
              onChange={(e) => setResolutionComment(e.target.value)}
              placeholder="Provide comments explaining your decision..."
              disabled={resolvingDispute}
            />
          </div>
          
          <div className="d-flex gap-2 mt-3">
            <button 
              className="btn btn-success"
              onClick={() => handleResolveDispute('accept')}
              disabled={resolvingDispute || !resolutionComment.trim()}
              title={!resolutionComment.trim() ? "Please provide comments explaining your decision" : ""}
            >
              {resolvingDispute ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle size={16} className="me-2" />
                  Accept Dispute
                </>
              )}
            </button>
            <button 
              className="btn btn-danger"
              onClick={() => handleResolveDispute('reject')}
              disabled={resolvingDispute || !resolutionComment.trim()}
              title={!resolutionComment.trim() ? "Please provide comments explaining your decision" : ""}
            >
              {resolvingDispute ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" />
                  Processing...
                </>
              ) : (
                <>
                  <XCircle size={16} className="me-2" />
                  Reject Dispute
                </>
              )}
            </button>
          </div>
          
          <div className="mt-3">
            <h6>What happens next?</h6>
            <ul className="mb-0">
              <li><strong>Accept Dispute</strong>: The evaluation will be marked for review and require re-moderation</li>
              <li><strong>Reject Dispute</strong>: The evaluation will remain as is, with your comments added as feedback</li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  // Render Agent Comments Section
  const renderAgentCommentsSection = () => {
    // Show if:
    // 1. User is an agent AND evaluation is published, OR
    // 2. User is an admin, OR
    // 3. There are existing agent comments
    if (!(
      (isAgent && humanEvaluation.isPublished) || 
      isAdmin || 
      humanEvaluation.agentComments
    )) return null;
    
    return (
      <div className="card mb-4">
        <div className="card-header">
          <h5 className="card-title mb-0">Agent Response</h5>
        </div>
        <div className="card-body">
          {isAgent && humanEvaluation.isPublished ? (
            // Show editable form for agent
            <div className="form-group">
              <textarea
                className="form-control"
                rows="4"
                value={humanEvaluation.agentComments}
                onChange={(e) => handleAgentCommentsChange(e.target.value)}
                placeholder="Enter your response to this evaluation..."
                disabled={isSaving}
              />
              <div className="d-flex gap-2 mt-2">
                <button 
                  className="btn btn-primary"
                  onClick={() => saveHumanEvaluation(true)}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <MessageSquare size={16} className="me-2" />
                      Save Response
                    </>
                  )}
                </button>
                <button 
                  className="btn btn-danger"
                  onClick={handleDisputeEvaluation}
                  disabled={isSaving || !humanEvaluation.agentComments}
                  title={!humanEvaluation.agentComments ? "Please add comments explaining why you're disputing this evaluation" : ""}
                >
                  {isSaving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Disputing...
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={16} className="me-2" />
                      Dispute Evaluation
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            // Show read-only version for admins or when comments exist
            <div>
              {humanEvaluation.agentComments ? (
                <div className="p-3 border rounded bg-light">
                  <p className="mb-0">{humanEvaluation.agentComments}</p>
                  {evaluation.status === 'disputed' || evaluation.disputed ? (
                    <div className="alert alert-danger mt-2">
                      <AlertTriangle size={16} className="me-2" />
                      This evaluation has been disputed by the agent.
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-muted mb-0">No response from agent yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Main render method
  return (
    <div className="container-fluid py-4">
      {/* Status and Action Bar */}
      <div className="card mb-4">
        {(location.state?.fromDashboard || location.state?.fromRecentEvaluations || location.state?.fromNewEvaluations) && (
          <button
            className="btn btn-outline-secondary"
            onClick={() => {
              // Navigate based on source
              if (location.state?.fromDashboard) {
                navigate('/dashboard', { state: { fromEvaluationDetail: true } });
              } else if (location.state?.fromRecentEvaluations) {
                navigate('/evaluations', { state: { fromEvaluationDetail: true } });
              } else if (location.state?.fromNewEvaluations) {
                navigate('/new-evaluations', { state: { fromEvaluationDetail: true } });
              }
            }}
          >
            <i className="bi bi-arrow-left me-2"></i>
            Back to {location.state?.fromDashboard ? 'Dashboard' : location.state?.fromRecentEvaluations ? 'Evaluations' : 'New Evaluations'}
          </button>
        )}
        <div className="card-body d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <h4 className="mb-0 me-3">QA Evaluation</h4>
            {getStatusBadge()}
          </div>
          
          <div className="d-flex gap-2">
            {isAdmin && !isEditMode && (
              <button 
                className="btn btn-primary"
                onClick={() => setIsEditMode(true)}
              >
                <Edit size={16} className="me-2" />
                Edit Evaluation
              </button>
            )}
            
            {isAdmin && isEditMode && (
              <>
                <button 
                  className="btn btn-outline-secondary"
                  onClick={() => {
                    setIsEditMode(false);
                    // Reset any unsaved changes
                    fetchEvaluation();
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => saveHumanEvaluation(false)}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={16} className="me-2" />
                      Save Evaluation
                    </>
                  )}
                </button>
                <button 
                  className="btn btn-success"
                  onClick={() => saveHumanEvaluation(true)}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} className="me-2" />
                      {humanEvaluation.isPublished ? 'Update & Publish' : 'Publish Evaluation'}
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Save/Publish Messages */}
      {renderSaveMessages()}

      {/* Enhanced Score Display based on scoring mechanism */}
      {evaluation && (() => {
        const displayScores = getEvaluationScores();
        const hasNewScoringMechanism = evaluation.scoringMechanism === 'award' || evaluation.scoringMechanism === 'deduct';
        
        if (hasNewScoringMechanism) {
          return (
            <>
              <EnhancedScoreCard evaluation={evaluation} scores={displayScores} />
              
              {/* Scoring mechanism indicator */}
              <div className="alert alert-info mb-4">
                <div className="d-flex align-items-center">
                  <i className="bi bi-info-circle me-2"></i>
                  <div>
                    <strong>Scoring Method: </strong>
                    {evaluation.scoringMechanism === 'deduct' ? (
                      <>
                        <span className="badge bg-warning text-dark me-2">Deduct Mode</span>
                        Points are deducted from a starting total of {evaluation.formTotalScore || 100} for incorrect answers.
                      </>
                    ) : (
                      <>
                        <span className="badge bg-success me-2">Award Mode</span>
                        Points are awarded for correct answers, with a maximum possible score of {displayScores.overall.maxScore}.
                      </>
                    )}
                  </div>
                </div>
              </div>
            </>
          );
        } else {
          // Fallback to traditional score display for backward compatibility
          return (
            <div className="row mb-4">
              <ScoreCard 
                title="Overall Score" 
                value={isEditMode && calculatedScores ? 
                  calculatedScores.overall.adjustedScore.toFixed(1) : 
                  evaluation.evaluation?.totalScore || evaluation.evaluation?.scores?.overall?.average || 0}
                maxValue={isEditMode && calculatedScores ? 
                  calculatedScores.overall.maxScore : 
                  evaluation.evaluation?.maxScore || evaluation.evaluation?.scores?.overall?.maxScore || 100}
                percentage={isEditMode && calculatedScores ? 
                  calculatedScores.overall.percentage : 
                  Math.round(((evaluation.evaluation?.totalScore || evaluation.evaluation?.scores?.overall?.average || 0) / 
                    (evaluation.evaluation?.maxScore || evaluation.evaluation?.scores?.overall?.maxScore || 100)) * 100) || 0}
                bgColor={
                  (isEditMode && calculatedScores ? calculatedScores.overall.percentage : 
                  Math.round(((evaluation.evaluation?.totalScore || evaluation.evaluation?.scores?.overall?.average || 0) / 
                    (evaluation.evaluation?.maxScore || evaluation.evaluation?.scores?.overall?.maxScore || 100)) * 100) || 0) >= 80 ? 
                  'bg-success' : 
                  (isEditMode && calculatedScores ? calculatedScores.overall.percentage : 
                  Math.round(((evaluation.evaluation?.totalScore || evaluation.evaluation?.scores?.overall?.average || 0) / 
                    (evaluation.evaluation?.maxScore || evaluation.evaluation?.scores?.overall?.maxScore || 100)) * 100) || 0) >= 60 ? 
                  'bg-warning' : 'bg-danger'
                }
              />
            </div>
          );
        }
      })()}

      {/* Evaluation Criteria */}
      {renderEvaluationCriteria()}

      {/* Section-wise Scores */}
      {qaForm && (
        <SectionWiseScores 
          evaluation={evaluation} 
          qaForm={qaForm} 
          updatedScores={calculatedScores}
        />
      )}

      {interactionId && (
        <TicketInformationSection interactionId={interactionId} />
      )}
      
      {/* QA Evaluator Comments */}
      {renderQAEvaluatorComments()}

      {/* Agent Comments Section */}
      {renderAgentCommentsSection()}

      {/* Dispute Resolution Section - for admins only */}
      {renderDisputeResolutionSection()}

      {/* Sentiment Analysis Section */}
      {renderSentimentAnalysis()}

      {/* Enhanced Interaction Summary */}
      {renderInteractionSummary()}

      {/* Recording section - only show for audio channels */}
      {!isTextChannel && evaluation.interaction?.recording?.webPath && (
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

      {/* Areas of Improvement and Agent Strengths */}
      <div className="row">
        <div className="col-md-6">
          {renderAreasOfImprovement()}
        </div>
        
        <div className="col-md-6">
          {renderAgentStrengths()}
        </div>
      </div>

      {/* Silence Periods (only for calls) */}
      {renderSilencePeriods()}

      {/* Enhanced Transcription Section */}
      {renderTranscriptionSection()}

      {/* Transcription Analysis */}
      {renderTranscriptionAnalysis()}
      
      <style jsx>{`
        .message-bubble {
          word-wrap: break-word;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }

        .conversation-thread {
          border: 1px solid #dee2e6;
          border-radius: 0.375rem;
          padding: 1rem;
          background-color: #f8f9fa;
        }

        .message-text {
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
};

export default QADetail;