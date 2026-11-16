import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Play, Pause, Shuffle, Sparkles, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import type { StageMediaItem } from '../../types';
import { sanitizeMediaTitle } from '../../utils/titleSanitizer';
import { getMediaUrl } from '../../utils/imageUrlResolver';
import { getThumbnailUrl } from '../../utils/thumbnailResolver';
import { hapticMedium, hapticLight } from '../../utils/hapticsManager';
import { getRecentHistory, clearRecentHistory, formatTimeAgo, type RecentMediaItem } from '../../utils/recentHistoryManager';
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

  // Featured Hero Items: Strictly landscape video clips only - never vertical shorts, never static images
  const heroItems = useMemo(() => {
    return displayClips.map((item) => ({ item, category: 'CLIPS' as const }));
  }, [displayClips]);

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
    onOpenVideo(activeHero.item, displayClips);
  }, [activeHero, displayClips, onOpenVideo]);

  const heroVideoRef = useRef<HTMLVideoElement>(null);

  // Play/pause preview video when hero changes
  useEffect(() => {
    if (!activeHero || isModalOpen) return;
    if (heroVideoRef.current) {
      heroVideoRef.current.currentTime = 0;
      heroVideoRef.current.play().catch(() => {});
    }
  }, [heroIdx, activeHero, isModalOpen]);

  // User-based Recently Opened Media History
  const [recentHistory, setRecentHistory] = useState<RecentMediaItem[]>(() => getRecentHistory());
  const recentRailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleHistoryUpdate = () => {
      setRecentHistory(getRecentHistory());
    };
    window.addEventListener('recent-history-updated', handleHistoryUpdate);
    window.addEventListener('storage', handleHistoryUpdate);
    return () => {
      window.removeEventListener('recent-history-updated', handleHistoryUpdate);
      window.removeEventListener('storage', handleHistoryUpdate);
    };
  }, []);

  const handleOpenRecent = useCallback(
    (item: RecentMediaItem) => {
      hapticMedium();
      const isShort =
        item.mediaType === 'short' ||
        item.category?.toLowerCase().includes('short') ||
        item.url?.toLowerCase().includes('/shorts/');
      const isVid = item.type === 'video' && !isShort;
      if (isShort) {
        onOpenShort(item, shorts && shorts.length > 0 ? shorts : [item], 0, item.category || item.parentAlbum);
      } else if (isVid) {
        onOpenVideo(item, clips && clips.length > 0 ? clips : [item]);
      } else {
        onOpenPhoto(item, images && images.length > 0 ? images : [item], 0);
      }
    },
    [onOpenShort, onOpenVideo, onOpenPhoto, shorts, clips, images]
  );

  const handleClearHistory = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    hapticLight();
    clearRecentHistory();
  }, []);

  const scrollRecentRail = useCallback((direction: 'left' | 'right') => {
    if (!recentRailRef.current) return;
    const delta = direction === 'left' ? -340 : 340;
    recentRailRef.current.scrollBy({ left: delta, behavior: 'smooth' });
  }, []);

  const pausedClass = isMotionPaused || isModalOpen ? 'motion-paused' : '';

  return (
    <div className={`w-full min-h-0 flex-1 overflow-y-auto space-scrollbar p-3 sm:p-6 lg:p-8 space-y-8 z-10 transition-all duration-300 ${pausedClass}`}>
      
      {/* ===== HEADER CONTROLS DECK ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#00f0ff]/10 border border-[#00f0ff]/30 flex items-center justify-center text-[#00f0ff]">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white tracking-wider flex items-center gap-2">
              DYNAMIC ARCHIVE TRAILER
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00f0ff]/15 text-[#00f0ff] border border-[#00f0ff]/30 font-semibold uppercase tracking-widest">
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
            className={`reticle-chip ${
              !isMotionPaused ? 'active-chip' : ''
            }`}
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
            className="reticle-btn w-8 h-8 rounded-lg"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ===== SECTION 1: THE LIVING CINEMATIC ARCHIVE TRAILER (OUTLINE-FREE / BORDERLESS) ===== */}
      {activeHero && (
        <section className="relative w-full overflow-hidden bg-transparent transition-all duration-500">
          <div className="relative w-full aspect-[16/8] sm:aspect-[21/9] max-h-[520px] overflow-hidden flex items-center justify-center bg-transparent">
            
            {/* Strictly Landscape Cinematic Video Scene */}
            <video
              key={activeHero.item.id || activeHero.item.url}
              ref={heroVideoRef}
              src={getMediaUrl(activeHero.item.url)}
              poster={activeHero.item.thumbnail ? getMediaUrl(activeHero.item.thumbnail) : undefined}
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-cover brightness-[0.82] transition-opacity duration-700"
            />

            {/* Seamless Ambient Vignette & Gradient Overlays - Seamlessly blends into #08090c page canvas */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#08090c] via-transparent to-[#08090c]/80 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#08090c]/90 via-transparent to-[#08090c]/85 pointer-events-none" />

            {/* Upper Badge */}
            <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-2.5 z-20">
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00f0ff] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00f0ff]" />
              </span>
              <span className="text-[11px] font-mono uppercase tracking-widest text-[#00f0ff] font-bold px-3 py-1 rounded-full bg-black/60 border border-[#00f0ff]/30 backdrop-blur-md">
                CINEMATIC ARCHIVE TRAILER
              </span>
              <span className="text-[11px] font-mono text-neutral-400 px-2.5 py-1 rounded-full bg-black/50 border border-white/10 backdrop-blur-md">
                {String(heroIdx + 1).padStart(2, '0')} / {String(heroItems.length).padStart(2, '0')}
              </span>
            </div>

            {/* Upper Right Cycle Buttons (Precision Sci-Fi Reticle) */}
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2 z-20">
              <button
                type="button"
                onClick={handleHeroPrev}
                className="reticle-btn reticle-btn-prev w-9 h-9 rounded-lg"
                title="Previous Cinematic Trailer"
              >
                <ChevronLeft className="w-5 h-5 -ml-0.5" />
              </button>
              <button
                type="button"
                onClick={handleHeroNext}
                className="reticle-btn reticle-btn-next w-9 h-9 rounded-lg"
                title="Next Cinematic Trailer"
              >
                <ChevronRight className="w-5 h-5 -mr-0.5" />
              </button>
            </div>

            {/* Lower Third Content */}
            <div className="absolute bottom-5 left-5 right-5 sm:bottom-7 sm:left-7 sm:right-7 flex flex-col sm:flex-row sm:items-end justify-between gap-4 z-20">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-md bg-[#00f0ff] text-black">
                    CINEMATIC SCENE
                  </span>
                  <span className="text-xs font-mono text-neutral-400">
                    Living Trailer Stream
                  </span>
                </div>
                <h3 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-md line-clamp-1">
                  {sanitizeMediaTitle(activeHero.item.title || activeHero.item.name, 'Video')}
                </h3>
                <p className="text-xs sm:text-sm text-neutral-300 font-light line-clamp-1">
                  High-definition landscape archive scene presented in seamless borderless cinematic motion.
                </p>
              </div>

              <div className="shrink-0">
                <button
                  type="button"
                  onClick={handleOpenHero}
                  className="reticle-btn-primary"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>WATCH IN FULL VIEWER</span>
                </button>
              </div>
            </div>

            {/* Progress Bar Timeline */}
            <div className="absolute bottom-0 inset-x-0 h-1 bg-white/10 z-30">
              <div
                className="h-full bg-[#00f0ff] transition-all duration-100 ease-linear"
                style={{ width: `${Math.min(100, heroProgress)}%` }}
              />
            </div>

          </div>
        </section>
      )}

      {/* ===== SECTION 1.5: RECENTLY OPENED FILES (Visitor-Specific History) ===== */}
      {recentHistory.length > 0 && (
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5">
              <h3 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
                <span className="text-amber-400">🕒</span> RECENTLY OPENED
              </h3>
              <span className="text-[11px] font-mono text-neutral-400 px-2 py-0.5 rounded-full bg-neutral-900 border border-white/10">
                {recentHistory.length} FILE{recentHistory.length > 1 ? 'S' : ''}
              </span>
              <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest hidden sm:inline">
                • Visitor History
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearHistory}
                className="text-xs font-mono text-neutral-400 hover:text-red-400 flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-900/80 border border-white/10 hover:border-red-400/40 transition-colors cursor-pointer"
                title="Clear your recently opened history"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
              {recentHistory.length > 3 && (
                <div className="hidden sm:flex items-center gap-1.5 ml-1">
                  <button
                    type="button"
                    onClick={() => scrollRecentRail('left')}
                    className="reticle-btn w-7 h-7 rounded-md"
                    title="Scroll Left"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollRecentRail('right')}
                    className="reticle-btn w-7 h-7 rounded-md"
                    title="Scroll Right"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Smooth Horizontal Rail */}
          <div className="relative group/recent-rail">
            <div
              ref={recentRailRef}
              className="flex items-stretch gap-3 overflow-x-auto no-scrollbar scroll-smooth py-1 px-0.5"
            >
              {recentHistory.map((item, idx) => {
                const isShort =
                  item.mediaType === 'short' ||
                  item.category?.toLowerCase().includes('short') ||
                  item.url?.toLowerCase().includes('/shorts/');
                const isVideo = item.type === 'video' && !isShort;
                const isPhoto = item.type === 'image' || (!isVideo && !isShort);
                const thumbUrl = getThumbnailUrl(item) || (item.thumbnail ? getMediaUrl(item.thumbnail) : '');

                return (
                  <div
                    key={`recent-${item.id || item.url}-${idx}`}
                    onClick={() => handleOpenRecent(item)}
                    className="group relative flex-shrink-0 w-44 sm:w-52 bg-[#0c0e14] hover:bg-neutral-900 rounded-xl border border-white/10 hover:border-[#00f0ff] transition-all duration-300 cursor-pointer overflow-hidden shadow-lg hover:shadow-[0_0_20px_rgba(0, 240, 255,0.25)] flex flex-col"
                    title={`Reopen ${item.title || 'file'}`}
                  >
                    {/* Media Thumbnail Container */}
                    <div className="relative w-full aspect-video bg-neutral-950 overflow-hidden">
                      <img
                        src={thumbUrl}
                        alt={item.title || 'Media thumbnail'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                        onError={(e) => {
                          if (item.thumbnail && e.currentTarget.src !== item.thumbnail) {
                            e.currentTarget.src = item.thumbnail;
                          }
                        }}
                      />
                      {/* Media Type Badge */}
                      <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md border border-white/15 text-[9px] font-mono font-bold tracking-wider text-white">
                        {isShort ? (
                          <>
                            <span className="text-[#00f0ff]">⚡</span>
                            <span>SHORT</span>
                          </>
                        ) : isVideo ? (
                          <>
                            <span className="text-cyan-400">🎬</span>
                            <span>CLIP</span>
                          </>
                        ) : (
                          <>
                            <span className="text-emerald-400">📸</span>
                            <span>PHOTO</span>
                          </>
                        )}
                      </div>

                      {/* Hover Play / View Overlay */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-[#00f0ff] text-black flex items-center justify-center shadow-[0_0_15px_#00f0ff] transform group-hover:scale-110 transition-transform">
                          {isPhoto ? (
                            <Sparkles className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4 fill-current ml-0.5" />
                          )}
                        </div>
                      </div>

                      {/* Timestamp Pill */}
                      <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[9px] font-mono text-neutral-300 border border-white/10">
                        {formatTimeAgo(item.openedAt)}
                      </div>
                    </div>

                    {/* Meta snippet */}
                    <div className="p-2.5 flex-1 flex flex-col justify-between">
                      <p className="text-xs font-bold text-white line-clamp-1 group-hover:text-[#00f0ff] transition-colors">
                        {sanitizeMediaTitle(item.title || item.name, isPhoto ? 'Photo' : 'Video')}
                      </p>
                      <p className="text-[10px] font-mono text-neutral-400 truncate mt-0.5">
                        {item.category || item.parentAlbum || 'Archive'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===== SECTION 2: STREAM RAIL 1 - TRENDING SHORTS (Gliding Left) ===== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
              <span className="text-[#00f0ff]">⚡</span> TRENDING SHORTS
            </h3>
            <span className="text-[11px] font-mono text-neutral-400 px-2 py-0.5 rounded-full bg-neutral-900 border border-white/10">
              {displayShorts.length} CURATED
            </span>
          </div>
          {onNavigateCategory && (
            <button
              type="button"
              onClick={() => onNavigateCategory('SHORTS')}
              className="text-xs font-mono text-[#00f0ff] hover:underline flex items-center gap-1 cursor-pointer"
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
                  className="group relative w-[165px] sm:w-[195px] aspect-[9/16] shrink-0 rounded-2xl overflow-hidden bg-[#090d16] border border-white/10 hover:border-[#00f0ff]/60 hover:shadow-[0_0_25px_rgba(0, 240, 255,0.3)] transition-all duration-300 cursor-pointer transform hover:-translate-y-1.5"
                >
                  <img
                    src={short.thumbnail || getMediaUrl(short.url)}
                    alt={short.title || short.name}
                    loading="lazy"
                    className="w-full h-full object-cover brightness-[0.75] group-hover:brightness-100 transition-all duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20 flex flex-col justify-between p-3 pointer-events-none">
                    <span className="self-start text-[10px] font-mono px-2 py-0.5 rounded bg-black/60 text-[#00f0ff] border border-[#00f0ff]/30 font-bold">
                      SHORT
                    </span>
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-white line-clamp-2 leading-snug group-hover:text-[#00f0ff] transition-colors">
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
                      <span className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center text-xs text-white group-hover:bg-[#00f0ff] group-hover:text-black transition-all">
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
