import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Maximize2,
  Tag,
  Image as ImageIcon,
  Newspaper,
  Film,
  Play,
} from 'lucide-react';
import celebrityData from '../data/celebrityGallery.json';
import celebrityNewsData from '../data/celebrityNews.json';
import latestMusicReleasesData from '../data/latestMusicReleases.json';
import type { StageMediaItem, AlbumData } from '../types';
import { MediaModal } from './MediaModal';
import { YouTubeTheaterModal } from './YouTubeTheaterModal';
import { hapticMedium } from '../utils/hapticsManager';
import { CelebrityNewsPaper } from './CelebrityNewsPaper';
import { trackActivityEvent } from '../utils/usageTelemetry';
import { useBackButton } from '../utils/backButtonManager';

export interface CelebrityItem {
  id: string;
  name: string;
  title: string;
  category: string;
  src: string;
  thumb: string;
  aspect: 'portrait' | 'landscape';
  timestamp?: number;
}

export interface CelebrityNewsItem {
  id: string;
  celebrity: string;
  headline: string;
  summary: string;
  source: string;
  sourceUrl: string;
  imageUrl?: string;
  publishedAt: string;
  category: 'Filmfare' | 'Production' | 'Event' | 'Interview' | string;
}

export interface CelebrityShowcaseProps {
  onOpenPhoto?: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  className?: string;
}

const FILTER_CHIPS = [
  { id: 'ALL', label: 'ALL' },
  { id: 'Deepika Padukone', label: 'DEEPIKA' },
  { id: 'Katrina Kaif', label: 'KATRINA' },
  { id: 'Alia Bhatt', label: 'ALIA' },
  { id: 'Kiara Advani', label: 'KIARA' },
  { id: 'Shraddha Kapoor', label: 'SHRADDHA' },
  { id: 'Kriti Sanon', label: 'KRITI' },
  { id: 'Disha Patani', label: 'DISHA' },
  { id: 'Kareena Kapoor', label: 'KAREENA' },
  { id: 'Jacqueline Fernandez', label: 'JACQUELINE' },
  { id: 'Anushka Sharma', label: 'ANUSHKA' },
  { id: 'Aishwarya Rai', label: 'AISHWARYA' },
  { id: 'Priyanka Chopra', label: 'PRIYANKA' },
  { id: 'Sunny Leone', label: 'SUNNY' },
  { id: 'Phoebe Tonkin', label: 'PHOEBE' },
  { id: 'Michelle Rodriguez', label: 'MICHELLE' },
  { id: 'Scarlett Johansson', label: 'SCARLETT' },
  { id: 'Gal Gadot', label: 'GAL' },
  { id: 'Ana de Armas', label: 'ANA' },
  { id: 'Margot Robbie', label: 'MARGOT' },
  { id: 'Sydney Sweeney', label: 'SYDNEY' },
  { id: 'Zendaya', label: 'ZENDAYA' },
];

function toStageMediaItem(entry: CelebrityItem): StageMediaItem {
  return {
    id: entry.id,
    title: entry.title,
    name: entry.name,
    url: entry.src,
    path: entry.src,
    thumbnail: entry.thumb || entry.src,
    category: entry.category || 'Celebrity',
    type: 'image',
    mediaType: 'photo',
    parentAlbum: 'Celebrity Wallpapers',
  };
}

