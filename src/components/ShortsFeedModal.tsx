import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, ChevronUp, ChevronDown, Download, VolumeX, Volume2 } from 'lucide-react';
import type { StageMediaItem } from '../types';
import { downloadMedia } from '../utils/downloadMedia';

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
  const [isMuted, setIsMuted] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const isNavigatingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [prevProps, setPrevProps] = useState({ initialIndex, isOpen });
  if (prevProps.initialIndex !== initialIndex || prevProps.isOpen !== isOpen) {
    setPrevProps({ initialIndex, isOpen });
    setCurrentIndex(initialIndex);
  }

  const handleNext = useCallback(() => {
    if (currentIndex < shorts.length - 1) setCurrentIndex(prev => prev + 1);
  }, [currentIndex, shorts.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
  }, [currentIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); }
      else if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); handleNext(); }
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); handlePrev(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleNext, handlePrev]);

  const touchStartYRef = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => { touchStartYRef.current = e.touches[0].clientY; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartYRef.current - e.changedTouches[0].clientY;
    if (Math.abs(diff) > 45) {
      if (diff > 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
  };

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

  const handleDownload = useCallback(async () => {
    if (!shorts[currentIndex] || isDownloading) return;
    setIsDownloading(true);
    try {
      const item = shorts[currentIndex];
      await downloadMedia(item.url, item.title || item.id);
    } finally {
      setTimeout(() => setIsDownloading(false), 1200);
    }
  }, [currentIndex, shorts, isDownloading]);

  if (!isOpen || !shorts.length) return null;

  const currentShort = shorts[currentIndex] || shorts[0];
  const secureUrl = (currentShort.url || '').replace(/^http:\/\//i, 'https://');
  let streamUrl = secureUrl;
  if (streamUrl.includes('drive.google.com') && !streamUrl.includes('/preview')) {
    streamUrl = streamUrl.replace(/\/view(\?.*)?$/, '/preview');
  }

  const cleanTitle = currentShort.title
    ? currentShort.title.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim()
    : 'Short Reel';
  const displayTitle = /^smartselect|videocapture|screenshot|photo\s+[a-z0-9]/i.test(cleanTitle)
    ? 'Vertical Short Reel'
    : cleanTitle;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/97 backdrop-blur-2xl select-none"
      onClick={onClose}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Top Floating Actions */}
      <div
        className="absolute top-4 right-4 sm:top-5 sm:right-5 flex items-center gap-2 z-[130]"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={() => {
            setIsMuted(m => {
              if (videoRef.current) videoRef.current.muted = !m;
              return !m;
            });
          }}
          className="p-2 rounded-lg bg-zinc-900/90 border border-white/[0.08] text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="p-2 rounded-lg bg-zinc-900/90 border border-white/[0.08] text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-40"
          title="Download reel"
        >
          <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
        </button>
        <button
          onClick={onClose}
          className="p-2 rounded-lg bg-zinc-900/90 border border-white/[0.08] text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          title="Close (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 9:16 Shorts Container */}
      <div
        className="relative aspect-[9/16] h-[90vh] max-h-[820px] max-w-[460px] rounded-2xl overflow-hidden bg-black border border-white/[0.08] shadow-2xl flex flex-col justify-between"
        onClick={e => e.stopPropagation()}
      >
        {/* Video */}
        <div className="absolute inset-0 w-full h-full bg-black z-0">
          {streamUrl.includes('huggingface.co') || streamUrl.endsWith('.mp4') ? (
            <video
              ref={videoRef}
              key={currentShort.id}
              src={streamUrl}
              autoPlay
              loop
              muted={isMuted}
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <iframe
              key={currentShort.id}
              src={streamUrl}
              className="w-full h-full border-0"
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              title={displayTitle}
            />
          )}
        </div>

        {/* Top gradient overlay */}
        <div className="relative z-10 p-4 bg-gradient-to-b from-black/70 to-transparent flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Reels</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            {(currentIndex + 1).toString().padStart(2, '0')} / {shorts.length.toString().padStart(2, '0')}
          </span>
        </div>

        {/* Bottom gradient overlay */}
        <div className="relative z-10 px-4 pb-5 pt-12 bg-gradient-to-t from-black/80 to-transparent pointer-events-none">
          <h2 className="text-sm font-medium text-zinc-100 truncate">{displayTitle}</h2>
          <div className="w-full h-[2px] rounded-full bg-zinc-800/60 overflow-hidden mt-3">
            <div
              className="h-full bg-zinc-400 transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / shorts.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Side nav arrows */}
      <div
        className="hidden sm:flex flex-col gap-2.5 ml-5 z-[130]"
        onClick={e => e.stopPropagation()}
      >
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="p-2.5 rounded-xl bg-zinc-900/90 border border-white/[0.08] text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
        >
          <ChevronUp className="w-4 h-4" />
        </button>
        <button
          onClick={handleNext}
          disabled={currentIndex >= shorts.length - 1}
          className="p-2.5 rounded-xl bg-zinc-900/90 border border-white/[0.08] text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 disabled:opacity-20 disabled:pointer-events-none transition-all cursor-pointer"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
