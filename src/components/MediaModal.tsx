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
} from 'lucide-react';
import { downloadMedia, downloadBrandedVideo, applyWatermarkAndDownload } from '../utils/downloadMedia';
import { getMediaUrl } from '../utils/imageUrlResolver';
import type { StageMediaItem } from '../types';

interface MediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string | null;
  type: 'video' | 'image';
  title?: string;
  items?: StageMediaItem[];
  currentIndex?: number;
  onIndexChange?: (newIndex: number) => void;
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
}) => {
  const [activeIdx, setActiveIdx] = useState<number>(propCurrentIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isLightboxFullscreen, setIsLightboxFullscreen] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const isFullscreen = isNativeFullscreen || isLightboxFullscreen;

  const mediaBoxRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

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

  // Keyboard navigation & gestures
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
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

    document.body.style.overflow = 'hidden';
    document.body.classList.add('viewing-media');
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = 'unset';
      document.body.classList.remove('viewing-media');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, isFullscreen, toggleFullscreen, handleNext, handlePrev]);

  // Touch Swipe for mobile image browsing
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = {
      x: t.clientX,
      y: t.clientY,
      time: performance.now(),
    };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || isZoomed) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    const dt = performance.now() - touchStartRef.current.time;

    // Swipe down to dismiss
    if (dy > 120 && Math.abs(dx) < 60 && dt < 400) {
      onClose();
      return;
    }

    // Horizontal swipe between photos
    if (Math.abs(dx) > 45 && Math.abs(dy) < 60) {
      if (dx < 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    touchStartRef.current = null;
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
  const cleanTitle = activeTitle
    ? activeTitle.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim()
    : 'Photograph';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[120] flex flex-col items-center justify-center bg-[#030305]/95 backdrop-blur-2xl select-none overflow-hidden animate-fade-in"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Floating Smoked Frosted Glass Top HUD */}
      <div
        className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="glass-pill pointer-events-auto flex items-center justify-between gap-3 px-4 py-2 w-full max-w-4xl shadow-[0_8px_32px_rgba(0,0,0,0.8)]">
          {/* Left: Title & Counter */}
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <span className="text-xs sm:text-sm font-bold font-sans text-zinc-200 uppercase tracking-wider truncate max-w-[200px] sm:max-w-md">
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
                onClick={() => setIsZoomed(!isZoomed)}
                className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title={isZoomed ? 'Zoom Out (100%)' : 'Zoom In (165%)'}
              >
                {isZoomed ? <ZoomOut className="w-4 h-4 text-[#00D2FF]" /> : <ZoomIn className="w-4 h-4" />}
              </button>
            )}

            <button
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
              onClick={toggleFullscreen}
              className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Full Screen' : 'View Full Screen'}
            >
              {isFullscreen ? <Minimize className="w-4 h-4 text-[#00D2FF]" /> : <Maximize className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-300 transition-colors cursor-pointer ml-1"
              title="Close Viewer (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Side Arrow Navigation (Desktop & Tablet) */}
      {hasItemList && items.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            disabled={activeIdx <= 0}
            className="fixed left-3 sm:left-6 top-1/2 -translate-y-1/2 z-50 p-3 sm:p-3.5 rounded-full glass-panel text-zinc-300 hover:text-white hover:border-[#00D2FF]/40 hover:shadow-[0_0_20px_rgba(0,210,255,0.25)] transition-all cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            disabled={activeIdx >= items.length - 1}
            className="fixed right-3 sm:right-6 top-1/2 -translate-y-1/2 z-50 p-3 sm:p-3.5 rounded-full glass-panel text-zinc-300 hover:text-white hover:border-[#00D2FF]/40 hover:shadow-[0_0_20px_rgba(0,210,255,0.25)] transition-all cursor-pointer disabled:opacity-20 disabled:pointer-events-none"
            title="Next (Right Arrow)"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </>
      )}

      {/* Main Image Stage */}
      <div
        ref={mediaBoxRef}
        className={`relative w-full h-full flex items-center justify-center p-3 sm:p-8 md:p-12 transition-all ${
          isLightboxFullscreen ? 'is-fullscreen lightbox-fullscreen-active' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
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
              className={`max-w-full max-h-[82vh] object-contain rounded-xl select-none transition-transform duration-300 ${
                isZoomed ? 'scale-[1.65] cursor-zoom-out' : 'scale-100 cursor-zoom-in'
              } drop-shadow-[0_15px_35px_rgba(0,0,0,0.85)]`}
              draggable={false}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaModal;
