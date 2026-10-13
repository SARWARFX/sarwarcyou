/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, ExternalLink, ZoomIn, ZoomOut, Play, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { getDirectImageUrl, ensureHttps } from '../utils/imageUrlResolver';
import type { AlbumData, StageMediaItem } from '../types';

interface YouTubeTheaterModalProps {
  isOpen: boolean;
  onClose: () => void;
  album: AlbumData | null;
  initialIndex: number;
  onNextAlbum?: () => void;
  onPrevAlbum?: () => void;
}

export const YouTubeTheaterModal: React.FC<YouTubeTheaterModalProps> = ({
  isOpen,
  onClose,
  album,
  initialIndex,
  onNextAlbum,
  onPrevAlbum,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isCrossfading, setIsCrossfading] = useState(false);

  const playlistContainerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef({ y: 0, time: 0 });

  // Sync index when initialIndex changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
    setIsZoomed(false);
  }, [initialIndex, isOpen]);

  const items = useMemo(() => album?.items || [], [album]);
  const currentItem: StageMediaItem | undefined = items[currentIndex] || items[0];

  // Keyboard navigation & Escape
  useEffect(() => {
    if (!isOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        goToIndex(currentIndex + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        goToIndex(currentIndex - 1);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, currentIndex, items.length, onClose]);

  const goToIndex = useCallback(
    (idx: number) => {
      if (items.length === 0) return;
      const next = (idx + items.length) % items.length;
      setIsCrossfading(true);
      setIsZoomed(false);
      setCurrentIndex(next);
      window.setTimeout(() => {
        setIsCrossfading(false);
      }, 250);
    },
    [items.length]
  );

  // Wheel handling: if user scrolls at outer boundaries, dismiss and elevator-slide to next/prev album
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      // Check if mouse is over scrollable playlist
      const playlist = playlistContainerRef.current;
      const isOverPlaylist = playlist && playlist.contains(e.target as Node);

      if (isOverPlaylist && playlist) {
        const atBottom = playlist.scrollTop + playlist.clientHeight >= playlist.scrollHeight - 5;
        const atTop = playlist.scrollTop <= 5;

        if (e.deltaY > 65 && atBottom) {
          // Scrolled past bottom of queue -> elevator down
          onClose();
          onNextAlbum?.();
        } else if (e.deltaY < -65 && atTop) {
          // Scrolled past top of queue -> elevator up
          onClose();
          onPrevAlbum?.();
        }
      } else {
        // Over main theater area
        if (e.deltaY > 65) {
          onClose();
          onNextAlbum?.();
        } else if (e.deltaY < -65) {
          onClose();
          onPrevAlbum?.();
        }
      }
    },
    [onClose, onNextAlbum, onPrevAlbum]
  );

  // Mobile Touch handling for dismiss
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = {
      y: e.touches[0].clientY,
      time: performance.now(),
    };
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const deltaY = touchStartRef.current.y - e.changedTouches[0].clientY;
      const elapsed = performance.now() - touchStartRef.current.time;

      if (elapsed < 350) {
        if (deltaY > 100) {
          onClose();
          onNextAlbum?.();
        } else if (deltaY < -100) {
          onClose();
          onPrevAlbum?.();
        }
      }
    },
    [onClose, onNextAlbum, onPrevAlbum]
  );

  if (!isOpen || !currentItem) return null;

  // Enforce secure HTTPS
  const rawUrl = ensureHttps(currentItem.url);
  let streamUrl = rawUrl;
  if (streamUrl.includes('drive.google.com') && !streamUrl.includes('/preview')) {
    streamUrl = streamUrl.replace(/\/view(\?.*)?$/, '/preview');
    if (!streamUrl.includes('/preview')) {
      streamUrl = streamUrl.replace(/\?usp=.*$/, '') + '/preview';
    }
  }

  const directImgUrl = getDirectImageUrl(currentItem, currentIndex);

  // Clean title for display
  const rawTitle = currentItem.title || '';
  const cleanTitle = rawTitle.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim() || (currentItem.type === 'video' ? 'CINEMA STREAM' : 'PHOTOGRAPHIC PRINT');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={cleanTitle}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-2xl animate-fade-in select-none overflow-hidden"
    >
      {/* ================= TOP THEATER CONTROLS BAR ================= */}
      <div className="w-full px-5 py-3.5 border-b border-white/10 bg-[#0d0f17] flex items-center justify-between text-xs font-mono z-30">
        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-full bg-[#00D2FF]/10 border border-[#00D2FF]/30 text-[#00D2FF] font-bold tracking-wider text-[10px] uppercase">
            {album?.name || 'ALBUM'}
          </span>
          <span className="text-white/40 hidden sm:inline">•</span>
          <span className="text-white/70 font-semibold tracking-wider hidden sm:inline">
            ITEM {String(currentIndex + 1).padStart(2, '0')} / {String(items.length).padStart(2, '0')}
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {currentItem.type === 'image' && (
            <button
              onClick={() => setIsZoomed(!isZoomed)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              title={isZoomed ? 'Zoom Out (100%)' : 'Zoom In (160%)'}
            >
              {isZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
            </button>
          )}

          <a
            href={rawUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            title="Open original file in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </a>

          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
            title="Close Theater (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ================= MAIN THEATER BODY (DESKTOP 70/30 | MOBILE STICKY TOP) ================= */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden p-3 sm:p-5 lg:p-6 gap-4 sm:gap-6">
        {/* ================= LEFT MAIN VIEWPORT (~70% DESKTOP) ================= */}
        <div className="w-full lg:w-[70%] h-[45vh] sm:h-[55vh] lg:h-full flex flex-col bg-[#08090e] rounded-2xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex-shrink-0">
          {/* Main Media Stage */}
          <div
            className={`relative flex-1 w-full bg-black flex items-center justify-center overflow-hidden transition-opacity duration-200 ${
              isCrossfading ? 'opacity-40' : 'opacity-100'
            }`}
          >
            {currentItem.type === 'video' ? (
              <iframe
                src={`${streamUrl}?autoplay=1`}
                className="w-full h-full border-0"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                title={cleanTitle}
              />
            ) : (
              <div
                onClick={() => setIsZoomed(!isZoomed)}
                className="w-full h-full flex items-center justify-center p-2 sm:p-4 cursor-pointer overflow-hidden"
              >
                <img
                  src={directImgUrl}
                  alt={cleanTitle}
                  className={`max-w-full max-h-full object-contain rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.9)] transition-transform duration-300 ${
                    isZoomed ? 'scale-[1.65] cursor-zoom-out' : 'scale-100 cursor-zoom-in'
                  }`}
                />
              </div>
            )}
          </div>

          {/* Under-player Editorial Metadata & Playlist Step */}
          <div className="px-5 py-3 border-t border-white/10 bg-[#0d0f17] flex items-center justify-between text-xs font-mono">
            <div className="truncate max-w-[70%]">
              <span className="font-space font-bold text-white text-sm tracking-wide uppercase block truncate">
                {cleanTitle}
              </span>
              <span className="text-white/40 text-[10px] tracking-wider uppercase block">
                {currentItem.type === 'video' ? 'STREAMING 1080P • FULL CINEMATIC SOUND' : (isZoomed ? 'ZOOMED 165% • LOSSLESS' : 'HIGH DEFINITION PHOTOGRAPH')}
              </span>
            </div>

            {/* Previous / Next buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => goToIndex(currentIndex - 1)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/15 text-white transition-colors cursor-pointer"
                title="Previous media (←)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => goToIndex(currentIndex + 1)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/15 text-white transition-colors cursor-pointer"
                title="Next media (→)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ================= RIGHT PLAYLIST QUEUE (~30% DESKTOP) ================= */}
        <div
          ref={playlistContainerRef}
          className="w-full lg:w-[30%] flex-1 lg:h-full flex flex-col bg-[#08090e] rounded-2xl border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.6)] overflow-hidden"
        >
          {/* Queue Header */}
          <div className="px-4 py-3 border-b border-white/10 bg-[#0d0f17] flex items-center justify-between font-mono text-[11px]">
            <span className="font-bold text-white tracking-wider uppercase">
              ALBUM PLAYLIST ({items.length})
            </span>
            <span className="text-[#00D2FF] text-[10px] tracking-widest uppercase flex items-center gap-1">
              <Check className="w-3 h-3" /> READY
            </span>
          </div>

          {/* Scrollable Playlist Cards */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 no-scrollbar">
            {items.map((item, idx) => {
              const isActive = idx === currentIndex;
              const thumbUrl = getDirectImageUrl(item, idx);
              const itemTitle = (item.title || `Media ${idx + 1}`)
                .replace(/\.[^/.]+$/, '')
                .replace(/[-_]+/g, ' ')
                .trim();

              return (
                <div
                  key={item.id || `queue-item-${idx}`}
                  onClick={() => goToIndex(idx)}
                  className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all duration-300 group ${
                    isActive
                      ? 'bg-[#00D2FF]/15 border border-[#00D2FF]/50 shadow-[0_0_25px_rgba(0,210,255,0.2)]'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="relative w-24 sm:w-28 aspect-video rounded-lg overflow-hidden bg-black flex-shrink-0 border border-white/10">
                    <img
                      src={thumbUrl}
                      alt={itemTitle}
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300 pointer-events-none"
                    />

                    {/* Active badge overlay */}
                    {isActive ? (
                      <div className="absolute inset-0 bg-[#00D2FF]/20 flex items-center justify-center">
                        <span className="px-1.5 py-0.5 rounded bg-[#00D2FF] text-black font-mono font-black text-[9px] tracking-widest uppercase">
                          PLAYING
                        </span>
                      </div>
                    ) : (
                      item.type === 'video' && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                          <Play className="w-3.5 h-3.5 text-white fill-current" />
                        </div>
                      )
                    )}
                  </div>

                  {/* Title & Metadata */}
                  <div className="flex-1 min-w-0">
                    <span
                      className={`font-space text-xs font-bold truncate block transition-colors ${
                        isActive ? 'text-[#00D2FF]' : 'text-white/80 group-hover:text-white'
                      }`}
                    >
                      {itemTitle}
                    </span>
                    <span className="text-[10px] font-mono text-white/40 tracking-wider uppercase block mt-0.5">
                      {String(idx + 1).padStart(2, '0')} • {item.type === 'video' ? 'CINEMA VIDEO' : 'PHOTOGRAPH'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer Drag Dismiss Notice */}
          <div className="px-4 py-2 border-t border-white/5 bg-[#0a0a0c] text-center text-[10px] font-mono tracking-widest text-white/30 uppercase">
            SCROLL PAST QUEUE TO ELEVATE
          </div>
        </div>
      </div>
    </div>
  );
};
