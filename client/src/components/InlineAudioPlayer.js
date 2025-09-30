// client/src/components/InlineAudioPlayer.js
import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward } from 'lucide-react';

const InlineAudioPlayer = ({ interaction }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlayerActive, setIsPlayerActive] = useState(false); // NEW: Track if player is activated
  const [error, setError] = useState(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const audioUrl = interaction?.extraPayload?.callRecording?.webPathQA || 
	  interaction?.extraPayload?.callRecording?.webPath ||
	  interaction?.recording?.webPath;

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setIsLoading(false);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleError = (e) => {
    console.error('Audio playback error:', e);
    setError('Failed to load audio');
    setIsLoading(false);
    setIsPlaying(false);
  };

  // NEW: Activate player and start loading audio
  const activatePlayer = (e) => {
    e.stopPropagation();
    setIsPlayerActive(true);
    setIsLoading(true);
    
    // Small delay to ensure audio element is ready
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.load();
      }
    }, 100);
  };

  const togglePlayPause = (e) => {
    e.stopPropagation();
    
    if (!isPlayerActive) {
      activatePlayer(e);
      return;
    }

    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch((err) => {
            console.error('Playback failed:', err);
            setError('Playback failed');
            setIsPlaying(false);
          });
      }
    }
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const skipTime = (seconds, e) => {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, currentTime + seconds));
    }
  };

  const formatTime = (time) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const handleCanPlay = () => {
    // Audio is ready to play
    setIsLoading(false);
    // Auto-play after loading
    if (audioRef.current && isPlayerActive) {
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.error('Auto-play failed:', err);
          setIsPlaying(false);
        });
    }
  };

  if (!audioUrl) {
    return <span className="badge bg-warning">No Recording</span>;
  }

  if (error) {
    return (
      <div className="inline-audio-player-error" onClick={(e) => e.stopPropagation()}>
        <small className="text-danger">
          <i className="fas fa-exclamation-triangle me-1"></i>
          {error}
        </small>
      </div>
    );
  }

  // NEW: Show simple play button before player is activated
  if (!isPlayerActive) {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <button
          className="btn btn-sm btn-success d-flex align-items-center gap-1"
          onClick={activatePlayer}
          title="Play recording"
        >
          <Play size={16} />
          <span>Play Recording</span>
        </button>
      </div>
    );
  }

  // Show full player after activation
  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div 
      className="inline-audio-player" 
      onClick={(e) => e.stopPropagation()}
      style={{ minWidth: '280px' }}
    >
      {/* Audio element only loads when player is activated */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={handleError}
        onCanPlay={handleCanPlay}
        preload="none"
      />

      <div className="d-flex align-items-center gap-2">
        {/* Skip Back Button */}
        <button
          className="btn btn-sm btn-outline-secondary p-1"
          onClick={(e) => skipTime(-10, e)}
          disabled={isLoading || !duration}
          title="Rewind 10s"
          style={{ width: '32px', height: '32px' }}
        >
          <SkipBack size={16} />
        </button>

        {/* Play/Pause Button */}
        <button
          className="btn btn-sm btn-success p-1"
          onClick={togglePlayPause}
          disabled={isLoading}
          title={isPlaying ? 'Pause' : 'Play'}
          style={{ width: '36px', height: '36px' }}
        >
          {isLoading ? (
            <span className="spinner-border spinner-border-sm" style={{ width: '16px', height: '16px' }} />
          ) : isPlaying ? (
            <Pause size={18} />
          ) : (
            <Play size={18} />
          )}
        </button>

        {/* Skip Forward Button */}
        <button
          className="btn btn-sm btn-outline-secondary p-1"
          onClick={(e) => skipTime(10, e)}
          disabled={isLoading || !duration}
          title="Forward 10s"
          style={{ width: '32px', height: '32px' }}
        >
          <SkipForward size={16} />
        </button>

        {/* Progress Bar and Time */}
        <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: '120px' }}>
          <div className="position-relative" style={{ height: '6px', backgroundColor: '#e9ecef', borderRadius: '3px', cursor: 'pointer' }}>
            <input
              type="range"
              className="audio-progress-slider"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              disabled={isLoading || !duration}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
                zIndex: 2
              }}
            />
            <div 
              className="audio-progress-bar"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: `${progressPercentage}%`,
                backgroundColor: '#198754',
                borderRadius: '3px',
                transition: 'width 0.1s ease'
              }}
            />
          </div>
          <div className="d-flex justify-content-between mt-1">
            <small className="text-muted" style={{ fontSize: '0.7rem' }}>
              {duration > 0 ? formatTime(currentTime) : 'Loading...'}
            </small>
            <small className="text-muted" style={{ fontSize: '0.7rem' }}>
              {duration > 0 ? formatTime(duration) : '--:--'}
            </small>
          </div>
        </div>
      </div>

      <style jsx>{`
        .inline-audio-player {
          padding: 8px;
          background-color: #f8f9fa;
          border-radius: 6px;
          border: 1px solid #dee2e6;
        }

        .inline-audio-player:hover {
          background-color: #e9ecef;
        }

        .inline-audio-player-error {
          padding: 4px 8px;
          background-color: #fff3cd;
          border-radius: 4px;
          border: 1px solid #ffc107;
        }

        .btn {
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .btn:hover:not(:disabled) {
          transform: scale(1.05);
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .audio-progress-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 0;
          height: 0;
        }

        .audio-progress-slider::-moz-range-thumb {
          width: 0;
          height: 0;
          border: none;
          background: transparent;
        }
      `}</style>
    </div>
  );
};

export default InlineAudioPlayer;