import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Download,
  Loader2,
  Maximize,
  Minimize,
  Check,
  ChevronLeft,
  ChevronRight,
  ListVideo,
  Share2,
} from 'lucide-react';
import { downloadMedia, downloadBrandedVideo, applyWatermarkAndDownload } from '../utils/downloadMedia';
import { getMediaUrl } from '../utils/imageUrlResolver';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';
import { createShareableMediaUrl, copyToClipboard } from '../utils/urlRouter';
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
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isZoomed = scale > 1.05;

  // Single Tap to Toggle Controls (with 250ms double-tap protection)
  const [showControls, setShowControls] = useState<boolean>(true);
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTouchTimeRef = useRef<number>(0);

  const [showSidebar, setShowSidebar] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
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
    startPosition: { x: number; y: number };
    lastTouchX: number;
    lastTouchY: number;
    isPinching: boolean;
    isPanning: boolean;
  }>({
    startDist: 0,
    startScale: 1,
    startPosition: { x: 0, y: 0 },
    lastTouchX: 0,
    lastTouchY: 0,
    isPinching: false,
    isPanning: false,
  });

  const lastTapRef = useRef<{ time: number; x: number; y: number }>({ time: 0, x: 0, y: 0 });

  const wakeFullscreenClose = useCallback(() => {
    setShowFullscreenClose(true);
    if (fullscreenCloseTimerRef.current) window.clearTimeout(fullscreenCloseTimerRef.current);
    fullscreenCloseTimerRef.current = window.setTimeout(() => {
      setShowFullscreenClose(false);
    }, 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) clearTimeout(singleTapTimerRef.current);
      if (fullscreenCloseTimerRef.current) window.clearTimeout(fullscreenCloseTimerRef.current);
    };
  }, []);

  const [prevPropKey, setPrevPropKey] = useState({ propCurrentIndex, isOpen });
  if (prevPropKey.propCurrentIndex !== propCurrentIndex || prevPropKey.isOpen !== isOpen) {
    setPrevPropKey({ propCurrentIndex, isOpen });
    setActiveIdx(propCurrentIndex);
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setShowControls(true);
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
    setPosition({ x: 0, y: 0 });
    onIndexChange?.(next);
  }, [hasItemList, activeIdx, items.length, onIndexChange]);

  const handlePrev = useCallback(() => {
    if (!hasItemList || activeIdx <= 0) return;
    const prev = activeIdx - 1;
    setActiveIdx(prev);
    setScale(1);
    setPosition({ x: 0, y: 0 });
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
    setPosition({ x: 0, y: 0 });
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
  // Mobile Touch Gestures & Desktop Zoom Handlers
  // -------------------------------------------------------------
  const handleDoubleTap = useCallback((e?: React.TouchEvent | React.MouseEvent) => {
    if (e) {
      if ('cancelable' in e && e.cancelable) {
        e.preventDefault();
      }
      if ('stopPropagation' in e) {
        e.stopPropagation();
      }
    }
    // Clear single-tap timer so controls don't flicker
    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
      singleTapTimerRef.current = null;
    }

    if (scale > 1.05) {
      // ALWAYS RESET to natural default state when already zoomed
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      // Zoom in to 2.5x centered around natural view
      setScale(2.5);
      setPosition({ x: 0, y: 0 });
    }
  }, [scale]);

  const handleTouchStart = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();
    wakeFullscreenClose();

    // Multi-touch: Two-finger pinch gesture setup
    if (e.touches.length === 2) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      pinchStateRef.current = {
        startDist: dist,
        startScale: scale,
        startPosition: { ...position },
        lastTouchX: midX,
        lastTouchY: midY,
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
      const timeSinceLastTap = now - lastTapRef.current.time;
      const distFromLastTap = Math.hypot(
        t.clientX - lastTapRef.current.x,
        t.clientY - lastTapRef.current.y
      );

      // Double tap to zoom / reset (second tap within 300ms and 35px)
      if (timeSinceLastTap < 300 && distFromLastTap < 35) {
        lastTapRef.current = { time: 0, x: 0, y: 0 };
        handleDoubleTap(e);
        touchStateRef.current = null;
        return;
      }

      // Drag / Pan while zoomed in (scale > 1.05)
      if (scale > 1.05) {
        pinchStateRef.current.isPanning = true;
        pinchStateRef.current.isPinching = false;
        pinchStateRef.current.lastTouchX = t.clientX;
        pinchStateRef.current.lastTouchY = t.clientY;
        touchStateRef.current = {
          startX: t.clientX,
          startY: t.clientY,
          currentX: t.clientX,
          currentY: t.clientY,
          time: now,
        };
        return;
      }

      // Normal swipe gesture setup when at 1x
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
    lastTouchTimeRef.current = Date.now();
    wakeFullscreenClose();

    // Multi-touch: Two-finger continuous pinch zooming (clamped 1x to 4x)
    if (e.touches.length === 2 && pinchStateRef.current.isPinching) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (pinchStateRef.current.startDist > 0) {
        const factor = dist / pinchStateRef.current.startDist;
        const newScale = Math.max(1, Math.min(4, pinchStateRef.current.startScale * factor));
        setScale(newScale);

        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const dMidX = midX - pinchStateRef.current.lastTouchX;
        const dMidY = midY - pinchStateRef.current.lastTouchY;
        pinchStateRef.current.lastTouchX = midX;
        pinchStateRef.current.lastTouchY = midY;

        if (newScale <= 1.05) {
          setPosition({ x: 0, y: 0 });
        } else {
          const maxPanX = Math.max(0, (window.innerWidth * (newScale - 1)) / 2 + 50);
          const maxPanY = Math.max(0, (window.innerHeight * (newScale - 1)) / 2 + 50);
          setPosition((prev) => ({
            x: Math.max(-maxPanX, Math.min(maxPanX, prev.x + dMidX)),
            y: Math.max(-maxPanY, Math.min(maxPanY, prev.y + dMidY)),
          }));
        }
      }
      return;
    }

    // Drag / Pan with 1 finger when zoomed in (scale > 1.05)
    if (e.touches.length === 1 && scale > 1.05 && pinchStateRef.current.isPanning) {
      const t = e.touches[0];
      const dx = t.clientX - pinchStateRef.current.lastTouchX;
      const dy = t.clientY - pinchStateRef.current.lastTouchY;
      pinchStateRef.current.lastTouchX = t.clientX;
      pinchStateRef.current.lastTouchY = t.clientY;

      if (touchStateRef.current) {
        touchStateRef.current.currentX = t.clientX;
        touchStateRef.current.currentY = t.clientY;
      }

      // Boundary clamp to inspect every corner without losing image
      const maxPanX = Math.max(0, (window.innerWidth * (scale - 1)) / 2 + 50);
      const maxPanY = Math.max(0, (window.innerHeight * (scale - 1)) / 2 + 50);

      setPosition((prev) => ({
        x: Math.max(-maxPanX, Math.min(maxPanX, prev.x + dx)),
        y: Math.max(-maxPanY, Math.min(maxPanY, prev.y + dy)),
      }));
      return;
    }

    // Horizontal swipe preview feedback ONLY when scale <= 1.05
    if (!touchStateRef.current || scale > 1.05) return;
    const t = e.touches[0];
    touchStateRef.current.currentX = t.clientX;
    touchStateRef.current.currentY = t.clientY;

    const dx = t.clientX - touchStateRef.current.startX;
    const dy = t.clientY - touchStateRef.current.startY;

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      setTouchDeltaX(Math.max(-80, Math.min(80, dx * 0.35)));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    lastTouchTimeRef.current = Date.now();

    if (e.touches.length === 0) {
      pinchStateRef.current.isPinching = false;
      pinchStateRef.current.isPanning = false;

      // Snap back if pinched below 1.05x
      if (scale <= 1.05) {
        setScale(1);
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && pinchStateRef.current.isPinching) {
      pinchStateRef.current.isPinching = false;
      pinchStateRef.current.isPanning = scale > 1.05;
      const t = e.touches[0];
      pinchStateRef.current.lastTouchX = t.clientX;
      pinchStateRef.current.lastTouchY = t.clientY;
    }

    const state = touchStateRef.current;
    touchStateRef.current = null;
    setTouchDeltaX(0);

    if (!state) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - state.startX;
    const dy = t.clientY - state.startY;
    const dt = performance.now() - state.time;

    // Stationary single tap check (< 20px move & < 300ms)
    const isStationaryTap = Math.abs(dx) < 20 && Math.abs(dy) < 20 && dt < 300;
    if (isStationaryTap) {
      lastTapRef.current = {
        time: performance.now(),
        x: t.clientX,
        y: t.clientY,
      };

      // 250ms timeout to distinguish single tap from double tap
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
      singleTapTimerRef.current = setTimeout(() => {
        setShowControls((prev) => !prev);
        singleTapTimerRef.current = null;
      }, 250);
      return;
    }

    // When scale > 1, horizontal swipe navigation is strictly disabled to allow free panning
    if (scale > 1.05) {
      return;
    }

    // Swipe down to dismiss
    if (dy > 120 && Math.abs(dx) < 60 && dt < 450) {
      onClose();
      return;
    }

    // Horizontal swipe navigation (distance > 50px)
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < -50) {
        handleNext();
      } else if (dx > 50) {
        handlePrev();
      }
    }
  };

  // Desktop Click handlers (with double-click protection)
  const handleStageClick = () => {
    if (Date.now() - lastTouchTimeRef.current < 600) {
      return;
    }

    if (singleTapTimerRef.current) {
      clearTimeout(singleTapTimerRef.current);
    }
    singleTapTimerRef.current = setTimeout(() => {
      setShowControls((prev) => !prev);
      singleTapTimerRef.current = null;
    }, 250);
  };

  const handleStageDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (Date.now() - lastTouchTimeRef.current < 600) {
      return;
    }
    handleDoubleTap(e);
  };

  // Wheel zoom on desktop
  const handleWheel = (e: React.WheelEvent) => {
    if (type !== 'image') return;
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.2 : 0.8;
    const newScale = Math.max(1, Math.min(5, scale * zoomFactor));
    setScale(newScale);
    if (newScale <= 1.05) {
      setPosition({ x: 0, y: 0 });
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

  const handleSharePhoto = useCallback(async () => {
    if (!currentItem) return;
    const albumName = currentItem.category || currentItem.parentAlbum || '';
    const shareUrl = createShareableMediaUrl(currentItem, albumName);
    const success = await copyToClipboard(shareUrl);
    if (success) {
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 2200);
    }
  }, [currentItem]);

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
        className="fixed inset-0 w-full h-[100dvh] overflow-hidden z-[9999] bg-black select-none touch-none touch-action-none flex items-center justify-center animate-fade-in cursor-pointer"
        onClick={handleStageClick}
        onDoubleClick={handleStageDoubleClick}
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
              transform:
                touchDeltaX !== 0
                  ? `translateX(${touchDeltaX}px)`
                  : `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
              transition:
                pinchStateRef.current.isPinching ||
                pinchStateRef.current.isPanning ||
                touchDeltaX !== 0
                  ? 'none'
                  : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
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
            showControls && showFullscreenClose
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
      className="fixed inset-0 w-full max-w-full h-[100dvh] overflow-hidden z-[9999] flex flex-col md:flex-row bg-[#030305]/95 backdrop-blur-2xl select-none animate-fade-in touch-none touch-action-none overscroll-contain"
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
        {/* Top Bar Header */}
        <header
          className={`absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-300 ${
            showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Left Corner: Info Only */}
          <div className="flex items-center gap-3 text-white/90 min-w-0 pr-4">
            <span className="text-sm font-semibold tracking-wide truncate max-w-xs md:max-w-md">
              {currentItem?.title || currentItem?.name || cleanTitle}
            </span>
            {hasItemList && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-white/70 font-mono flex-shrink-0">
                {activeIdx + 1} / {items.length}
              </span>
            )}
          </div>

          {/* Top Right Corner: Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Queue / Playlist Drawer Button */}
            {hasItemList && (
              <button
                type="button"
                onClick={() => setShowSidebar(!showSidebar)}
                className={`p-2 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                  showSidebar
                    ? 'text-[#00E5FF] bg-white/15'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
                title={showSidebar ? 'Hide Queue' : 'Show Queue'}
                aria-label="Toggle queue"
              >
                <ListVideo className="w-5 h-5" />
              </button>
            )}

            {/* Clean Original Download Button */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className={`p-2 rounded-full transition-all cursor-pointer ${
                downloadSuccess
                  ? 'text-emerald-400 bg-emerald-500/20'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              } disabled:opacity-40`}
              title="Download Original Media"
              aria-label="Download image"
            >
              {downloadSuccess ? (
                <Check className="w-5 h-5 text-emerald-400" />
              ) : isDownloading ? (
                <Loader2 className="w-5 h-5 animate-spin text-[#00E5FF]" />
              ) : (
                <Download className="w-5 h-5" />
              )}
            </button>

            {/* Share / Copy Direct Link Button */}
            <button
              type="button"
              onClick={handleSharePhoto}
              className={`p-2 rounded-full transition-all cursor-pointer ${
                shareSuccess
                  ? 'text-[#00E5FF] bg-[#00E5FF]/20'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
              title={shareSuccess ? 'Link Copied to Clipboard!' : 'Share Image Link'}
              aria-label="Share image"
            >
              {shareSuccess ? (
                <Check className="w-5 h-5 text-[#00E5FF]" />
              ) : (
                <Share2 className="w-5 h-5" />
              )}
            </button>

            {/* Fullscreen Toggle Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all cursor-pointer"
              title="Toggle Fullscreen (F)"
              aria-label="Toggle fullscreen"
            >
              {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
            </button>
          </div>
        </header>

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
              className={`absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-40 p-2.5 sm:p-3.5 rounded-full bg-black/70 hover:bg-black/90 text-white backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.85)] hover:border-[#00D2FF]/60 hover:shadow-[0_0_20px_rgba(0,210,255,0.35)] transition-all duration-300 cursor-pointer disabled:opacity-20 disabled:pointer-events-none ${
                showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
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
              className={`absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-40 p-2.5 sm:p-3.5 rounded-full bg-black/70 hover:bg-black/90 text-white backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.85)] hover:border-[#00D2FF]/60 hover:shadow-[0_0_20px_rgba(0,210,255,0.35)] transition-all duration-300 cursor-pointer disabled:opacity-20 disabled:pointer-events-none ${
                showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
              }`}
              title="Next (Right Arrow)"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </>
        )}

        {/* Main Media Stage */}
        <div
          ref={mediaBoxRef}
          className="flex-1 relative w-full h-full flex items-center justify-center p-3 sm:p-6 md:p-8 transition-all overflow-hidden cursor-pointer"
          onClick={handleStageClick}
          onDoubleClick={handleStageDoubleClick}
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
                style={{
                  transform:
                    touchDeltaX !== 0
                      ? `translateX(${touchDeltaX}px)`
                      : `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
                  transition:
                    pinchStateRef.current.isPinching || pinchStateRef.current.isPanning || touchDeltaX !== 0
                      ? 'none'
                      : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
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
                setPosition({ x: 0, y: 0 });
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
