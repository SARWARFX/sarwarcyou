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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-xl p-3 sm:p-6 md:p-10 animate-fade-in"
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
        {title && (
          <div className="w-full px-5 py-3 border-b border-white/10 bg-white/[0.02] flex items-center justify-between text-xs font-mono text-white/60">
            <span className="truncate max-w-[80%] font-bold text-white uppercase">{title}</span>
            <span className="text-cyan-400">STREAMING</span>
          </div>
        )}

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
          <div className="relative w-full h-[75vh] flex items-center justify-center p-4 bg-black">
            <img
              src={url}
              alt={title || 'Media Image'}
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        )}
      </div>
    </div>
  );
};
