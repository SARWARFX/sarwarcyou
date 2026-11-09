import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
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
  Check,
  Loader2,
  ChevronsLeft,
  ChevronsRight,
  Share2,
  X,
  AlertTriangle,
  PictureInPicture2,
} from 'lucide-react';
import type { StageMediaItem, MediaFolderEntry } from '../types';
import { downloadBrandedVideo } from '../utils/downloadMedia';
import { getMediaUrl, getDirectHfVideoUrl } from '../utils/imageUrlResolver';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { createShareableMediaUrl, copyToClipboard } from '../utils/urlRouter';
import { CyberMediaSidebar } from './CyberMediaSidebar';
import { lockToLandscape, unlockOrientation } from '../utils/orientationManager';
import { useBackButton } from '../utils/backButtonManager';
import { hapticLight } from '../utils/hapticsManager';
import { cacheVideoForOffline, getLocalCachedVideoUrl } from '../services/videoOfflineManager';

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

const PLAYBACK_SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

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
  const [speedMenuPos, setSpeedMenuPos] = useState<{ bottom: number; right: number } | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain');
  const [repeatMode, setRepeatMode] = useState<VideoRepeatMode>('off');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [videoResolution, setVideoResolution] = useState<{ width: number; height: number } | null>(null);

  // Picture-in-Picture State
  const [isPiPSupported, setIsPiPSupported] = useState(false);

  // Auto-cache video on native app when opened/played
  useEffect(() => {
    if (isOpen && item && Capacitor.isNativePlatform()) {
      cacheVideoForOffline(item).catch(() => {});
    }
  }, [isOpen, item]);

  useEffect(() => {
    if (typeof document !== 'undefined' && 'pictureInPictureEnabled' in document) {
      setIsPiPSupported(Boolean(document.pictureInPictureEnabled));
    }
  }, []);

  const handleTogglePiP = async () => {
    try {
      hapticLight();
      if (!videoRef.current) return;
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP error:', err);
    }
  };

  // Playback Fallback & Error State
  const [sourceOverride, setSourceOverride] = useState<string | null>(null);
  const [hasPlaybackError, setHasPlaybackError] = useState(false);
  const fallbackAttemptedRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    setSourceOverride(null);
    setHasPlaybackError(false);
    fallbackAttemptedRef.current = {};
  }, [item?.id, item?.url, isOpen]);

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
  const sliderPreviewVideoRef = useRef<HTMLVideoElement>(null);
  const gesturePreviewVideoRef = useRef<HTMLVideoElement>(null);
  const wasPlayingBeforeGesture = useRef(false);
  const lastTimeUpdateRef = useRef<number>(0);

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const speedBtnRef = useRef<HTMLButtonElement>(null);
  const isDraggingProgress = useRef(false);

  // Auto-hide HUD on inactivity (3 seconds)
  const resetHudTimer = useCallback(() => {
    setShowHud(true);
    if (hudTimerRef.current) window.clearTimeout(hudTimerRef.current);
    if (showSpeedMenu || seekHover.isHovering) return;
    hudTimerRef.current = window.setTimeout(() => {
      setShowHud(false);
      setShowSpeedMenu(false);
    }, 3000);
  }, [showSpeedMenu, seekHover.isHovering]);

  // Robust Playback Speed Application Engine
  const applyPlaybackSpeed = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      try {
        videoRef.current.defaultPlaybackRate = speed;
        videoRef.current.playbackRate = speed;
        videoRef.current.preservesPitch = true;
        (videoRef.current as any).webkitPreservesPitch = true;
        (videoRef.current as any).mozPreservesPitch = true;
      } catch (err) {
        console.warn('Failed to set video playback rate:', err);
      }
    }
  }, []);

  const handleSelectSpeed = useCallback(
    (speed: number) => {
      applyPlaybackSpeed(speed);
      setShowSpeedMenu(false);
      resetHudTimer();
    },
    [applyPlaybackSpeed, resetHudTimer]
  );

  const toggleSpeedMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const targetEl = (e.currentTarget as HTMLElement) || speedBtnRef.current;
    setShowSpeedMenu((prev) => {
      const next = !prev;
      if (next && targetEl) {
        const rect = targetEl.getBoundingClientRect();
        setSpeedMenuPos({
          bottom: Math.max(16, window.innerHeight - rect.top + 8),
          right: Math.max(8, window.innerWidth - rect.right),
        });
      }
      return next;
    });
  }, []);

  // Sync menu position dynamically on resize / scroll
  useEffect(() => {
    if (!showSpeedMenu || !speedBtnRef.current) return;
    const updatePos = () => {
      if (speedBtnRef.current) {
        const rect = speedBtnRef.current.getBoundingClientRect();
        setSpeedMenuPos({
          bottom: Math.max(16, window.innerHeight - rect.top + 8),
          right: Math.max(8, window.innerWidth - rect.right),
        });
      }
    };
    updatePos();
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [showSpeedMenu]);

  // Outside click & ESC key handler for Playback Speed menu (touch + mouse)
  useEffect(() => {
    if (!showSpeedMenu) return;

    if (hudTimerRef.current) {
      window.clearTimeout(hudTimerRef.current);
      hudTimerRef.current = null;
    }
    setShowHud(true);

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        speedMenuRef.current &&
        !speedMenuRef.current.contains(target) &&
        speedBtnRef.current &&
        !speedBtnRef.current.contains(target)
      ) {
        setShowSpeedMenu(false);
        resetHudTimer();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSpeedMenu(false);
        resetHudTimer();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSpeedMenu, resetHudTimer]);

  // Ensure playbackSpeed persistence across video changes
  useEffect(() => {
    if (videoRef.current) {
      try {
        videoRef.current.defaultPlaybackRate = playbackSpeed;
        videoRef.current.playbackRate = playbackSpeed;
        videoRef.current.preservesPitch = true;
        (videoRef.current as any).webkitPreservesPitch = true;
        (videoRef.current as any).mozPreservesPitch = true;
      } catch (_) {}
    }
  }, [playbackSpeed, item?.id, item?.url]);

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
    hapticLight();
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
    wasPlayingBeforeGesture.current = !videoRef.current?.paused;

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
        // Pause playback during horizontal drag so seeking is instantaneous and audio doesn't stutter
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch (_) {}
      }
    }

    if (drag.isLockedVertical || !drag.isLockedHorizontal) return;

    // Dynamic scrubbing sensitivity: ~10s per 100px dragged, gently scaled for longer videos
    const vidDuration = videoRef.current?.duration || duration || 60;
    const secPerPx = Math.max(0.1, Math.min(0.5, vidDuration / 500));
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

    // Update main video element so entire player shows frames in real time
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }

    // Also update gesture preview video frame lazily
    if (gesturePreviewVideoRef.current) {
      if (!gesturePreviewVideoRef.current.src || gesturePreviewVideoRef.current.src !== streamUrl) {
        gesturePreviewVideoRef.current.src = streamUrl;
      }
      if (Math.abs(gesturePreviewVideoRef.current.currentTime - targetTime) > 0.15) {
        gesturePreviewVideoRef.current.currentTime = targetTime;
      }
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
        // Smoothly resume playback if video was playing prior to scrubbing
        if (wasPlayingBeforeGesture.current) {
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      }

      setGestureSeek((prev) => ({ ...prev, isActive: false }));
      if (gestureFadeTimeoutRef.current) window.clearTimeout(gestureFadeTimeoutRef.current);
      gestureFadeTimeoutRef.current = window.setTimeout(() => {
        setGestureSeek((prev) => ({ ...prev, isVisible: false }));
        if (gesturePreviewVideoRef.current) {
          try {
            gesturePreviewVideoRef.current.pause();
            gesturePreviewVideoRef.current.removeAttribute('src');
            gesturePreviewVideoRef.current.load();
          } catch (_) {}
        }
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

    if (wasPlayingBeforeGesture.current && videoRef.current) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }

    setGestureSeek((prev) => ({ ...prev, isActive: false }));
    if (gestureFadeTimeoutRef.current) window.clearTimeout(gestureFadeTimeoutRef.current);
    gestureFadeTimeoutRef.current = window.setTimeout(() => {
      setGestureSeek((prev) => ({ ...prev, isVisible: false }));
      if (gesturePreviewVideoRef.current) {
        try {
          gesturePreviewVideoRef.current.pause();
          gesturePreviewVideoRef.current.removeAttribute('src');
          gesturePreviewVideoRef.current.load();
        } catch (_) {}
      }
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
    wasPlayingBeforeGesture.current = !videoRef.current?.paused;

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
        if (videoRef.current && !videoRef.current.paused) {
          videoRef.current.pause();
        }
      }
    }

    if (drag.isLockedVertical || !drag.isLockedHorizontal) return;

    const vidDuration = videoRef.current?.duration || duration || 60;
    const secPerPx = Math.max(0.1, Math.min(0.5, vidDuration / 500));
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

    if (gesturePreviewVideoRef.current) {
      if (!gesturePreviewVideoRef.current.src || gesturePreviewVideoRef.current.src !== streamUrl) {
        gesturePreviewVideoRef.current.src = streamUrl;
      }
      if (Math.abs(gesturePreviewVideoRef.current.currentTime - targetTime) > 0.15) {
        gesturePreviewVideoRef.current.currentTime = targetTime;
      }
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
        if (wasPlayingBeforeGesture.current) {
          videoRef.current.play().catch(() => {});
          setIsPlaying(true);
        }
      }

      setGestureSeek((prev) => ({ ...prev, isActive: false }));
      if (gestureFadeTimeoutRef.current) window.clearTimeout(gestureFadeTimeoutRef.current);
      gestureFadeTimeoutRef.current = window.setTimeout(() => {
        setGestureSeek((prev) => ({ ...prev, isVisible: false }));
        if (gesturePreviewVideoRef.current) {
          try {
            gesturePreviewVideoRef.current.pause();
            gesturePreviewVideoRef.current.removeAttribute('src');
            gesturePreviewVideoRef.current.load();
          } catch (_) {}
        }
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

    // Lazily mount timeslider hover preview video frame on demand
    if (sliderPreviewVideoRef.current) {
      if (!sliderPreviewVideoRef.current.src || sliderPreviewVideoRef.current.src !== streamUrl) {
        sliderPreviewVideoRef.current.src = streamUrl;
      }
      if (Math.abs(sliderPreviewVideoRef.current.currentTime - time) > 0.15) {
        sliderPreviewVideoRef.current.currentTime = time;
      }
    }
  };

  const handleSeekMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    handleSeekMouseMove(e);
  };

  const handleSeekMouseLeave = () => {
    setSeekHover((prev) => ({ ...prev, isHovering: false }));
    if (sliderPreviewVideoRef.current) {
      try {
        sliderPreviewVideoRef.current.pause();
        sliderPreviewVideoRef.current.removeAttribute('src');
        sliderPreviewVideoRef.current.load();
      } catch (_) {}
    }
  };

  // Toggle Fullscreen with Landscape Auto-Rotate via Native Capacitor Screen Orientation
  const handleFullscreenToggle = useCallback(async () => {
    hapticLight();
    const container = playerContainerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    if (!document.fullscreenElement) {
      try {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        } else if ((container as any).webkitRequestFullscreen) {
          await (container as any).webkitRequestFullscreen();
        }
      } catch (err) {
        console.warn('Fullscreen request notice:', err);
      }

      // Force rotate phone screen to landscape on video fullscreen
      await lockToLandscape();
    } else {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      } catch (err) {
        console.warn('Fullscreen exit notice:', err);
      }

      await unlockOrientation();
    }
    resetHudTimer();
  }, [resetHudTimer]);

  // Listen to fullscreenchange to unlock orientation if user exits via hardware gestures
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        unlockOrientation();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      unlockOrientation();
    };
  }, []);

  // Android Native Hardware Back Button handler
  useBackButton(
    useCallback(() => {
      // 1. If currently in fullscreen, exit fullscreen and restore portrait
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
        unlockOrientation();
        return true;
      }

      // 2. If sidebar drawer is open, close drawer first
      if (showSidebar) {
        setShowSidebar(false);
        return true;
      }

      // 3. Close the video player
      unlockOrientation();
      onClose();
      return true;
    }, [showSidebar, onClose]),
    isOpen
  );

  // Handle Mute Toggle
  const handleToggleMute = useCallback(() => {
    hapticLight();
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
        videoRef.current.src = '';
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      } catch {
        // ignore
      }
    }
    if (sliderPreviewVideoRef.current) {
      try {
        sliderPreviewVideoRef.current.pause();
        sliderPreviewVideoRef.current.src = '';
        sliderPreviewVideoRef.current.removeAttribute('src');
        sliderPreviewVideoRef.current.load();
      } catch {
        // ignore
      }
    }
    if (gesturePreviewVideoRef.current) {
      try {
        gesturePreviewVideoRef.current.pause();
        gesturePreviewVideoRef.current.src = '';
        gesturePreviewVideoRef.current.removeAttribute('src');
        gesturePreviewVideoRef.current.load();
      } catch {
        // ignore
      }
    }
  }, []);

  const handleClose = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    if ('orientation' in screen && 'unlock' in (screen.orientation as any)) {
      try {
        (screen.orientation as any).unlock();
      } catch (_) {}
    }
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
        if (showSidebar) {
          setShowSidebar(false);
        } else if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          handleClose();
        }
      } else if (e.key === ' ') {
        if (e.cancelable) e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowRight') {
        seekBy(10);
      } else if (e.key === 'ArrowLeft') {
        seekBy(-10);
      } else if (e.key === 'f' || e.key === 'F') {
        handleFullscreenToggle();
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleMute();
      } else if (e.key === '>' || (e.shiftKey && e.key === '.') || e.key === ']') {
        if (e.cancelable) e.preventDefault();
        const curIdx = PLAYBACK_SPEED_OPTIONS.indexOf(playbackSpeed);
        const nextSpeed = curIdx >= 0 && curIdx < PLAYBACK_SPEED_OPTIONS.length - 1
          ? PLAYBACK_SPEED_OPTIONS[curIdx + 1]
          : playbackSpeed;
        applyPlaybackSpeed(nextSpeed);
        resetHudTimer();
      } else if (e.key === '<' || (e.shiftKey && e.key === ',') || e.key === '[') {
        if (e.cancelable) e.preventDefault();
        const curIdx = PLAYBACK_SPEED_OPTIONS.indexOf(playbackSpeed);
        const prevSpeed = curIdx > 0
          ? PLAYBACK_SPEED_OPTIONS[curIdx - 1]
          : playbackSpeed;
        applyPlaybackSpeed(prevSpeed);
        resetHudTimer();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, togglePlay, seekBy, handleFullscreenToggle, handleToggleMute, playbackSpeed, applyPlaybackSpeed, resetHudTimer]);

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

  // Handle A-B Loop Toggle (1st tap: Point A, 2nd tap: Point B & loop, 3rd tap: Clear)
  const handleToggleLoop = () => {
    const now = videoRef.current ? videoRef.current.currentTime : currentTime;

    if (loopA === null) {
      // 1st tap: Set Point A
      setLoopA(now);
      setLoopB(null);
    } else if (loopB === null) {
      // 2nd tap: Set Point B and start looping immediately
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
      // 3rd tap: Clear loop
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

  const cachedLocalUrl = getLocalCachedVideoUrl(item);
  const primaryStreamUrl = getMediaUrl(item.url || item.path || item.id);
  const directHfUrl = getDirectHfVideoUrl(item);
  const streamUrl = sourceOverride || cachedLocalUrl || primaryStreamUrl || directHfUrl;
  const albumName = item.category || item.parentAlbum || 'Cinema Vault';
  const activeIdx = playlist.findIndex((v) => v.id === item.id || v.url === item.url);
  const currentItemIndex = activeIdx >= 0 ? activeIdx + 1 : 1;
  const totalCount = playlist.length;
  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferPct = duration > 0 ? (buffered / duration) * 100 : 0;

  // Clamped position for Seek Hover Tooltip
  const barWidth = progressBarRef.current?.getBoundingClientRect().width || 300;
  const tooltipWidth = 192;
  const halfTooltip = tooltipWidth / 2;
  const clampedX = barWidth > tooltipWidth + 16
    ? Math.max(halfTooltip + 8, Math.min(barWidth - halfTooltip - 8, seekHover.hoverX))
    : barWidth / 2;

  return (
    <div
      ref={playerContainerRef}
      onMouseMove={resetHudTimer}
      onClick={resetHudTimer}
      className="fixed inset-0 z-50 bg-black/95 text-white overflow-hidden h-[100dvh] w-full max-w-full select-none font-sans touch-none touch-action-none overscroll-contain animate-fade-in"
      style={{
        background: 'rgba(2, 4, 8, 0.96)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* 1. Ambient CSS Glow (Zero extra video decoders) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,240,255,0.06)_0%,_transparent_70%)]" />

      {/* 2. Top-Left: Unboxed Floating HUD Stamp (Web only) */}
      {!Capacitor.isNativePlatform() && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className={`fixed top-4 left-4 sm:top-6 sm:left-7 z-30 font-mono text-xs tracking-widest text-white/90 flex items-center gap-2.5 transition-opacity duration-300 select-none drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] ${
            showHud ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <span className="font-['Roboto_Condensed'] font-sans font-medium uppercase truncate max-w-[180px] xs:max-w-xs sm:max-w-md tracking-wider">
            {albumName}
          </span>
          {totalCount > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/15 flex-shrink-0 font-mono">
              {currentItemIndex} / {totalCount}
            </span>
          )}
        </div>
      )}

      {/* Top Center Floating Action Bar: Loop, A-B, Speed, PiP, Download, Share (Website & App) */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className={`fixed top-3 sm:top-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 sm:gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-xl border border-white/15 shadow-2xl transition-all duration-300 pointer-events-auto ${
          showHud ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2 pointer-events-none'
        }`}
      >
        {/* Loop Mode */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
            resetHudTimer();
          }}
          className={`p-1.5 sm:p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all text-xs font-mono flex items-center gap-1 cursor-pointer ${
            repeatMode !== 'off' ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-300 hover:text-white'
          }`}
          title={`Loop: ${repeatMode.toUpperCase()}`}
          aria-label="Loop Mode"
        >
          {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
          <span className="text-[10px] uppercase font-bold tracking-wider hidden xs:inline">{repeatMode}</span>
        </button>

        {/* A-B Loop */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleToggleLoop();
            resetHudTimer();
          }}
          className={`p-1.5 sm:p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all text-xs font-mono flex items-center gap-1 cursor-pointer ${
            loopA !== null ? 'text-cyan-400 bg-cyan-500/10' : 'text-slate-300 hover:text-white'
          }`}
          title={loopA !== null && loopB !== null ? `A-B Loop (${formatTime(loopA)} - ${formatTime(loopB)})` : loopA !== null ? 'Set Point B' : 'Set Point A'}
          aria-label="A-B Loop"
        >
          <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-white/10">A-B</span>
          <span className="text-[10px] uppercase font-bold tracking-wider hidden md:inline">
            {loopA !== null && loopB !== null ? 'Active' : loopA !== null ? 'Set B' : 'Off'}
          </span>
        </button>

        {/* Playback Speed */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowSpeedMenu((prev) => !prev);
            resetHudTimer();
          }}
          className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all text-xs font-mono flex items-center gap-1 cursor-pointer text-slate-300 hover:text-white"
          title="Playback Speed"
          aria-label="Playback Speed"
        >
          <Gauge className="w-4 h-4" />
          <span className="text-[10px] font-bold tracking-wider">{playbackSpeed}x</span>
        </button>

        {/* Picture-in-Picture */}
        {isPiPSupported && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleTogglePiP();
              resetHudTimer();
            }}
            className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all text-slate-300 hover:text-white cursor-pointer"
            title="Picture-in-Picture"
            aria-label="Picture-in-Picture"
          >
            <PictureInPicture2 className="w-4 h-4" />
          </button>
        )}

        <div className="w-[1px] h-4 bg-white/20 mx-0.5" />

        {/* Download */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
            resetHudTimer();
          }}
          disabled={isDownloading}
          className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all text-slate-300 hover:text-white cursor-pointer disabled:opacity-40"
          title="Download Video"
          aria-label="Download Video"
        >
          {downloadSuccess ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : isDownloading ? (
            <Loader2 className="w-4 h-4 animate-spin text-neutral-300" />
          ) : (
            <Download className="w-4 h-4" />
          )}
        </button>

        {/* Share */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleShareMedia();
            resetHudTimer();
          }}
          className="p-1.5 sm:p-2 rounded-full hover:bg-white/10 active:scale-95 transition-all text-slate-300 hover:text-white cursor-pointer"
          title={shareSuccess ? 'Link Copied!' : 'Share Video'}
          aria-label="Share Video"
        >
          {shareSuccess ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Share2 className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Top-Right: Borderless Floating Text Actions (Web only) */}
      {!Capacitor.isNativePlatform() && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className={`fixed top-4 right-4 sm:top-6 sm:right-7 z-30 flex items-center gap-3 sm:gap-4 transition-opacity duration-300 pointer-events-auto ${
            showHud ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* CLOSE (✕) Action */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="bg-transparent border-none outline-none text-xs font-['Roboto_Condensed'] font-sans font-medium tracking-widest text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer active:scale-95 py-1 px-1.5"
            title="Close (Esc)"
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">CLOSE</span>
          </button>
        </div>
      )}

      {/* Retro Sci-Fi Video Stream Telemetry HUD Overlay */}
      {showTelemetry && (
        <div
          className="fixed top-16 left-4 sm:top-20 sm:left-8 z-50 p-4 rounded-xl border border-white/40 font-mono text-xs text-neutral-300 select-text max-w-sm pointer-events-auto shadow-xl animate-fade-in"
          style={{
            background: 'rgba(4, 8, 16, 0.78)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            textShadow: '0 1px 4px #000, 0 0 8px #000',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/20 pb-2 mb-2.5">
            <span className="text-white font-bold tracking-widest text-[11px] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              STREAM // TELEMETRY HUD
            </span>
            <button
              type="button"
              onClick={() => setShowTelemetry(false)}
              className="text-white/60 hover:text-white text-xs font-sans px-1"
            >
              ✕
            </button>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between gap-4">
              <span className="text-white/50">TITLE:</span>
              <span className="text-white font-medium truncate max-w-[200px]" title={item.name || item.title}>
                {item.name || item.title}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-white/50">RESOLUTION:</span>
              <span className="text-white font-bold">
                {videoResolution ? `${videoResolution.width} × ${videoResolution.height}` : 'Detecting...'}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-white/50">CODEC / EXT:</span>
              <span className="text-white uppercase font-bold">
                {item.url?.split('.').pop()?.split('?')[0] || 'MP4'}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-white/50">DURATION:</span>
              <span className="text-white">{formatTime(duration)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-white/50">BUFFERED / NOW:</span>
              <span className="text-white">{formatTime(currentTime)} / {formatTime(buffered)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-white/50">STORAGE REPO:</span>
              <span className="text-neutral-300 truncate max-w-[180px]">SARWARFX/stream-vault</span>
            </div>
            <div className="flex flex-col gap-0.5 pt-1 border-t border-white/10">
              <span className="text-white/50 text-[10px]">SOURCE URL:</span>
              <span className="text-[10px] text-white/70 break-all bg-black/40 p-1.5 rounded border border-white/5 select-all">
                {streamUrl}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2.5 Swipe Left-Right Gesture Scrubbing Overlay with Frame Preview */}
      {gestureSeek.isVisible && (
        <div
          className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none transition-all duration-300 transform ${
            gestureSeek.isActive ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
        >
          <div className="flex flex-col items-center gap-3 p-3 sm:p-4 rounded-3xl bg-black/90 backdrop-blur-2xl border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(0,229,255,0.3)] w-[240px] sm:w-[280px]">
            {/* Video Frame Preview Box */}
            <div className="w-full aspect-video rounded-2xl overflow-hidden border border-white/15 bg-black relative shadow-lg">
              <video
                ref={gesturePreviewVideoRef}
                src={gestureSeek.isActive ? streamUrl : undefined}
                preload="none"
                muted
                playsInline
                crossOrigin="anonymous"
                className="w-full h-full object-cover pointer-events-none bg-black"
              />

              {/* Direction Pulse Badge */}
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/10 text-[11px] font-mono text-white">
                {gestureSeek.icon === 'forward' ? (
                  <ChevronsRight className="w-3.5 h-3.5 text-white animate-pulse" />
                ) : (
                  <ChevronsLeft className="w-3.5 h-3.5 text-white animate-pulse" />
                )}
                <span className="font-bold tracking-wider">{gestureSeek.icon === 'forward' ? 'FORWARD' : 'REWIND'}</span>
              </div>

              {/* Live Delta Pill */}
              <div className="absolute bottom-2 right-2 z-10 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 text-xs font-mono font-bold text-white shadow">
                <span className="text-white">{formatDelta(gestureSeek.deltaSeconds)}</span>
              </div>
            </div>

            {/* Target Timestamp / Total Duration */}
            <div className="flex items-center justify-between w-full px-1 text-xs font-mono font-bold tracking-wider text-zinc-300">
              <span className="text-white text-sm">{formatTime(gestureSeek.targetTime)}</span>
              <span className="text-zinc-500 font-normal">/ {formatTime(duration)}</span>
            </div>

            {/* Mini Progress Bar in Overlay */}
            {duration > 0 && (
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white shadow-sm transition-all duration-75"
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
            try {
              v.defaultPlaybackRate = playbackSpeed;
              v.playbackRate = playbackSpeed;
              v.preservesPitch = true;
              (v as any).webkitPreservesPitch = true;
              (v as any).mozPreservesPitch = true;
            } catch (_) {}
            const playPromise = v.play();
            if (playPromise !== undefined) {
              playPromise.then(() => setIsPlaying(true)).catch(() => {});
            }
          }}
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

              // Throttle state updates to at most once every 100ms for locked 60fps UI performance
              const wallNow = performance.now();
              if (wallNow - lastTimeUpdateRef.current >= 100) {
                lastTimeUpdateRef.current = wallNow;
                if (!isDraggingProgress.current && !gestureSeek.isActive) {
                  setCurrentTime(now);
                  if (videoRef.current.buffered.length > 0) {
                    setBuffered(videoRef.current.buffered.end(videoRef.current.buffered.length - 1));
                  }
                }
              }
            }
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration || 0);
              setVideoResolution({
                width: videoRef.current.videoWidth,
                height: videoRef.current.videoHeight,
              });
              try {
                videoRef.current.defaultPlaybackRate = playbackSpeed;
                videoRef.current.playbackRate = playbackSpeed;
                videoRef.current.preservesPitch = true;
                (videoRef.current as any).webkitPreservesPitch = true;
                (videoRef.current as any).mozPreservesPitch = true;
              } catch (_) {}
            }
          }}
          onPlay={() => {
            setIsPlaying(true);
            if (videoRef.current) {
              try {
                videoRef.current.defaultPlaybackRate = playbackSpeed;
                videoRef.current.playbackRate = playbackSpeed;
                videoRef.current.preservesPitch = true;
                (videoRef.current as any).webkitPreservesPitch = true;
                (videoRef.current as any).mozPreservesPitch = true;
              } catch (_) {}
            }
          }}
          onPlaying={(e) => {
            setIsPlaying(true);
            const v = e.currentTarget;
            if (v.playbackRate !== playbackSpeed) {
              try {
                v.defaultPlaybackRate = playbackSpeed;
                v.playbackRate = playbackSpeed;
                v.preservesPitch = true;
                (v as any).webkitPreservesPitch = true;
                (v as any).mozPreservesPitch = true;
              } catch (_) {}
            }
          }}
          onRateChange={(e) => {
            const v = e.currentTarget;
            // Prevent browser media engine from silently resetting playbackRate back to 1.0
            if (playbackSpeed !== 1 && v.playbackRate === 1) {
              try {
                v.defaultPlaybackRate = playbackSpeed;
                v.playbackRate = playbackSpeed;
                v.preservesPitch = true;
                (v as any).webkitPreservesPitch = true;
                (v as any).mozPreservesPitch = true;
              } catch (_) {}
            }
          }}
          onEnded={handleVideoEnded}
          onError={(e) => {
            const v = e.currentTarget;
            if (!v.error) return;
            const itemKey = item.id || item.url || item.path || 'active';
            if (!fallbackAttemptedRef.current[itemKey] && directHfUrl && streamUrl !== directHfUrl) {
              fallbackAttemptedRef.current[itemKey] = true;
              console.warn(`[CyberPlayer] Stream failed on ${streamUrl}, falling back to direct HF CDN: ${directHfUrl}`);
              setSourceOverride(directHfUrl);
              v.src = directHfUrl;
              v.load();
              return;
            }
            fallbackAttemptedRef.current[itemKey] = true;
            console.warn('[CyberPlayer] Both primary and CDN fallback failed for:', itemKey, v.error.message);
            setHasPlaybackError(true);
          }}
        />

        {hasPlaybackError && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center bg-black/85 backdrop-blur-md">
            <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mb-3 shadow-[0_0_20px_rgba(239,68,68,0.3)]">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white mb-1">Playback Error</h3>
            <p className="text-xs text-zinc-300 font-mono mb-4 max-w-xs">
              Unable to stream video. The media file or network may be temporarily unavailable.
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const itemKey = item.id || item.url || item.path || 'active';
                fallbackAttemptedRef.current[itemKey] = false;
                setHasPlaybackError(false);
                if (videoRef.current) {
                  videoRef.current.src = directHfUrl || primaryStreamUrl;
                  videoRef.current.load();
                }
              }}
              className="py-1.5 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 text-white text-xs font-mono font-semibold transition-all cursor-pointer active:scale-95"
            >
              Retry Video
            </button>
          </div>
        )}
      </div>

      {/* 4. Borderless Floating Controls & Bottom Scrim */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className={`absolute bottom-6 left-0 right-0 px-6 md:px-12 flex flex-col gap-3.5 z-30 bg-transparent border-none transition-opacity duration-300 pointer-events-auto overflow-visible ${
          showHud ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Backdrop Gradient Scrim for Contrast & Legibility */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none -z-10" />

        {/* Scrubber Container with Hover Preview */}
        <div
          ref={progressBarRef}
          onClick={handleProgressSeek}
          onMouseEnter={handleSeekMouseEnter}
          onMouseMove={handleSeekMouseMove}
          onMouseLeave={handleSeekMouseLeave}
          className="group/seek relative w-full pt-1 pb-1.5 cursor-pointer select-none overflow-visible"
        >
          {/* Floating Hover Preview Tooltip Card (YouTube Style with Live Frame) */}
          <div
            className={`absolute bottom-6 -translate-x-1/2 pointer-events-none transition-all duration-150 ease-out z-50 flex flex-col items-center ${
              seekHover.isHovering && duration > 0
                ? 'opacity-100 scale-100'
                : 'opacity-0 scale-90 pointer-events-none'
            }`}
            style={{ left: `${clampedX}px` }}
          >
            <div className="w-40 sm:w-48 aspect-video rounded-xl overflow-hidden border border-white/20 bg-black/95 shadow-[0_12px_40px_rgba(0,0,0,0.95),0_0_20px_rgba(56,189,248,0.3)] flex flex-col items-center relative">
              {/* Live Video Frame Preview */}
              <video
                ref={sliderPreviewVideoRef}
                src={seekHover.isHovering ? streamUrl : undefined}
                preload="none"
                muted
                playsInline
                crossOrigin="anonymous"
                className="w-full h-full object-cover pointer-events-none bg-black"
              />

              {/* Bottom Timestamp Badge Overlay */}
              <div className="absolute bottom-1.5 px-2 py-0.5 rounded-md bg-black/85 backdrop-blur-md border border-white/15 text-[11px] font-mono font-bold text-white shadow flex items-center gap-1.5">
                <span className="text-white">{formatTime(seekHover.hoverTime)}</span>
                <span className="text-zinc-400 text-[10px]">
                  ({formatDelta(seekHover.hoverTime - currentTime)})
                </span>
              </div>
            </div>

            {/* Pointer Arrow */}
            <div className="w-2.5 h-2.5 bg-black border-r border-b border-white/20 transform rotate-45 -mt-1 shadow-lg" />
          </div>

          {/* Visual Track: Slim 3px timeline track expanding to 5px on hover */}
          <div className="relative w-full h-[3px] group-hover/seek:h-[5px] bg-white/15 rounded-full transition-all duration-150 flex items-center overflow-visible">
            {/* Buffered Progress */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-white/25 rounded-full transition-all"
              style={{ width: `${bufferPct}%` }}
            />

            {/* Subtle Ghost Scrub Fill on Hover */}
            {seekHover.isHovering && (
              <div
                className="absolute left-0 top-0 bottom-0 bg-white/20 rounded-full pointer-events-none transition-all"
                style={{ width: `${seekHover.hoverPct}%` }}
              />
            )}

            {/* Active Progress: Gradient progress fill linear-gradient(90deg, #38bdf8 0%, #ffffff 100%) */}
            <div
              className="absolute left-0 top-0 bottom-0 rounded-full transition-all"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(90deg, #38bdf8 0%, #ffffff 100%)',
                boxShadow: '0 0 10px rgba(56, 189, 248, 0.65)',
              }}
            />

            {/* Distinct Scrubber Dot with Ambient White/Cyan Glow */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border border-[#38bdf8] transition-transform duration-100 group-hover/seek:scale-125 z-20 pointer-events-none"
              style={{
                left: `${progressPct}%`,
                boxShadow: '0 0 10px rgba(56, 189, 248, 0.9), 0 0 18px rgba(255, 255, 255, 0.75)',
              }}
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
                className="absolute top-0 bottom-0 bg-[#38bdf8]/25 border-x-2 border-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.4)] z-10 pointer-events-none"
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
                className="absolute top-0 bottom-0 w-1 bg-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.9)] z-20 pointer-events-none"
                style={{ left: `${(loopB / duration) * 100}%` }}
              />
            )}
          </div>
        </div>

        {/* Desktop Controls Row (md:flex) */}
        <div className="hidden md:flex items-center justify-between gap-2 w-full max-w-full overflow-visible">
          {/* Left Cluster: Play/Pause button + Current Time / Total Duration timecode */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={togglePlay}
              className="bg-transparent border-none outline-none text-slate-300 hover:text-white transition-all duration-200 hover:scale-110 cursor-pointer p-1.5 flex items-center justify-center font-['Roboto_Condensed'] font-sans flex-shrink-0"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <span
              className="text-[10px] sm:text-xs font-mono font-medium text-white/90 tracking-wider whitespace-nowrap select-none"
              style={{ textShadow: '0 1px 4px #000, 0 0 8px #000' }}
            >
              {formatTime(currentTime)} <span className="text-white/40">/</span> {formatTime(duration)}
            </span>
          </div>

          {/* Right Cluster: Loop, A-B Repeat, FIT, Download, Share, Speed (1x), Mute, Fullscreen */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* 3-State Repeat Mode Toggle (Loop) */}
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
              className={`bg-transparent border-none outline-none transition-all duration-200 hover:scale-110 cursor-pointer p-1.5 flex items-center justify-center font-['Roboto_Condensed'] font-sans flex-shrink-0 ${
                repeatMode !== 'off'
                  ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]'
                  : 'text-slate-300 hover:text-white'
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
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
            </button>

            {/* A-B Loop Button */}
            <button
              type="button"
              onClick={handleToggleLoop}
              className={`bg-transparent border-none outline-none flex items-center gap-1 p-1.5 text-[10px] sm:text-xs font-['Roboto_Condensed'] font-sans font-medium tracking-wider transition-all duration-200 hover:scale-110 cursor-pointer flex-shrink-0 ${
                loopA !== null && loopB !== null
                  ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]'
                  : loopA !== null
                  ? 'text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]'
                  : 'text-slate-300 hover:text-white'
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
              <Repeat className="w-3.5 h-3.5" />
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
              className={`bg-transparent border-none outline-none p-1.5 text-[10px] sm:text-xs font-['Roboto_Condensed'] font-sans font-medium tracking-wider transition-all duration-200 hover:scale-110 cursor-pointer flex-shrink-0 ${
                fitMode === 'cover'
                  ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]'
                  : 'text-slate-300 hover:text-white'
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
              className={`bg-transparent border-none outline-none transition-all duration-200 hover:scale-110 cursor-pointer p-1.5 flex items-center justify-center font-['Roboto_Condensed'] font-sans flex-shrink-0 ${
                downloadSuccess
                  ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                  : 'text-slate-300 hover:text-white'
              } disabled:opacity-40`}
              title={downloadSuccess ? 'Video Clip Saved' : isDownloading ? 'Downloading Video...' : 'Download Video Clip'}
              aria-label="Download Video"
            >
              {downloadSuccess ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Download className="w-4 h-4" />
              )}
            </button>

            {/* Share / Copy Direct Link */}
            <button
              type="button"
              onClick={handleShareMedia}
              className={`bg-transparent border-none outline-none transition-all duration-200 hover:scale-110 cursor-pointer p-1.5 flex items-center justify-center font-['Roboto_Condensed'] font-sans flex-shrink-0 ${
                shareSuccess
                  ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]'
                  : 'text-slate-300 hover:text-white'
              }`}
              title={shareSuccess ? 'Link Copied to Clipboard!' : 'Share Video Link'}
              aria-label="Share Video Link"
            >
              {shareSuccess ? (
                <Check className="w-4 h-4 text-[#38bdf8]" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
            </button>

            {/* Speed Selector Popover */}
            <div className="relative flex-shrink-0">
              <button
                ref={speedBtnRef}
                type="button"
                onClick={toggleSpeedMenu}
                className={`bg-transparent border-none outline-none flex items-center gap-1 p-1.5 text-[10px] sm:text-xs font-['Roboto_Condensed'] font-sans font-medium tracking-wider transition-all duration-200 hover:scale-110 cursor-pointer flex-shrink-0 ${
                  playbackSpeed !== 1
                    ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Playback Speed (< / >)"
                aria-haspopup="true"
                aria-expanded={showSpeedMenu}
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>{playbackSpeed}x</span>
              </button>

              {showSpeedMenu && (
                <div
                  ref={speedMenuRef}
                  style={{
                    bottom: speedMenuPos ? `${speedMenuPos.bottom}px` : '4.5rem',
                    right: speedMenuPos ? `${speedMenuPos.right}px` : '1rem',
                    background: 'rgba(4, 7, 12, 0.92)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                  }}
                  className="fixed py-1.5 px-1 rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.9),0_0_20px_rgba(56,189,248,0.25)] flex flex-col gap-0.5 z-[10000] min-w-[110px] max-h-[50vh] overflow-y-auto pointer-events-auto animate-fade-in"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-semibold border-b border-white/10 mb-0.5">
                    Playback Speed
                  </div>
                  {PLAYBACK_SPEED_OPTIONS.map((speed) => {
                    const isSelected = playbackSpeed === speed;
                    const label = speed === 1 ? '1x (Normal)' : `${speed}x`;
                    return (
                      <button
                        key={speed}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectSpeed(speed);
                        }}
                        className={`px-2 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer text-left flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-[#38bdf8]/20 text-[#38bdf8] font-semibold shadow-sm border border-[#38bdf8]/30'
                            : 'text-zinc-400 hover:text-white hover:bg-white/10 active:bg-white/15'
                        }`}
                      >
                        <span>{label}</span>
                        {isSelected && <Check className="w-3 h-3 text-[#38bdf8]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Picture-in-Picture */}
            {isPiPSupported && (
              <button
                type="button"
                onClick={handleTogglePiP}
                className="bg-transparent border-none outline-none text-slate-300 hover:text-white transition-all duration-200 hover:scale-110 cursor-pointer p-1.5 flex items-center justify-center font-['Roboto_Condensed'] font-sans flex-shrink-0"
                title="Picture-in-Picture (P)"
                aria-label="Toggle Picture-in-Picture"
              >
                <PictureInPicture2 className="w-4 h-4" />
              </button>
            )}

            {/* Mute / Unmute Toggle */}
            <button
              type="button"
              onClick={handleToggleMute}
              className="bg-transparent border-none outline-none text-slate-300 hover:text-white transition-all duration-200 hover:scale-110 cursor-pointer p-1.5 flex items-center justify-center font-['Roboto_Condensed'] font-sans flex-shrink-0"
              title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-zinc-400" /> : <Volume2 className="w-4 h-4 text-white" />}
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={handleFullscreenToggle}
              className="bg-transparent border-none outline-none text-slate-300 hover:text-white transition-all duration-200 hover:scale-110 cursor-pointer p-1.5 flex items-center justify-center font-['Roboto_Condensed'] font-sans flex-shrink-0"
              title="Fullscreen (F)"
              aria-label="Toggle Fullscreen"
            >
              {document.fullscreenElement ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Controls Row (< md): Guaranteed Left (Play/Time), Center (FIT/Speed/⋯), Right (Mute/Fullscreen) */}
        <div className="flex md:hidden items-center justify-between gap-1 w-full relative z-10">
          {/* Left: Play/Pause button + compact Timecode */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={togglePlay}
              className="bg-transparent border-none outline-none text-slate-300 hover:text-white cursor-pointer p-1.5 flex items-center justify-center flex-shrink-0"
              title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <span
              className="text-[10px] font-mono font-medium text-white/90 tracking-wider whitespace-nowrap select-none"
              style={{ textShadow: '0 1px 4px #000, 0 0 8px #000' }}
            >
              {formatTime(currentTime)} <span className="text-white/40">/</span> {formatTime(duration)}
            </span>
          </div>

          {/* Center: FIT toggle, Speed button, and Overflow Menu */}
          <div className="flex items-center gap-1 overflow-x-hidden min-w-0 justify-end">
            {/* Aspect Ratio Fit */}
            <button
              type="button"
              onClick={() => {
                setFitMode((prev) => (prev === 'contain' ? 'cover' : 'contain'));
                resetHudTimer();
              }}
              className={`bg-transparent border-none outline-none p-1 text-[10px] font-['Roboto_Condensed'] font-sans font-medium tracking-wider cursor-pointer flex-shrink-0 ${
                fitMode === 'cover'
                  ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]'
                  : 'text-slate-400 hover:text-white'
              }`}
              title={fitMode === 'cover' ? 'Fill Screen' : 'Fit Screen'}
            >
              {fitMode === 'cover' ? 'FILL' : 'FIT'}
            </button>

            {/* Speed Selector */}
            <button
              type="button"
              onClick={toggleSpeedMenu}
              className={`bg-transparent border-none outline-none p-1 text-[10px] font-mono font-medium cursor-pointer flex-shrink-0 ${
                playbackSpeed !== 1 ? 'text-[#38bdf8] font-bold' : 'text-slate-400 hover:text-white'
              }`}
              title="Speed"
            >
              {playbackSpeed}x
            </button>

            {/* Mobile Controls Right Edge */}
          </div>

          {/* Right: Mute & Fullscreen ALWAYS pinned to the right edge with flex-shrink-0 z-10 */}
          <div className="flex items-center gap-1 z-10 flex-shrink-0">
            {/* Mute / Unmute Toggle */}
            <button
              type="button"
              onClick={handleToggleMute}
              className="bg-transparent border-none outline-none text-slate-300 hover:text-white cursor-pointer p-1.5 flex items-center justify-center flex-shrink-0 z-10"
              title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-zinc-400" /> : <Volume2 className="w-4 h-4 text-white" />}
            </button>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={handleFullscreenToggle}
              className="bg-transparent border-none outline-none text-slate-300 hover:text-white cursor-pointer p-1.5 flex items-center justify-center flex-shrink-0 z-10"
              title="Fullscreen (F)"
              aria-label="Toggle Fullscreen"
            >
              {document.fullscreenElement ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>


      {/* 5. Slide-out Queue & Suggestions Drawer (Responsive Bottom Sheet on Mobile, Right Drawer on Desktop) */}
      {showSidebar && (
        <div
          className="fixed inset-0 z-[10000] flex flex-col md:flex-row justify-end items-end md:items-stretch animate-fade-in pointer-events-auto overflow-hidden w-full max-w-full"
          style={{
            background: 'rgba(3, 5, 10, 0.55)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
          onClick={(e) => {
            e.stopPropagation();
            setShowSidebar(false);
          }}
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
