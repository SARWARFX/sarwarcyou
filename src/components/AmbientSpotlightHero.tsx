import React, { useState, useEffect, useRef } from 'react';
import { Play, Sparkles, Folder, Calendar } from 'lucide-react';
import type { StageMediaItem } from '../types';
import { getMediaUrl } from '../utils/imageUrlResolver';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';
import { isVideoExtension } from '../utils/mediaTypeDetector';
import { getCachedThumbnailSync } from '../utils/clientVideoThumbnails';
import { getCachedVideoPoster } from '../utils/videoPosterGenerator';

export interface AmbientSpotlightHeroProps {
  item: StageMediaItem | null;
  playlistContext?: StageMediaItem[];
  onPlay: (item: StageMediaItem, playlistContext?: StageMediaItem[]) => void;
  onExploreAlbum?: (albumName: string) => void;
}

export const AmbientSpotlightHero: React.FC<AmbientSpotlightHeroProps> = ({
  item,
  playlistContext = [],
  onPlay,
  onExploreAlbum,
}) => {
  const [shouldPlayAmbient, setShouldPlayAmbient] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isHoveredRef = useRef(false);

  // Cold paint integrity: 0 video bytes initially!
  // Trigger ambient preview only after browser idle (or 2.8s delay after mount)
  useEffect(() => {
    if (!item) return;

    let idleId: number | null = null;
    let timerId: ReturnType<typeof setTimeout> | null = null;

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = (window as any).requestIdleCallback(
        () => {
          setShouldPlayAmbient(true);
        },
        { timeout: 3500 }
      );
    } else {
      timerId = setTimeout(() => {
        setShouldPlayAmbient(true);
      }, 2800);
    }

    return () => {
      if (idleId && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleId);
      }
      if (timerId) clearTimeout(timerId);
    };
  }, [item?.id]);

  if (!item) return null;

  const displayTitle = sanitizeMediaTitle(item.title, item.category);
  const albumName = item.category || item.parentAlbum || 'Stream Vault Exclusive';
  const rawPoster =
    item.thumbnails?.[0] ||
    getCachedThumbnailSync(item.url) ||
    getCachedVideoPoster(item.url) ||
    item.thumbnail ||
    '';
  const posterSrc = rawPoster && !isVideoExtension(rawPoster) ? getMediaUrl(rawPoster) : '';
  const streamUrl = getMediaUrl(item.url || item.path || item.id);

  const handleMouseEnter = () => {
    isHoveredRef.current = true;
    if (!shouldPlayAmbient) {
      setShouldPlayAmbient(true);
    }
  };

  const handleMouseLeave = () => {
    isHoveredRef.current = false;
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative w-full h-[58vh] sm:h-[68vh] lg:h-[78vh] max-h-[740px] min-h-[440px] overflow-hidden select-none bg-[#030305]"
    >
      {/* 1. Background Visuals: High-Res Poster initially + Smooth Ambient Video Loop on Idle */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {/* High-Res Static Poster Image (Guaranteed 0 video bytes on cold load) */}
        {posterSrc ? (
          <img
            src={posterSrc}
            alt={displayTitle}
            loading="eager"
            decoding="async"
            className={`w-full h-full object-cover object-center filter brightness-[0.72] transform scale-[1.02] transition-opacity duration-1000 ${
              videoLoaded ? 'opacity-40' : 'opacity-100'
            }`}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-neutral-950 to-black" />
        )}

        {/* Ambient Subtle Video Loop (Triggered only after idle/hover) */}
        {shouldPlayAmbient && streamUrl && (
          <video
            ref={videoRef}
            src={streamUrl}
            autoPlay
            loop
            muted
            playsInline
            crossOrigin="anonymous"
            onLoadedData={() => setVideoLoaded(true)}
            className={`absolute inset-0 w-full h-full object-cover filter brightness-[0.68] transition-opacity duration-1000 pointer-events-none ${
              videoLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
      </div>

      {/* 2. Layered Vignettes & Gradients */}
      {/* Bottom fade into the content feed */}
      <div className="absolute inset-x-0 bottom-0 h-44 sm:h-64 bg-gradient-to-t from-[var(--bg-page)] via-[var(--bg-page)]/80 to-transparent z-10 pointer-events-none" />

      {/* Left vignette for crisp text legibility */}
      <div className="absolute inset-y-0 left-0 w-full sm:w-4/5 lg:w-3/5 bg-gradient-to-r from-black/95 via-black/60 to-transparent z-10 pointer-events-none" />

      {/* Top vignette */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent z-10 pointer-events-none" />

      {/* 3. Hero Metadata & Action Buttons */}
      <div className="relative z-20 h-full max-w-7xl mx-auto px-4 sm:px-8 md:px-12 flex flex-col justify-end pb-10 sm:pb-14 lg:pb-18">
        <div className="max-w-xl sm:max-w-2xl flex flex-col gap-3 sm:gap-4.5">
          {/* Top Category Badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 backdrop-blur-xl border border-[#00E5FF]/40 text-[#00E5FF] text-xs font-mono font-semibold tracking-wider shadow-[0_0_15px_rgba(0,229,255,0.25)]">
              <Sparkles className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span className="uppercase">{albumName}</span>
            </div>

            {item.date && (
              <div className="hidden xs:flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/[0.08] backdrop-blur-md text-zinc-300 text-xs font-mono">
                <Calendar className="w-3 h-3 text-zinc-400" />
                <span>
                  {new Date(item.date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Large Hero Title */}
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-white tracking-tight leading-[1.12] drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] line-clamp-2 sm:line-clamp-3">
            {displayTitle}
          </h1>

          {/* Subtitle / Description */}
          <p className="text-xs sm:text-sm md:text-base text-zinc-300 line-clamp-2 leading-relaxed max-w-xl drop-shadow">
            Stream high-fidelity media directly from the stream vault. Experience lossless edge streaming with ultra-low latency playback.
          </p>

          {/* Action CTAs */}
          <div className="flex items-center gap-3 pt-2">
            {/* Primary "Watch Now" Button */}
            <button
              type="button"
              onClick={() => onPlay(item, playlistContext)}
              className="px-5 sm:px-7 py-2.5 sm:py-3.5 rounded-xl bg-gradient-to-r from-[#00E5FF] to-blue-600 text-black font-bold text-xs sm:text-sm font-sans flex items-center gap-2.5 shadow-[0_0_25px_rgba(0,229,255,0.4)] hover:shadow-[0_0_35px_rgba(0,229,255,0.65)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              <span>Watch Now</span>
            </button>

            {/* Secondary "Explore Album" Button */}
            {onExploreAlbum && (
              <button
                type="button"
                onClick={() => onExploreAlbum(albumName)}
                className="px-4 sm:px-6 py-2.5 sm:py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs sm:text-sm backdrop-blur-xl border border-white/15 hover:border-white/30 flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
              >
                <Folder className="w-4 h-4 text-zinc-300" />
                <span>Explore Album</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AmbientSpotlightHero;
