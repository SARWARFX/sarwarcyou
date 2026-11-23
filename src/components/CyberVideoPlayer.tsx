import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Repeat,
  Repeat1,
  Gauge,
  Check,
  Loader2,
  ChevronsLeft,
  ChevronsRight,
  PictureInPicture2,
} from 'lucide-react';
import type { StageMediaItem, MediaFolderEntry } from '../types';
import { downloadBrandedVideo } from '../utils/downloadMedia';
import { getMediaUrl, getDirectHfVideoUrl } from '../utils/imageUrlResolver';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { CyberMediaSidebar } from './CyberMediaSidebar';
import { lockToLandscape, unlockOrientation } from '../utils/orientationManager';
import { useBackButton } from '../utils/backButtonManager';
import { hapticLight, hapticWarning } from '../utils/hapticsManager';
import { getGlobalAudioMuted } from '../utils/audioMuteManager';
import { HeaderBrandLogo } from './updater/HeaderBrandLogo';
import { getMediaShortId, updateBrowserUrl } from '../utils/urlRouter';
import { acquirePlayerWakeLock, releasePlayerWakeLock } from '../utils/keepAwakeManager';
import {
  subscribeBatteryState,
  subscribeUrgentPlayback,
  requestUrgentPlayback,
  resetUrgentPlayback,
} from '../utils/batteryManager';
import type { BatteryState } from '../utils/batteryManager';
import {
  LaserCloseIcon,
  LaserDownloadIcon,
  LaserPlayIcon,
  LaserPauseIcon,
  LaserVolumeIcon,
  LaserFullscreenIcon,
} from './brand/LaserIcons';

export type VideoRepeatMode = 'off' | 'all' | 'one';

