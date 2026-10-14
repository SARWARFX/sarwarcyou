import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ExternalLink, ZoomIn, ZoomOut, Download, Loader2, Maximize, Minimize, Check } from 'lucide-react';
import { downloadMedia, downloadBrandedVideo, applyWatermarkAndDownload } from '../utils/downloadMedia';
import { getMediaUrl } from '../utils/imageUrlResolver';

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

  // Dock global site header to top-left when media viewer is active
  useEffect(() => {
    const header = document.getElementById('global-site-header');
    if (isOpen) {
      document.body.classList.add('viewing-media');
      if (header) header.classList.add('docked-left');
    } else {
      document.body.classList.remove('viewing-media');
      if (header) header.classList.remove('docked-left');
    }
    return () => {
      document.body.classList.remove('viewing-media');
      const h = document.getElementById('global-site-header');
      if (h) h.classList.remove('docked-left');
    };
  }, [isOpen]);

  const handleDownload = useCallback(async () => {
    if (!url || isDownloading) return;
    setIsDownloading(true);
    try {
      const dlUrl = getMediaUrl(url);
      if (type === 'video') {
        await downloadBrandedVideo(dlUrl, title);
      } else {
        await applyWatermarkAndDownload(dlUrl, title);
      }
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2000);
    } catch (err) {
      console.warn('Watermarking download error, fallback to downloadMedia:', err);
      const dlUrl = getMediaUrl(url);
      await downloadMedia(dlUrl, title);
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
      {/* ===== TOP STATUS / ACTION BAR (SSOT: Brand logo provided by #global-site-header) ===== */}
      <div
        className="viewer-top-bar player-header-bar fixed top-0 left-0 right-0 w-full bg-black/85 backdrop-blur-xl border-none"
        onClick={(e) => e.stopPropagation()}
      >
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
          isLightboxFullscreen ? 'is-fullscreen lightbox-fullscreen-active' : 'mt-12 sm:mt-14'
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
            {streamUrl.includes('media.sarwar.cyou') || streamUrl.includes('huggingface.co') || streamUrl.endsWith('.mp4') ? (
              <video
                src={getMediaUrl(streamUrl)}
                controls
                autoPlay
                preload="metadata"
                playsInline
                {...{ 'webkit-playsinline': 'true' }}
                crossOrigin="anonymous"
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
                : getMediaUrl(url);

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
