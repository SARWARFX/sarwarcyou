import React, { useState, useRef, useEffect, useCallback } from 'react';
import { AlertCircle, RotateCcw, Loader2 } from 'lucide-react';
import type { MediaItem } from '../../models/media';
import { PlayerControls } from './PlayerControls';

export interface VideoPlayerProps {
  item: MediaItem;
  autoPlay?: boolean;
  onEnded?: () => void;
  className?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  item,
  autoPlay = true,
  onEnded,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiPAvailable, setIsPiPAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const hideControlsTimerRef = useRef<number | null>(null);

  // Check PiP support
  useEffect(() => {
    if (typeof document !== 'undefined') {
      setIsPiPAvailable(document.pictureInPictureEnabled ?? false);
    }
  }, []);

  // Reset state when switching media item
  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);

    const video = videoRef.current;
    if (video) {
      video.load();
      if (autoPlay) {
        video.play().catch(() => {
          // Auto-play was prevented by browser policy (common on first interaction)
          setIsPlaying(false);
        });
      }
    }
  }, [item.mediaUrl, autoPlay]);

  // Handle Fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Controls visibility inactivity timer
  const scheduleHideControls = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimerRef.current) {
      window.clearTimeout(hideControlsTimerRef.current);
    }
    if (isPlaying) {
      hideControlsTimerRef.current = window.setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  const handleMouseMove = () => {
    scheduleHideControls();
  };

  // Playback handlers
  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(video.duration || 0, time));
    video.currentTime = clamped;
    setCurrentTime(clamped);
  }, []);

  const handleSkip = useCallback((seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    handleSeek(video.currentTime + seconds);
  }, [handleSeek]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = newVolume;
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      video.muted = false;
      setIsMuted(false);
    }
  }, [isMuted]);

  const handleToggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const handlePlaybackRateChange = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
  }, []);

  const handleTogglePiP = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch {
      // Ignore PiP errors
    }
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  // Keyboard controls listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          handlePlayPause();
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          handleSkip(-5);
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          handleSkip(5);
          break;
        case 'arrowup':
          e.preventDefault();
          handleVolumeChange(Math.min(1, volume + 0.1));
          break;
        case 'arrowdown':
          e.preventDefault();
          handleVolumeChange(Math.max(0, volume - 0.1));
          break;
        case 'm':
          e.preventDefault();
          handleToggleMute();
          break;
        case 'f':
          e.preventDefault();
          handleToggleFullscreen();
          break;
      }
      scheduleHideControls();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    handlePlayPause,
    handleSkip,
    handleVolumeChange,
    handleToggleMute,
    handleToggleFullscreen,
    scheduleHideControls,
    volume,
  ]);

  // Video Element Events
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);

    // Calculate buffered percentage
    if (video.buffered.length > 0 && video.duration > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      setBuffered(bufferedEnd / video.duration);
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    setIsLoading(false);
  };

  const handleVideoError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  const handleRetry = () => {
    setHasError(false);
    setIsLoading(true);
    const video = videoRef.current;
    if (video) {
      video.load();
      video.play().catch(() => setIsPlaying(false));
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className={`relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 select-none group ${className}`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={item.mediaUrl}
        preload="metadata"
        crossOrigin="anonymous"
        playsInline
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => setIsLoading(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onError={handleVideoError}
        onEnded={onEnded}
        onClick={handlePlayPause}
        className="w-full h-full object-contain cursor-pointer"
      />

      {/* Loading Overlay */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-10 h-10 text-[#00E5FF] animate-spin" />
            <span className="text-xs font-mono text-zinc-300 tracking-wider">BUFFERING...</span>
          </div>
        </div>
      )}

      {/* Error State Banner */}
      {hasError && (
        <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center z-40">
          <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
          <h3 className="text-base font-bold text-white mb-1">Failed to load video stream</h3>
          <p className="text-xs text-zinc-400 font-mono max-w-md mb-4 break-all">
            {item.mediaUrl}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-mono uppercase tracking-wider cursor-pointer active:scale-95 transition"
          >
            <RotateCcw className="w-4 h-4 text-[#00E5FF]" />
            Retry Stream
          </button>
        </div>
      )}

      {/* Controls Overlay */}
      <div
        className={`transition-opacity duration-300 pointer-events-auto ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <PlayerControls
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          buffered={buffered}
          volume={volume}
          isMuted={isMuted}
          playbackRate={playbackRate}
          isFullscreen={isFullscreen}
          isPiPAvailable={isPiPAvailable}
          onPlayPause={handlePlayPause}
          onSeek={handleSeek}
          onVolumeChange={handleVolumeChange}
          onToggleMute={handleToggleMute}
          onPlaybackRateChange={handlePlaybackRateChange}
          onTogglePiP={handleTogglePiP}
          onToggleFullscreen={handleToggleFullscreen}
          onSkip={handleSkip}
        />
      </div>
    </div>
  );
};