export const CelebrityShowcase: React.FC<CelebrityShowcaseProps> = ({
  onOpenPhoto,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'PORTRAITS' | 'DISPATCHES' | 'REELS'>('PORTRAITS');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [internalModalState, setInternalModalState] = useState<{
    isOpen: boolean;
    currentIndex: number;
    activeItem: StageMediaItem | null;
  }>({
    isOpen: false,
    currentIndex: 0,
    activeItem: null,
  });

  const [isTheaterOpen, setIsTheaterOpen] = useState(false);
  const [theaterIndex, setTheaterIndex] = useState(0);

  // Map latestMusicReleases to StageMediaItem[]
  const cinemaReelItems: StageMediaItem[] = useMemo(() => {
    return (latestMusicReleasesData as Array<{
      id: string;
      title: string;
      actress: string;
      channel: string;
      publishedAt: string;
      thumbnail: string;
    }>).map((rel) => ({
      id: rel.id,
      title: rel.title,
      name: `${rel.title} - ${rel.actress}`,
      url: `https://www.youtube-nocookie.com/embed/${rel.id}`,
      thumbnail: rel.thumbnail,
      category: 'CINEMA REELS',
      type: 'video' as const,
      mediaType: 'clip' as const,
      parentAlbum: 'CINEMA REELS',
      poster: rel.thumbnail,
      posterUrl: rel.thumbnail,
      date: new Date(rel.publishedAt).getTime(),
      actress: rel.actress,
      channel: rel.channel,
      publishedAt: rel.publishedAt,
    } as StageMediaItem & { actress?: string; channel?: string; publishedAt?: string }));
  }, []);

  // Filter cinema reels by activeFilter (actress or 'ALL')
  const filteredCinemaReels = useMemo(() => {
    if (activeFilter === 'ALL') return cinemaReelItems;
    const filter = activeFilter.toLowerCase();
    return cinemaReelItems.filter((item: any) => {
      const act = (item.actress || '').toLowerCase();
      return act.includes(filter) || filter.includes(act);
    });
  }, [cinemaReelItems, activeFilter]);

  const cinemaReelsAlbum: AlbumData = useMemo(() => ({
    id: 'cinema-reels-archive',
    index: 0,
    name: 'CINEMA REELS',
    type: 'video' as const,
    itemCount: filteredCinemaReels.length,
    items: filteredCinemaReels,
    layoutType: 'grid-wall' as const,
    subtitle: 'Verified Actress Music Releases',
  }), [filteredCinemaReels]);

  const handleOpenCinemaReel = useCallback((index: number) => {
    hapticMedium();
    trackActivityEvent(1);
    setTheaterIndex(index);
    setIsTheaterOpen(true);
  }, []);

  useBackButton(
    useCallback(() => {
      if (isTheaterOpen) {
        setIsTheaterOpen(false);
        return true;
      }
      return false;
    }, [isTheaterOpen])
  );

  // 1. Scroll Controller with Top Guard & Direction Hysteresis
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const accumulatedDelta = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = (currentScrollY: number) => {
      const scrollPos = Math.max(0, currentScrollY);
      const delta = scrollPos - lastScrollY.current;

      // Guard: Always show and never oscillate when within 140px from the top
      if (scrollPos <= 140) {
        setHeaderVisible(true);
        accumulatedDelta.current = 0;
        lastScrollY.current = scrollPos;
        return;
      }

      // Accumulate direction delta (reset on direction reversal)
      if ((delta > 0 && accumulatedDelta.current < 0) || (delta < 0 && accumulatedDelta.current > 0)) {
        accumulatedDelta.current = 0;
      }
      accumulatedDelta.current += delta;

      // Require deliberate 35px continuous threshold before toggling
      if (accumulatedDelta.current > 35) {
        setHeaderVisible(false); // Definite scroll down
      } else if (accumulatedDelta.current < -35) {
        setHeaderVisible(true);  // Definite scroll up
      }

      lastScrollY.current = scrollPos;
    };

    const container = scrollContainerRef.current;
    const onContainerScroll = () => {
      if (container) handleScroll(container.scrollTop);
    };
    const onWindowScroll = () => {
      handleScroll(window.scrollY);
    };

    if (container) {
      container.addEventListener('scroll', onContainerScroll, { passive: true });
    }
    window.addEventListener('scroll', onWindowScroll, { passive: true });

    return () => {
      if (container) {
        container.removeEventListener('scroll', onContainerScroll);
      }
      window.removeEventListener('scroll', onWindowScroll);
    };
  }, []);

  const rawWallpapers = (celebrityData as CelebrityItem[]) || [];
  const rawNews = (celebrityNewsData as CelebrityNewsItem[]) || [];

  const filteredWallpapers = useMemo(() => {
    if (activeFilter === 'ALL') {
      return rawWallpapers;
    }
    return rawWallpapers.filter(
      (item) => item.name.toLowerCase() === activeFilter.toLowerCase()
    );
  }, [rawWallpapers, activeFilter]);

  const filteredNews = useMemo(() => {
    if (activeFilter === 'ALL') {
      return rawNews;
    }
    return rawNews.filter(
      (item) => item.celebrity.toLowerCase() === activeFilter.toLowerCase()
    );
  }, [rawNews, activeFilter]);

  const stagePlaylist = useMemo(() => {
    return filteredWallpapers.map(toStageMediaItem);
  }, [filteredWallpapers]);

  const handleCardClick = useCallback(
    (index: number) => {
      hapticMedium();
      trackActivityEvent(1);
      const targetStageItem = stagePlaylist[index];
      if (!targetStageItem) return;

      if (onOpenPhoto) {
        onOpenPhoto(targetStageItem, stagePlaylist, index);
      } else {
        setInternalModalState({
          isOpen: true,
          currentIndex: index,
          activeItem: targetStageItem,
        });
      }
    },
    [onOpenPhoto, stagePlaylist]
  );

  return (
    <div className={`w-full h-full flex flex-col min-w-0 select-none relative overflow-hidden bg-[#09090b] ${className}`}>
      {/* 1. Header Bar: Title, View Switcher & Minimalist Flat Filters (Decoupled from Document Flow) */}
      <header
        className={`celebrity-header-wrapper showcase-control-header ${
          headerVisible ? 'visible' : 'hidden'
        } flex flex-col gap-3.5`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-base sm:text-lg font-serif font-bold tracking-widest text-[#f4f4f5] uppercase">
                CELEBRITY ARCHIVE
              </h1>
              <p className="text-[11px] tracking-wide text-neutral-400">
                Curated High-Definition Portraits &amp; Verified Intelligence on Leading Actresses
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* View Toggle Tabs */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#121215] border border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  hapticMedium();
                  setActiveTab('PORTRAITS');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-mono font-bold tracking-wide transition-all duration-200 cursor-pointer ${
                  activeTab === 'PORTRAITS'
                    ? 'bg-[#ccff00] text-black shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>PORTRAITS</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  hapticMedium();
                  setActiveTab('DISPATCHES');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-mono font-bold tracking-wide transition-all duration-200 cursor-pointer ${
                  activeTab === 'DISPATCHES'
                    ? 'bg-[#ccff00] text-black shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Newspaper className="w-3.5 h-3.5" />
                <span>DISPATCHES</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  hapticMedium();
                  setActiveTab('REELS');
                }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-mono font-bold tracking-wide transition-all duration-200 cursor-pointer ${
                  activeTab === 'REELS'
                    ? 'bg-[#ccff00] text-black shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>CINEMA REELS</span>
              </button>
            </div>
          </div>
        </div>

        {/* Minimalist Flat Filter Bar with Generous Spacing & Subtle Underline */}
        <div className="flex items-center gap-6 overflow-x-auto space-scrollbar pt-1.5 pb-0.5 border-t border-white/[0.06]">
          {FILTER_CHIPS.map((chip) => {
            const isActive = activeFilter === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => {
                  hapticMedium();
                  setActiveFilter(chip.id);
                }}
                className={`text-xs uppercase tracking-widest transition-all duration-150 cursor-pointer flex-shrink-0 pb-1.5 font-mono ${
                  isActive
                    ? 'text-[#ccff00] font-bold border-b-2 border-[#ccff00]'
                    : 'text-neutral-400 hover:text-neutral-200 border-b-2 border-transparent'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Scrollable Container with Static Dummy Spacer (Decoupled from Header Visibility) */}
      <div
        ref={scrollContainerRef}
        className="w-full h-full overflow-y-auto space-scrollbar relative"
      >
        {/* Static persistent spacer ensures document layout height never changes */}
        <div className="celebrity-header-spacer shrink-0" aria-hidden="true" />

        {/* 2. Main Body Content: Portraits vs News Feed vs Cinema Reels */}
        <main className="p-4 sm:p-6 lg:p-8 pb-20">
          {activeTab === 'PORTRAITS' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 items-stretch">
              {filteredWallpapers.map((item, idx) => {
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleCardClick(idx)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleCardClick(idx);
                      }
                    }}
                    className="group relative rounded-xl overflow-hidden bg-[#121215] border border-white/[0.08] hover:border-[#ccff00] hover:shadow-[0_0_20px_rgba(204,255,0,0.25)] shadow-md transition-all duration-500 cursor-pointer flex flex-col justify-end aspect-[3/4]"
                  >
                    {/* Background Image - Full Natural Color */}
                    <img
                      src={item.thumb || item.src}
                      alt={item.title}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* Ambient Top Vignette */}
                    <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

                    {/* Top Category Badge */}
                    <div className="absolute top-3 right-3 z-10">
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] tracking-wider uppercase text-neutral-300 bg-[#09090b]/80 backdrop-blur-md border border-white/[0.08] group-hover:border-[#ccff00]/40 transition-colors">
                        <Tag className="w-2.5 h-2.5 text-[#ccff00]" />
                        <span>{item.category}</span>
                      </span>
                    </div>

                    {/* Hover Maximize Pip */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                      <div className="w-12 h-12 rounded-full bg-[#ccff00] text-black flex items-center justify-center shadow-[0_0_20px_rgba(204,255,0,0.6)] group-hover:scale-110 transition-transform duration-300">
                        <Maximize2 className="w-5 h-5 text-black stroke-[2.5]" />
                      </div>
                    </div>

                    {/* Bottom Dark Gradient Caption Overlay */}
                    <div className="relative z-10 p-4 bg-gradient-to-t from-[#09090b]/95 via-[#09090b]/60 to-transparent flex flex-col gap-1 pointer-events-none">
                      <span className="font-serif font-bold tracking-wide text-sm text-[#f4f4f5] group-hover:text-[#ccff00] transition-colors">
                        {item.name}
                      </span>
                      <span className="font-sans text-xs text-neutral-400 line-clamp-1 leading-snug">
                        {item.title}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : activeTab === 'DISPATCHES' ? (
            /* BROADSHEET NEWSPAPER EDITORIAL SECTION */
            <CelebrityNewsPaper
              articles={filteredNews}
              onResetFilter={() => setActiveFilter('ALL')}
              activeFilter={activeFilter}
            />
          ) : (
            /* CINEMA REELS VIEW */
            filteredCinemaReels.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center my-auto min-h-[35vh] text-white/60">
                <Film className="w-10 h-10 text-white/30 mb-3" />
                <p className="text-white/80 text-sm font-semibold tracking-wider uppercase mb-1">
                  No Cinema Reels Found for {activeFilter}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveFilter('ALL')}
                  className="mt-3 px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-mono tracking-wider uppercase transition-all cursor-pointer"
                >
                  Show All Releases
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 items-stretch">
                {filteredCinemaReels.map((item, idx) => {
                  const itemAny = item as any;
                  const formattedDate = itemAny.publishedAt
                    ? new Date(itemAny.publishedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : '';

                  const channelBadgeClass =
                    itemAny.channel === 'T-Series'
                      ? 'bg-red-500/20 text-red-300 border-red-500/40'
                      : itemAny.channel === 'Zee Music Company'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : itemAny.channel === 'Sony Music India'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : itemAny.channel === 'YRF'
                      ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      : 'bg-white/10 text-white/90 border-white/20';

                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleOpenCinemaReel(idx)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleOpenCinemaReel(idx);
                        }
                      }}
                      className="group relative rounded-xl overflow-hidden bg-[#121215] border border-white/[0.08] hover:border-[#ccff00] hover:shadow-[0_0_20px_rgba(204,255,0,0.25)] shadow-md transition-all duration-500 cursor-pointer flex flex-col justify-between aspect-video select-none"
                    >
                      {/* 16:9 Thumbnail Cover */}
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />

                      {/* Ambient Obsidian Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#09090b]/95 via-[#09090b]/30 to-transparent pointer-events-none" />

                      {/* Top Right Record Label Badge */}
                      <div className="absolute top-2.5 right-2.5 z-10">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase backdrop-blur-md border shadow-md ${channelBadgeClass}`}>
                          {itemAny.channel || 'OFFICIAL'}
                        </span>
                      </div>

                      {/* Center Hover Play Icon */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                        <div className="w-12 h-12 rounded-full bg-[#ccff00] text-black flex items-center justify-center shadow-[0_0_20px_rgba(204,255,0,0.6)] group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-current ml-0.5 text-black" />
                        </div>
                      </div>

                      {/* Bottom Metadata Bar */}
                      <div className="relative z-10 p-3.5 mt-auto flex flex-col gap-1 pointer-events-none">
                        <h3 className="font-['Roboto_Condensed'] font-bold text-sm sm:text-base text-white group-hover:text-[#ccff00] transition-colors line-clamp-1">
                          {item.title}
                        </h3>
                        <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400">
                          <span className="text-zinc-300 font-medium group-hover:text-white transition-colors">
                            {itemAny.actress}
                          </span>
                          <span>{formattedDate}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </main>
      </div>

      {/* Fallback Internal MediaModal (used if onOpenPhoto is omitted) */}
      {!onOpenPhoto && internalModalState.isOpen && internalModalState.activeItem && (
        <MediaModal
          isOpen={internalModalState.isOpen}
          onClose={() =>
            setInternalModalState((prev) => ({ ...prev, isOpen: false }))
          }
          type="image"
          url={internalModalState.activeItem.url}
          title={internalModalState.activeItem.title}
          items={stagePlaylist}
          currentIndex={internalModalState.currentIndex}
          onIndexChange={(newIdx) => {
            const next = stagePlaylist[newIdx];
            if (next) {
              setInternalModalState((prev) => ({
                ...prev,
                currentIndex: newIdx,
                activeItem: next,
              }));
            }
          }}
        />
      )}

      {/* In-App Native YouTube Theater Modal for Cinema Reels */}
      <YouTubeTheaterModal
        isOpen={isTheaterOpen}
        onClose={() => setIsTheaterOpen(false)}
        album={cinemaReelsAlbum}
        allAlbums={[cinemaReelsAlbum]}
        initialIndex={theaterIndex}
        title={filteredCinemaReels[theaterIndex]?.title}
        onIndexChange={setTheaterIndex}
      />
    </div>
  );
};

export default CelebrityShowcase;
