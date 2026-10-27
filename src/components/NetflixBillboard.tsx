import React, { useState, useEffect, useMemo } from 'react';
import { Play, Folder, Sparkles } from 'lucide-react';
import type { StageMediaItem } from '../types';
import { getMediaUrl } from '../utils/imageUrlResolver';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';
import { isVideoExtension } from '../utils/mediaTypeDetector';

export interface NetflixBillboardProps {
  items?: StageMediaItem[];
  item?: StageMediaItem | null;
  onPlay: (item: StageMediaItem, playlistContext?: StageMediaItem[]) => void;
  onOpenAlbum?: (item: StageMediaItem) => void;
}

export const NetflixBillboard: React.FC<NetflixBillboardProps> = ({
  items,
  item,
  onPlay,
  onOpenAlbum,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Determine playlist: prioritize 10-video rotating playlist, fallback to single item
  const playlist = useMemo(() => {
    if (items && items.length > 0) return items;
    if (item) return [item];
    return [];
  }, [items, item]);

  // Keep currentIndex bounded
  const safeIndex = playlist.length > 0 ? currentIndex % playlist.length : 0;
  const currentItem = playlist[safeIndex] || null;

  // 10-second timer to auto-advance to next video across different folders
  useEffect(() => {
    if (playlist.length <= 1) return;

    const timer = setInterval(() => {
      handleNext();
    }, 10000);

    return () => clearInterval(timer);
  }, [playlist.length, safeIndex]);

  const handleNext = () => {
    if (playlist.length > 1) {
      setCurrentIndex((prev) => (prev + 1) % playlist.length);
    }
  };

  const handleSelectIndex = (idx: number) => {
    setCurrentIndex(idx);
  };

  if (!currentItem) return null;

  const isVideo =
    currentItem.type === 'video' ||
    currentItem.mediaType === 'clip' ||
    currentItem.mediaType === 'short' ||
    /\.(mp4|mov|webm)$/i.test(currentItem.url);

  const cleanTitle = sanitizeMediaTitle(currentItem.title || currentItem.name, currentItem.category);
  const mediaSrc = getMediaUrl(currentItem.url);
  const posterSrc = currentItem.thumbnail || currentItem.poster || mediaSrc;

  return (
    <div className="relative w-full h-[62vh] sm:h-[70vh] lg:h-[82vh] max-h-[760px] overflow-hidden select-none bg-black">
      {/* 1. Background Cinematic Visual: High-Res Backdrop / Poster */}
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#121420] via-[#090a0f] to-[#020204]">
        {posterSrc && !isVideoExtension(posterSrc) ? (
          <img
            key={currentItem.id || currentItem.url}
            src={posterSrc}
            alt={cleanTitle}
            loading="eager"
            className="w-full h-full object-cover object-center scale-105 filter brightness-80 animate-fade-in"
          />
        ) : (
          <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
            <div className="absolute w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute w-[350px] h-[350px] bg-blue-600/10 rounded-full blur-[80px] pointer-events-none translate-x-28 -translate-y-16" />
          </div>
        )}
      </div>

      {/* 2. Cinematic Gradient Overlays (Netflix Signature Fade) */}
      {/* Bottom fade into the carousel stream */}
      <div className="absolute inset-x-0 bottom-0 h-48 sm:h-64 bg-gradient-to-t from-[#030305] via-[#030305]/70 to-transparent z-10 pointer-events-none" />

      {/* Left vignette for text legibility */}
      <div className="absolute inset-y-0 left-0 w-full sm:w-3/4 lg:w-3/5 bg-gradient-to-r from-[#030305] via-[#030305]/80 md:via-[#030305]/40 to-transparent z-10 pointer-events-none" />

      {/* Top vignette for navbar contrast */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/80 via-black/30 to-transparent z-10 pointer-events-none" />

      {/* 3. Hero Metadata & Action CTAs */}
      <div className="relative z-20 h-full max-w-7xl mx-auto px-4 sm:px-8 md:px-12 flex flex-col justify-end pb-12 sm:pb-16 lg:pb-20">
        <div className="max-w-xl sm:max-w-2xl flex flex-col gap-3 sm:gap-4">
          {/* Top Pill / Brand Label */}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-mono font-bold tracking-widest text-[#00E5FF] bg-black/60 backdrop-blur-md border border-[#00E5FF]/30 shadow-[0_0_15px_rgba(0,229,255,0.2)]">
              <Sparkles className="w-3 h-3 text-[#00E5FF]" />
              SARWARCYOU SPOTLIGHT
            </span>
            <span className="text-[10px] sm:text-xs font-mono font-semibold text-zinc-400 uppercase tracking-widest">
              {currentItem.category || (isVideo ? 'Cinema Archive' : 'Photo Vault')}
            </span>
          </div>

          {/* Huge Cinematic Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black font-sans uppercase tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)] leading-none line-clamp-2">
            {cleanTitle}
          </h1>

          {/* Badges / Rating Row */}
          <div className="flex items-center gap-2.5 sm:gap-3 text-xs font-mono text-zinc-300">
            <span className="text-[#00E5FF] font-bold">99% MATCH</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/20 text-white border border-white/20">
              4K ULTRA HD
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
              IMDb 9.4
            </span>
            <span className="text-zinc-400 hidden sm:inline">
              Stream Vault Master
            </span>
          </div>

          {/* Descriptive Excerpt */}
          <p className="text-xs sm:text-sm text-zinc-300 line-clamp-2 sm:line-clamp-3 max-w-lg drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] font-sans">
            High definition master archive streamed directly via Cloudflare CDN. Produced, curated, and graded by Sarwar C You.
          </p>

          {/* Primary Action Buttons: PLAY & OPEN ALBUM */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onPlay(currentItem, playlist)}
              className="flex items-center justify-center gap-2.5 px-6 sm:px-8 py-3 rounded-xl bg-white hover:bg-zinc-200 text-black font-black font-sans text-xs sm:text-sm tracking-wider uppercase transition-all duration-200 shadow-[0_8px_25px_rgba(255,255,255,0.25)] hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current ml-0.5" />
              <span>PLAY</span>
            </button>

            <button
              type="button"
              onClick={() => (onOpenAlbum ? onOpenAlbum(currentItem) : onPlay(currentItem, playlist))}
              className="flex items-center justify-center gap-2 px-5 sm:px-6 py-3 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold font-sans text-xs sm:text-sm tracking-wider uppercase backdrop-blur-xl border border-white/20 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer group/album"
              title={currentItem.category ? `Open ${currentItem.category} Album` : 'Open Album'}
            >
              <Folder className="w-4 h-4 text-[#00E5FF] transition-transform duration-200 group-hover/album:scale-110" />
              <span>OPEN ALBUM</span>
            </button>
          </div>

          {/* 10-Video Playlist Pips (Rotates every 10s, Clickable) */}
          {playlist.length > 1 && (
            <div className="flex items-center gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                {playlist.map((it, idx) => (
                  <button
                    key={it.id || idx}
                    type="button"
                    onClick={() => handleSelectIndex(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      idx === safeIndex
                        ? 'w-7 sm:w-9 bg-[#00E5FF] shadow-[0_0_10px_rgba(0,229,255,0.8)]'
                        : 'w-2 sm:w-2.5 bg-white/30 hover:bg-white/60'
                    }`}
                    title={`Spotlight video ${idx + 1} of ${playlist.length}: ${it.title || it.name}`}
                    aria-label={`Jump to spotlight video ${idx + 1}`}
                  />
                ))}
              </div>
              <span className="text-[10px] font-mono font-bold text-zinc-400">
                <span className="text-[#00E5FF]">{safeIndex + 1}</span> / {playlist.length}
              </span>
            </div>
          )}
        </div>
      </div>


    </div>
  );
};

export default NetflixBillboard;
