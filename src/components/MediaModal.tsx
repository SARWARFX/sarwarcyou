import React, { useEffect } from 'react';
import { X, ExternalLink } from 'lucide-react';

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

  // Ensure Google Drive URL is iframe embeddable
  let streamUrl = url;
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
      {/* Top action bar */}
      <div className="absolute top-4 sm:top-6 right-4 sm:right-6 flex items-center gap-3 z-[110]">
        <a
          href={url}
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
        className="relative w-full max-w-5xl max-h-[85vh] rounded-2xl overflow-hidden bg-black/95 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.9)] flex flex-col items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between text-xs font-mono text-white/60">
          <span className="truncate max-w-[80%] font-bold text-white uppercase tracking-wider">{displayTitle}</span>
          <span className="text-[#00D2FF] font-semibold">{type === 'video' ? 'STREAMING 1080P' : 'HIGH DEFINITION'}</span>
        </div>

        {type === 'video' ? (
          <div className="w-full aspect-video bg-black flex items-center justify-center">
            <iframe
              src={streamUrl}
              className="w-full h-full border-0"
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              title={title || 'Media Stream'}
            />
          </div>
        ) : (
          <div className="relative w-full h-[78vh] flex items-center justify-center p-2 sm:p-4 bg-black/50">
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
                  className="max-w-full max-h-full object-contain rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-white/5"
                  onError={(e) => {
                    // Fallback to Drive preview iframe if direct image loading is restricted
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
