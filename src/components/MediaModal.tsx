import React, { useEffect, useState } from 'react';
import { X, ExternalLink, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { downloadMedia } from '../utils/downloadMedia';

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
  const [prevMediaKey, setPrevMediaKey] = useState({ url, isOpen });
  if (prevMediaKey.url !== url || prevMediaKey.isOpen !== isOpen) {
    setPrevMediaKey({ url, isOpen });
    setIsZoomed(false);
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
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
  }, [isOpen, onClose]);

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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92 backdrop-blur-2xl p-3 sm:p-6 md:p-10 animate-fade-in"
      onClick={onClose}
    >
      {/* Mobile: Top-Left Homepage Link with Tri-Fold Delta Logo */}
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        className="flex md:hidden absolute top-4 sm:top-6 left-4 sm:left-6 brand-lockup items-center gap-[10px] m-0 p-0 select-none cursor-pointer group z-[110] border-none outline-none"
        title="Return to Home"
        aria-label="Return to Home"
      >
        <svg
          className="brand-delta-logo w-[32px] h-[32px] sm:w-[36px] sm:h-[36px] flex-shrink-0 overflow-visible transition-transform duration-300 group-hover:scale-105"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block', flexShrink: 0 }}
        >
          <defs>
            <linearGradient id="modal-mobile-brand-dynamic-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ffffff" />
              <stop className="svg-gradient-mid" offset="50%" stop-color="hsl(205, 100%, 65%)" />
              <stop offset="100%" stop-color="#ffffff" />
            </linearGradient>
          </defs>
          <path d="M 50,6 L 62,28 L 47,56 L 31,56 Z" fill="url(#modal-mobile-brand-dynamic-gradient)" />
          <path d="M 24,67 L 41,67 L 54,92 L 11,92 L 24,67 Z M 44,67 L 58,41 L 69,61 L 55,61 Z" fill="url(#modal-mobile-brand-dynamic-gradient)" />
          <path d="M 64,19 L 50,46 L 63,69 L 89,92 L 100,92 Z" fill="url(#modal-mobile-brand-dynamic-gradient)" />
        </svg>
        <h1 className="brand-title font-brand font-black select-none leading-none whitespace-nowrap m-0 p-0 flex items-center">
          SARWARCYOU
        </h1>
      </a>

      {/* Desktop: Centered Website Logo & Wordmark (Hidden on Mobile) */}
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        className="hidden md:flex absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 brand-lockup items-center justify-center gap-[10px] m-0 p-0 select-none cursor-pointer group z-[110] border-none outline-none"
        title="Return to Home"
        aria-label="Return to Home"
      >
        <svg
          className="brand-delta-logo w-[38px] h-[38px] sm:w-[42px] sm:h-[42px] flex-shrink-0 overflow-visible transition-transform duration-300 group-hover:scale-105"
          viewBox="0 0 100 100"
          width="42"
          height="42"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block', flexShrink: 0 }}
        >
          <defs>
            <linearGradient id="modal-desktop-brand-dynamic-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#ffffff" />
              <stop className="svg-gradient-mid" offset="50%" stop-color="hsl(205, 100%, 65%)" />
              <stop offset="100%" stop-color="#ffffff" />
            </linearGradient>
          </defs>
          <path d="M 50,6 L 62,28 L 47,56 L 31,56 Z" fill="url(#modal-desktop-brand-dynamic-gradient)" />
          <path d="M 24,67 L 41,67 L 54,92 L 11,92 L 24,67 Z M 44,67 L 58,41 L 69,61 L 55,61 Z" fill="url(#modal-desktop-brand-dynamic-gradient)" />
          <path d="M 64,19 L 50,46 L 63,69 L 89,92 L 100,92 Z" fill="url(#modal-desktop-brand-dynamic-gradient)" />
        </svg>
        <h1 className="brand-title font-brand font-black select-none leading-none whitespace-nowrap m-0 p-0 flex items-center group-hover:opacity-90 transition-opacity">
          SARWARCYOU
        </h1>
      </a>

      {/* Top action bar */}
      <div className="absolute top-4 sm:top-6 right-4 sm:right-6 flex items-center gap-3 z-[110]">
        {type === 'image' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsZoomed(!isZoomed);
            }}
            className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white cursor-pointer"
            title={isZoomed ? 'Zoom Out' : 'Zoom In'}
          >
            {isZoomed ? <ZoomOut className="w-5 h-5" /> : <ZoomIn className="w-5 h-5" />}
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (url) downloadMedia(url, title);
          }}
          className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white cursor-pointer"
          title="Download original file"
        >
          <Download className="w-5 h-5" />
        </button>
        <a
          href={secureUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
          title="Open in new tab"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-5 h-5" />
        </a>
        <button
          onClick={onClose}
          className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white cursor-pointer"
          title="Close player (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main player box */}
      <div
        className="relative w-full max-w-5xl max-h-[85vh] rounded-2xl overflow-hidden bg-black/95 shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full px-5 py-3 bg-white/[0.02] flex items-center justify-between text-xs font-mono text-white/60">
          <span className="truncate max-w-[80%] font-bold text-white uppercase tracking-wider">{displayTitle}</span>
          <span className="text-[#00D2FF] font-semibold">{type === 'video' ? 'STREAMING 1080P' : (isZoomed ? 'ZOOMED 160%' : 'HIGH DEFINITION')}</span>
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
