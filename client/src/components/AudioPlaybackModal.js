// client/src/components/AudioPlaybackModal.js
import React, { useState, useRef, useEffect } from 'react';

const AudioPlaybackModal = ({ 
  isOpen, 
  onClose, 
  interaction,
  title = "Call Recording" 
}) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get recording URL from interaction
  const recordingUrl = interaction?.extraPayload?.callRecording?.webPathQA || 
                      interaction?.extraPayload?.callRecording?.webPath ||
                      interaction?.recording?.webPath;

  const audioProxyUrl = recordingUrl ? 
    `/api/audio-proxy?url=${encodeURIComponent(recordingUrl)}` : null;

  useEffect(() => {
    if (isOpen && audioRef.current && audioProxyUrl) {
      setIsLoading(true);
      setError(null);
    }
  }, [isOpen, audioProxyUrl]);

  const handleLoadStart = () => {
    setIsLoading(true);
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration || 0);
      setIsLoading(false);
    }
  };

  const handleLoadError = () => {
    setError('Failed to load audio file');
    setIsLoading(false);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime || 0);
    }
  };

  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const handleSeek = (e) => {
    if (audioRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      const newTime = percent * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
    if (e.key === ' ' && audioProxyUrl) {
      e.preventDefault();
      handlePlayPause();
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
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
              <h5 className="modal-title">{title}</h5>
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
                  <div className="col-md-6">
                    <small className="text-muted">Agent:</small>
                    <div className="fw-bold">{interaction?.agent?.name || 'Unknown'}</div>
                  </div>
                  <div className="col-md-6">
                    <small className="text-muted">Caller ID:</small>
                    <div className="fw-bold">{interaction?.caller?.id || 'Unknown'}</div>
                  </div>
                </div>
                <div className="row mt-2">
                  <div className="col-md-6">
                    <small className="text-muted">Date/Time:</small>
                    <div className="fw-bold">
                      {interaction?.createdAt ? 
                        new Date(interaction.createdAt).toLocaleString() : 'N/A'}
                    </div>
                  </div>
                  <div className="col-md-6">
                    <small className="text-muted">Duration:</small>
                    <div className="fw-bold">
                      {interaction?.connect?.duration ? 
                        formatTime(interaction.connect.duration) : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              <hr />

              {/* Audio Player */}
              {!audioProxyUrl ? (
                <div className="alert alert-warning">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  No recording available for this interaction.
                </div>
              ) : error ? (
                <div className="alert alert-danger">
                  <i className="fas fa-exclamation-circle me-2"></i>
                  {error}
                </div>
              ) : (
                <div>
                  <audio
                    ref={audioRef}
                    onLoadStart={handleLoadStart}
                    onLoadedMetadata={handleLoadedMetadata}
                    onError={handleLoadError}
                    onTimeUpdate={handleTimeUpdate}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    preload="metadata"
                    style={{ display: 'none' }}
                  >
                    <source src={audioProxyUrl} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>

                  {/* Custom Audio Controls */}
                  <div className="audio-player p-3 border rounded">
                    {isLoading ? (
                      <div className="text-center py-4">
                        <div className="spinner-border spinner-border-sm me-2" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        Loading audio...
                      </div>
                    ) : (
                      <>
                        {/* Play/Pause Button */}
                        <div className="d-flex align-items-center mb-3">
                          <button
                            className={`btn btn-primary btn-lg me-3`}
                            onClick={handlePlayPause}
                            disabled={!audioProxyUrl}
                          >
                            <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}></i>
                          </button>
                          
                          {/* Time Display */}
                          <div className="flex-grow-1">
                            <div className="d-flex justify-content-between small text-muted mb-1">
                              <span>{formatTime(currentTime)}</span>
                              <span>{formatTime(duration)}</span>
                            </div>
                            
                            {/* Progress Bar */}
                            <div 
                              className="progress" 
                              style={{ height: '6px', cursor: 'pointer' }}
                              onClick={handleSeek}
                            >
                              <div 
                                className="progress-bar bg-primary" 
                                role="progressbar" 
                                style={{ 
                                  width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%'
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>

                        {/* Native Audio Controls (fallback) */}
                        <audio 
                          controls 
                          className="w-100" 
                          controlsList="nodownload"
                          preload="metadata"
                          style={{ marginTop: '10px' }}
                        >
                          <source src={audioProxyUrl} type="audio/mpeg" />
                          Your browser does not support the audio element.
                        </audio>
                      </>
                    )}
                  </div>
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
    </>
  );
};

export default AudioPlaybackModal;