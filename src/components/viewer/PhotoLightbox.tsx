import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ExternalLink,
  Download,
} from 'lucide-react';
import type { MediaItem } from '../../models/media';

export interface PhotoLightboxProps {
  item: MediaItem;
  items: MediaItem[];
  onClose: () => void;
  onNavigate: (item: MediaItem) => void;
}

export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({
  item,
  items,
  onClose,
  onNavigate,
}) => {
  const [scale, setScale] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);

  const currentIndex = items.findIndex((i) => i.id === item.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1 && currentIndex !== -1;

  // Reset zoom on item change
  useEffect(() => {
    setScale(1);
    setIsLoaded(false);
  }, [item.id]);

  const handlePrev = useCallback(() => {
    if (hasPrev) {
      onNavigate(items[currentIndex - 1]);
    }
  }, [hasPrev, currentIndex, items, onNavigate]);

  const handleNext = useCallback(() => {
    if (hasNext) {
      onNavigate(items[currentIndex + 1]);
    }
  }, [hasNext, currentIndex, items, onNavigate]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          handlePrev();
          break;
        case 'ArrowRight':
          handleNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handlePrev, handleNext]);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col justify-between select-none animate-in fade-in duration-200">
      {/* Top Header Controls */}
      <div className="p-4 sm:p-6 flex items-center justify-between z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white max-w-sm sm:max-w-md truncate">
              {item.title}
            </h3>
            <p className="text-xs font-mono text-zinc-400">
              {currentIndex !== -1 ? `${currentIndex + 1} of ${items.length}` : ''}
              {item.albumTitle ? ` • ${item.albumTitle}` : ''}
            </p>
          </div>
        </div>

        {/* Zoom & Action Tools */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono text-zinc-400 w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(3, s + 0.25))}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setScale(1)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition cursor-pointer"
            title="Reset Zoom"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <a
            href={item.mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white transition cursor-pointer"
            title="Open Original"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
          <a
            href={item.mediaUrl}
            download
            className="p-2 rounded-lg bg-[#00E5FF]/20 hover:bg-[#00E5FF]/30 text-[#00E5FF] transition cursor-pointer"
            title="Download Image"
          >
            <Download className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Main Image Viewport with Next/Prev Buttons */}
      <div className="relative flex-1 flex items-center justify-center p-4 overflow-hidden">
        {/* Previous Button */}
        {hasPrev && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 transition cursor-pointer"
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* The Image */}
        <div
          className="transition-transform duration-200 ease-out max-w-full max-h-full flex items-center justify-center"
          style={{ transform: `scale(${scale})` }}
        >
          <img
            src={item.mediaUrl}
            alt={item.title}
            onLoad={() => setIsLoaded(true)}
            className={`max-w-full max-h-[85vh] object-contain transition-opacity duration-300 rounded-lg shadow-2xl ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </div>

        {/* Next Button */}
        {hasNext && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 p-3 rounded-full bg-black/60 hover:bg-black/90 text-white border border-white/20 transition cursor-pointer"
            title="Next (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom Thumbnail Strip */}
      <div className="p-4 z-10 bg-gradient-to-t from-black/90 to-transparent overflow-x-auto flex items-center justify-center gap-2 max-w-full">
        {items.map((thumb) => {
          const isSelected = thumb.id === item.id;
          return (
            <button
              key={thumb.id}
              type="button"
              onClick={() => onNavigate(thumb)}
              className={`relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition cursor-pointer ${
                isSelected
                  ? 'border-[#00E5FF] scale-105 shadow-[0_0_12px_rgba(0,229,255,0.6)]'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={thumb.thumbnailUrl || thumb.mediaUrl}
                alt={thumb.title}
                loading="lazy"
                className="w-full h-full object-cover"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};
