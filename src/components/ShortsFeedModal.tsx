import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronUp, ChevronDown, ExternalLink } from 'lucide-react';
import type { StageMediaItem } from '../types';

interface ShortsFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  shorts: StageMediaItem[];
  initialIndex: number;
}

export const ShortsFeedModal: React.FC<ShortsFeedModalProps> = ({
  isOpen,
  onClose,
  shorts,
  initialIndex,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const isNavigatingRef = useRef(false);

  const [prevProps, setPrevProps] = useState({ initialIndex, isOpen });
  if (prevProps.initialIndex !== initialIndex || prevProps.isOpen !== isOpen) {
    setPrevProps({ initialIndex, isOpen });
    setCurrentIndex(initialIndex);
  }

  const handleNext = useCallback(() => {
    if (currentIndex < shorts.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, shorts.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  // Keyboard navigation & Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrev();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, handleNext, handlePrev]);

  // Touch swipe support (Up = Next, Down = Prev)
  const touchStartYRef = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartYRef.current - touchEndY;
    if (Math.abs(diff) > 45) {
      if (diff > 0) {
        handleNext(); // Swiped up -> next short
      } else {
        handlePrev(); // Swiped down -> prev short
      }
    }
  };

  // Mouse wheel snap support
  const handleWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) > 30) {
      if (isNavigatingRef.current) return;
      isNavigatingRef.current = true;
      if (e.deltaY > 0) {
        handleNext();
      } else {
        handlePrev();
      }
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 550);
    }
  };

  if (!isOpen || !shorts.length) return null;

  const currentShort = shorts[currentIndex] || shorts[0];
  const secureUrl = (currentShort.url || '').replace(/^http:\/\//i, 'https://');

  // Convert Google Drive preview URL with autoplay
  let streamUrl = secureUrl;
  if (streamUrl.includes('drive.google.com')) {
    if (!streamUrl.includes('/preview')) {
      streamUrl = streamUrl.replace(/\/view(\?.*)?$/, '/preview');
    }
  }

  // Clean title without raw extensions
  const cleanTitle = currentShort.title
    ? currentShort.title.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim()
    : 'Short Reel';
  const displayTitle = /^smartselect|videocapture|screenshot|photo\s+[a-z0-9]/i.test(cleanTitle)
    ? 'VERTICAL SHORT REEL'
    : cleanTitle;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 backdrop-blur-2xl select-none"
      onClick={onClose}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Action Bar */}
      <div className="absolute top-5 right-5 sm:top-7 sm:right-7 flex items-center gap-3 z-[130]">
        <a
          href={secureUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
          title="Open in new tab"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-4 h-4" />
        </a>
        <button
          onClick={onClose}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          title="Close feed (Esc)"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main 9:16 Vertical Shorts Container */}
      <div
        className="relative aspect-[9/16] h-[90vh] max-h-[820px] max-w-[460px] rounded-3xl overflow-hidden bg-black border border-white/15 shadow-[0_0_60px_rgba(0,0,0,0.95)] flex flex-col justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Shorts Stream Video Frame */}
        <div className="absolute inset-0 w-full h-full bg-black z-0">
          <iframe
            key={currentShort.id}
            src={streamUrl}
            className="w-full h-full border-0"
            allow="autoplay; encrypted-media; fullscreen"
            allowFullScreen
            title={displayTitle}
          />
        </div>

        {/* Top Overlay Badge */}
        <div className="relative z-10 p-4 bg-gradient-to-b from-black/80 via-black/30 to-transparent flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00D2FF] animate-pulse" />
            <span className="text-[11px] font-mono font-bold tracking-widest text-[#00D2FF] uppercase">
              REELS FEED
            </span>
          </div>
          <span className="text-[11px] font-mono font-semibold text-white/70">
            {(currentIndex + 1).toString().padStart(2, '0')} / {shorts.length.toString().padStart(2, '0')}
          </span>
        </div>

        {/* Bottom Overlay Title & Navigation Hint */}
        <div className="relative z-10 p-5 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none flex flex-col gap-1.5">
          <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wide truncate drop-shadow-md">
            {displayTitle}
          </h2>
          <div className="text-[9px] font-mono text-white/50 tracking-widest uppercase flex items-center gap-1.5">
            <span>SWIPE UP/DOWN • ARROWS TO CYCLE</span>
          </div>

          {/* Micro Progress Bar */}
          <div className="w-full h-1 rounded-full bg-white/20 overflow-hidden mt-1.5">
            <div
              className="h-full bg-[#00D2FF] transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / shorts.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Floating Side Vertical Arrows for One-Click Snap */}
      <div
        className="hidden sm:flex flex-col gap-3 ml-6 z-[130]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          title="Previous Short (Up)"
          className="p-3 rounded-full bg-black/60 border border-white/15 text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:pointer-events-none transition-all active:scale-90 cursor-pointer shadow-xl backdrop-blur-md"
        >
          <ChevronUp className="w-5 h-5 text-[#00D2FF]" />
        </button>
        <button
          onClick={handleNext}
          disabled={currentIndex >= shorts.length - 1}
          title="Next Short (Down)"
          className="p-3 rounded-full bg-black/60 border border-white/15 text-white/80 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:pointer-events-none transition-all active:scale-90 cursor-pointer shadow-xl backdrop-blur-md"
        >
          <ChevronDown className="w-5 h-5 text-[#00D2FF]" />
        </button>
      </div>
    </div>
  );
};
