// client/src/components/InlineAudioPlayer.js - ENHANCED VERSION
import React, { useState, useRef, useEffect } from 'react';

const InlineAudioPlayer = ({ interaction, className = '' }) => {
  const audioRef = useRef(null);
  const progressRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [volume, setVolume] = useState(1);

  // Get recording URL from interaction
  const recordingUrl = interaction?.extraPayload?.callRecording?.webPathQA || 
                      interaction?.extraPayload?.callRecording?.webPath ||
                      interaction?.recording?.webPath;

  const audioProxyUrl = recordingUrl ? 
    `/api/audio-proxy?url=${encodeURIComponent(recordingUrl)}` : null;

  useEffect(() => {
    if (audioProxyUrl && audioRef.current) {
      const audio = audioRef.current;
      
      const handleLoadStart = () => setIsLoading(true);
      const handleLoadedMetadata = () => {
        setDuration(audio.duration || 0);
        setIsLoading(false);
      };
      const handleLoadError = () => {
        setError('Failed to load audio');
        setIsLoading(false);
      };
      const handleTimeUpdate = () => {
        if (!isDragging) {
          setCurrentTime(audio.currentTime || 0);
        }
      };
      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const handleEnded = () => setIsPlaying(false);

      audio.addEventListener('loadstart', handleLoadStart);
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('error', handleLoadError);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('ended', handleEnded);

      return () => {
        audio.removeEventListener('loadstart', handleLoadStart);
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('error', handleLoadError);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, [audioProxyUrl, isDragging]);

  const handlePlayPause = (e) => {
    e.stopPropagation(); // Prevent row click
    
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      // Pause any other playing audio first
      document.querySelectorAll('audio').forEach(audio => {
        if (audio !== audioRef.current && !audio.paused) {
          audio.pause();
        }
      });
      
      audioRef.current.play();
    }
  };

  const seekToTime = (newTime) => {
    if (!audioRef.current || !duration) return;
    
    const clampedTime = Math.max(0, Math.min(duration, newTime));
    audioRef.current.currentTime = clampedTime;
    setCurrentTime(clampedTime);
  };

  const handleSeek = (e) => {
    e.stopPropagation(); // Prevent row click
    
    if (!audioRef.current || !duration || !progressRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = percent * duration;
    
    seekToTime(newTime);
  };

  const handleMouseDown = (e) => {
    e.stopPropagation();
    setIsDragging(true);
    handleSeek(e);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    e.stopPropagation();
    handleSeek(e);
  };

  const handleMouseUp = (e) => {
    e.stopPropagation();
    setIsDragging(false);
  };

  // Add global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);

  const handleSkip = (seconds, e) => {
    e.stopPropagation();
    const newTime = currentTime + seconds;
    seekToTime(newTime);
  };

  const formatTime = (time) => {
    if (!time || isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDuration = (time) => {
    if (!time || isNaN(time)) return '0:00';
    if (time >= 3600) {
      // Show hours for long recordings
      const hours = Math.floor(time / 3600);
      const minutes = Math.floor((time % 3600) / 60);
      const seconds = Math.floor(time % 60);
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!audioProxyUrl) {
    return (
      <span className="badge bg-warning">
        No Recording
      </span>
    );
  }

  if (error) {
    return (
      <span className="badge bg-danger" title={error}>
        <i className="fas fa-exclamation-circle me-1"></i>
        Error
      </span>
    );
  }

  return (
    <div className={`inline-audio-player ${className}`} onClick={(e) => e.stopPropagation()}>
      <audio
        ref={audioRef}
        preload="metadata"
        style={{ display: 'none' }}
        volume={volume}
      >
        <source src={audioProxyUrl} type="audio/mpeg" />
      </audio>

      <div className="d-flex align-items-center">
        {/* Play/Pause Button */}
        <button
          className={`btn btn-sm me-2 ${isPlaying ? 'btn-danger' : 'btn-success'}`}
          onClick={handlePlayPause}
          disabled={isLoading}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          style={{ minWidth: '32px' }}
        >
          {isLoading ? (
            <div className="spinner-border spinner-border-sm" role="status" style={{ width: '12px', height: '12px' }}>
              <span className="visually-hidden">Loading...</span>
            </div>
          ) : (
            <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`} style={{ fontSize: '10px' }}></i>
          )}
        </button>

        {/* Skip backward 10s */}
        <button
          className="btn btn-sm btn-outline-secondary me-1"
          onClick={(e) => handleSkip(-10, e)}
          disabled={isLoading || !duration}
          title="Skip back 10s"
          style={{ padding: '2px 6px', fontSize: '9px' }}
        >
          <i className="fas fa-backward"></i>
        </button>

        {/* Skip forward 10s */}
        <button
          className="btn btn-sm btn-outline-secondary me-2"
          onClick={(e) => handleSkip(10, e)}
          disabled={isLoading || !duration}
          title="Skip forward 10s"
          style={{ padding: '2px 6px', fontSize: '9px' }}
        >
          <i className="fas fa-forward"></i>
        </button>

        {/* Time Display */}
        <div className="d-flex flex-column" style={{ minWidth: '90px' }}>
          <small className="text-muted text-center" style={{ fontSize: '11px', lineHeight: '1' }}>
            {formatTime(currentTime)} / {formatDuration(duration)}
          </small>
          <small className="text-muted text-center" style={{ fontSize: '9px', lineHeight: '1.2' }}>
            Click/drag to seek
          </small>
        </div>
      </div>

      {/* Enhanced progress bar with seek functionality */}
      {duration > 0 && (
        <div className="mt-2">
          <div 
            ref={progressRef}
            className="progress" 
            style={{ 
              height: '8px', 
              cursor: 'pointer',
              borderRadius: '4px',
              backgroundColor: '#e9ecef'
            }}
            onClick={handleSeek}
            onMouseDown={handleMouseDown}
            title={`Seek to ${formatTime((currentTime / duration) * duration)} / ${formatDuration(duration)}`}
          >
            <div 
              className={`progress-bar ${isDragging ? 'bg-warning' : 'bg-primary'}`}
              role="progressbar" 
              style={{ 
                width: `${(currentTime / duration) * 100}%`,
                borderRadius: '4px',
                position: 'relative'
              }}
            >
              {/* Seek handle/thumb */}
              <div
                style={{
                  position: 'absolute',
                  right: '-4px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '8px',
                  height: '8px',
                  backgroundColor: isDragging ? '#ffc107' : '#0d6efd',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  opacity: duration > 0 ? 1 : 0
                }}
              />
            </div>
          </div>
          
          {/* Time markers for longer recordings */}
          {duration > 300 && ( // Show markers for recordings longer than 5 minutes
            <div className="d-flex justify-content-between mt-1" style={{ fontSize: '8px' }}>
              <span className="text-muted">0:00</span>
              <span className="text-muted">{formatDuration(duration / 2)}</span>
              <span className="text-muted">{formatDuration(duration)}</span>
            </div>
          )}
        </div>
      )}

      {/* Keyboard shortcuts info (only show on hover) */}
      <div className="d-none d-lg-block" style={{ fontSize: '8px', color: '#6c757d', marginTop: '2px' }}>
        Space: Play/Pause • ←/→: Skip 10s
      </div>
    </div>
  );
};

export default InlineAudioPlayer;