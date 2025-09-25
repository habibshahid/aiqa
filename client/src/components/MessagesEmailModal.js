// client/src/components/MessagesEmailModal.js
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

  const getSpeakerBadgeColor = (speakerRole) => {
    return speakerRole === 'customer' ? 'bg-info' : 'bg-success';
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
        <div className="modal-dialog modal-lg">
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

                  {/* Message Thread */}
                  <div className="conversation-container" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    {messagesData.conversation?.transcription?.map((entry, index) => {
                      const timestamp = Object.keys(entry)[0];
                      const messageData = entry[timestamp];
                      const time = formatMessageTime(timestamp);
                      const isCustomer = messageData.speaker_role === 'customer';
                      
                      return (
                        <div key={index} className={`d-flex mb-3 ${isCustomer ? '' : 'flex-row-reverse'}`}>
                          <div className={`message-bubble p-3 rounded-3 ${isCustomer ? 'bg-light me-3' : 'bg-primary text-white ms-3'}`} 
                               style={{ maxWidth: '70%', minWidth: '200px' }}>
                            
                            {/* Message Header */}
                            <div className="d-flex align-items-center mb-2">
                              <span className={`badge ${getSpeakerBadgeColor(messageData.speaker_role)} me-2`}>
                                {messageData.speaker_role === 'customer' ? 'Customer' : 'Agent'}
                              </span>
                              <small className={isCustomer ? 'text-muted' : 'text-white-50'}>
                                {time}
                              </small>
                            </div>
                            
                            {/* Show subject for emails */}
                            {isEmail && messageData.subject && (
                              <div className="mb-2">
                                <small className={isCustomer ? 'text-dark fw-bold' : 'text-white fw-bold'}>
                                  <i className="fas fa-envelope me-1"></i>
                                  Subject: {messageData.subject}
                                </small>
                              </div>
                            )}
                            
                            {/* Message Content */}
                            <div className="message-text" style={{ lineHeight: '1.4', wordBreak: 'break-word' }}>
                              {messageData.original_text}
                            </div>
                            
                            {/* Show attachment indicators */}
                            {messageData.attachments && messageData.attachments.length > 0 && (
                              <div className="mt-2">
                                <small className={isCustomer ? 'text-muted' : 'text-white-50'}>
                                  <i className="fas fa-paperclip me-1"></i>
                                  {messageData.attachments.length} attachment{messageData.attachments.length > 1 ? 's' : ''}:
                                </small>
                                <div className="mt-1">
                                  {messageData.attachments.map((attachment, i) => (
                                    <span key={i} className={`badge ${isCustomer ? 'bg-secondary' : 'bg-light text-dark'} me-1 mb-1`}>
                                      {attachment.type || attachment.data?.extension || 'file'}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Show forwarded indicator */}
                            {messageData.forwarded && (
                              <div className="mt-1">
                                <small className={isCustomer ? 'text-muted' : 'text-white-50'}>
                                  <i className="fas fa-share me-1"></i>Forwarded
                                </small>
                              </div>
                            )}
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
        .message-bubble {
          word-wrap: break-word;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        }

        .conversation-container::-webkit-scrollbar {
          width: 8px;
        }

        .conversation-container::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }

        .conversation-container::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 4px;
        }

        .conversation-container::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }
      `}</style>
    </>
  );
};

export default MessagesEmailModal;