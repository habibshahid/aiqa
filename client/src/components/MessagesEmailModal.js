// client/src/components/MessagesEmailModal.js - IMPROVED VERSION
import React, { useState, useEffect } from 'react';

const MessagesEmailModal = ({ 
  isOpen, 
  onClose, 
  interaction,
  title = "Messages" 
}) => {
  const [messagesData, setMessagesData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isEmail = interaction?.channel === 'email';
  const displayTitle = isEmail ? 'Email Thread' : 'Message Conversation';

  useEffect(() => {
    if (isOpen && interaction?._id) {
      fetchMessages();
    }
  }, [isOpen, interaction]);

  const fetchMessages = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/interactions/${interaction._id}/messages`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${isEmail ? 'emails' : 'messages'}`);
      }

      const data = await response.json();
      setMessagesData(data);
    } catch (err) {
      console.error('Error fetching messages:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatMessageTime = (timestamp) => {
    const date = new Date(parseInt(timestamp));
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

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

  const getSpeakerBadgeColor = (speakerRole) => {
    return speakerRole === 'customer' ? 'bg-info' : 'bg-success';
  };

  // Enhanced text processing for emails
  const processEmailText = (text) => {
    if (!text) return { parts: [], hasThreads: false };
    
    // Convert various newline formats to standard \n
    let processedText = text
      .replace(/\\r\\n/g, '\n')  // Handle escaped newlines from JSON
      .replace(/\\n/g, '\n')     // Handle escaped \n
      .replace(/\r\n/g, '\n')    // Handle Windows line endings
      .replace(/\r/g, '\n');     // Handle old Mac line endings
    
    // Detect email thread separators
    const separatorPatterns = [
      /_{5,}/,                    // Underscores (_____)
      /^From:.*?Sent:.*?To:/ms,  // Email header pattern
      /^On .+? wrote:/m,          // "On [date] [person] wrote:"
      /-{5,}/,                    // Dashes (-----)
    ];
    
    // Split by separator patterns
    let parts = [];
    let currentPart = '';
    let inThread = false;
    
    const lines = processedText.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this line is a separator
      const isSeparator = separatorPatterns.some(pattern => pattern.test(line));
      
      if (isSeparator && currentPart.trim()) {
        // Save the current part
        parts.push({ text: currentPart.trim(), isThread: inThread });
        currentPart = line + '\n';
        inThread = true;
      } else {
        currentPart += line + '\n';
      }
    }
    
    // Add the last part
    if (currentPart.trim()) {
      parts.push({ text: currentPart.trim(), isThread: inThread });
    }
    
    // If no parts were created, return the whole text
    if (parts.length === 0) {
      parts.push({ text: processedText, isThread: false });
    }
    
    return { 
      parts, 
      hasThreads: parts.length > 1 || parts.some(p => p.isThread) 
    };
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
    // Simple URL detection and conversion
    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
    
    let result = text;
    
    // Replace URLs with links
    result = result.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
    
    // Replace email addresses with mailto links
    result = result.replace(emailRegex, (email) => {
      return `<a href="mailto:${email}">${email}</a>`;
    });
    
    return result;
  };

  // Render email content with proper formatting
  const renderEmailContent = (text) => {
    if (!text) return null;
    
    // Process the text to add line breaks and links
    const processedText = linkifyText(text);
    
    // Split into lines and render
    const lines = processedText.split('\n');
    
    return (
      <div>
        {lines.map((line, index) => (
          <div key={index} dangerouslySetInnerHTML={{ __html: line || '&nbsp;' }} />
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="modal-backdrop fade show" 
        onClick={handleBackdropClick}
        style={{ zIndex: 1050 }}
      ></div>
      <div 
        className="modal fade show" 
        style={{ display: 'block', zIndex: 1060 }} 
        tabIndex="-1"
        onKeyDown={handleKeyDown}
      >
        <div className="modal-dialog modal-xl">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{title || displayTitle}</h5>
              <button 
                type="button" 
                className="btn-close" 
                onClick={onClose}
                aria-label="Close"
              ></button>
            </div>
            <div className="modal-body">
              {/* Interaction Details */}
              <div className="mb-3">
                <div className="row">
                  <div className="col-md-4">
                    <small className="text-muted">Agent:</small>
                    <div className="fw-bold">{interaction?.agent?.name || 'Unknown'}</div>
                  </div>
                  <div className="col-md-4">
                    <small className="text-muted">Channel:</small>
                    <div className="fw-bold">
                      <span className="badge bg-primary me-1">
                        {isEmail ? 'Email' : interaction?.channel?.toUpperCase() || 'Unknown'}
                      </span>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <small className="text-muted">Date/Time:</small>
                    <div className="fw-bold">
                      {interaction?.createdAt ? 
                        new Date(interaction.createdAt).toLocaleString() : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              <hr />

              {loading ? (
                <div className="text-center py-4">
                  <div className="spinner-border" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <div className="mt-2">Loading {isEmail ? 'emails' : 'messages'}...</div>
                </div>
              ) : error ? (
                <div className="alert alert-danger">
                  <i className="fas fa-exclamation-circle me-2"></i>
                  {error}
                </div>
              ) : messagesData ? (
                <>
                  {/* Conversation Stats */}
                  <div className="row mb-3">
                    <div className="col-md-3">
                      <div className="text-center">
                        <div className="h4 text-primary mb-0">{messagesData.stats?.totalMessages || messagesData.count}</div>
                        <small className="text-muted">{isEmail ? 'Total Emails' : 'Total Messages'}</small>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="text-center">
                        <div className="h4 text-info mb-0">{messagesData.stats?.customerMessages || 0}</div>
                        <small className="text-muted">{isEmail ? 'Inbound' : 'Customer'}</small>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="text-center">
                        <div className="h4 text-success mb-0">{messagesData.stats?.agentMessages || 0}</div>
                        <small className="text-muted">{isEmail ? 'Outbound' : 'Agent'}</small>
                      </div>
                    </div>
                    <div className="col-md-3">
                      <div className="text-center">
                        <div className="h4 text-warning mb-0">{messagesData.stats?.multimediaMessages || 0}</div>
                        <small className="text-muted">{isEmail ? 'With Attachments' : 'Multimedia'}</small>
                      </div>
                    </div>
                  </div>

                  <hr />

                  {/* Message/Email Thread */}
                  <div className="conversation-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                    {messagesData.conversation?.transcription?.map((entry, index) => {
                      const timestamp = Object.keys(entry)[0];
                      const messageData = entry[timestamp];
                      const fullDateTime = formatFullDateTime(timestamp);
                      const isCustomer = messageData.speaker_role === 'customer';
                      
                      // Process email content
                      const emailContent = processEmailText(messageData.original_text);
                      
                      return (
                        <div key={index} className="mb-4">
                          {/* Email Card */}
                          <div className={`email-card border rounded shadow-sm ${isCustomer ? 'border-info' : 'border-success'}`}>
                            
                            {/* Email Header */}
                            <div className={`email-header p-3 ${isCustomer ? 'bg-light' : 'bg-primary bg-opacity-10'}`}>
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
                              
                              {/* Subject */}
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
                            
                            {/* Email Body */}
                            <div className="email-body p-3">
                              {emailContent.parts.map((part, partIndex) => {
                                const metadata = extractEmailMetadata(part.text);
                                const hasMetadata = metadata.from || metadata.sent || metadata.to;
                                
                                return (
                                  <div key={partIndex} className={partIndex > 0 ? 'mt-4 pt-3 border-top' : ''}>
                                    {/* Thread metadata */}
                                    {part.isThread && hasMetadata && partIndex > 0 && (
                                      <div className="email-metadata bg-light p-3 rounded mb-3 border-start border-4 border-secondary">
                                        <div className="text-muted mb-2">
                                          <i className="fas fa-reply me-2"></i>
                                          <strong>Previous Email in Thread</strong>
                                        </div>
                                        {metadata.from && (
                                          <div className="mb-1"><strong>From:</strong> {metadata.from}</div>
                                        )}
                                        {metadata.sent && (
                                          <div className="mb-1"><strong>Sent:</strong> {metadata.sent}</div>
                                        )}
                                        {metadata.to && (
                                          <div className="mb-1"><strong>To:</strong> {metadata.to}</div>
                                        )}
                                        {metadata.cc && (
                                          <div className="mb-1"><strong>Cc:</strong> {metadata.cc}</div>
                                        )}
                                        {metadata.subject && (
                                          <div className="mb-1"><strong>Subject:</strong> {metadata.subject}</div>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Email content with proper line breaks */}
                                    <div 
                                      className="email-content-text"
                                      style={{
                                        lineHeight: '1.6',
                                        fontFamily: 'Arial, sans-serif',
                                        fontSize: '14px',
                                        color: '#333',
                                        wordBreak: 'break-word'
                                      }}
                                    >
                                      {renderEmailContent(part.text)}
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
                    }) || (
                      <div className="alert alert-info">
                        <i className="fas fa-info-circle me-2"></i>
                        No {isEmail ? 'emails' : 'messages'} found for this interaction.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="alert alert-warning">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  No {isEmail ? 'email' : 'message'} data available for this interaction.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .email-card {
          transition: box-shadow 0.2s;
        }

        .email-card:hover {
          box-shadow: 0 4px 12px rgba(0,0,0,0.15) !important;
        }

        .email-header {
          border-bottom: 2px solid #dee2e6;
        }

        .email-metadata {
          font-size: 13px;
        }

        .email-content-text {
          max-width: 100%;
          overflow-x: auto;
        }

        .email-content-text a {
          color: #0d6efd;
          text-decoration: underline;
          word-break: break-all;
        }

        .email-content-text a:hover {
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
    </>
  );
};

export default MessagesEmailModal;