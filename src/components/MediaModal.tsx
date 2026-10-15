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
  const [isZoomed, setIsZoomed] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isLightboxFullscreen, setIsLightboxFullscreen] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const isFullscreen = isNativeFullscreen || isLightboxFullscreen;

  const mediaBoxRef = useRef<HTMLDivElement>(null);
  const touchStateRef = useRef<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    time: number;
    isMultiTouch: boolean;
  } | null>(null);
  const [touchDeltaX, setTouchDeltaX] = useState<number>(0);

  const [prevPropKey, setPrevPropKey] = useState({ propCurrentIndex, isOpen });
  if (prevPropKey.propCurrentIndex !== propCurrentIndex || prevPropKey.isOpen !== isOpen) {
    setPrevPropKey({ propCurrentIndex, isOpen });
    setActiveIdx(propCurrentIndex);
    setIsZoomed(false);
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
    setIsZoomed(false);
    onIndexChange?.(next);
  }, [hasItemList, activeIdx, items.length, onIndexChange]);

  const handlePrev = useCallback(() => {
    if (!hasItemList || activeIdx <= 0) return;
    const prev = activeIdx - 1;
    setActiveIdx(prev);
    setIsZoomed(false);
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
    };
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = mediaBoxRef.current;
    if (isFullscreen) {
      if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        }
      }
      setIsLightboxFullscreen(false);
      setIsNativeFullscreen(false);
      return;
    }

    if (el) {
      const req = el.requestFullscreen || (el as any).webkitRequestFullscreen;
      if (req) {
        req.call(el)
          .then(() => setIsNativeFullscreen(true))
          .catch(() => {
            setIsLightboxFullscreen(true);
          });
        return;
      }
    }
    setIsLightboxFullscreen(true);
  }, [isFullscreen]);

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
          if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
            if (document.exitFullscreen) {
              document.exitFullscreen().catch(() => {});
            } else if ((document as any).webkitExitFullscreen) {
              (document as any).webkitExitFullscreen();
            }
          }
          setIsLightboxFullscreen(false);
          setIsNativeFullscreen(false);
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
  }, [isOpen, onClose, isFullscreen, toggleFullscreen, handleNext, handlePrev]);

  // Touch Swipe for mobile image browsing with pinch-to-zoom protection
  const handleTouchStart = (e: React.TouchEvent) => {
    // Abort if multi-touch (e.g. pinch-to-zoom gesture)
    if (e.touches.length > 1) {
      if (touchStateRef.current) {
        touchStateRef.current.isMultiTouch = true;
      }
      setTouchDeltaX(0);
      return;
    }

    // Only enable swipe navigation when scale is 1x (not zoomed)
    if (isZoomed) {
      touchStateRef.current = null;
      return;
    }

    const t = e.touches[0];
    touchStateRef.current = {
      startX: t.clientX,
      startY: t.clientY,
      currentX: t.clientX,
      currentY: t.clientY,
      time: performance.now(),
      isMultiTouch: false,
    };
    setTouchDeltaX(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStateRef.current || touchStateRef.current.isMultiTouch || isZoomed) return;

    if (e.touches.length > 1) {
      touchStateRef.current.isMultiTouch = true;
      setTouchDeltaX(0);
      return;
    }

    const t = e.touches[0];
    touchStateRef.current.currentX = t.clientX;
    touchStateRef.current.currentY = t.clientY;

    const dx = t.clientX - touchStateRef.current.startX;
    const dy = t.clientY - touchStateRef.current.startY;

    // Interactive horizontal elastic offset feedback when swiping horizontally
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 12) {
      setTouchDeltaX(Math.max(-100, Math.min(100, dx * 0.35)));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const state = touchStateRef.current;
    touchStateRef.current = null;
    setTouchDeltaX(0);

    if (!state || state.isMultiTouch || isZoomed) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - state.startX;
    const dy = t.clientY - state.startY;
    const dt = performance.now() - state.time;

    // 1. Swipe down to dismiss (if vertical downward motion > 120px and not horizontal)
    if (dy > 120 && Math.abs(dx) < 60 && dt < 450) {
      onClose();
      return;
    }

    // 2. Horizontal swipe navigation: Swiping Left (dx < -50px) -> Next; Swiping Right (dx > 50px) -> Prev
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < -50) {
        handleNext();
      } else if (dx > 50) {
        handlePrev();
      }
    }
  };

  const handleDownload = useCallback(async () => {
    if (!activeUrl || isDownloading) return;
    setIsDownloading(true);
    setDownloadSuccess(false);
    try {
      const dlUrl = getMediaUrl(activeUrl);
      if (type === 'video') {
        await downloadBrandedVideo(dlUrl, activeTitle, 'clip');
      } else {
        await applyWatermarkAndDownload(dlUrl, activeTitle);
      }
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2200);
    } catch (err) {
      console.warn('Watermark download error, fallback to downloadMedia:', err);
      const dlUrl = getMediaUrl(activeUrl);
      await downloadMedia(dlUrl, activeTitle, type === 'video' ? 'clip' : 'photo');
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2200);
    } finally {
      setIsDownloading(false);
    }
  }, [activeUrl, activeTitle, type, isDownloading]);

  if (!isOpen || !activeUrl) return null;

  const secureUrl = activeUrl.replace(/^http:\/\//i, 'https://');
  const cleanTitle = sanitizeMediaTitle(activeTitle, type === 'video' ? 'Video' : 'Photograph');

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 w-screen h-[100dvh] overflow-hidden z-[120] flex flex-col md:flex-row bg-[#030305]/95 backdrop-blur-2xl select-none animate-fade-in touch-none touch-action-none overscroll-contain"
      onClick={onClose}
    >
      {/* 1. Left Pane: Primary Media Stage (~65-70% desktop width, 100% mobile) */}
      <div className="flex-1 relative flex flex-col justify-between overflow-hidden h-full min-h-[50vh] md:min-h-0 bg-[#030305]">
        {/* Floating Top HUD */}
        <div
          className="relative z-40 p-4 pt-[max(1rem,env(safe-area-inset-top))] flex justify-center pointer-events-none flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="glass-pill pointer-events-auto flex items-center justify-between gap-3 px-4 py-2 w-full max-w-4xl shadow-[0_8px_32px_rgba(0,0,0,0.8)]">
            {/* Left: Title & Counter */}
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <span className="text-xs sm:text-sm font-bold font-sans text-zinc-200 uppercase tracking-wider truncate max-w-[150px] sm:max-w-md">
                {cleanTitle}
              </span>
              {hasItemList && (
                <span className="text-[10px] sm:text-xs font-mono font-semibold text-[#00D2FF] bg-[#00D2FF]/10 px-2 py-0.5 rounded-full flex-shrink-0 border border-[#00D2FF]/20">
                  {activeIdx + 1} / {items.length}
                </span>
              )}
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {type === 'image' && (
                <button
                  type="button"
                  onClick={() => setIsZoomed(!isZoomed)}
                  className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  title={isZoomed ? 'Zoom Out (100%)' : 'Zoom In (165%)'}
                >
                  {isZoomed ? <ZoomOut className="w-4 h-4 text-[#00D2FF]" /> : <ZoomIn className="w-4 h-4" />}
                </button>
              )}

              <button
                type="button"
                onClick={handleDownload}
                disabled={isDownloading}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-brand tracking-wider transition-all cursor-pointer ${
                  downloadSuccess
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                    : 'bg-white/5 hover:bg-white/10 text-zinc-200 hover:text-white border border-white/10'
                } disabled:opacity-40`}
                title="1-Click Download"
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

              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title={isFullscreen ? 'Exit Full Screen' : 'View Full Screen'}
              >
                {isFullscreen ? <Minimize className="w-4 h-4 text-[#00D2FF]" /> : <Maximize className="w-4 h-4" />}
              </button>

              {/* Sidebar Queue Toggle */}
              {hasItemList && (
                <button
                  type="button"
                  onClick={() => setShowSidebar(!showSidebar)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold font-sans tracking-wider border transition-all cursor-pointer ${
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
              className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 z-40 p-3 sm:p-3.5 rounded-full bg-black/70 hover:bg-black/90 text-white backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.85)] hover:border-[#00D2FF]/60 hover:shadow-[0_0_20px_rgba(0,210,255,0.35)] transition-all cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
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
              className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 z-40 p-3 sm:p-3.5 rounded-full bg-black/70 hover:bg-black/90 text-white backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.85)] hover:border-[#00D2FF]/60 hover:shadow-[0_0_20px_rgba(0,210,255,0.35)] transition-all cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
              title="Next (Right Arrow)"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </>
        )}

        {/* Main Media Stage */}
        <div
          ref={mediaBoxRef}
          className={`flex-1 relative w-full h-full flex items-center justify-center p-3 sm:p-6 md:p-8 transition-all overflow-hidden ${
            isLightboxFullscreen ? 'is-fullscreen lightbox-fullscreen-active' : ''
          }`}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
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
                onClick={() => setIsZoomed(!isZoomed)}
                style={{
                  transform: isZoomed
                    ? 'scale(1.65)'
                    : touchDeltaX !== 0
                    ? `translateX(${touchDeltaX}px)`
                    : 'none',
                  transition: touchDeltaX !== 0 ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
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

      {/* 2. Slide-out Queue & Suggestions Drawer (Overlay with Backdrop) */}
      {showSidebar && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in pointer-events-auto"
          onClick={() => setShowSidebar(false)}
        >
          <div
            className="h-full max-h-screen flex shadow-2xl animate-slide-left pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CyberMediaSidebar
              items={items}
              activeItem={currentItem}
              activeIdx={activeIdx}
              onSelectItem={(_, idx) => {
                setActiveIdx(idx);
                setIsZoomed(false);
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
