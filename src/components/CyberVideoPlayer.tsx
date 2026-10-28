/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Download,
  Repeat,
  Repeat1,
  Gauge,
  ListVideo,
  Check,
  Loader2,
  ChevronsLeft,
  ChevronsRight,
  X,
  Share2,
  Folder,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { StageMediaItem, MediaFolderEntry } from '../types';
import { downloadBrandedVideo } from '../utils/downloadMedia';
import { getMediaUrl } from '../utils/imageUrlResolver';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { createShareableMediaUrl, copyToClipboard } from '../utils/urlRouter';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';
import { getCachedVideoPoster } from '../utils/videoPosterGenerator';
import { getCachedThumbnailSync } from '../utils/clientVideoThumbnails';
import { isVideoExtension } from '../utils/mediaTypeDetector';

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

const PLAYBACK_SPEED_OPTIONS = [0.1, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

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
  const [isMuted, setIsMuted] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain');
  const [repeatMode, setRepeatMode] = useState<VideoRepeatMode>('off');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  // Seek bar hover preview state
  const [seekHover, setSeekHover] = useState<{
    isHovering: boolean;
    hoverX: number;
    hoverPct: number;
    hoverTime: number;
  }>({
    isHovering: false,
    hoverX: 0,
    hoverPct: 0,
    hoverTime: 0,
  });

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
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const speedBtnRef = useRef<HTMLButtonElement>(null);
  const isDraggingProgress = useRef(false);

  // Outside click & ESC key handler for Playback Speed menu
  useEffect(() => {
    if (!showSpeedMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        speedMenuRef.current &&
        !speedMenuRef.current.contains(e.target as Node) &&
        speedBtnRef.current &&
        !speedBtnRef.current.contains(e.target as Node)
      ) {
        setShowSpeedMenu(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSpeedMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSpeedMenu]);

  // Ensure playbackSpeed persistence across video changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
      videoRef.current.preservesPitch = true;
    }
  }, [playbackSpeed, item?.id, item?.url]);

  // Auto-hide HUD on inactivity
  const resetHudTimer = useCallback(() => {
    setShowHud(true);
    if (hudTimerRef.current) window.clearTimeout(hudTimerRef.current);
    if (showSpeedMenu || seekHover.isHovering) return;
    hudTimerRef.current = window.setTimeout(() => {
      setShowHud(false);
      setShowSpeedMenu(false);
    }, 3200);
  }, [showSpeedMenu, seekHover.isHovering]);

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

  // Mobile Touchscreen Handlers
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

  // Hover Position & Timestamp Tracking for Seek Bar
  const handleSeekMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const vidDuration = videoRef.current?.duration || duration || 0;
    const time = (pct / 100) * vidDuration;

    setSeekHover({
      isHovering: true,
      hoverX: x,
      hoverPct: pct,
      hoverTime: time,
    });
  };

  const handleSeekMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    handleSeekMouseMove(e);
  };

  const handleSeekMouseLeave = () => {
    setSeekHover((prev) => ({ ...prev, isHovering: false }));
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

  // Handle Mute Toggle
  const handleToggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (videoRef.current) {
        videoRef.current.muted = next;
      }
      return next;
    });
    resetHudTimer();
  }, [resetHudTimer]);

  // Strict background scroll-lock
  useLockBodyScroll(isOpen);

  // Instantly release GPU RAM and video decoders on mobile
  const releaseVideoResources = useCallback(() => {
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      } catch {
        // ignore
      }
    }
  }, []);

  const handleClose = useCallback(() => {
    releaseVideoResources();
    onClose();
  }, [onClose, releaseVideoResources]);

  useEffect(() => {
    if (!isOpen) {
      releaseVideoResources();
    }
  }, [isOpen, releaseVideoResources]);

  useEffect(() => {
    return () => {
      releaseVideoResources();
    };
  }, [releaseVideoResources]);

  // Keyboard Shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          handleClose();
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
        handleToggleMute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, handleClose, togglePlay, seekBy, toggleFullscreen, handleToggleMute]);

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

  // Handle Share / Copy Direct Link
  const handleShareMedia = async () => {
    if (!item) return;
    const albumName = item.category || item.parentAlbum || '';
    const shareUrl = createShareableMediaUrl(item, albumName);
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2200);
    }
  };

  // Handle A-B Loop Toggle
  const handleToggleLoop = () => {
    const now = videoRef.current ? videoRef.current.currentTime : currentTime;

    if (loopA === null) {
      setLoopA(now);
      setLoopB(null);
    } else if (loopB === null) {
      let endPoint = now;
      if (endPoint <= loopA) {
        const safeEnd = Math.min(duration || 0, loopA + 3);
        endPoint = safeEnd > loopA ? safeEnd : (duration || loopA + 1);
      }
      setLoopB(endPoint);
      if (videoRef.current) {
        videoRef.current.currentTime = loopA;
      }
      setCurrentTime(loopA);
    } else {
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

  const streamUrl = getMediaUrl(item.url || item.path || item.id);
  const albumName = item.category || item.parentAlbum || 'Cinema Vault';
  const activeIdx = playlist.findIndex((v) => v.id === item.id || v.url === item.url);
  const currentItemIndex = activeIdx >= 0 ? activeIdx + 1 : 1;
  const totalCount = playlist.length;
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const displayTitle = sanitizeMediaTitle(item.title, item.category);

  // Clamped position for Seek Hover Tooltip
  const barWidth = progressBarRef.current?.getBoundingClientRect().width || 300;
  const tooltipWidth = 160;
  const halfTooltip = tooltipWidth / 2;
  const clampedX = barWidth > tooltipWidth + 16
    ? Math.max(halfTooltip + 8, Math.min(barWidth - halfTooltip - 8, seekHover.hoverX))
    : barWidth / 2;

  return (
    <div
      ref={playerContainerRef}
      className="fixed inset-0 z-[9999] bg-[#0f0f0f] text-white overflow-y-auto w-full h-[100dvh] font-sans select-none antialiased"
    >
      {/* 1. YouTube Dark-Mode Top Header Navigation Bar */}
      <header className="sticky top-0 z-50 h-14 w-full bg-[#0f0f0f]/95 backdrop-blur-md border-b border-white/[0.08] px-3 sm:px-6 flex items-center justify-between">
        {/* Left: YouTube Watch Logo & Brand Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-white/10 text-white/90 hover:text-white transition-colors cursor-pointer active:scale-95"
            title="Back to Catalog (Esc)"
            aria-label="Back to Catalog"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-7 h-5 rounded-md bg-[#ff0000] flex items-center justify-center shadow-[0_0_12px_rgba(255,0,0,0.4)]">
              <Play className="w-3 h-3 fill-current text-white ml-0.5" />
            </div>
            <span className="font-bold text-sm sm:text-base tracking-tight text-white">SARWARCYOU</span>
            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/10 text-zinc-300 hidden sm:inline">
              Watch
            </span>
          </div>
        </div>

        {/* Center: Current Album Name Tag */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.05] border border-white/10 text-xs font-mono text-zinc-300">
          <Folder className="w-3.5 h-3.5 text-[#00E5FF]" />
          <span className="truncate max-w-xs">{albumName}</span>
        </div>

        {/* Right: Share, Download & Close */}
        <div className="flex items-center gap-2">
          {/* Share Button */}
          <button
            type="button"
            onClick={handleShareMedia}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-xl border transition-all cursor-pointer active:scale-95 ${
              shareSuccess
                ? 'bg-[#00E5FF]/20 text-[#00E5FF] border-[#00E5FF]/40 shadow-[0_0_12px_rgba(0,229,255,0.25)]'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
            }`}
            title="Share Video Link"
            aria-label="Share Video Link"
          >
            {shareSuccess ? (
              <Check className="w-3.5 h-3.5 text-[#00E5FF]" />
            ) : (
              <Share2 className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{shareSuccess ? 'Copied' : 'Share'}</span>
          </button>

          {/* Download Button */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={isDownloading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all cursor-pointer disabled:opacity-40 active:scale-95"
            title="Download Video"
            aria-label="Download Video"
          >
            {downloadSuccess ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : isDownloading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00E5FF]" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{downloadSuccess ? 'Saved' : 'Download'}</span>
          </button>
        </div>
      </header>

      {/* 2. Main YouTube Watch-Page Layout Grid (Desktop: 70/30 Columns; Mobile: Sticky Player + Feed) */}
      <main className="max-w-[1780px] mx-auto px-0 sm:px-4 md:px-6 lg:px-8 py-0 sm:py-4 md:py-6 flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* ================= PRIMARY LEFT COLUMN (~70% Width) ================= */}
        <section className="w-full lg:flex-1 min-w-0 max-w-full lg:max-w-[calc(100%-380px)] xl:max-w-[calc(100%-420px)] flex flex-col">
          {/* Active Video Player Container (Sticky on Mobile, Rounded on Desktop) */}
          <div
            className="sticky top-14 lg:static z-40 w-full aspect-video bg-black rounded-none sm:rounded-2xl overflow-hidden relative shadow-2xl group/player"
            onMouseMove={resetHudTimer}
            onClick={resetHudTimer}
          >
            {/* Ambient Backing Glow */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,229,255,0.06)_0%,_rgba(0,0,0,0.95)_70%)]" />

            {/* Samsung One UI Style Horizontal Gesture Scrubbing Overlay */}
            {gestureSeek.isVisible && (
              <div
                className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none transition-all duration-300 transform ${
                  gestureSeek.isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                }`}
              >
                <div className="flex flex-col items-center gap-2.5 px-6 py-4 rounded-3xl bg-black/85 backdrop-blur-2xl border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(0,229,255,0.25)] min-w-[210px]">
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
                  <div className="text-xs font-mono font-bold tracking-wider text-zinc-300">
                    <span className="text-[#00E5FF]">{formatTime(gestureSeek.targetTime)}</span>
                    <span className="text-zinc-500 mx-1.5">/</span>
                    <span>{formatTime(duration)}</span>
                  </div>
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

            {/* Video Canvas Stage with Touch/Pointer Handlers */}
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
                src={streamUrl}
                autoPlay
                preload="auto"
                playsInline
                crossOrigin="anonymous"
                muted={isMuted}
                className={`w-full h-full pointer-events-none transition-all duration-300 ${
                  fitMode === 'cover' ? 'object-cover' : 'object-contain'
                }`}
                onCanPlay={(e) => {
                  const v = e.currentTarget;
                  const playPromise = v.play();
                  if (playPromise !== undefined) {
                    playPromise.then(() => setIsPlaying(true)).catch(() => {});
                  }
                }}
                onTimeUpdate={() => {
                  if (videoRef.current) {
                    const now = videoRef.current.currentTime;
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
                    videoRef.current.playbackRate = playbackSpeed;
                    videoRef.current.preservesPitch = true;
                  }
                }}
                onPlay={() => {
                  setIsPlaying(true);
                  if (videoRef.current) {
                    videoRef.current.playbackRate = playbackSpeed;
                    videoRef.current.preservesPitch = true;
                  }
                }}
                onEnded={handleVideoEnded}
              />
            </div>

            {/* Custom Video Player HUD Controls Overlay (Retained 100% as requested) */}
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className={`absolute bottom-0 inset-x-0 z-40 p-2 sm:p-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex flex-col gap-1.5 max-w-5xl mx-auto w-full transition-opacity duration-300 pointer-events-auto ${
                showHud ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Scrubber Container with Hover Preview */}
              <div
                ref={progressBarRef}
                onClick={handleProgressSeek}
                onMouseEnter={handleSeekMouseEnter}
                onMouseMove={handleSeekMouseMove}
                onMouseLeave={handleSeekMouseLeave}
                className="group/seek relative w-full py-2 cursor-pointer select-none overflow-visible"
              >
                {/* Floating Hover Preview Tooltip Card */}
                {seekHover.isHovering && duration > 0 && (
                  <div
                    className="absolute bottom-6 -translate-x-1/2 pointer-events-none transition-transform duration-75 ease-out z-40"
                    style={{ left: `${clampedX}px` }}
                  >
                    <div className="px-3 py-1.5 rounded-lg border border-white/20 bg-neutral-900/95 shadow-2xl flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#00E5FF]">
                        {formatTime(seekHover.hoverTime)}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        ({formatDelta(seekHover.hoverTime - currentTime)})
                      </span>
                    </div>
                  </div>
                )}

                {/* Visual Track */}
                <div className="relative w-full h-2 group-hover/seek:h-2.5 bg-white/10 rounded-full transition-all flex items-center overflow-hidden">
                  {/* Buffered Progress */}
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-white/20 rounded-full transition-all"
                    style={{ width: `${bufferPct}%` }}
                  />

                  {/* Subtle Ghost Scrub Fill on Hover */}
                  {seekHover.isHovering && (
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-white/20 rounded-full pointer-events-none transition-all"
                      style={{ width: `${seekHover.hoverPct}%` }}
                    />
                  )}

                  {/* Active Progress with Neon Cyan Glow */}
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-[#00E5FF] shadow-[0_0_12px_#00E5FF] rounded-full transition-all"
                    style={{ width: `${progressPct}%` }}
                  />

                  {/* Ghost Scrub Line Marker */}
                  {seekHover.isHovering && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] pointer-events-none z-30"
                      style={{ left: `${seekHover.hoverPct}%` }}
                    />
                  )}

                  {/* A-B Loop Locked Interval Shading */}
                  {duration > 0 && loopA !== null && loopB !== null && loopB > loopA && (
                    <div
                      className="absolute top-0 bottom-0 bg-violet-500/30 border-x-2 border-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.6)] z-10 pointer-events-none"
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
                      className="absolute top-0 bottom-0 w-1 bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.9)] z-20 pointer-events-none"
                      style={{ left: `${(loopB / duration) * 100}%` }}
                    />
                  )}
                </div>
              </div>

              {/* HUD Button Row: Smoked Frosted Glass Pill */}
              <div className="cyber-pill px-2 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-1 sm:gap-2 w-full max-w-full overflow-x-auto scrollbar-none shadow-[0_10px_35px_rgba(0,0,0,0.8)]">
                {/* Left side: Play/Pause button + Current Time / Duration counter */}
                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={togglePlay}
                    className="p-1.5 sm:p-2 rounded-lg text-white/90 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer flex-shrink-0"
                    title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    )}
                  </button>

                  <span className="text-[10px] sm:text-xs font-mono font-medium text-white/80 tracking-wider whitespace-nowrap select-none">
                    {formatTime(currentTime)} <span className="text-white/40">/</span> {formatTime(duration)}
                  </span>
                </div>

                {/* Right side: Repeat, AB Repeat, Fit/Fill, Download, Speed, Mute, Fullscreen */}
                <div className="flex items-center gap-0.5 sm:gap-1.5 flex-shrink-0">
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
                    className={`p-1.5 sm:p-2 rounded-lg transition-all cursor-pointer flex-shrink-0 active:scale-95 ${
                      repeatMode !== 'off'
                        ? 'bg-violet-600/30 text-violet-300 border border-violet-500/40 shadow-[0_0_10px_rgba(139,92,246,0.25)]'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    }`}
                    title={
                      repeatMode === 'off'
                        ? 'Autoplay Next (Click for Repeat All)'
                        : repeatMode === 'all'
                        ? 'Repeat Queue / All (Click for Repeat One)'
                        : 'Repeat One (Click for Normal)'
                    }
                    aria-label={`Repeat mode: ${repeatMode}`}
                  >
                    {repeatMode === 'one' ? (
                      <Repeat1 className="w-4 h-4 text-violet-300" />
                    ) : (
                      <Repeat className={`w-4 h-4 ${repeatMode === 'all' ? 'text-violet-300' : ''}`} />
                    )}
                  </button>

                  {/* A-B Loop Pill */}
                  <button
                    type="button"
                    onClick={handleToggleLoop}
                    className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md text-[10px] sm:text-xs font-mono font-bold tracking-wider transition-all cursor-pointer active:scale-95 flex-shrink-0 ${
                      loopA !== null && loopB !== null
                        ? 'bg-violet-600/30 text-violet-300 border border-violet-500/30 shadow-[0_0_10px_rgba(139,92,246,0.3)]'
                        : loopA !== null
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                        : 'p-1.5 sm:p-2 text-white/80 hover:text-white hover:bg-white/10 border border-transparent'
                    }`}
                    title={
                      loopA !== null && loopB !== null
                        ? `A-B Loop Active (${formatTime(loopA)} - ${formatTime(loopB)}). Tap to clear.`
                        : loopA !== null
                        ? `Set Point B (Point A set at ${formatTime(loopA)}). Tap to lock loop.`
                        : 'Set Point A (Tap to start A-B loop)'
                    }
                    aria-label="A-B Loop"
                  >
                    <Repeat
                      className={`w-3.5 h-3.5 ${
                        loopA !== null && loopB !== null
                          ? 'text-violet-300'
                          : loopA !== null
                          ? 'text-amber-400 animate-pulse'
                          : 'text-current'
                      }`}
                    />
                    <span className="text-[10px] sm:text-xs">
                      {loopA !== null && loopB !== null
                        ? 'A-B'
                        : loopA !== null
                        ? 'Set B'
                        : 'A-B'}
                    </span>
                  </button>

                  {/* Aspect Ratio Fit / Fill Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      setFitMode((prev) => (prev === 'contain' ? 'cover' : 'contain'));
                      resetHudTimer();
                    }}
                    className={`px-1.5 sm:px-2 py-1 rounded-md text-[10px] sm:text-xs font-mono font-bold tracking-wider transition-colors cursor-pointer border flex-shrink-0 active:scale-95 ${
                      fitMode === 'cover'
                        ? 'bg-[#00E5FF]/20 text-[#00E5FF] border-[#00E5FF]/50 shadow-[0_0_8px_rgba(0,229,255,0.3)]'
                        : 'bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border-white/10'
                    }`}
                    title={
                      fitMode === 'cover'
                        ? 'Fill Screen Active (Zoomed borderless fill). Click for Aspect Fit.'
                        : 'Fit Screen Active (Aspect ratio preserved). Click for 100% Borderless Fill.'
                    }
                    aria-label={`Fit mode: ${fitMode}`}
                  >
                    {fitMode === 'cover' ? 'FILL' : 'FIT'}
                  </button>

                  {/* 1-Click Download */}
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={isDownloading}
                    className={`p-1.5 sm:p-2 rounded-lg transition-all cursor-pointer flex-shrink-0 active:scale-95 ${
                      downloadSuccess
                        ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                        : 'text-white/80 hover:text-white hover:bg-white/10'
                    } disabled:opacity-40`}
                    title={downloadSuccess ? 'Video Clip Saved' : isDownloading ? 'Downloading Video...' : 'Download Video Clip'}
                    aria-label="Download Video"
                  >
                    {downloadSuccess ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : isDownloading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#00E5FF]" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>

                  {/* Speed Selector Popover */}
                  <div className="relative flex-shrink-0">
                    <button
                      ref={speedBtnRef}
                      type="button"
                      onClick={() => setShowSpeedMenu((prev) => !prev)}
                      className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white text-[10px] sm:text-xs font-mono font-bold tracking-wider transition-colors cursor-pointer active:scale-95"
                      title="Playback Speed"
                      aria-haspopup="true"
                      aria-expanded={showSpeedMenu}
                    >
                      <Gauge className="w-3.5 h-3.5 text-violet-400" />
                      <span>{playbackSpeed}x</span>
                    </button>

                    {showSpeedMenu && (
                      <div
                        ref={speedMenuRef}
                        className="absolute bottom-11 right-0 mb-1 py-1.5 px-1 rounded-xl bg-neutral-900/95 backdrop-blur-xl border border-white/15 shadow-2xl flex flex-col gap-0.5 z-50 min-w-[85px] max-h-[50vh] overflow-y-auto"
                      >
                        {PLAYBACK_SPEED_OPTIONS.map((speed) => {
                          const isSelected = playbackSpeed === speed;
                          const label = speed === 1 ? '1x (Normal)' : `${speed}x`;
                          return (
                            <button
                              key={speed}
                              type="button"
                              onClick={() => {
                                setPlaybackSpeed(speed);
                                if (videoRef.current) {
                                  videoRef.current.playbackRate = speed;
                                  videoRef.current.preservesPitch = true;
                                }
                                setShowSpeedMenu(false);
                              }}
                              className={`px-2 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer text-left flex items-center justify-between gap-1.5 ${
                                isSelected
                                  ? 'bg-violet-600/30 text-violet-300 font-semibold shadow-[0_0_10px_rgba(139,92,246,0.25)] border border-violet-500/30'
                                  : 'text-zinc-400 hover:text-white hover:bg-white/10'
                              }`}
                            >
                              <span>{label}</span>
                              {isSelected && <Check className="w-3 h-3 text-violet-400" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Mute / Unmute Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleMute}
                    className="p-1.5 sm:p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer flex-shrink-0"
                    title={isMuted ? 'Unmute' : 'Mute'}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4 text-zinc-400" /> : <Volume2 className="w-4 h-4 text-violet-400" />}
                  </button>

                  {/* Fullscreen */}
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="p-1.5 sm:p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all cursor-pointer flex-shrink-0"
                    title="Fullscreen (F)"
                    aria-label="Toggle Fullscreen"
                  >
                    {document.fullscreenElement ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Underneath Video Player: Title & Creator Metadata Bar */}
          <div className="px-3 sm:px-0 py-3 sm:py-4 flex flex-col gap-3">
            {/* YouTube Video Title */}
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight leading-snug">
              {displayTitle}
            </h1>

            {/* Creator Row & Action Pill Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-b border-white/[0.08] pb-4">
              {/* Creator Channel Badge */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00E5FF] to-blue-700 flex items-center justify-center font-bold text-white shadow-md">
                  S
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-white">Sarwar</span>
                    <div className="w-3.5 h-3.5 rounded-full bg-zinc-600 flex items-center justify-center text-black">
                      <Check className="w-2.5 h-2.5 text-white" />
                    </div>
                  </div>
                  <span className="text-xs text-zinc-400 font-mono">Stream Vault Official</span>
                </div>

                <div className="ml-2 px-2.5 py-1 rounded-full bg-white/[0.07] border border-white/10 text-xs font-mono text-[#00E5FF] flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#00E5FF]" />
                  <span>{albumName}</span>
                </div>
              </div>

              {/* YouTube Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleShareMedia}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold backdrop-blur-xl border transition-all cursor-pointer active:scale-95 ${
                    shareSuccess
                      ? 'bg-[#00E5FF]/20 text-[#00E5FF] border-[#00E5FF]/40 shadow-[0_0_12px_rgba(0,229,255,0.25)]'
                      : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
                  }`}
                  title="Share Direct Link"
                >
                  {shareSuccess ? <Check className="w-4 h-4 text-[#00E5FF]" /> : <Share2 className="w-4 h-4" />}
                  <span>{shareSuccess ? 'Copied' : 'Share'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-all cursor-pointer disabled:opacity-40 active:scale-95"
                  title="Download Video Clip"
                >
                  {downloadSuccess ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : isDownloading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#00E5FF]" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>{downloadSuccess ? 'Saved' : 'Download'}</span>
                </button>
              </div>
            </div>

            {/* YouTube Description Box */}
            <div
              onClick={() => setIsDescExpanded((prev) => !prev)}
              className="bg-[#272727]/60 hover:bg-[#272727]/90 rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm text-zinc-300 leading-relaxed cursor-pointer transition-all border border-white/[0.05]"
            >
              <div className="flex flex-wrap items-center gap-3 font-semibold text-white mb-2">
                <span>{albumName}</span>
                <span className="text-zinc-500">•</span>
                <span className="font-mono text-xs text-[#00E5FF]">Clip #{currentItemIndex} of {totalCount}</span>
                {item.date && (
                  <>
                    <span className="text-zinc-500">•</span>
                    <span className="text-xs text-zinc-400 font-mono">
                      {new Date(item.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>
                  </>
                )}
              </div>

              <p className={`text-zinc-300 ${isDescExpanded ? '' : 'line-clamp-2'}`}>
                Streaming directly from Hugging Face dataset <span className="font-mono text-cyan-400">SARWARFX/stream-vault</span> via Cloudflare Worker edge streaming proxy. Original source file: <span className="font-mono text-zinc-400">{item.path || item.name || item.id}</span>.
              </p>

              <button
                type="button"
                className="mt-2 text-xs font-bold text-white hover:text-[#00E5FF] flex items-center gap-1 cursor-pointer"
              >
                {isDescExpanded ? (
                  <>Show less <ChevronUp className="w-3.5 h-3.5" /></>
                ) : (
                  <>...more <ChevronDown className="w-3.5 h-3.5" /></>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* ================= SECONDARY RIGHT COLUMN (~30% Width) ================= */}
        {/* Scrollable "Up Next" / Recommended Queue Feed */}
        <aside className="w-full lg:w-[360px] xl:w-[400px] flex-shrink-0 flex flex-col gap-3 px-3 sm:px-0 pb-16">
          {/* "Up Next" Queue Header */}
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-2">
              <ListVideo className="w-4 h-4 text-[#00E5FF]" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Up Next</h2>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/10 text-[#00E5FF] border border-[#00E5FF]/20">
              {currentItemIndex} / {totalCount}
            </span>
          </div>

          {/* Video Cards List (Authentic YouTube Watch-Page Style) */}
          <div className="flex flex-col gap-2.5">
            {playlist.map((it, idx) => {
              const isActive = idx === activeIdx || it.id === item.id || it.url === item.url;
              const cardTitle = sanitizeMediaTitle(it.title, it.category);
              const rawPoster = (
                it.thumbnails?.[0] ||
                getCachedThumbnailSync(it.url) ||
                getCachedVideoPoster(it.url) ||
                it.thumbnail ||
                ''
              );
              const cardThumb = rawPoster && !isVideoExtension(rawPoster) ? getMediaUrl(rawPoster) : '';

              return (
                <div
                  key={it.id || idx}
                  onClick={() => onSelectItem?.(it)}
                  className={`group/card flex gap-3 p-2 rounded-xl transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-white/[0.12] ring-1 ring-[#00E5FF]/60 shadow-[0_0_15px_rgba(0,229,255,0.2)]'
                      : 'hover:bg-white/[0.07] border border-transparent hover:border-white/10'
                  }`}
                >
                  {/* Left: 16:9 Thumbnail Container */}
                  <div className="w-36 sm:w-40 aspect-video rounded-lg overflow-hidden relative flex-shrink-0 bg-zinc-900 border border-white/10 group-hover/card:scale-102 transition-transform duration-200">
                    {cardThumb ? (
                      <img
                        src={cardThumb}
                        alt={cardTitle}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-zinc-800 to-black flex items-center justify-center">
                        <Play className="w-4 h-4 text-zinc-500 fill-current ml-0.5" />
                      </div>
                    )}

                    {/* Active "Now Playing" Equalizer Overlay */}
                    {isActive ? (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center gap-1">
                        <div className="w-1 h-3 bg-[#00E5FF] rounded-full animate-bounce" />
                        <div className="w-1 h-4 bg-[#00E5FF] rounded-full animate-bounce [animation-delay:0.15s]" />
                        <div className="w-1 h-2.5 bg-[#00E5FF] rounded-full animate-bounce [animation-delay:0.3s]" />
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/25 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity">
                        <Play className="w-5 h-5 text-white fill-current ml-0.5 drop-shadow-md" />
                      </div>
                    )}
                  </div>

                  {/* Right: Video Metadata (Title, Channel, Album) */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h3 className={`text-xs sm:text-sm font-semibold line-clamp-2 leading-snug group-hover/card:text-[#00E5FF] transition-colors ${
                      isActive ? 'text-[#00E5FF]' : 'text-white'
                    }`}>
                      {cardTitle}
                    </h3>
                    <span className="text-[11px] text-zinc-400 mt-1 truncate">Sarwar</span>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono truncate">
                      <span>{it.category || albumName}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Other Albums / Folders in Stream Vault (YouTube Recommended Playlists) */}
          {allFolders.length > 1 && (
            <div className="mt-4 pt-4 border-t border-white/[0.08] flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-300 uppercase tracking-wider">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Other Video Vaults</span>
              </div>

              <div className="flex flex-col gap-1.5">
                {allFolders
                  .filter((f) => (f.name || f.id) !== albumName)
                  .slice(0, 4)
                  .map((folder) => (
                    <button
                      key={folder.id || folder.name}
                      type="button"
                      onClick={() => onSelectFolder?.(folder)}
                      className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.05] hover:border-white/15 text-left text-xs transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Folder className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                        <span className="font-medium text-zinc-200 group-hover:text-white truncate">
                          {folder.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 flex-shrink-0 ml-2">
                        {folder.items.length} clips
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
};

export default CyberVideoPlayer;
