import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Download,
  Loader2,
  Maximize,
  Minimize,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  ListVideo,
} from 'lucide-react';
import { downloadMedia, downloadBrandedVideo, applyWatermarkAndDownload } from '../utils/downloadMedia';
import { getMediaUrl } from '../utils/imageUrlResolver';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';
import { CyberMediaSidebar } from './CyberMediaSidebar';
import type { StageMediaItem, MediaFolderEntry } from '../types';

interface MediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string | null;
  type: 'video' | 'image';
  title?: string;
  items?: StageMediaItem[];
  currentIndex?: number;
  onIndexChange?: (newIndex: number) => void;
  allFolders?: MediaFolderEntry[];
  onSelectFolder?: (folder: MediaFolderEntry) => void;
}

export const MediaModal: React.FC<MediaModalProps> = ({
  isOpen,
  onClose,
  url,
  type,
  title,
  items = [],
  currentIndex: propCurrentIndex = 0,
  onIndexChange,
  allFolders = [],
  onSelectFolder,
}) => {
  const [activeIdx, setActiveIdx] = useState<number>(propCurrentIndex);
  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isZoomed = scale > 1.05;

  const [showSidebar, setShowSidebar] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isLightboxFullscreen, setIsLightboxFullscreen] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const isFullscreen = isNativeFullscreen || isLightboxFullscreen;

  // Auto-hiding close button for truly full screen photo mode
  const [showFullscreenClose, setShowFullscreenClose] = useState(true);
  const fullscreenCloseTimerRef = useRef<number | null>(null);

  const mediaBoxRef = useRef<HTMLDivElement>(null);
  const touchStateRef = useRef<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    time: number;
  } | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState<number>(0);

  // 2-Finger Pinch & Pan State Ref
  const pinchStateRef = useRef<{
    startDist: number;
    startScale: number;
    startPan: { x: number; y: number };
    lastTouchX: number;
    lastTouchY: number;
    isPinching: boolean;
    isPanning: boolean;
  }>({
    startDist: 0,
    startScale: 1,
    startPan: { x: 0, y: 0 },
    lastTouchX: 0,
    lastTouchY: 0,
    isPinching: false,
    isPanning: false,
  });

  const lastTapRef = useRef<number>(0);

  const wakeFullscreenClose = useCallback(() => {
    setShowFullscreenClose(true);
    if (fullscreenCloseTimerRef.current) window.clearTimeout(fullscreenCloseTimerRef.current);
    fullscreenCloseTimerRef.current = window.setTimeout(() => {
      setShowFullscreenClose(false);
    }, 2500);
  }, []);

  const [prevPropKey, setPrevPropKey] = useState({ propCurrentIndex, isOpen });
  if (prevPropKey.propCurrentIndex !== propCurrentIndex || prevPropKey.isOpen !== isOpen) {
    setPrevPropKey({ propCurrentIndex, isOpen });
    setActiveIdx(propCurrentIndex);
    setScale(1);
    setPan({ x: 0, y: 0 });
  }

  // Determine active media item
  const hasItemList = items && items.length > 0;
  const currentItem = hasItemList ? items[activeIdx] : null;
  const activeUrl = currentItem?.url || url;
  const activeTitle = currentItem?.title || title || (type === 'video' ? 'Video Stream' : 'Photograph');

  const handleNext = useCallback(() => {
    if (!hasItemList || activeIdx >= items.length - 1) return;
    const next = activeIdx + 1;
    setActiveIdx(next);
    setScale(1);
    setPan({ x: 0, y: 0 });
    onIndexChange?.(next);
  }, [hasItemList, activeIdx, items.length, onIndexChange]);

  const handlePrev = useCallback(() => {
    if (!hasItemList || activeIdx <= 0) return;
    const prev = activeIdx - 1;
    setActiveIdx(prev);
    setScale(1);
    setPan({ x: 0, y: 0 });
    onIndexChange?.(prev);
  }, [hasItemList, activeIdx, onIndexChange]);

  // Sync native fullscreen state
  useEffect(() => {
    const onFullscreenChange = () => {
      const isFull = Boolean(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement
      );
      setIsNativeFullscreen(isFull);
      if (!isFull) {
        setIsLightboxFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
      if (fullscreenCloseTimerRef.current) window.clearTimeout(fullscreenCloseTimerRef.current);
    };
  }, []);

  const exitFullscreen = useCallback(() => {
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
    setIsLightboxFullscreen(false);
    setIsNativeFullscreen(false);
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
    } else {
      setIsLightboxFullscreen(true);
      wakeFullscreenClose();
      const el = mediaBoxRef.current || document.documentElement;
      if (el) {
        const req = el.requestFullscreen || (el as any).webkitRequestFullscreen;
        if (req) {
          req.call(el)
            .then(() => setIsNativeFullscreen(true))
            .catch(() => setIsLightboxFullscreen(true));
          return;
        }
      }
      setIsLightboxFullscreen(true);
    }
  }, [isFullscreen, exitFullscreen, wakeFullscreenClose]);

  // Strict background scroll-lock
  useLockBodyScroll(isOpen);

  // Keyboard navigation & gestures
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSidebar) {
          setShowSidebar(false);
          return;
        }
        if (isFullscreen) {
          exitFullscreen();
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, isFullscreen, toggleFullscreen, exitFullscreen, showSidebar, handleNext, handlePrev]);

  // -------------------------------------------------------------
  // Touch Handlers with 2-Finger Pinch Zooming and Panning
  // -------------------------------------------------------------
  const handleTouchStart = (e: React.TouchEvent) => {
    wakeFullscreenClose();

    // Two-finger pinch gesture
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStateRef.current = {
        startDist: dist,
        startScale: scale,
        startPan: { ...pan },
        lastTouchX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        lastTouchY: (e.touches[0].clientY + e.touches[1].clientY) / 2,
        isPinching: true,
        isPanning: false,
      };
      setTouchDeltaX(0);
      touchStateRef.current = null;
      return;
    }

    // Single finger touch
    if (e.touches.length === 1) {
      const t = e.touches[0];
      const now = performance.now();

      // Double tap to zoom toggle (2.5x vs 1x)
      if (now - lastTapRef.current < 280) {
        lastTapRef.current = 0;
        if (scale > 1.05) {
          setScale(1);
          setPan({ x: 0, y: 0 });
        } else {
          setScale(2.5);
          setPan({ x: 0, y: 0 });
        }
        return;
      }
      lastTapRef.current = now;

      // Panning while zoomed in
      if (scale > 1.05) {
        pinchStateRef.current.isPanning = true;
        pinchStateRef.current.isPinching = false;
        pinchStateRef.current.lastTouchX = t.clientX;
        pinchStateRef.current.lastTouchY = t.clientY;
        touchStateRef.current = null;
        return;
      }

      // Normal swipe gesture setup
      touchStateRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        currentX: t.clientX,
        currentY: t.clientY,
        time: now,
      };
      setTouchDeltaX(0);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    wakeFullscreenClose();

    // Two-finger pinch zooming
    if (e.touches.length === 2 && pinchStateRef.current.isPinching) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (pinchStateRef.current.startDist > 0) {
        const factor = dist / pinchStateRef.current.startDist;
        const newScale = Math.max(1, Math.min(5, pinchStateRef.current.startScale * factor));
        setScale(newScale);
      }
      return;
    }

    // Single-finger panning when zoomed in
    if (e.touches.length === 1 && scale > 1.05 && pinchStateRef.current.isPanning) {
      const t = e.touches[0];
      const dx = t.clientX - pinchStateRef.current.lastTouchX;
      const dy = t.clientY - pinchStateRef.current.lastTouchY;
      pinchStateRef.current.lastTouchX = t.clientX;
      pinchStateRef.current.lastTouchY = t.clientY;

      const maxPanX = (window.innerWidth * (scale - 1)) / 1.6;
      const maxPanY = (window.innerHeight * (scale - 1)) / 1.6;

      setPan((prev) => ({
        x: Math.max(-maxPanX, Math.min(maxPanX, prev.x + dx)),
        y: Math.max(-maxPanY, Math.min(maxPanY, prev.y + dy)),
      }));
      return;
    }

    // Single-finger swipe navigation when scale is 1x (only in normal viewer mode)
    if (!touchStateRef.current || scale > 1.05 || isFullscreen) return;
    const t = e.touches[0];
    touchStateRef.current.currentX = t.clientX;
    touchStateRef.current.currentY = t.clientY;

    const dx = t.clientX - touchStateRef.current.startX;
    const dy = t.clientY - touchStateRef.current.startY;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 12) {
      setTouchDeltaX(Math.max(-100, Math.min(100, dx * 0.35)));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      pinchStateRef.current.isPinching = false;
      pinchStateRef.current.isPanning = false;

      // Snap back if pinched below 1x
      if (scale < 1.05) {
        setScale(1);
        setPan({ x: 0, y: 0 });
      }
    }

    const state = touchStateRef.current;
    touchStateRef.current = null;
    setTouchDeltaX(0);

    if (!state || scale > 1.05 || isFullscreen) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - state.startX;
    const dy = t.clientY - state.startY;
    const dt = performance.now() - state.time;

    // Swipe down to dismiss
    if (dy > 120 && Math.abs(dx) < 60 && dt < 450) {
      onClose();
      return;
    }

    // Horizontal swipe navigation
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < -50) {
        handleNext();
      } else if (dx > 50) {
        handlePrev();
      }
    }
  };

  // Double click / tap toggle
  const toggleZoom = () => {
    if (scale > 1.05) {
      setScale(1);
      setPan({ x: 0, y: 0 });
    } else {
      setScale(2.5);
      setPan({ x: 0, y: 0 });
    }
  };

  // Wheel zoom on desktop
  const handleWheel = (e: React.WheelEvent) => {
    if (type !== 'image') return;
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.2 : 0.8;
    const newScale = Math.max(1, Math.min(5, scale * zoomFactor));
    setScale(newScale);
    if (newScale <= 1.05) {
      setPan({ x: 0, y: 0 });
    }
  };

  const handleDownload = useCallback(async () => {
    if (!activeUrl || isDownloading) return;
    setIsDownloading(true);
    setDownloadSuccess(false);

    try {
      const filename = activeTitle
        ? `${activeTitle.toLowerCase().replace(/[^a-z0-9]/g, '_')}.${type === 'video' ? 'mp4' : 'jpg'}`
        : `media_${Date.now()}.${type === 'video' ? 'mp4' : 'jpg'}`;

      if (type === 'video') {
        await downloadBrandedVideo(activeUrl, filename);
      } else {
        await applyWatermarkAndDownload(activeUrl, filename);
      }

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2200);
    } catch {
      await downloadMedia(activeUrl, activeTitle || 'download');
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2200);
    } finally {
      setIsDownloading(false);
    }
  }, [activeUrl, activeTitle, type, isDownloading]);

  if (!isOpen || !activeUrl) return null;

  const secureUrl = activeUrl.replace(/^http:\/\//i, 'https://');
  const cleanTitle = sanitizeMediaTitle(activeTitle, type === 'video' ? 'Video' : 'Photograph');

  // =========================================================================
  // 1. TRULY FULL SCREEN IMMERSIVE PHOTO CANVAS
  // =========================================================================
  if (isFullscreen && type === 'image') {
    return (
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 w-full h-[100dvh] overflow-hidden z-[150] bg-black select-none touch-none touch-action-none flex items-center justify-center animate-fade-in"
        onClick={wakeFullscreenClose}
        onMouseMove={wakeFullscreenClose}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        {/* Edge-to-Edge Pure Photo */}
        <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
          <img
            src={getMediaUrl(secureUrl)}
            alt={cleanTitle}
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
              transition:
                pinchStateRef.current.isPinching || pinchStateRef.current.isPanning
                  ? 'none'
                  : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            className="w-full h-full object-contain pointer-events-none select-none max-w-none max-h-none"
            draggable={false}
          />
        </div>

        {/* Dedicated Auto-Hiding Close Button to return to normal Image Viewer */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            exitFullscreen();
          }}
          className={`fixed top-4 right-4 sm:top-6 sm:right-6 z-[160] p-2.5 sm:p-3 rounded-full bg-black/75 hover:bg-black/95 text-white backdrop-blur-2xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.95)] hover:border-[#00D2FF]/60 hover:text-[#00D2FF] transition-all duration-300 cursor-pointer ${
            showFullscreenClose
              ? 'opacity-100 scale-100 pointer-events-auto'
              : 'opacity-0 scale-90 pointer-events-none'
          }`}
          title="Exit Fullscreen (Esc)"
        >
          <Minimize className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>
    );
  }

  // =========================================================================
  // 2. NORMAL TWO-PANE SPLIT VIEW IMAGE VIEWER
  // =========================================================================
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 w-full max-w-full h-[100dvh] overflow-hidden z-[120] flex flex-col md:flex-row bg-[#030305]/95 backdrop-blur-2xl select-none animate-fade-in touch-none touch-action-none overscroll-contain"
      onClick={(e) => {
        if (showSidebar) {
          setShowSidebar(false);
          return;
        }
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* 1. Left Pane: Primary Media Stage (~65-70% desktop width, 100% mobile) */}
      <div className="flex-1 relative flex flex-col justify-between overflow-hidden h-full min-h-[50vh] md:min-h-0 bg-[#030305]">
        {/* Floating Top HUD */}
        <div
          className="relative z-40 p-3 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] flex justify-center pointer-events-none flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="cyber-pill pointer-events-auto flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2 w-full max-w-4xl shadow-[0_8px_32px_rgba(0,0,0,0.8)]">
            {/* Left: Title & Counter */}
            <div className="flex items-center gap-2 min-w-0 pr-1 sm:pr-2">
              <span className="text-xs sm:text-sm font-bold font-sans text-zinc-200 uppercase tracking-wider truncate max-w-[130px] sm:max-w-md">
                {cleanTitle}
              </span>
              {hasItemList && (
                <span className="text-[10px] sm:text-xs font-mono font-semibold text-[#00D2FF] bg-[#00D2FF]/10 px-2 py-0.5 rounded-full flex-shrink-0 border border-[#00D2FF]/20">
                  {activeIdx + 1} / {items.length}
                </span>
              )}
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {type === 'image' && (
                <button
                  type="button"
                  onClick={toggleZoom}
                  className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  title={isZoomed ? 'Reset Zoom (1x)' : 'Zoom In (2.5x)'}
                >
                  {isZoomed ? <ZoomOut className="w-4 h-4 text-[#00D2FF]" /> : <ZoomIn className="w-4 h-4" />}
                </button>
              )}

              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold font-brand tracking-wider transition-all cursor-pointer ${
                  downloadSuccess
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                    : 'bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white'
                } disabled:opacity-40`}
                title="Download Clean High-Res Media"
              >
                {downloadSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="hidden sm:inline">SAVED</span>
                  </>
                ) : (
                  <>
                    {isDownloading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00D2FF]" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">
                      {isDownloading ? 'SAVING...' : 'DOWNLOAD'}
                    </span>
                  </>
                )}
              </button>

              {/* Fullscreen Button -> Enters Truly Full Screen Mode */}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="View Truly Full Screen"
              >
                <Maximize className="w-4 h-4" />
              </button>

              {/* Sidebar Queue Toggle */}
              {hasItemList && (
                <button
                  type="button"
                  onClick={() => setShowSidebar(!showSidebar)}
                  className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-bold font-sans tracking-wider border transition-all cursor-pointer ${
                    showSidebar
                      ? 'bg-[#00D2FF]/20 text-[#00D2FF] border-[#00D2FF]/40 shadow-[0_0_12px_rgba(0,210,255,0.25)]'
                      : 'bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white border-white/10'
                  }`}
                  title={showSidebar ? 'Hide Queue & Suggestions' : 'Show Queue & Suggestions'}
                >
                  <ListVideo className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">QUEUE</span>
                  <span className="text-[10px] font-mono bg-white/10 px-1.5 py-0.2 rounded-full">
                    {items.length}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 transition-colors cursor-pointer ml-1"
                title="Close Viewer (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Side Arrow Navigation within Left Pane */}
        {hasItemList && items.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              disabled={activeIdx <= 0}
              className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-40 p-2.5 sm:p-3.5 rounded-full bg-black/70 hover:bg-black/90 text-white backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.85)] hover:border-[#00D2FF]/60 hover:shadow-[0_0_20px_rgba(0,210,255,0.35)] transition-all cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
              title="Previous (Left Arrow)"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              disabled={activeIdx >= items.length - 1}
              className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-40 p-2.5 sm:p-3.5 rounded-full bg-black/70 hover:bg-black/90 text-white backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.85)] hover:border-[#00D2FF]/60 hover:shadow-[0_0_20px_rgba(0,210,255,0.35)] transition-all cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
              title="Next (Right Arrow)"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </>
        )}

        {/* Main Media Stage */}
        <div
          ref={mediaBoxRef}
          className="flex-1 relative w-full h-full flex items-center justify-center p-3 sm:p-6 md:p-8 transition-all overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
        >
          {type === 'video' ? (
            <div className="w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center border border-white/10">
              <video
                src={getMediaUrl(secureUrl)}
                controls
                autoPlay
                preload="metadata"
                playsInline
                {...{ 'webkit-playsinline': 'true' }}
                crossOrigin="anonymous"
                className="w-full h-full object-contain"
              />
            </div>
          ) : (
            <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
              <img
                src={getMediaUrl(secureUrl)}
                alt={cleanTitle}
                onClick={toggleZoom}
                style={{
                  transform:
                    scale > 1.05
                      ? `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`
                      : touchDeltaX !== 0
                      ? `translateX(${touchDeltaX}px)`
                      : 'none',
                  transition:
                    pinchStateRef.current.isPinching || pinchStateRef.current.isPanning || touchDeltaX !== 0
                      ? 'none'
                      : 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                className={`max-w-full max-h-[82dvh] md:max-h-[85dvh] object-contain rounded-xl select-none will-change-transform ${
                  isZoomed ? 'cursor-zoom-out' : 'cursor-zoom-in'
                } drop-shadow-[0_15px_35px_rgba(0,0,0,0.85)]`}
                draggable={false}
              />
            </div>
          )}
        </div>
      </div>

      {/* 2. Slide-out Queue & Suggestions Drawer (Responsive Bottom Sheet on Mobile, Right Drawer on Desktop) */}
      {showSidebar && (
        <div
          className="fixed inset-0 z-[130] flex flex-col md:flex-row justify-end items-end md:items-stretch bg-black/75 backdrop-blur-sm animate-fade-in pointer-events-auto overflow-hidden w-full max-w-full"
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
              items={items}
              activeItem={currentItem}
              activeIdx={activeIdx}
              onSelectItem={(_, idx) => {
                setActiveIdx(idx);
                setScale(1);
                setPan({ x: 0, y: 0 });
                onIndexChange?.(idx);
              }}
              mediaType="image"
              currentFolderName={currentItem?.category || 'Photo Archive'}
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

export default MediaModal;
