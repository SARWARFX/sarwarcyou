import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Play, Pause, Shuffle, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import type { StageMediaItem } from '../../types';
import { sanitizeMediaTitle } from '../../utils/titleSanitizer';
import { getMediaUrl } from '../../utils/imageUrlResolver';
import { hapticMedium, hapticLight } from '../../utils/hapticsManager';
import { FALLBACK_HF_CATALOG } from '../../data/fallbackData';

export interface DynamicTrailerShowcaseProps {
  shorts: StageMediaItem[];
  clips: StageMediaItem[];
  images: StageMediaItem[];
  onOpenPhoto: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo: (item: StageMediaItem, playlist: StageMediaItem[]) => void;
  onOpenShort: (item: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => void;
  onNavigateCategory?: (category: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY') => void;
  isModalOpen?: boolean;
}

export const DynamicTrailerShowcase: React.FC<DynamicTrailerShowcaseProps> = ({
  shorts,
  clips,
  images,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
  onNavigateCategory,
  isModalOpen = false,
}) => {
  // Motion Controls State
  const [isMotionPaused, setIsMotionPaused] = useState<boolean>(false);

  // Hero Spotlight Index & Auto-Timer
  const [heroIdx, setHeroIdx] = useState<number>(0);
  const [heroProgress, setHeroProgress] = useState<number>(0);
  const HERO_CYCLE_DURATION_MS = 7500;

  // Curate ~50% of items for the dynamic trailer
  const [shuffleKey, setShuffleKey] = useState<number>(0);

  // Robust fallback layers if props arrive empty while data hydrates
  const effectiveShorts = useMemo(() => {
    if (shorts && shorts.length > 0) return shorts;
    return ((FALLBACK_HF_CATALOG?.shorts || []) as any[]).map((s) => ({
      ...s,
      type: 'video' as const,
      mediaType: 'short' as const,
      category: 'Shorts',
    })) as StageMediaItem[];
  }, [shorts]);

  const effectiveClips = useMemo(() => {
    if (clips && clips.length > 0) return clips;
    return ((FALLBACK_HF_CATALOG?.clips || []) as any[]).map((c) => ({
      ...c,
      type: 'video' as const,
      category: 'Video Clips',
    })) as StageMediaItem[];
  }, [clips]);

  const effectiveImages = useMemo(() => {
    if (images && images.length > 0) return images;
    return ((FALLBACK_HF_CATALOG?.images || []) as any[]).map((img) => ({
      ...img,
      type: 'image' as const,
      category: 'Photographs',
    })) as StageMediaItem[];
  }, [images]);

  const displayShorts = useMemo(() => {
    const pool = [...effectiveShorts];
    if (shuffleKey > 0) pool.sort(() => Math.random() - 0.5);
    return pool.slice(0, Math.max(24, Math.floor(pool.length * 0.55)));
  }, [effectiveShorts, shuffleKey]);

  const displayClips = useMemo(() => {
    const pool = [...effectiveClips];
    if (shuffleKey > 0) pool.sort(() => Math.random() - 0.5);
    return pool.slice(0, Math.max(20, Math.floor(pool.length * 0.55)));
  }, [effectiveClips, shuffleKey]);

  const displayImages = useMemo(() => {
    const pool = [...effectiveImages];
    if (shuffleKey > 0) pool.sort(() => Math.random() - 0.5);
    return pool.slice(0, Math.max(30, Math.floor(pool.length * 0.55)));
  }, [effectiveImages, shuffleKey]);

  // Standard uniform physical cruising velocity across all 3 rails (~48px per second)
  // Regardless of how many media cards exist in each section, all rails glide at the exact same physical speed!
  const STANDARD_VELOCITY_PX_PER_SEC = 48;

  const shortsDurationSec = useMemo(() => {
    return Math.max(15, Math.round((displayShorts.length * 196) / STANDARD_VELOCITY_PX_PER_SEC));
  }, [displayShorts.length]);

  const clipsDurationSec = useMemo(() => {
    return Math.max(15, Math.round((displayClips.length * 306) / STANDARD_VELOCITY_PX_PER_SEC));
  }, [displayClips.length]);

  const imagesDurationSec = useMemo(() => {
    return Math.max(15, Math.round((displayImages.length * 206) / STANDARD_VELOCITY_PX_PER_SEC));
  }, [displayImages.length]);

  // Featured Hero Items (curated mixture across all 3 media types)
  const heroItems = useMemo(() => {
    const list: { item: StageMediaItem; category: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY' }[] = [];
    if (displayClips.length > 0) list.push({ item: displayClips[0], category: 'CLIPS' });
    if (displayShorts.length > 0) list.push({ item: displayShorts[0], category: 'SHORTS' });
    if (displayImages.length > 0) list.push({ item: displayImages[0], category: 'PHOTOGRAPHY' });
    if (displayClips.length > 1) list.push({ item: displayClips[1], category: 'CLIPS' });
    if (displayShorts.length > 1) list.push({ item: displayShorts[1], category: 'SHORTS' });
    if (displayImages.length > 1) list.push({ item: displayImages[1], category: 'PHOTOGRAPHY' });
    return list;
  }, [displayClips, displayShorts, displayImages]);

  const activeHero = heroItems[heroIdx % (heroItems.length || 1)];

  // Auto-Cycle Hero Spotlight
  useEffect(() => {
    if (isModalOpen || heroItems.length <= 1) return;

    setHeroProgress(0);
    const interval = 100;
    const step = 100 / (HERO_CYCLE_DURATION_MS / interval);

    const timer = setInterval(() => {
      setHeroProgress((prev) => {
        if (prev >= 100) {
          setHeroIdx((cur) => (cur + 1) % heroItems.length);
          return 0;
        }
        return prev + step;
      });
    }, interval);

    return () => clearInterval(timer);
  }, [heroIdx, isModalOpen, heroItems.length]);

  const handleHeroNext = useCallback(() => {
    hapticLight();
    setHeroIdx((cur) => (cur + 1) % heroItems.length);
    setHeroProgress(0);
  }, [heroItems.length]);

  const handleHeroPrev = useCallback(() => {
    hapticLight();
    setHeroIdx((cur) => (cur - 1 + heroItems.length) % heroItems.length);
    setHeroProgress(0);
  }, [heroItems.length]);

  // Open Hero Item in Full Modal
  const handleOpenHero = useCallback(() => {
    if (!activeHero) return;
    hapticMedium();
    const { item, category } = activeHero;
    if (category === 'PHOTOGRAPHY') {
      const idx = displayImages.findIndex((p) => p.id === item.id || p.url === item.url);
      onOpenPhoto(item, displayImages, idx >= 0 ? idx : 0);
    } else if (category === 'SHORTS') {
      const idx = displayShorts.findIndex((s) => s.id === item.id || s.url === item.url);
      onOpenShort(item, displayShorts, idx >= 0 ? idx : 0, 'Shorts');
    } else {
      onOpenVideo(item, displayClips);
    }
  }, [activeHero, displayImages, displayShorts, displayClips, onOpenPhoto, onOpenShort, onOpenVideo]);

  const heroVideoRef = useRef<HTMLVideoElement>(null);

  // Play/pause preview video when hero changes
  useEffect(() => {
    if (!activeHero) return;
    const isVideo = activeHero.category === 'CLIPS' || activeHero.category === 'SHORTS';
    if (isVideo && heroVideoRef.current && !isModalOpen) {
      heroVideoRef.current.currentTime = 0;
      heroVideoRef.current.play().catch(() => {});
    }
  }, [heroIdx, activeHero, isModalOpen]);

  const pausedClass = isMotionPaused || isModalOpen ? 'motion-paused' : '';

  return (
    <div className={`w-full min-h-0 flex-1 overflow-y-auto space-scrollbar p-3 sm:p-6 lg:p-8 space-y-8 z-10 transition-all duration-300 ${pausedClass}`}>
      
      {/* ===== HEADER CONTROLS DECK ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#ccff00]/10 border border-[#ccff00]/30 flex items-center justify-center text-[#ccff00]">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-wider flex items-center gap-2">
              DYNAMIC ARCHIVE TRAILER
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#ccff00]/15 text-[#ccff00] border border-[#ccff00]/30 font-semibold uppercase tracking-widest">
                LIVING STREAM
              </span>
            </h2>
            <p className="text-[11px] font-mono text-neutral-400">
              Active Movie Trailer • {displayShorts.length + displayClips.length + displayImages.length} Curated Media Cards
            </p>
          </div>
        </div>

        {/* Motion Deck Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              hapticLight();
              setIsMotionPaused((prev) => !prev);
            }}
            className="px-3 py-1.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-white/10 hover:border-[#ccff00]/40 text-xs font-mono text-neutral-300 hover:text-[#ccff00] flex items-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95"
          >
            {isMotionPaused ? <Play className="w-3.5 h-3.5 fill-current" /> : <Pause className="w-3.5 h-3.5 fill-current" />}
            <span>{isMotionPaused ? 'RESUME MOTION' : 'PAUSE MOTION'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              hapticMedium();
              setShuffleKey((k) => k + 1);
            }}
            title="Shuffle Reel"
            className="p-2 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-white/10 text-neutral-300 hover:text-[#ccff00] transition-all cursor-pointer active:scale-95"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ===== SECTION 1: THE LIVING HERO SPOTLIGHT TEASER ===== */}
      {activeHero && (
        <section className="relative w-full rounded-3xl overflow-hidden bg-black/60 border border-white/15 shadow-[0_0_80px_-20px_rgba(204,255,0,0.25)] transition-all duration-500">
          <div className="relative w-full aspect-[16/8] sm:aspect-[21/9] max-h-[500px] overflow-hidden bg-black flex items-center justify-center">
            
            {/* Visual Teaser Background */}
            {activeHero.category === 'PHOTOGRAPHY' ? (
              <img
                key={activeHero.item.id || activeHero.item.url}
                src={getMediaUrl(activeHero.item.url || activeHero.item.thumbnail)}
                alt={activeHero.item.title || activeHero.item.name}
                className="absolute inset-0 w-full h-full object-cover brightness-[0.7] transition-all duration-700 transform scale-105"
              />
            ) : (
              <video
                key={activeHero.item.id || activeHero.item.url}
                ref={heroVideoRef}
                src={getMediaUrl(activeHero.item.url)}
                poster={activeHero.item.thumbnail ? getMediaUrl(activeHero.item.thumbnail) : undefined}
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 w-full h-full object-cover brightness-[0.72] transition-opacity duration-700"
              />
            )}

            {/* Ambient Vignette & Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#050505]/85 via-transparent to-[#050505]/70 pointer-events-none" />

            {/* Upper Badge */}
            <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-2.5 z-20">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ccff00] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ccff00]" />
              </span>
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#ccff00] font-bold px-3 py-1 rounded-full bg-black/60 border border-[#ccff00]/30 backdrop-blur-md">
                FEATURED TRAILER REEL
              </span>
              <span className="text-[11px] font-mono text-neutral-400 px-2.5 py-1 rounded-full bg-black/50 border border-white/10 backdrop-blur-md">
                {String(heroIdx + 1).padStart(2, '0')} / {String(heroItems.length).padStart(2, '0')}
              </span>
            </div>

            {/* Upper Right Cycle Buttons */}
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 z-20">
              <button
                type="button"
                onClick={handleHeroPrev}
                className="w-9 h-9 rounded-full bg-black/60 hover:bg-neutral-800 border border-white/15 flex items-center justify-center text-white/80 hover:text-[#ccff00] transition-all cursor-pointer backdrop-blur-md active:scale-95"
                title="Previous Trailer Reel"
              >
                <ChevronLeft className="w-5 h-5 -ml-0.5" />
              </button>
              <button
                type="button"
                onClick={handleHeroNext}
                className="w-9 h-9 rounded-full bg-black/60 hover:bg-neutral-800 border border-white/15 flex items-center justify-center text-white/80 hover:text-[#ccff00] transition-all cursor-pointer backdrop-blur-md active:scale-95"
                title="Next Trailer Reel"
              >
                <ChevronRight className="w-5 h-5 -mr-0.5" />
              </button>
            </div>

            {/* Lower Third Content */}
            <div className="absolute bottom-5 left-5 right-5 sm:bottom-7 sm:left-7 sm:right-7 flex flex-col sm:flex-row sm:items-end justify-between gap-4 z-20">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-md bg-[#ccff00] text-black">
                    {activeHero.category}
                  </span>
                  <span className="text-xs font-mono text-neutral-400">
                    Live Auto-Advancing Trailer
                  </span>
                </div>
                <h3 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-md line-clamp-1">
                  {sanitizeMediaTitle(activeHero.item.title || activeHero.item.name, activeHero.category === 'PHOTOGRAPHY' ? 'Photograph' : 'Video')}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-300 font-light line-clamp-1">
                  Interactive movie trailer representing your directory with full momentum animations and zoom.
                </p>
              </div>

              <div className="shrink-0">
                <button
                  type="button"
                  onClick={handleOpenHero}
                  className="px-5 py-2.5 sm:px-6 sm:py-3 rounded-2xl bg-[#ccff00] hover:bg-[#b8e600] active:scale-95 text-black font-bold text-xs sm:text-sm font-mono tracking-wider flex items-center gap-2 shadow-[0_0_25px_rgba(204,255,0,0.45)] transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>WATCH IN FULL VIEWER</span>
                </button>
              </div>
            </div>

            {/* Progress Bar Timeline */}
            <div className="absolute bottom-0 inset-x-0 h-1 bg-white/10 z-30">
              <div
                className="h-full bg-[#ccff00] transition-all duration-100 ease-linear"
                style={{ width: `${Math.min(100, heroProgress)}%` }}
              />
            </div>

          </div>
        </section>
      )}

      {/* ===== SECTION 2: STREAM RAIL 1 - TRENDING SHORTS (Gliding Left) ===== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
              <span className="text-[#ccff00]">⚡</span> TRENDING SHORTS
            </h3>
            <span className="text-[11px] font-mono text-neutral-400 px-2 py-0.5 rounded-full bg-neutral-900 border border-white/10">
              {displayShorts.length} CURATED
            </span>
          </div>
          {onNavigateCategory && (
            <button
              type="button"
              onClick={() => onNavigateCategory('SHORTS')}
              className="text-xs font-mono text-[#ccff00] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All Shorts</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Marquee Infinite Rail */}
        <div className="relative w-full overflow-hidden trailer-container rounded-2xl py-2">
          <div className="absolute left-0 inset-y-0 w-12 sm:w-20 bg-gradient-to-r from-[#050505] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 inset-y-0 w-12 sm:w-20 bg-gradient-to-l from-[#050505] to-transparent z-10 pointer-events-none" />

          <div className="trailer-track-left gap-3.5 sm:gap-4" style={{ animationDuration: `${shortsDurationSec}s` }}>
            {[...displayShorts, ...displayShorts].map((short, idx) => {
              const realIdx = idx % displayShorts.length;
              return (
                <div
                  key={`short-${short.id || short.url}-${idx}`}
                  onClick={() => {
                    hapticLight();
                    onOpenShort(short, displayShorts, realIdx, 'Shorts');
                  }}
                  className="group relative w-[165px] sm:w-[195px] aspect-[9/16] shrink-0 rounded-2xl overflow-hidden bg-[#090d16] border border-white/10 hover:border-[#ccff00]/60 hover:shadow-[0_0_25px_rgba(204,255,0,0.3)] transition-all duration-300 cursor-pointer transform hover:-translate-y-1.5"
                >
                  <img
                    src={short.thumbnail || getMediaUrl(short.url)}
                    alt={short.title || short.name}
                    loading="lazy"
                    className="w-full h-full object-cover brightness-[0.75] group-hover:brightness-100 transition-all duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20 flex flex-col justify-between p-3 pointer-events-none">
                    <span className="self-start text-[10px] font-mono px-2 py-0.5 rounded bg-black/60 text-[#ccff00] border border-[#ccff00]/30 font-bold">
                      SHORT
                    </span>
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-white line-clamp-2 leading-snug group-hover:text-[#ccff00] transition-colors">
                        {sanitizeMediaTitle(short.title || short.name, 'Short')}
                      </p>
                      <span className="text-[10px] font-mono text-neutral-400">Tap to play</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== SECTION 3: STREAM RAIL 2 - CINEMATIC VIDEO CLIPS (Drifting Right) ===== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
              <span className="text-emerald-400">🎬</span> CINEMATIC VIDEO SCENES
            </h3>
            <span className="text-[11px] font-mono text-neutral-400 px-2 py-0.5 rounded-full bg-neutral-900 border border-white/10">
              {displayClips.length} CURATED
            </span>
          </div>
          {onNavigateCategory && (
            <button
              type="button"
              onClick={() => onNavigateCategory('CLIPS')}
              className="text-xs font-mono text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All Clips</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Marquee Infinite Rail Right */}
        <div className="relative w-full overflow-hidden trailer-container rounded-2xl py-2">
          <div className="absolute left-0 inset-y-0 w-12 sm:w-20 bg-gradient-to-r from-[#050505] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 inset-y-0 w-12 sm:w-20 bg-gradient-to-l from-[#050505] to-transparent z-10 pointer-events-none" />

          <div className="trailer-track-right gap-3.5 sm:gap-4" style={{ animationDuration: `${clipsDurationSec}s` }}>
            {[...displayClips, ...displayClips].map((clip, idx) => {
              return (
                <div
                  key={`clip-${clip.id || clip.url}-${idx}`}
                  onClick={() => {
                    hapticLight();
                    onOpenVideo(clip, displayClips);
                  }}
                  className="group relative w-[270px] sm:w-[310px] aspect-[16/9] shrink-0 rounded-2xl overflow-hidden bg-[#090d16] border border-white/10 hover:border-emerald-400/60 hover:shadow-[0_0_25px_rgba(52,211,153,0.3)] transition-all duration-300 cursor-pointer transform hover:-translate-y-1.5"
                >
                  <img
                    src={clip.thumbnail || getMediaUrl(clip.url)}
                    alt={clip.title || clip.name}
                    loading="lazy"
                    className="w-full h-full object-cover brightness-[0.75] group-hover:brightness-100 transition-all duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20 flex flex-col justify-between p-3 pointer-events-none">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/60 text-emerald-400 border border-emerald-400/30 font-bold">
                        SCENE
                      </span>
                      <span className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-xs text-white group-hover:bg-[#ccff00] group-hover:text-black transition-all">
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      </span>
                    </div>
                    <p className="text-xs font-bold text-white line-clamp-1 group-hover:text-emerald-300 transition-colors">
                      {sanitizeMediaTitle(clip.title || clip.name, 'Video')}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== SECTION 4: STREAM RAIL 3 - MASTER PHOTOGRAPHS (Gliding Left) ===== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
              <span className="text-cyan-400">📸</span> MASTER PHOTOGRAPHS & STILLS
            </h3>
            <span className="text-[11px] font-mono text-neutral-400 px-2 py-0.5 rounded-full bg-neutral-900 border border-white/10">
              {displayImages.length} CURATED
            </span>
          </div>
          {onNavigateCategory && (
            <button
              type="button"
              onClick={() => onNavigateCategory('PHOTOGRAPHY')}
              className="text-xs font-mono text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All Photographs</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Marquee Infinite Rail Left */}
        <div className="relative w-full overflow-hidden trailer-container rounded-2xl py-2">
          <div className="absolute left-0 inset-y-0 w-12 sm:w-20 bg-gradient-to-r from-[#050505] to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 inset-y-0 w-12 sm:w-20 bg-gradient-to-l from-[#050505] to-transparent z-10 pointer-events-none" />

          <div className="trailer-track-left gap-3.5 sm:gap-4" style={{ animationDuration: `${imagesDurationSec}s` }}>
            {[...displayImages, ...displayImages].map((imgItem, idx) => {
              const realIdx = idx % displayImages.length;
              return (
                <div
                  key={`img-${imgItem.id || imgItem.url}-${idx}`}
                  onClick={() => {
                    hapticLight();
                    onOpenPhoto(imgItem, displayImages, realIdx);
                  }}
                  className="group relative w-[175px] sm:w-[205px] aspect-[4/5] shrink-0 rounded-2xl overflow-hidden bg-[#090d16] border border-white/10 hover:border-cyan-400/60 hover:shadow-[0_0_25px_rgba(34,211,238,0.3)] transition-all duration-300 cursor-pointer transform hover:-translate-y-1.5"
                >
                  <img
                    src={getMediaUrl(imgItem.thumbnail || imgItem.url)}
                    alt={imgItem.title || imgItem.name}
                    loading="lazy"
                    className="w-full h-full object-cover brightness-[0.8] group-hover:brightness-100 transition-all duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent flex flex-col justify-end p-3 pointer-events-none">
                    <p className="text-xs font-bold text-white line-clamp-1 group-hover:text-cyan-300 transition-colors">
                      {sanitizeMediaTitle(imgItem.title || imgItem.name, 'Photograph')}
                    </p>
                    <span className="text-[10px] font-mono text-neutral-400">HD Photograph</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

    </div>
  );
};

export default DynamicTrailerShowcase;
