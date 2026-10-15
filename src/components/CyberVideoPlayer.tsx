import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  RotateCcw,
  RotateCw,
  Repeat,
  Repeat1,
  Gauge,
  ListVideo,
  ArrowLeft,
  Check,
  Loader2,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import type { StageMediaItem, MediaFolderEntry } from '../types';
import { downloadBrandedVideo } from '../utils/downloadMedia';
import { getMediaUrl } from '../utils/imageUrlResolver';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';
import { CyberMediaSidebar } from './CyberMediaSidebar';

export type VideoRepeatMode = 'off' | 'all' | 'one';

export interface CyberVideoPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  item: StageMediaItem | null;
  playlist?: StageMediaItem[];
  allFolders?: MediaFolderEntry[];
  onSelectItem?: (item: StageMediaItem) => void;
  onSelectFolder?: (folder: MediaFolderEntry) => void;
}

const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatDelta(seconds: number): string {
  const sign = seconds >= 0 ? '+' : '-';
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = Math.floor(abs % 60);
  return `${sign}${m}:${s.toString().padStart(2, '0')}s`;
}

export const CyberVideoPlayer: React.FC<CyberVideoPlayerProps> = ({
  isOpen,
  onClose,
  item,
  playlist = [],
  allFolders = [],
  onSelectItem,
  onSelectFolder,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain');
  const [repeatMode, setRepeatMode] = useState<VideoRepeatMode>('off');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // A-B Loop State
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);

  // HUD Auto-hide state
  const [showHud, setShowHud] = useState(true);
  const hudTimerRef = useRef<number | null>(null);

  // Samsung One UI Style Horizontal Gesture Scrubbing State
  const [gestureSeek, setGestureSeek] = useState<{
    isActive: boolean;
    isVisible: boolean;
    deltaSeconds: number;
    targetTime: number;
    icon: 'forward' | 'rewind';
  }>({
    isActive: false,
    isVisible: false,
    deltaSeconds: 0,
    targetTime: 0,
    icon: 'forward',
  });

  const gestureDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTime: number;
    isLockedHorizontal: boolean;
    isLockedVertical: boolean;
    hasMovedPastThreshold: boolean;
    targetTime: number;
    deltaSeconds: number;
  } | null>(null);

  const gestureFadeTimeoutRef = useRef<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const isDraggingProgress = useRef(false);

  // Auto-hide HUD on inactivity
  const resetHudTimer = useCallback(() => {
    setShowHud(true);
    if (hudTimerRef.current) window.clearTimeout(hudTimerRef.current);
    hudTimerRef.current = window.setTimeout(() => {
      setShowHud(false);
      setShowSpeedMenu(false);
    }, 2800);
  }, []);

  useEffect(() => {
    return () => {
      if (hudTimerRef.current) window.clearTimeout(hudTimerRef.current);
      if (gestureFadeTimeoutRef.current) window.clearTimeout(gestureFadeTimeoutRef.current);
    };
  }, []);

  // Sync state on media change
  const [prevItemKey, setPrevItemKey] = useState({ itemId: item?.id, isOpen });
  if (prevItemKey.itemId !== item?.id || prevItemKey.isOpen !== isOpen) {
    setPrevItemKey({ itemId: item?.id, isOpen });
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setLoopA(null);
    setLoopB(null);
    if (gestureFadeTimeoutRef.current) window.clearTimeout(gestureFadeTimeoutRef.current);
    gestureDragRef.current = null;
    setGestureSeek({
      isActive: false,
      isVisible: false,
      deltaSeconds: 0,
      targetTime: 0,
      icon: 'forward',
    });
  }

  // A-B Looping Enforcement on state change
  useEffect(() => {
    if (loopA !== null && loopB !== null && loopB > loopA && videoRef.current) {
      if (videoRef.current.currentTime >= loopB || videoRef.current.currentTime < loopA) {
        videoRef.current.currentTime = loopA;
        setCurrentTime(loopA);
      }
    }
  }, [loopA, loopB]);

  // Play / Pause Toggle
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    resetHudTimer();
  }, [resetHudTimer]);

  // Samsung One UI Style Horizontal Scrubbing Gesture Handlers
  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary button or touch
    if (e.button !== 0) return;

    if (gestureFadeTimeoutRef.current) {
      window.clearTimeout(gestureFadeTimeoutRef.current);
      gestureFadeTimeoutRef.current = null;
    }

    const currentVidTime = videoRef.current ? videoRef.current.currentTime : currentTime;

    gestureDragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTime: currentVidTime,
      isLockedHorizontal: false,
      isLockedVertical: false,
      hasMovedPastThreshold: false,
      targetTime: currentVidTime,
      deltaSeconds: 0,
    };
  };

  const handleStagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = gestureDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    // Direction locking check (prevents interference with vertical gestures or scroll)
    if (!drag.isLockedHorizontal && !drag.isLockedVertical) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        drag.isLockedVertical = true;
        return;
      }
      if (Math.abs(dx) > 10 && Math.abs(dx) >= Math.abs(dy)) {
        drag.isLockedHorizontal = true;
        drag.hasMovedPastThreshold = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch (_) {}
      }
    }

    if (drag.isLockedVertical || !drag.isLockedHorizontal) return;

    // Dynamic scrubbing sensitivity: ~10s per 100px dragged, gently scaled for longer videos
    const vidDuration = videoRef.current?.duration || duration || 60;
    const secPerPx = Math.max(0.1, Math.min(0.5, vidDuration / 600));
    const deltaSeconds = Math.round(dx * secPerPx);
    const targetTime = Math.max(0, Math.min(vidDuration, drag.startTime + deltaSeconds));
    const actualDelta = Math.round(targetTime - drag.startTime);

    drag.targetTime = targetTime;
    drag.deltaSeconds = actualDelta;

    setGestureSeek({
      isActive: true,
      isVisible: true,
      deltaSeconds: actualDelta,
      targetTime,
      icon: actualDelta >= 0 ? 'forward' : 'rewind',
    });

    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
    resetHudTimer();
  };

  const handleStagePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = gestureDragRef.current;
    if (!drag) return;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}

    if (drag.hasMovedPastThreshold && drag.isLockedHorizontal) {
      if (videoRef.current) {
        videoRef.current.currentTime = drag.targetTime;
        setCurrentTime(drag.targetTime);
        if (loopA !== null && loopB !== null && loopB > loopA) {
          if (drag.targetTime >= loopB || drag.targetTime < loopA) {
            videoRef.current.currentTime = loopA;
            setCurrentTime(loopA);
          }
        }
      }

      setGestureSeek((prev) => ({ ...prev, isActive: false }));
      if (gestureFadeTimeoutRef.current) window.clearTimeout(gestureFadeTimeoutRef.current);
      gestureFadeTimeoutRef.current = window.setTimeout(() => {
        setGestureSeek((prev) => ({ ...prev, isVisible: false }));
      }, 400);
    } else if (!drag.hasMovedPastThreshold && !drag.isLockedVertical) {
      togglePlay();
    }

    gestureDragRef.current = null;
  };

  const handleStagePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}

    setGestureSeek((prev) => ({ ...prev, isActive: false }));
    if (gestureFadeTimeoutRef.current) window.clearTimeout(gestureFadeTimeoutRef.current);
    gestureFadeTimeoutRef.current = window.setTimeout(() => {
      setGestureSeek((prev) => ({ ...prev, isVisible: false }));
    }, 400);

    gestureDragRef.current = null;
  };

  // Explicit Mobile Touchscreen Handlers for guaranteed compatibility
  const handleStageTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 1) {
      if (gestureDragRef.current) gestureDragRef.current.isLockedVertical = true;
      return;
    }
    const t = e.touches[0];
    if (gestureFadeTimeoutRef.current) {
      window.clearTimeout(gestureFadeTimeoutRef.current);
      gestureFadeTimeoutRef.current = null;
    }
    const currentVidTime = videoRef.current ? videoRef.current.currentTime : currentTime;
    gestureDragRef.current = {
      pointerId: -1,
      startX: t.clientX,
      startY: t.clientY,
      startTime: currentVidTime,
      isLockedHorizontal: false,
      isLockedVertical: false,
      hasMovedPastThreshold: false,
      targetTime: currentVidTime,
      deltaSeconds: 0,
    };
  };

  const handleStageTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const drag = gestureDragRef.current;
    if (!drag || e.touches.length > 1) return;
    const t = e.touches[0];
    const dx = t.clientX - drag.startX;
    const dy = t.clientY - drag.startY;

    if (!drag.isLockedHorizontal && !drag.isLockedVertical) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        drag.isLockedVertical = true;
        return;
      }
      if (Math.abs(dx) > 10 && Math.abs(dx) >= Math.abs(dy)) {
        drag.isLockedHorizontal = true;
        drag.hasMovedPastThreshold = true;
      }
    }

    if (drag.isLockedVertical || !drag.isLockedHorizontal) return;

    const vidDuration = videoRef.current?.duration || duration || 60;
    const secPerPx = Math.max(0.1, Math.min(0.5, vidDuration / 600));
    const deltaSeconds = Math.round(dx * secPerPx);
    const targetTime = Math.max(0, Math.min(vidDuration, drag.startTime + deltaSeconds));
    const actualDelta = Math.round(targetTime - drag.startTime);

    drag.targetTime = targetTime;
    drag.deltaSeconds = actualDelta;

    setGestureSeek({
      isActive: true,
      isVisible: true,
      deltaSeconds: actualDelta,
      targetTime,
      icon: actualDelta >= 0 ? 'forward' : 'rewind',
    });

    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
    resetHudTimer();
  };

  const handleStageTouchEnd = () => {
    const drag = gestureDragRef.current;
    if (!drag) return;

    if (drag.hasMovedPastThreshold && drag.isLockedHorizontal) {
      if (videoRef.current) {
        videoRef.current.currentTime = drag.targetTime;
        setCurrentTime(drag.targetTime);
        if (loopA !== null && loopB !== null && loopB > loopA) {
          if (drag.targetTime >= loopB || drag.targetTime < loopA) {
            videoRef.current.currentTime = loopA;
            setCurrentTime(loopA);
          }
        }
      }

      setGestureSeek((prev) => ({ ...prev, isActive: false }));
      if (gestureFadeTimeoutRef.current) window.clearTimeout(gestureFadeTimeoutRef.current);
      gestureFadeTimeoutRef.current = window.setTimeout(() => {
        setGestureSeek((prev) => ({ ...prev, isVisible: false }));
      }, 400);
    }

    gestureDragRef.current = null;
  };

  // Relative Seek
  const seekBy = useCallback((delta: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + delta));
    resetHudTimer();
  }, [resetHudTimer]);

  // Progress Bar Seek
  const handleProgressSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const target = pct * (videoRef.current.duration || 0);
    videoRef.current.currentTime = target;
    setCurrentTime(target);
    resetHudTimer();
  };

  // Toggle Fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      playerContainerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
    resetHudTimer();
  }, [resetHudTimer]);

  // Strict background scroll-lock
  useLockBodyScroll(isOpen);

  // Keyboard Shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSidebar) {
          setShowSidebar(false);
        } else if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight') {
        seekBy(10);
      } else if (e.key === 'ArrowLeft') {
        seekBy(-10);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'm' || e.key === 'M') {
        setIsMuted((m) => {
          if (videoRef.current) videoRef.current.muted = !m;
          return !m;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, togglePlay, seekBy, toggleFullscreen]);

  // Handle Download
  const handleDownload = async () => {
    if (!item || isDownloading) return;
    setIsDownloading(true);
    setDownloadSuccess(false);
    try {
      const dlUrl = getMediaUrl(item.url);
      await downloadBrandedVideo(dlUrl, item.title, 'clip');
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2200);
    } catch (err) {
      console.error('Video download error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // Handle A-B Loop Toggle
  const handleToggleLoop = () => {
    const now = videoRef.current ? videoRef.current.currentTime : currentTime;

    if (loopA === null) {
      // Button state 1 -> Set Point A
      setLoopA(now);
      setLoopB(null);
    } else if (loopB === null) {
      // Button state 2 -> Set Point B (requires loopB > loopA)
      if (now > loopA) {
        setLoopB(now);
      } else {
        const safeEnd = Math.min(duration || 0, loopA + 3);
        setLoopB(safeEnd > loopA ? safeEnd : (duration || loopA + 1));
      }
    } else {
      // Button state 4 -> Clear / Reset loop points back to normal unconstrained playback
      setLoopA(null);
      setLoopB(null);
    }
    resetHudTimer();
  };

  // Video Queue logic and Repeat Mode Handler
  const handleVideoEnded = useCallback(() => {
    if (repeatMode === 'one') {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
      setIsPlaying(true);
      return;
    }

    if (!item || !playlist.length) return;
    const currentIdx = playlist.findIndex((v) => v.id === item.id || v.url === item.url);
    const hasNext = currentIdx >= 0 && currentIdx < playlist.length - 1;

    if (repeatMode === 'all') {
      if (hasNext) {
        onSelectItem?.(playlist[currentIdx + 1]);
      } else if (playlist.length > 0) {
        onSelectItem?.(playlist[0]);
      }
      setIsPlaying(true);
      return;
    }

    // Normal ('off' / Autoplay Next)
    if (hasNext) {
      onSelectItem?.(playlist[currentIdx + 1]);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [repeatMode, playlist, item, onSelectItem]);

  if (!isOpen || !item) return null;

  const streamUrl = getMediaUrl(item.url);
  const cleanPlayerTitle = sanitizeMediaTitle(item.title, item.category);
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={playerContainerRef}
      onMouseMove={resetHudTimer}
      onClick={resetHudTimer}
      className="fixed inset-0 z-50 bg-black text-white overflow-hidden h-[100dvh] w-full max-w-full select-none font-sans touch-none touch-action-none overscroll-contain animate-fade-in"
    >
      {/* 1. Ambient Blurred Glow reflecting active video colors */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 flex items-center justify-center">
        <video
          src={streamUrl}
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
          className="w-full h-full object-cover filter blur-[90px] opacity-35 scale-125"
        />
      </div>

      {/* 2. Top Bar Overlay (Back Button, Title & Queue Toggle) */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className={`absolute top-0 inset-x-0 z-40 p-4 pt-[max(1rem,env(safe-area-inset-top))] flex items-center justify-between pointer-events-auto bg-gradient-to-b from-black/85 via-black/40 to-transparent transition-opacity duration-300 ${
          showHud ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 px-3 py-2 rounded-full bg-black/60 hover:bg-black/90 text-zinc-300 hover:text-white backdrop-blur-xl border border-white/10 transition-all cursor-pointer hover:border-[#00E5FF]/40"
              title="Back to Browse (Esc)"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-xs font-bold font-sans hidden sm:inline">Back</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-white tracking-wide truncate max-w-xs sm:max-w-md">
                  {cleanPlayerTitle}
                </h1>
                {playlist.length > 0 && (
                  <span className="text-[10px] font-mono font-bold text-[#00E5FF] bg-[#00E5FF]/10 px-2 py-0.5 rounded-full border border-[#00E5FF]/20 flex-shrink-0">
                    {playlist.findIndex((v) => v.id === item.id || v.url === item.url) + 1} / {playlist.length}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">
                {item.category || 'Cinema Vault'}
              </span>
            </div>
          </div>

          {/* Right Action: Queue Toggle */}
          <button
            type="button"
            onClick={() => {
              setShowSidebar(!showSidebar);
              resetHudTimer();
            }}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold font-sans tracking-wider backdrop-blur-xl border transition-all cursor-pointer ${
              showSidebar
                ? 'bg-[#00E5FF]/20 text-[#00E5FF] border-[#00E5FF]/40 shadow-[0_0_12px_rgba(0,229,255,0.25)]'
                : 'bg-black/60 hover:bg-black/90 text-zinc-300 hover:text-white border-white/10'
            }`}
            title={showSidebar ? 'Hide Queue & Suggestions' : 'Show Queue & Suggestions'}
          >
            <ListVideo className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">QUEUE</span>
            {playlist.length > 0 && (
              <span className="text-[10px] font-mono bg-white/10 px-1.5 py-0.2 rounded-full">
                {playlist.length}
              </span>
            )}
          </button>
        </div>

      {/* 2.5 Samsung One UI Style Horizontal Gesture Scrubbing Overlay */}
      {gestureSeek.isVisible && (
        <div
          className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none transition-all duration-300 transform ${
            gestureSeek.isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
        >
          <div className="flex flex-col items-center gap-2.5 px-6 py-4 rounded-3xl bg-black/85 backdrop-blur-2xl border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(0,229,255,0.25)] min-w-[210px]">
            {/* Top Row: Icon + Delta */}
            <div className="flex items-center gap-2">
              {gestureSeek.icon === 'forward' ? (
                <ChevronsRight className="w-6 h-6 text-[#00E5FF] animate-pulse" />
              ) : (
                <ChevronsLeft className="w-6 h-6 text-[#00E5FF] animate-pulse" />
              )}
              <span className="text-2xl font-mono font-black tracking-wider text-white">
                {formatDelta(gestureSeek.deltaSeconds)}
              </span>
            </div>

            {/* Target Timestamp / Total Duration */}
            <div className="text-xs font-mono font-bold tracking-wider text-zinc-300">
              <span className="text-[#00E5FF]">{formatTime(gestureSeek.targetTime)}</span>
              <span className="text-zinc-500 mx-1.5">/</span>
              <span>{formatTime(duration)}</span>
            </div>

            {/* Mini Progress Bar in Overlay */}
            {duration > 0 && (
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden mt-1">
                <div
                  className="h-full bg-[#00E5FF] shadow-[0_0_10px_#00E5FF] transition-all duration-75"
                  style={{ width: `${Math.max(0, Math.min(100, (gestureSeek.targetTime / duration) * 100))}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Frameless Center Video Stage (100% True Full Screen) */}
      <div
        className="absolute inset-0 w-full h-full flex items-center justify-center touch-none cursor-pointer overflow-hidden z-10"
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerUp}
        onPointerCancel={handleStagePointerCancel}
        onTouchStart={handleStageTouchStart}
        onTouchMove={handleStageTouchMove}
        onTouchEnd={handleStageTouchEnd}
        onTouchCancel={handleStageTouchEnd}
      >
        <video
          ref={videoRef}
          key={item.id}
          src={streamUrl}
          autoPlay
          playsInline
          muted={isMuted}
          className={`w-full h-full pointer-events-none transition-all duration-300 ${
            fitMode === 'cover' ? 'object-cover' : 'object-contain'
          }`}
          onTimeUpdate={() => {
            if (videoRef.current) {
              const now = videoRef.current.currentTime;
              // A-B Looping Enforcement: immediately seek back to loopA when now >= loopB
              if (loopA !== null && loopB !== null && loopB > loopA) {
                if (now >= loopB || now < loopA) {
                  videoRef.current.currentTime = loopA;
                  setCurrentTime(loopA);
                  return;
                }
              }
              if (!isDraggingProgress.current && !gestureSeek.isActive) {
                setCurrentTime(now);
                if (videoRef.current.buffered.length > 0) {
                  setBuffered(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
                }
              }
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration || 0);
            }
          }}
          onEnded={handleVideoEnded}
        />
      </div>

      {/* 4. Floating HUD Controls (Bottom) */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className={`absolute bottom-0 inset-x-0 z-40 p-2 sm:p-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex flex-col gap-1.5 sm:gap-2 max-w-5xl mx-auto w-full transition-opacity duration-300 pointer-events-auto overflow-hidden ${
          showHud ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Scrubber Bar */}
        <div
          ref={progressBarRef}
          onClick={handleProgressSeek}
          className="group/seek relative w-full h-2 hover:h-3 bg-white/10 rounded-full cursor-pointer transition-all flex items-center overflow-hidden"
        >
          {/* Buffered Progress */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-white/20 rounded-full transition-all"
            style={{ width: `${bufferPct}%` }}
          />
          {/* Active Progress with Neon Cyan Glow */}
          <div
            className="absolute left-0 top-0 bottom-0 bg-[#00E5FF] shadow-[0_0_12px_#00E5FF] rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />

          {/* A-B Loop Locked Interval Shading */}
          {duration > 0 && loopA !== null && loopB !== null && loopB > loopA && (
            <div
              className="absolute top-0 bottom-0 bg-cyan-400/35 border-x-2 border-[#00E5FF] shadow-[0_0_12px_rgba(0,229,255,0.7)] z-10 pointer-events-none"
              style={{
                left: `${(loopA / duration) * 100}%`,
                width: `${((loopB - loopA) / duration) * 100}%`,
              }}
            />
          )}

          {/* Marker A */}
          {duration > 0 && loopA !== null && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)] z-20 pointer-events-none"
              style={{ left: `${(loopA / duration) * 100}%` }}
            />
          )}

          {/* Marker B */}
          {duration > 0 && loopB !== null && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-[#00E5FF] shadow-[0_0_8px_rgba(0,229,255,0.9)] z-20 pointer-events-none"
              style={{ left: `${(loopB / duration) * 100}%` }}
            />
          )}
        </div>

        {/* HUD Button Row: Smoked Frosted Glass Pill */}
        <div className="cyber-pill px-2.5 sm:px-4 py-1.5 sm:py-2.5 flex items-center justify-between gap-1.5 sm:gap-3 w-full max-w-full overflow-hidden shadow-[0_10px_35px_rgba(0,0,0,0.8)]">
          {/* Bottom-Left: Play, Rewind/Forward, Volume, Timestamps */}
          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={togglePlay}
              className="p-1.5 sm:p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer flex-shrink-0"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={() => seekBy(-10)}
              className="p-1 sm:p-1.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer flex-shrink-0"
              title="10s Back"
            >
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            <button
              type="button"
              onClick={() => seekBy(10)}
              className="p-1 sm:p-1.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer flex-shrink-0"
              title="10s Forward"
            >
              <RotateCw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1 group/vol flex-shrink-0">
              <button
                type="button"
                onClick={() => {
                  setIsMuted(!isMuted);
                  if (videoRef.current) videoRef.current.muted = !isMuted;
                }}
                className="p-1 sm:p-1.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Mute / Unmute (M)"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  setIsMuted(false);
                  if (videoRef.current) {
                    videoRef.current.volume = val;
                    videoRef.current.muted = false;
                  }
                }}
                className="hidden sm:inline-block w-14 sm:w-18 h-1 accent-[#00E5FF] cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
              />
            </div>

            {/* Timestamp */}
            <span className="text-[10px] sm:text-xs font-mono font-medium text-zinc-300 tracking-wider whitespace-nowrap">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Bottom-Right: A-B loop, Speed, Download, Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-2.5 flex-shrink-0">
            {/* A-B Loop Control Toggle (Desktop only) */}
            <button
              type="button"
              onClick={handleToggleLoop}
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider transition-all cursor-pointer ${
                loopA !== null && loopB !== null
                  ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/60 shadow-[0_0_16px_rgba(0,229,255,0.4)]'
                  : loopA !== null
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                  : 'hover:bg-white/10 text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
              title={
                loopA !== null && loopB !== null
                  ? `A-B Loop Active (${formatTime(loopA)} - ${formatTime(loopB)}). Click to reset loop.`
                  : loopA !== null
                  ? `Set B (Point A locked at ${formatTime(loopA)}). Click to lock loop.`
                  : 'Set A (Click to start A-B loop)'
              }
            >
              <Repeat
                className={`w-3.5 h-3.5 ${
                  loopA !== null && loopB !== null
                    ? 'text-[#00E5FF]'
                    : loopA !== null
                    ? 'text-amber-400 animate-pulse'
                    : ''
                }`}
              />
              <span>
                {loopA !== null && loopB !== null
                  ? 'A-B Active'
                  : loopA !== null
                  ? `Set B (${formatTime(loopA)})`
                  : 'Set A'}
              </span>
            </button>

            {/* 3-State Repeat Mode Toggle */}
            <button
              type="button"
              onClick={() => {
                setRepeatMode((prev) => {
                  if (prev === 'off') return 'all';
                  if (prev === 'all') return 'one';
                  return 'off';
                });
                resetHudTimer();
              }}
              className={`flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-mono font-bold tracking-wider transition-all cursor-pointer ${
                repeatMode !== 'off'
                  ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/60 shadow-[0_0_12px_rgba(0,229,255,0.35)]'
                  : 'hover:bg-white/10 text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
              title={
                repeatMode === 'off'
                  ? 'Autoplay Next (Click for Repeat All)'
                  : repeatMode === 'all'
                  ? 'Repeat Queue / All (Click for Repeat One)'
                  : 'Repeat One (Click for Normal)'
              }
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-3.5 h-3.5 text-[#00E5FF]" />
              ) : (
                <Repeat className={`w-3.5 h-3.5 ${repeatMode === 'all' ? 'text-[#00E5FF]' : ''}`} />
              )}
              <span className="hidden sm:inline">
                {repeatMode === 'off'
                  ? 'Autoplay'
                  : repeatMode === 'all'
                  ? 'Repeat All'
                  : 'Repeat 1'}
              </span>
            </button>

            {/* Speed Selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="flex items-center gap-1 px-1.5 sm:px-2.5 py-1 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-zinc-200 text-[11px] sm:text-xs font-mono font-bold tracking-wider transition-colors cursor-pointer"
                title="Playback Speed"
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>{playbackRate}x</span>
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-10 right-0 cyber-glass rounded-xl p-1.5 flex flex-col gap-1 min-w-[75px] shadow-2xl z-50">
                  {PLAYBACK_RATES.map((rate) => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => {
                        setPlaybackRate(rate);
                        if (videoRef.current) videoRef.current.playbackRate = rate;
                        setShowSpeedMenu(false);
                      }}
                      className={`px-2 py-1 rounded-md text-xs font-mono font-bold text-left transition-colors cursor-pointer ${
                        playbackRate === rate
                          ? 'bg-[#00E5FF]/20 text-[#00E5FF]'
                          : 'text-zinc-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {rate}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 1-Click Download */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className={`flex items-center gap-1 px-2 sm:px-3 py-1 rounded-lg text-xs font-bold font-sans tracking-wider transition-all cursor-pointer ${
                downloadSuccess
                  ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                  : 'hover:bg-white/10 text-zinc-300 hover:text-white'
              } disabled:opacity-40`}
              title="Download Clip"
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden sm:inline">SAVED</span>
                </>
              ) : (
                <>
                  {isDownloading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00E5FF]" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">DOWNLOAD</span>
                </>
              )}
            </button>

            {/* Aspect Ratio Fit / Fill Toggle */}
            <button
              type="button"
              onClick={() => {
                setFitMode((prev) => (prev === 'contain' ? 'cover' : 'contain'));
                resetHudTimer();
              }}
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-mono font-bold tracking-wider transition-colors cursor-pointer border ${
                fitMode === 'cover'
                  ? 'bg-[#00E5FF]/20 text-[#00E5FF] border-[#00E5FF]/50 shadow-[0_0_10px_rgba(0,229,255,0.3)]'
                  : 'bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border-white/10'
              }`}
              title={
                fitMode === 'cover'
                  ? 'Fill Screen Active (Zoomed 100% borderless fill). Click for Aspect Fit.'
                  : 'Fit Screen Active (Aspect ratio preserved). Click for 100% Borderless Fill.'
              }
            >
              {fitMode === 'cover' ? 'FILL' : 'FIT'}
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-1 sm:p-1.5 rounded-full hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer flex-shrink-0"
              title="Fullscreen (F)"
            >
              {document.fullscreenElement ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* 5. Slide-out Queue & Suggestions Drawer (Responsive Bottom Sheet on Mobile, Right Drawer on Desktop) */}
      {showSidebar && (
        <div
          className="fixed inset-0 z-50 flex flex-col md:flex-row justify-end items-end md:items-stretch bg-black/75 backdrop-blur-sm animate-fade-in pointer-events-auto overflow-hidden w-full max-w-full"
          onClick={() => setShowSidebar(false)}
        >
          <div
            className="w-full md:w-auto h-[62vh] md:h-full max-h-[85vh] md:max-h-screen flex flex-col shadow-2xl pointer-events-auto overflow-hidden rounded-t-3xl md:rounded-t-none animate-slide-up md:animate-slide-left"
            onClick={(e) => e.stopPropagation()}
          >
            <CyberMediaSidebar
              items={playlist}
              activeItem={item}
              activeIdx={playlist.findIndex((v) => v.id === item.id || v.url === item.url)}
              onSelectItem={(selected) => onSelectItem?.(selected)}
              mediaType="video"
              currentFolderName={item.category || item.parentAlbum || 'Video Archive'}
              allFolders={allFolders}
              onSelectFolder={onSelectFolder}
              onClose={() => setShowSidebar(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default CyberVideoPlayer;