export interface CyberVideoPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  item: StageMediaItem | null;
  playlist?: StageMediaItem[];
  allFolders?: MediaFolderEntry[];
  photoPool?: StageMediaItem[];
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
  photoPool = [],
  onSelectItem,
  onSelectFolder,
}) => {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [isMuted, setIsMuted] = useState(() => getGlobalAudioMuted());
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [speedMenuPos, setSpeedMenuPos] = useState<{ bottom: number; left: number } | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain');
  const [repeatMode, setRepeatMode] = useState<VideoRepeatMode>('off');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [showTelemetry, setShowTelemetry] = useState(false);
  const [videoResolution, setVideoResolution] = useState<{ width: number; height: number } | null>(null);

  // Hardware Battery Safety Brake (< 5% on battery)
  const [batteryState, setBatteryState] = useState<BatteryState>({
    isSupported: false,
    level: 100,
    charging: true,
  });
  const [isUrgentPlaybackOverride, setIsUrgentPlaybackOverride] = useState(false);

  useEffect(() => {
    const unsubState = subscribeBatteryState((state) => {
      setBatteryState(state);
      if (state.isSupported && !state.charging && state.level < 5 && !isUrgentPlaybackOverride) {
        const v = activeVideoElRef.current || videoRef.current;
        if (v && !v.paused) {
          isPausedByUserRef.current = true;
          v.pause();
          setIsPlaying(false);
        }
      }
    });

    const unsubUrgent = subscribeUrgentPlayback((granted) => {
      if (granted) {
        setIsUrgentPlaybackOverride(true);
      }
    });

    return () => {
      unsubState();
      unsubUrgent();
    };
  }, [isUrgentPlaybackOverride]);

  // When video item changes or player closes/opens, reset emergency override
  useEffect(() => {
    setIsUrgentPlaybackOverride(false);
    resetUrgentPlayback();
  }, [item?.id, item?.url, isOpen]);

  const isBatteryBrakeActive =
    batteryState.isSupported && !batteryState.charging && batteryState.level < 5 && !isUrgentPlaybackOverride;

  const handleUrgentPlay = useCallback(() => {
    setIsUrgentPlaybackOverride(true);
    requestUrgentPlayback();
    const v = activeVideoElRef.current || videoRef.current;
    if (v) {
      isPausedByUserRef.current = false;
      const playPromise = v.play();
      if (playPromise !== undefined) {
        playPromise.then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  }, []);

  // Desktop, Tablet, and Mobile Screen Detection
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024);
  const [isTablet, setIsTablet] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 640 && window.innerWidth < 1024);
  const [isPhonePortrait, setIsPhonePortrait] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640 && window.innerHeight >= window.innerWidth);
  const [isPortrait, setIsPortrait] = useState(() => typeof window !== 'undefined' && window.innerHeight > window.innerWidth);
  const [isFullscreen, setIsFullscreen] = useState(() => typeof document !== 'undefined' && Boolean(document.fullscreenElement));

  // Shuffle photo pool: pick 20 random images from directory for background slideshow
  const shuffledBackgroundPhotos = useMemo(() => {
    const _videoKey = `${item?.id || ''}_${item?.url || ''}_${isOpen}`;
    if (!photoPool || photoPool.length === 0 || !_videoKey) return [];
    const pool = [...photoPool];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const selected20 = pool.slice(0, 20);
    // Duplicate once so continuous CSS animation loop (0% to -50%) remains perfectly seamless
    return [...selected20, ...selected20];
  }, [photoPool, item?.id, item?.url, isOpen]);

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setIsDesktop(w >= 1024);
      setIsTablet(w >= 640 && w < 1024);
      setIsPhonePortrait(w < 640 && h >= w);
      setIsPortrait(h > w);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Synchronize browser URL to active video
  useEffect(() => {
    if (!isOpen || !item) return;
    const shortId = getMediaShortId(item);
    if (shortId) {
      updateBrowserUrl('/clips/' + shortId, true);
    }
  }, [isOpen, item]);

  // Picture-in-Picture State
  const [isPiPSupported] = useState(() => typeof document !== 'undefined' && Boolean((document as any).pictureInPictureEnabled));

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
      if (import.meta.env.DEV) console.warn('PiP error:', err);
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
  const activeVideoElRef = useRef<HTMLVideoElement | null>(null);
  const isPausedByUserRef = useRef<boolean>(false);
  const sliderPreviewVideoRef = useRef<HTMLVideoElement>(null);
  const gesturePreviewVideoRef = useRef<HTMLVideoElement>(null);
  const wasPlayingBeforeGesture = useRef(false);
  const lastTimeUpdateRef = useRef<number>(0);

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const speedBtnRef = useRef<HTMLButtonElement>(null);
  const isDraggingProgress = useRef(false);
  const isVerticalScrubbingRef = useRef(false);

  // Auto-hide HUD on inactivity (3 seconds) when in fullscreen OR on rotated screen
  const resetHudTimer = useCallback(() => {
    setShowHud(true);
    if (hudTimerRef.current) window.clearTimeout(hudTimerRef.current);
    // Auto-hide only when in fullscreen OR on a rotated screen (mobile landscape)
    const shouldAutoHide = isFullscreen || (!isDesktop && !isPortrait);
    if (!shouldAutoHide) return;
    if (showSpeedMenu || isVerticalScrubbingRef.current) return;
    hudTimerRef.current = window.setTimeout(() => {
      setShowHud(false);
      setShowSpeedMenu(false);
    }, 3000);
  }, [isFullscreen, isDesktop, isPortrait, showSpeedMenu]);

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
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      const menuWidth = 140;
      const calculatedLeft = Math.min(
        Math.max(8, rect.left),
        window.innerWidth - menuWidth - 8
      );
      setSpeedMenuPos({
        bottom: Math.max(16, window.innerHeight - rect.top + 8),
        left: calculatedLeft,
      });
    }
    setShowSpeedMenu((prev) => !prev);
  }, []);

  // Sync menu position dynamically on resize / scroll
  useEffect(() => {
    if (!showSpeedMenu || !speedBtnRef.current) return;
    const updatePos = () => {
      if (speedBtnRef.current) {
        const rect = speedBtnRef.current.getBoundingClientRect();
        const menuWidth = 140;
        const calculatedLeft = Math.min(
          Math.max(8, rect.left),
          window.innerWidth - menuWidth - 8
        );
        setSpeedMenuPos({
          bottom: Math.max(16, window.innerHeight - rect.top + 8),
          left: calculatedLeft,
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
    if (isBatteryBrakeActive) {
      hapticWarning();
      return;
    }
    const v = activeVideoElRef.current || videoRef.current;
    if (!v) return;
    hapticLight();
    if (v.paused) {
      isPausedByUserRef.current = false;
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      isPausedByUserRef.current = true;
      v.pause();
      setIsPlaying(false);
    }
    resetHudTimer();
  }, [resetHudTimer, isBatteryBrakeActive]);

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

  // Toggle Fullscreen with Landscape Auto-Rotate via Web Screen Orientation API
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
        if (import.meta.env.DEV) console.warn('Fullscreen request notice:', err);
      }

      // Force rotate phone screen to landscape on video fullscreen
      await lockToLandscape();
      setIsFullscreen(true);
    } else {
      try {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      } catch (err) {
        if (import.meta.env.DEV) console.warn('Fullscreen exit notice:', err);
      }

      await unlockOrientation();
      setIsFullscreen(false);
      setShowHud(true);
    }
    resetHudTimer();
  }, [resetHudTimer]);

  // Listen to fullscreenchange to unlock orientation if user exits via hardware gestures
  useEffect(() => {
    const handleFullscreenChange = () => {
      const inFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(inFullscreen);
      if (!inFullscreen) {
        unlockOrientation();
        setShowHud(true);
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

  // Strict background scroll-lock
  useLockBodyScroll(isOpen);

  // Instantly release GPU RAM and video decoders on mobile & desktop
  const releaseVideoResources = useCallback(() => {
    const v = activeVideoElRef.current || videoRef.current;
    if (v) {
      try {
        v.pause();
        v.currentTime = 0;
        v.src = '';
        v.removeAttribute('src');
        v.load();
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
    releasePlayerWakeLock().catch(() => {});
  }, []);

  const handleClose = useCallback(() => {
    setIsUrgentPlaybackOverride(false);
    resetUrgentPlayback();
    isPausedByUserRef.current = true;
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
      handleClose();
      return true;
    }, [showSidebar, handleClose]),
    isOpen
  );

  // Handle Mute Toggle
  const handleToggleMute = useCallback(() => {
    hapticLight();
    setIsMuted((prev) => {
      const next = !prev;
      const v = activeVideoElRef.current || videoRef.current;
      if (v) {
        v.muted = next;
      }
      return next;
    });
    resetHudTimer();
  }, [resetHudTimer]);

  // Device Screen Lock Rule: Screen stays unlocked ONLY when video is actively playing
  useEffect(() => {
    if (isOpen && isPlaying) {
      acquirePlayerWakeLock().catch(() => {});
    } else {
      releasePlayerWakeLock().catch(() => {});
    }
    return () => {
      releasePlayerWakeLock().catch(() => {});
    };
  }, [isOpen, isPlaying]);

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
  }, [isOpen, onClose, togglePlay, seekBy, handleFullscreenToggle, handleToggleMute, playbackSpeed, applyPlaybackSpeed, resetHudTimer, handleClose, showSidebar]);

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
      if (import.meta.env.DEV) console.error('Video download error:', err);
    } finally {
      setIsDownloading(false);
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

  const primaryStreamUrl = getMediaUrl(item.url || item.path || item.id);
  const directHfUrl = getDirectHfVideoUrl(item);
  const streamUrl = sourceOverride || primaryStreamUrl || directHfUrl;

  // Vertical timeline scrub handling (adapted from ShortsView with live square reticle dot)

  const handleVerticalScrubSeek = useCallback((clientY: number, target: HTMLElement) => {
    if (!videoRef.current || !duration) return;
    const rect = target.getBoundingClientRect();
    if (rect.height <= 0) return;
    const pct = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
    const seekTime = pct * duration;
    videoRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
    resetHudTimer();
  }, [duration, resetHudTimer]);

  const handleVerticalScrubPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    isVerticalScrubbingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    handleVerticalScrubSeek(e.clientY, e.currentTarget);
  }, [handleVerticalScrubSeek]);

  const handleVerticalScrubPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isVerticalScrubbingRef.current) return;
    e.stopPropagation();
    handleVerticalScrubSeek(e.clientY, e.currentTarget);
  }, [handleVerticalScrubSeek]);

  const handleVerticalScrubPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isVerticalScrubbingRef.current) return;
    e.stopPropagation();
    isVerticalScrubbingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    hapticLight();
    resetHudTimer();
  }, [resetHudTimer]);

  const renderVerticalScrubberBar = useCallback(() => {
    const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
    const bufferPct = duration > 0 ? Math.min(100, Math.max(0, (buffered / duration) * 100)) : 0;

    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className="group/vseek relative h-full flex flex-col items-center justify-between cursor-pointer select-none py-1.5"
        title="Seek playback (Drag to scrub)"
      >
        {/* Top Bound Time Label */}
        <span
          className="text-[10px] font-mono text-white/50 tracking-wider font-bold select-none shrink-0"
          style={{ textShadow: '0 1px 4px #000' }}
        >
          0:00
        </span>

        {/* Vertical Track Hitbox */}
        <div
          onPointerDown={handleVerticalScrubPointerDown}
          onPointerMove={handleVerticalScrubPointerMove}
          onPointerUp={handleVerticalScrubPointerUp}
          onPointerCancel={handleVerticalScrubPointerUp}
          className="relative w-7 flex-1 flex items-center justify-center cursor-pointer my-1.5 overflow-visible"
        >
          {/* Visual Track Rail: Slim 3px expanding to 5px on hover */}
          <div className="relative w-[3px] group-hover/vseek:w-[5px] h-full bg-white/20 transition-all duration-150 flex flex-col justify-start overflow-visible">
            {/* Buffered Progress */}
            <div
              className="absolute top-0 left-0 right-0 bg-white/30 transition-all"
              style={{ height: `${bufferPct}%` }}
            />

            {/* Active Progress Fill: Pure Stark White Style with Cyber Glow */}
            <div
              className="absolute top-0 left-0 right-0 transition-all"
              style={{
                height: `${progressPct}%`,
                background: '#ffffff',
                boxShadow: '0 0 10px rgba(255, 255, 255, 0.85)',
              }}
            />

            {/* A-B Loop Locked Interval Shading */}
            {duration > 0 && loopA !== null && loopB !== null && loopB > loopA && (
              <div
                className="absolute left-0 right-0 bg-amber-400/30 border-y border-amber-400/60 z-10 pointer-events-none"
                style={{
                  top: `${(loopA / duration) * 100}%`,
                  height: `${((loopB - loopA) / duration) * 100}%`,
                }}
              />
            )}

            {/* Scrubber Handle & Live Timestamp Badge */}
            <div
              className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center pointer-events-none transition-transform duration-75 group-hover/vseek:scale-110 z-20"
              style={{
                top: `${progressPct}%`,
              }}
            >
              {/* Distinct Square Reticle Scrubber Dot */}
              <div
                className="w-3.5 h-3.5 bg-white border border-black/40 shrink-0"
                style={{
                  boxShadow: '0 0 10px rgba(255, 255, 255, 0.9)',
                  borderRadius: 0,
                  outline: 'none',
                }}
              />

              {/* Live Current Time Badge beside the Scrubber Dot */}
              <span
                className="ml-2 px-1.5 py-0.5 bg-[#05070c]/95 border border-white/30 text-[10px] font-mono font-bold text-white shadow-[0_0_10px_rgba(0,0,0,0.9)] whitespace-nowrap"
                style={{ borderRadius: 0, outline: 'none' }}
              >
                {formatTime(currentTime)}
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Bound Duration Label */}
        <span
          className="text-[10px] font-mono text-white/50 tracking-wider font-bold select-none shrink-0"
          style={{ textShadow: '0 1px 4px #000' }}
        >
          {formatTime(duration)}
        </span>
      </div>
    );
  }, [duration, currentTime, buffered, loopA, loopB, handleVerticalScrubPointerDown, handleVerticalScrubPointerMove, handleVerticalScrubPointerUp]);

  return (
    <div
      ref={playerContainerRef}
      onMouseMove={resetHudTimer}
      onTouchStart={resetHudTimer}
      onTouchMove={resetHudTimer}
      onClick={(e) => {
        resetHudTimer();
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      className="fixed inset-0 z-50 bg-[#020408] text-white overflow-hidden h-[100dvh] w-full max-w-full select-none font-sans touch-none touch-action-none overscroll-contain animate-keynote-modal"
      style={{
        backgroundColor: '#020408',
      }}
    >
      {/* 1. Ambient CSS Glow (Zero extra video decoders) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 bg-[radial-gradient(ellipse_at_center,_rgba(0,240,255,0.06)_0%,_transparent_70%)]" />

      {/* Photographic Background Tapestry on Desktop & Portrait Screens (Hidden when in Fullscreen) */}
      {!isFullscreen && shuffledBackgroundPhotos.length > 0 && (
        <div
          className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none opacity-30"
          aria-hidden="true"
        >
          <div className="shorts-stream-track">
            {shuffledBackgroundPhotos.map((photo, pIdx) => (
              <div
                key={`bg-photo-${photo.id || photo.url}-${pIdx}`}
                className="shorts-stream-card aspect-[3/4] h-full overflow-hidden flex-shrink-0"
              >
                <img
                  src={photo.thumbnail || getMediaUrl(photo.url)}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover filter brightness-75 contrast-110"
                />
              </div>
            ))}
          </div>
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
          <div className="flex flex-col items-center gap-3 p-3 sm:p-4 rounded-none bg-black/90 backdrop-blur-2xl border border-white/20 shadow-[0_20px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(0,229,255,0.3)] w-[240px] sm:w-[280px]">
            {/* Video Frame Preview Box */}
            <div className="w-full aspect-video rounded-none overflow-hidden border border-white/15 bg-black relative shadow-lg">
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
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2.5 py-1 rounded-none bg-black/75 backdrop-blur-md border border-white/10 text-[11px] font-mono text-white">
                {gestureSeek.icon === 'forward' ? (
                  <ChevronsRight className="w-3.5 h-3.5 text-white animate-pulse" />
                ) : (
                  <ChevronsLeft className="w-3.5 h-3.5 text-white animate-pulse" />
                )}
                <span className="font-bold tracking-wider">{gestureSeek.icon === 'forward' ? 'FORWARD' : 'REWIND'}</span>
              </div>

              {/* Live Delta Pill */}
              <div className="absolute bottom-2 right-2 z-10 px-2.5 py-1 rounded-none bg-black/80 backdrop-blur-md border border-white/10 text-xs font-mono font-bold text-white shadow">
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
                  className="h-full bg-[#00f0ff] shadow-[0_0_8px_rgba(0, 240, 255,0.6)] transition-all duration-75"
                  style={{ width: `${Math.max(0, Math.min(100, (gestureSeek.targetTime / duration) * 100))}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Video Stage: Desktop Centered Cinema Card vs Mobile / Portrait Centered Card */}
      <div
        className={
          isDesktop
            ? "fixed inset-0 z-20 flex items-center justify-center p-6 sm:p-10 pb-24 pointer-events-auto select-none cursor-pointer"
            : isPortrait && !isFullscreen
            ? "fixed inset-0 z-20 flex flex-col items-center justify-between pointer-events-auto select-none cursor-pointer"
            : "absolute inset-0 w-full h-full flex items-center justify-center touch-none cursor-pointer overflow-hidden z-10"
        }
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleClose();
          }
        }}
      >
        {/* Upper Empty Space on Portrait Screens: Tap to Close */}
        {isPortrait && !isFullscreen && (
          <div
            className="w-full flex-1 cursor-pointer min-h-[40px] z-10"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            title="Tap empty space to close"
          />
        )}

        <div
          className={
            isDesktop
              ? "pointer-events-auto relative w-full max-w-[min(84vw,calc(72vh*(16/9)))] flex flex-col items-center justify-center cursor-default select-none shrink-0 z-20"
              : isPortrait && !isFullscreen
              ? "pointer-events-auto relative w-full flex flex-col items-center justify-center cursor-default select-none shrink-0 z-20"
              : "relative w-full h-full flex items-center justify-center overflow-hidden"
          }
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {/* Video Player Box with overflow-hidden */}
          <div
            className={
              isDesktop
                ? "relative w-full max-h-[72vh] aspect-[16/9] rounded-none border-0 shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-black overflow-hidden flex items-center justify-center"
                : isPortrait && !isFullscreen
                ? "relative w-full aspect-[16/9] max-h-[75vh] rounded-none border-0 shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-black overflow-hidden flex items-center justify-center"
                : "relative w-full h-full flex items-center justify-center overflow-hidden"
            }
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
              ref={(el) => {
                (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
                activeVideoElRef.current = el;
              }}
              src={streamUrl}
              autoPlay
              preload="auto"
              playsInline
              crossOrigin="anonymous"
              muted={isMuted}
              className={`w-full h-full pointer-events-none transition-all duration-300 ${
                isDesktop ? 'rounded-none' : ''
              } ${fitMode === 'cover' ? 'object-cover' : 'object-contain'}`}
              onCanPlay={(e) => {
                const v = e.currentTarget;
                try {
                  v.defaultPlaybackRate = playbackSpeed;
                  v.playbackRate = playbackSpeed;
                  v.preservesPitch = true;
                  (v as any).webkitPreservesPitch = true;
                  (v as any).mozPreservesPitch = true;
                } catch (_) {}
                // Respect user pause & battery safety brake: NEVER auto-resume if paused or critical battery
                if (isPlaying && !isPausedByUserRef.current && !isBatteryBrakeActive && v.paused) {
                  const playPromise = v.play();
                  if (playPromise !== undefined) {
                    playPromise.then(() => setIsPlaying(true)).catch(() => {});
                  }
                }
              }}
              onPause={() => {
                setIsPlaying(false);
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
                if (import.meta.env.DEV) {
                  console.warn(`[CyberPlayer] Stream failed on ${streamUrl}, falling back to direct HF CDN: ${directHfUrl}`);
                }
                setSourceOverride(directHfUrl);
                v.src = directHfUrl;
                v.load();
                return;
              }
              fallbackAttemptedRef.current[itemKey] = true;
              if (import.meta.env.DEV) {
                console.warn('[CyberPlayer] Both primary and CDN fallback failed for:', itemKey, v.error.message);
              }
              setHasPlaybackError(true);
            }}
          />

          {/* In-Stage Safety Brake Modal Banner for < 5% Battery on Battery Power */}
          {isBatteryBrakeActive && (
            <div
              className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[10px] pointer-events-auto select-none animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="relative w-full max-w-md p-6 sm:p-7 shadow-[0_30px_80px_rgba(0,0,0,0.75)] text-white flex flex-col gap-4 animate-scale-in text-left"
                style={{
                  borderRadius: 0,
                  outline: 'none',
                  border: 'none',
                  background: 'rgba(10, 14, 23, 0.58)',
                  backdropFilter: 'blur(32px) saturate(190%)',
                  WebkitBackdropFilter: 'blur(32px) saturate(190%)',
                  boxShadow: '0 30px 80px rgba(0, 0, 0, 0.75), 0 0 1px rgba(255, 255, 255, 0.2) inset',
                }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold font-mono tracking-tight uppercase flex items-center gap-2 text-[#ff0022]">
                    <span className="w-2.5 h-2.5 bg-[#ff0022] animate-ping inline-block shrink-0 shadow-[0_0_8px_#ff0022]" />
                    // CRITICAL BATTERY // &lt; 5%
                  </h3>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-7 h-7 flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-base font-mono p-0"
                    style={{ borderRadius: 0, outline: 'none', border: 'none', background: 'transparent' }}
                    title="Close Video"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs sm:text-sm text-neutral-300 font-sans leading-relaxed">
                  Device is running on very low power emergency state (&lt; 5%). Video & shorts playback is locked to prevent sudden system crash. You may choose 'Play as Urgent' for a single emergency play.
                </p>

                <div className="bg-[#030508]/45 p-2.5 text-[11px] font-mono text-neutral-400 flex items-center justify-between">
                  <span className="text-[#ff0022] font-bold">CRITICAL // {batteryState.level}%</span>
                  <span className="text-neutral-500">PLAYBACK LOCKED</span>
                </div>

                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleUrgentPlay}
                    className="py-2 px-4 font-mono font-bold text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 hover:bg-white hover:text-black"
                    style={{
                      borderRadius: 0,
                      outline: 'none',
                      border: 'none',
                      backgroundColor: '#ff0022',
                      color: '#ffffff',
                      boxShadow: '0 0 16px rgba(255, 0, 34, 0.45)',
                    }}
                  >
                    <span>⚡</span>
                    <span>Play as Urgent</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {hasPlaybackError && (
            <div
              className="absolute inset-0 z-40 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[10px] select-none pointer-events-auto animate-fade-in"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="relative w-full max-w-md p-6 sm:p-7 shadow-[0_30px_80px_rgba(0,0,0,0.75)] text-white flex flex-col gap-4 animate-scale-in text-left"
                style={{
                  borderRadius: 0,
                  outline: 'none',
                  border: 'none',
                  background: 'rgba(10, 14, 23, 0.58)',
                  backdropFilter: 'blur(32px) saturate(190%)',
                  WebkitBackdropFilter: 'blur(32px) saturate(190%)',
                  boxShadow: '0 30px 80px rgba(0, 0, 0, 0.75), 0 0 1px rgba(255, 255, 255, 0.2) inset',
                }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold font-mono tracking-tight uppercase flex items-center gap-2 text-[#ef4444]">
                    <span className="w-2.5 h-2.5 bg-[#ef4444] animate-ping inline-block shrink-0 shadow-[0_0_8px_#ef4444]" />
                    // STREAM UNAVAILABLE
                  </h3>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="w-7 h-7 flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-base font-mono p-0"
                    style={{ borderRadius: 0, outline: 'none', border: 'none', background: 'transparent' }}
                    title="Close Video"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-xs sm:text-sm text-neutral-300 font-sans leading-relaxed">
                  Unable to stream video. The media file or upstream server may be temporarily unreachable.
                </p>

                <div className="bg-[#030508]/45 p-2.5 text-[11px] font-mono text-neutral-400 flex items-center justify-between">
                  <span className="text-[#ef4444] font-bold">STREAM // ABORTED</span>
                  <span className="text-neutral-500">SERVER UNREACHABLE</span>
                </div>

                <div className="flex items-center justify-end pt-1">
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
                    className="py-2 px-4 bg-white/15 text-white hover:bg-white hover:text-black font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer font-bold"
                    style={{ borderRadius: 0, outline: 'none', border: 'none' }}
                  >
                    Retry Video
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Desktop Outside Vertical Time Slider (At the very right side of the VideoPlayer) */}
          {isDesktop && duration > 0 && !isFullscreen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className={`absolute left-[calc(100%+16px)] sm:left-[calc(100%+24px)] top-1/2 -translate-y-1/2 h-[55vh] max-h-[520px] z-30 flex items-center select-none transition-all duration-300 ${
                showHud ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-3 pointer-events-none'
              }`}
            >
              {renderVerticalScrubberBar()}
            </div>
          )}

        </div>
      </div>

        {/* Lower Empty Space on Portrait Screens: Tap to Close */}
        {isPortrait && !isFullscreen && (
          <div
            className="w-full flex-1 cursor-pointer min-h-[40px] z-10"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            title="Tap empty space to close"
          />
        )}
      </div>

      {/* 4. Top Floating Control Tray (Portrait Screens: Timer, Fit, PiP, Download, Close) */}
      {isPortrait && !isFullscreen && (
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className={`fixed top-4 left-4 z-50 flex items-center gap-2 p-2 rounded-none bg-[rgba(5,7,12,0.92)] backdrop-blur-xl border-0 shadow-[0_12px_45px_rgba(0,0,0,0.85)] pointer-events-auto transition-all duration-300 max-w-[calc(100vw-2rem)] overflow-x-auto space-scrollbar ${
            showHud ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
          }`}
        >
          {/* Current Time / Duration on Portrait Screens */}
          <span
            className="px-2 text-xs font-mono font-medium text-white/90 tracking-wider whitespace-nowrap select-none"
            style={{ textShadow: '0 1px 4px #000, 0 0 8px #000' }}
          >
            {formatTime(currentTime)} <span className="text-white/40">/</span> {formatTime(duration)}
          </span>

          {/* Aspect Ratio Fit / Fill Toggle */}
          <button
            type="button"
            onClick={() => {
              setFitMode((prev) => (prev === 'contain' ? 'cover' : 'contain'));
              resetHudTimer();
            }}
            className={`reticle-btn px-2.5 h-9 rounded-none text-xs font-mono font-bold cursor-pointer border-0 ${
              fitMode === 'cover' ? 'text-white drop-shadow-[0_0_8px_#ffffff]' : 'text-slate-400 hover:text-white'
            }`}
            title={fitMode === 'cover' ? 'Fill Screen Active (Click for Fit)' : 'Fit Screen Active (Click for Fill)'}
            aria-label={`Fit mode: ${fitMode}`}
          >
            {fitMode === 'cover' ? 'FILL' : 'FIT'}
          </button>

          {/* Picture-in-Picture */}
          {isPiPSupported && (
            <button
              type="button"
              onClick={handleTogglePiP}
              className="reticle-btn w-9 h-9 rounded-none cursor-pointer text-slate-300 hover:text-white border-0"
              title="Picture-in-Picture (P)"
              aria-label="Toggle Picture-in-Picture"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>
          )}

          {/* Download Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDownload();
              resetHudTimer();
            }}
            disabled={isDownloading}
            className="reticle-btn w-9 h-9 cursor-pointer text-slate-300 hover:text-white disabled:opacity-40 border-0"
            title="Download Video"
            aria-label="Download Video"
          >
            {downloadSuccess ? (
              <Check className="w-5 h-5 text-emerald-400" />
            ) : isDownloading ? (
              <Loader2 className="w-5 h-5 animate-spin text-neutral-300" />
            ) : (
              <LaserDownloadIcon size={22} />
            )}
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClose();
            }}
            className="reticle-btn reticle-btn-close w-9 h-9 cursor-pointer text-slate-300 hover:text-white border-0"
            title="Close (Esc)"
            aria-label="Close"
          >
            <LaserCloseIcon size={22} />
          </button>
        </div>
      )}

      {/* Tablet Vertical Time Slider (Middle Right Side) */}
      {isTablet && duration > 0 && !isFullscreen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`fixed right-4 sm:right-6 top-1/2 -translate-y-1/2 h-[50vh] max-h-[460px] z-30 flex items-center select-none transition-all duration-300 ${
            showHud ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-3 pointer-events-none'
          }`}
        >
          {renderVerticalScrubberBar()}
        </div>
      )}

      {/* Mobile Phone Portrait Vertical Time Slider (Bottom Right Side, underneath video, above logo) */}
      {isPhonePortrait && duration > 0 && !isFullscreen && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`fixed right-4 bottom-[76px] h-[150px] max-h-[20vh] z-30 flex items-center select-none transition-all duration-300 ${
            showHud ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-3 pointer-events-none'
          }`}
        >
          {renderVerticalScrubberBar()}
        </div>
      )}

      {/* Rotated Phone Landscape / Fullscreen Vertical Time Slider */}
      {((!isDesktop && !isTablet && !isPhonePortrait && duration > 0) || (isFullscreen && duration > 0)) && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`fixed right-3.5 top-1/2 -translate-y-1/2 h-[60vh] max-h-[360px] z-30 flex items-center select-none transition-all duration-300 ${
            showHud ? 'opacity-100 translate-x-0 pointer-events-auto' : 'opacity-0 translate-x-3 pointer-events-none'
          }`}
        >
          {renderVerticalScrubberBar()}
        </div>
      )}

      {/* 5. Universal Floating Control Tray (Bottom Left Corner on Desktop & Tablets / Bottom on Mobile) */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: `translateY(${showHud ? '0px' : '16px'})`,
          borderRadius: 0,
          outline: 'none',
        }}
        className={`fixed ${
          isPortrait && !isFullscreen
            ? 'bottom-16 sm:bottom-20 left-4'
            : 'bottom-4 left-4 sm:bottom-6 sm:left-6'
        } z-50 flex items-center gap-2 p-2 rounded-none bg-[rgba(5,7,12,0.92)] backdrop-blur-xl border border-white/[0.1] shadow-[0_12px_45px_rgba(0,0,0,0.85)] pointer-events-auto transition-all duration-300 max-w-[calc(100vw-2rem)] overflow-hidden select-none ${
          showHud ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
          {/* Play / Pause Toggle (Laser Shimmer Outline) */}
          <button
            type="button"
            onClick={togglePlay}
            className="reticle-btn w-9 h-9 cursor-pointer border-0"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <LaserPauseIcon size={24} />
            ) : (
              <LaserPlayIcon size={24} />
            )}
          </button>

          {/* Current Time / Duration (Desktop, Landscape & Fullscreen) */}
          {(!isPortrait || isFullscreen) && (
            <span
              className="px-2 text-xs font-mono font-medium text-white/90 tracking-wider whitespace-nowrap select-none"
              style={{ textShadow: '0 1px 4px #000, 0 0 8px #000' }}
            >
              {formatTime(currentTime)} <span className="text-white/40">/</span> {formatTime(duration)}
            </span>
          )}

          {/* Repeat Mode (Loop) */}
          <button
            type="button"
            onClick={() => {
              setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
              resetHudTimer();
            }}
            className={`reticle-btn w-9 h-9 rounded-none cursor-pointer border-0 ${
              repeatMode !== 'off' ? 'text-white drop-shadow-[0_0_8px_#ffffff]' : 'text-slate-400 hover:text-white'
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
            {repeatMode === 'one' ? <Repeat1 className="w-4 h-4" /> : <Repeat className="w-4 h-4" />}
          </button>

          {/* A-B Loop */}
          <button
            type="button"
            onClick={handleToggleLoop}
            className={`reticle-btn px-2.5 h-9 rounded-none text-xs font-mono font-bold cursor-pointer border-0 ${
              loopA !== null && loopB !== null
                ? 'text-white drop-shadow-[0_0_8px_#ffffff]'
                : loopA !== null
                ? 'text-white/80'
                : 'text-slate-400 hover:text-white'
            }`}
            title="A-B Loop"
            aria-label="A-B Loop"
          >
            {loopA !== null && loopB !== null ? 'A-B' : loopA !== null ? 'Set B' : 'A-B'}
          </button>

          {/* Aspect Ratio Fit / Fill Toggle (Desktop, Landscape & Fullscreen) */}
          {(!isPortrait || isFullscreen) && (
            <button
              type="button"
              onClick={() => {
                setFitMode((prev) => (prev === 'contain' ? 'cover' : 'contain'));
                resetHudTimer();
              }}
              className={`reticle-btn px-2.5 h-9 rounded-none text-xs font-mono font-bold cursor-pointer border-0 ${
                fitMode === 'cover' ? 'text-white drop-shadow-[0_0_8px_#ffffff]' : 'text-slate-400 hover:text-white'
              }`}
              title={fitMode === 'cover' ? 'Fill Screen Active (Click for Fit)' : 'Fit Screen Active (Click for Fill)'}
              aria-label={`Fit mode: ${fitMode}`}
            >
              {fitMode === 'cover' ? 'FILL' : 'FIT'}
            </button>
          )}

          {/* Playback Speed Popover */}
          <div className="relative">
            <button
              ref={speedBtnRef}
              type="button"
              onClick={toggleSpeedMenu}
              className={`reticle-btn px-2.5 h-9 rounded-none text-xs font-mono font-bold flex items-center gap-1 cursor-pointer border-0 ${
                playbackSpeed !== 1 ? 'text-white drop-shadow-[0_0_8px_#ffffff]' : 'text-slate-400 hover:text-white'
              }`}
              title="Playback Speed (< / >)"
              aria-haspopup="true"
              aria-expanded={showSpeedMenu}
            >
              <Gauge className="w-3.5 h-3.5" />
              <span>{playbackSpeed}x</span>
            </button>
          </div>

          {showSpeedMenu && typeof document !== 'undefined' && createPortal(
            <div
              ref={speedMenuRef}
              style={{
                position: 'fixed',
                bottom: speedMenuPos ? `${speedMenuPos.bottom}px` : '5rem',
                left: speedMenuPos ? `${speedMenuPos.left}px` : '50%',
                background: 'rgba(7, 9, 14, 0.98)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                boxShadow: '0 12px 45px rgba(0,0,0,0.95), 0 0 20px rgba(56, 189, 248, 0.2)',
              }}
              className="py-1.5 px-1 rounded-none flex flex-col gap-0.5 z-[999999] min-w-[130px] max-h-[50vh] overflow-y-auto pointer-events-auto backdrop-blur-xl border-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-[#38bdf8] font-bold border-b border-white/10 mb-0.5"
                style={{ fontFamily: "'Science Gothic', sans-serif" }}
              >
                SPEED CONTROL
              </div>
              {PLAYBACK_SPEED_OPTIONS.map((speed) => {
                const isSelected = playbackSpeed === speed;
                return (
                  <button
                    key={speed}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectSpeed(speed);
                    }}
                    className={`px-2 py-1.5 rounded-none text-xs font-mono transition-all cursor-pointer text-left flex items-center justify-between gap-2 border-0 ${
                      isSelected
                        ? 'bg-white text-black font-semibold'
                        : 'text-neutral-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span>{speed === 1 ? '1x (Normal)' : `${speed}x`}</span>
                    {isSelected && <Check className="w-3 h-3 text-black" />}
                  </button>
                );
              })}
            </div>,
            document.body
          )}

          {/* Picture-in-Picture (Desktop, Landscape & Fullscreen) */}
          {(!isPortrait || isFullscreen) && isPiPSupported && (
            <button
              type="button"
              onClick={handleTogglePiP}
              className="reticle-btn w-9 h-9 rounded-none cursor-pointer text-slate-300 hover:text-white border-0"
              title="Picture-in-Picture (P)"
              aria-label="Toggle Picture-in-Picture"
            >
              <PictureInPicture2 className="w-4 h-4" />
            </button>
          )}

          {/* Mute / Unmute Toggle (Laser Shimmer Outline) */}
          <button
            type="button"
            onClick={handleToggleMute}
            className="reticle-btn w-9 h-9 cursor-pointer text-slate-300 hover:text-white border-0"
            title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            <LaserVolumeIcon size={24} isMuted={isMuted} />
          </button>

          {/* Download Button inside Control Tray (Desktop, Landscape & Fullscreen) */}
          {(!isPortrait || isFullscreen) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
                resetHudTimer();
              }}
              disabled={isDownloading}
              className="reticle-btn w-9 h-9 cursor-pointer text-slate-300 hover:text-white disabled:opacity-40 border-0"
              title="Download Video"
              aria-label="Download Video"
            >
              {downloadSuccess ? (
                <Check className="w-5 h-5 text-emerald-400" />
              ) : isDownloading ? (
                <Loader2 className="w-5 h-5 animate-spin text-neutral-300" />
              ) : (
                <LaserDownloadIcon size={22} />
              )}
            </button>
          )}

          {/* Fullscreen Toggle (Laser Shimmer Outline) */}
          <button
            type="button"
            onClick={handleFullscreenToggle}
            className="reticle-btn w-9 h-9 cursor-pointer text-slate-300 hover:text-white border-0"
            title="Fullscreen (F)"
            aria-label="Toggle Fullscreen"
          >
            <LaserFullscreenIcon size={22} />
          </button>

          {/* Close Button inside Control Tray (Desktop, Landscape & Fullscreen) */}
          {(!isPortrait || isFullscreen) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              className="reticle-btn reticle-btn-close w-9 h-9 cursor-pointer text-slate-300 hover:text-white border-0"
              title="Close (Esc)"
              aria-label="Close"
            >
              <LaserCloseIcon size={22} />
            </button>
          )}
        </div>

      {/* 6. Brand Watermark Logo on Bottom-Right: click opens navigation dock on any screen */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          hapticLight();
          window.dispatchEvent(new CustomEvent('streamvault_open_dock'));
        }}
        onMouseEnter={() => resetHudTimer()}
        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex items-center select-none cursor-pointer transition-all duration-300 ease-out opacity-80 hover:opacity-100 hover:scale-105 pointer-events-auto"
        title="Open Navigation Dock"
      >
        <div className="flex items-center">
          <HeaderBrandLogo trackingClass="tracking-[0.2em]" />
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
            className="w-full md:w-auto h-[62vh] md:h-full max-h-[85vh] md:max-h-screen flex flex-col shadow-2xl pointer-events-auto overflow-hidden rounded-none animate-slide-up md:animate-slide-left"
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

