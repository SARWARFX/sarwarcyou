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
      {/* Mobile: Top-Left Homepage Link */}
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        className="flex md:hidden absolute top-4 sm:top-6 left-4 sm:left-6 items-center select-none cursor-pointer group z-[110]"
        title="Return to Home"
        aria-label="Return to Home"
      >
        <span className="font-brand font-black text-base sm:text-lg tracking-wider text-white whitespace-nowrap">
          SARWAR<span className="text-cyan-400">C</span>YOU
        </span>
      </a>

      {/* Desktop: Centered Website Wordmark (Hidden on Mobile) */}
      <a
        href="/"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        className="hidden md:flex absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 items-center select-none cursor-pointer group z-[110]"
        title="Return to Home"
        aria-label="Return to Home"
      >
        <span className="font-brand font-black tracking-widest text-2xl lg:text-3xl text-white uppercase truncate drop-shadow-md group-hover:opacity-90 transition-opacity">
          SARWAR<span className="text-cyan-400">C</span>YOU
        </span>
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
