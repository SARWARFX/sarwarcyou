import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ExternalLink, ZoomIn, ZoomOut, Download, Loader2, Maximize, Minimize, Check } from 'lucide-react';
import { downloadMedia, downloadBrandedVideo } from '../utils/downloadMedia';

interface MediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string | null;
  type: 'video' | 'image';
  title?: string;
}

export const MediaModal: React.FC<MediaModalProps> = ({
  isOpen,
  onClose,
  url,
  type,
  title,
}) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isLightboxFullscreen, setIsLightboxFullscreen] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const isFullscreen = isNativeFullscreen || isLightboxFullscreen;

  const mediaBoxRef = useRef<HTMLDivElement>(null);

  const [prevMediaKey, setPrevMediaKey] = useState({ url, isOpen });
  if (prevMediaKey.url !== url || prevMediaKey.isOpen !== isOpen) {
    setPrevMediaKey({ url, isOpen });
    setIsZoomed(false);
  }

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
    // Mobile fallback (iOS Safari, etc.)
    setIsLightboxFullscreen(true);
  }, [isFullscreen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
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
      } else if ((e.key === 'f' || e.key === 'F') && isOpen) {
        toggleFullscreen();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, isFullscreen, toggleFullscreen]);

  const handleDownload = useCallback(async () => {
    if (!url || isDownloading) return;
    setIsDownloading(true);
    try {
      if (type === 'video') {
        await downloadBrandedVideo(url, title);
      } else {
        await downloadMedia(url, title);
      }
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    } finally {
      setIsDownloading(false);
    }
  }, [url, title, type, isDownloading]);

  if (!isOpen || !url) return null;

  // Enforce HTTPS
  const secureUrl = url.replace(/^http:\/\//i, 'https://');

  // Ensure Google Drive URL is iframe embeddable
  let streamUrl = secureUrl;
  if (streamUrl.includes('drive.google.com') && !streamUrl.includes('/preview')) {
    streamUrl = streamUrl.replace(/\/view(\?.*)?$/, '/preview');
    if (!streamUrl.includes('/preview')) {
      streamUrl = streamUrl.replace(/\?usp=.*$/, '') + '/preview';
    }
  }

  // Clean up title to remove raw camera/screenshot filenames
  const cleanTitle = title
    ? title.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim()
    : type === 'video' ? 'VIDEO STREAM' : 'PORTRAIT VIEW';
  const displayTitle = /^smartselect|videocapture|screenshot|photo\s+[a-z0-9]/i.test(cleanTitle)
    ? (type === 'video' ? 'VIDEO STREAM' : 'PORTRAIT VIEW')
    : cleanTitle;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-2xl p-3 sm:p-6 md:p-10 select-none overflow-hidden animate-fade-in"
      onClick={onClose}
    >
      {/* ===== TOP STATUS / ACTION BAR (EXACTLY ONE BRAND LOCKUP + CONTROLS) ===== */}
      <div
        className="fixed top-0 left-0 right-0 w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-black/85 backdrop-blur-xl flex items-center justify-between text-xs font-mono z-[110] border-b border-white/[0.06]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left: EXACTLY ONE Single Brand Lockup + Dedicated Metadata Section */}
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onClose();
            }}
            className="brand-lockup flex items-center gap-[10px] m-0 p-0 select-none cursor-pointer group border-none outline-none flex-shrink-0"
            title="Return to Home"
            aria-label="Return to Home"
          >
            <svg
              className="brand-delta-logo w-[32px] h-[32px] sm:w-[38px] sm:h-[38px] flex-shrink-0 overflow-visible transition-transform duration-300 group-hover:scale-105"
              viewBox="0 0 100 100"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ display: 'block', flexShrink: 0 }}
            >
              <defs>
                <linearGradient id="media-modal-brand-dynamic-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#ffffff" />
                  <stop className="svg-gradient-mid" offset="50%" stop-color="hsl(205, 100%, 65%)" />
                  <stop offset="100%" stop-color="#ffffff" />
                </linearGradient>
              </defs>
              <path d="M 50,6 L 62,28 L 47,56 L 31,56 Z" fill="url(#media-modal-brand-dynamic-gradient)" />
              <path d="M 24,67 L 41,67 L 54,92 L 11,92 L 24,67 Z M 44,67 L 58,41 L 69,61 L 55,61 Z" fill="url(#media-modal-brand-dynamic-gradient)" />
              <path d="M 64,19 L 50,46 L 63,69 L 89,92 L 100,92 Z" fill="url(#media-modal-brand-dynamic-gradient)" />
            </svg>
            <h1 className="brand-title font-brand font-black select-none leading-none whitespace-nowrap m-0 p-0 flex items-center text-sm sm:text-base md:text-lg">
              SARWARCYOU
            </h1>
          </a>

          {/* Dedicated Media Metadata (Pill & Clean Title) Beside Brand */}
          <div className="flex items-center gap-2 min-w-0 pl-2 sm:pl-3 border-l border-white/10 truncate">
            <span className="px-2 py-0.5 rounded-lg bg-zinc-900/80 text-zinc-300 font-bold tracking-wide text-xs uppercase flex-shrink-0">
              {type === 'video' ? 'Video' : 'Photo'}
            </span>
            <span className="text-zinc-400 font-medium truncate hidden sm:inline text-xs max-w-[180px] md:max-w-md">
              {displayTitle}
            </span>
          </div>
        </div>

        {/* Right: Actions (Zoom, Download, External Link, Prominent View Full Screen - NO Close Button) */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 ml-auto">
          {type === 'image' && (
            <button
              onClick={() => setIsZoomed(!isZoomed)}
              className="p-2 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-100 transition-colors duration-200 cursor-pointer"
              title={isZoomed ? 'Zoom out (100%)' : 'Zoom in (165%)'}
            >
              {isZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
            </button>
          )}

          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold font-brand tracking-wider transition-all duration-200 cursor-pointer ${
              downloadSuccess
                ? 'bg-emerald-950/80 text-emerald-300'
                : 'bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-200 hover:text-white'
            } disabled:opacity-40`}
            title="Direct Media Download"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline">SAVED</span>
              </>
            ) : (
              <>
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">
                  {isDownloading ? 'DOWNLOADING...' : 'DOWNLOAD'}
                </span>
              </>
            )}
          </button>

          <a
            href={secureUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-100 transition-colors duration-200 cursor-pointer"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          {/* Prominent View Full Screen Button (Replaces Close Button) */}
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-800/80 text-zinc-200 hover:text-white text-xs sm:text-sm font-bold font-brand tracking-wider transition-all duration-200 cursor-pointer"
            title={isFullscreen ? 'Exit Full Screen' : 'View Full Screen'}
          >
            {isFullscreen ? (
              <>
                <Minimize className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">EXIT FULLSCREEN</span>
              </>
            ) : (
              <>
                <Maximize className="w-4 h-4 text-cyan-400" />
                <span className="hidden sm:inline">VIEW FULL SCREEN</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main player box */}
      <div
        ref={mediaBoxRef}
        onDoubleClick={toggleFullscreen}
        className={`relative w-full max-w-5xl max-h-[85vh] rounded-2xl overflow-hidden bg-black/95 shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col items-center justify-center transition-all ${
          isLightboxFullscreen ? 'lightbox-fullscreen-active' : 'mt-12 sm:mt-14'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {isLightboxFullscreen && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            className="absolute top-4 right-4 z-[999999] px-3 py-1.5 rounded-full bg-black/80 hover:bg-black text-white text-xs font-mono font-bold tracking-wider border border-white/20 backdrop-blur-md shadow-2xl transition-all flex items-center gap-1.5 cursor-pointer"
            title="Exit Fullscreen"
          >
            <Minimize className="w-3.5 h-3.5 text-cyan-400" />
            <span>EXIT FULLSCREEN</span>
          </button>
        )}

        <div className="w-full px-5 py-3 bg-white/[0.02] flex items-center justify-between text-xs font-mono text-white/60">
          <span className="truncate max-w-[80%] font-bold text-white uppercase tracking-wider">{displayTitle}</span>
          <span className="text-[#00D2FF] font-semibold">{type === 'video' ? 'STREAMING 1080P' : (isZoomed ? 'ZOOMED 165%' : 'HIGH DEFINITION')}</span>
        </div>

        {type === 'video' ? (
          <div className="w-full aspect-video bg-black flex items-center justify-center">
            {streamUrl.includes('huggingface.co') || streamUrl.endsWith('.mp4') ? (
              <video
                src={streamUrl}
                controls
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            ) : (
              <iframe
                src={streamUrl}
                className="w-full h-full border-0"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                title={title || 'Media Stream'}
              />
            )}
          </div>
        ) : (
          <div className="relative w-full h-[78vh] flex items-center justify-center p-2 sm:p-4 bg-black/50 overflow-hidden">
            {/* If Google Drive file ID is present, use high-res direct image CDN */}
            {(() => {
              const driveIdMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
              const driveId = driveIdMatch ? driveIdMatch[1] : null;
              const directImgUrl = driveId
                ? `https://lh3.googleusercontent.com/u/0/d/${driveId}=w2560`
                : url;

              return (
                <img
                  src={directImgUrl}
                  alt={title || 'Photo Lightbox'}
                  onClick={() => setIsZoomed(!isZoomed)}
                  className={`max-w-full max-h-full object-contain rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-white/5 transition-transform duration-300 ${
                    isZoomed ? 'scale-[1.65] cursor-zoom-out' : 'scale-100 cursor-zoom-in'
                  }`}
                  onError={(e) => {
                    const parent = e.currentTarget.parentElement;
                    if (parent && streamUrl) {
                      e.currentTarget.style.display = 'none';
                      const iframe = document.createElement('iframe');
                      iframe.src = streamUrl;
                      iframe.className = 'w-full h-full border-0 rounded-xl';
                      iframe.allow = 'fullscreen';
                      parent.appendChild(iframe);
                    }
                  }}
                />
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
