import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Sparkles,
  Maximize2,
  Tag,
  Image as ImageIcon,
  Newspaper,
} from 'lucide-react';
import celebrityData from '../data/celebrityGallery.json';
import celebrityNewsData from '../data/celebrityNews.json';
import type { StageMediaItem } from '../types';
import { MediaModal } from './MediaModal';
import { hapticMedium } from '../utils/hapticsManager';
import { CelebrityNewsPaper } from './CelebrityNewsPaper';

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
];

function toStageMediaItem(entry: CelebrityItem): StageMediaItem {
  return {
    id: entry.id,
    title: entry.title,
    name: entry.name,
    url: entry.src,
    path: entry.src,
    thumbnail: entry.thumb || entry.src,
    category: entry.category || 'Bollywood',
    type: 'image',
    mediaType: 'photo',
    parentAlbum: 'Bollywood Wallpapers',
  };
}

export const CelebrityShowcase: React.FC<CelebrityShowcaseProps> = ({
  onOpenPhoto,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'WALLPAPERS' | 'NEWS'>('WALLPAPERS');
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

  // Smart auto-hiding sticky header state
  const [headerVisible, setHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback((currentScrollY: number) => {
    const delta = currentScrollY - lastScrollY.current;

    // Always keep header visible near the absolute top
    if (currentScrollY < 60) {
      setHeaderVisible(true);
    }
    // Scrolling DOWN -> Hide header for 100% immersive view
    else if (delta > 8) {
      setHeaderVisible(false);
    }
    // Scrolling UP -> Reveal header smoothly
    else if (delta < -8) {
      setHeaderVisible(true);
    }

    lastScrollY.current = currentScrollY;
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const onContainerScroll = () => {
      handleScroll(container.scrollTop);
    };

    container.addEventListener('scroll', onContainerScroll, { passive: true });
    return () => container.removeEventListener('scroll', onContainerScroll);
  }, [handleScroll]);

  useEffect(() => {
    const onWindowScroll = () => {
      handleScroll(window.scrollY);
    };
    window.addEventListener('scroll', onWindowScroll, { passive: true });
    return () => window.removeEventListener('scroll', onWindowScroll);
  }, [handleScroll]);

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
    <div className={`w-full h-full flex flex-col min-w-0 select-none relative overflow-hidden ${className}`}>
      {/* Scrollable Container with Auto-Hiding Sticky Control Header */}
      <div
        ref={scrollContainerRef}
        className="w-full h-full overflow-y-auto space-scrollbar relative"
      >
        {/* 1. Header Bar: Title, View Switcher & Quick Filters (Auto-Hiding Sticky) */}
        <header
          className={`showcase-control-header ${
            headerVisible ? 'visible' : 'hidden'
          } flex flex-col gap-3`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#38bdf8]/10 border border-[#38bdf8]/30 flex items-center justify-center shadow-[0_0_15px_rgba(56,189,248,0.3)]">
                <Sparkles className="w-4 h-4 text-[#38bdf8] animate-pulse" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black font-['Roboto_Condensed'] tracking-[0.22em] text-white uppercase flex items-center gap-2">
                  BOLLYWOOD ARCHIVE
                  <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] shadow-[0_0_6px_#38bdf8]" />
                </h1>
                <p className="text-[10px] font-mono tracking-widest text-neutral-400 uppercase">
                  ULTRA-HD CELEBRITY WALLPAPERS & VERIFIED DAILY INTEL
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {/* View Toggle Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    setActiveTab('WALLPAPERS');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-['Roboto_Condensed'] font-bold tracking-wider transition-all duration-200 cursor-pointer ${
                    activeTab === 'WALLPAPERS'
                      ? 'bg-gradient-to-r from-[#0284c7] to-[#38bdf8] text-neutral-950 shadow-[0_0_15px_rgba(56,189,248,0.5)]'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>WALLPAPERS</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    setActiveTab('NEWS');
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-['Roboto_Condensed'] font-bold tracking-wider transition-all duration-200 cursor-pointer ${
                    activeTab === 'NEWS'
                      ? 'bg-gradient-to-r from-[#0284c7] to-[#38bdf8] text-neutral-950 shadow-[0_0_15px_rgba(56,189,248,0.5)]'
                      : 'text-white/70 hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <Newspaper className="w-3.5 h-3.5" />
                  <span>DAILY INTEL</span>
                </button>
              </div>

              {/* Item Count Pill */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-xs font-['Roboto_Condensed'] font-bold tracking-wider text-[#38bdf8] shrink-0">
                {activeTab === 'WALLPAPERS' ? (
                  <>
                    <ImageIcon className="w-3.5 h-3.5" />
                    <span>{filteredWallpapers.length} PORTRAITS</span>
                  </>
                ) : (
                  <>
                    <Newspaper className="w-3.5 h-3.5" />
                    <span>{filteredNews.length} ARTICLES</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Quick Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto space-scrollbar py-1">
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
                  className={`px-3.5 py-1.5 rounded-full text-xs font-['Roboto_Condensed'] font-bold tracking-wider uppercase transition-all duration-200 cursor-pointer flex-shrink-0 ${
                    isActive
                      ? 'bg-gradient-to-r from-[#0284c7] to-[#38bdf8] text-neutral-950 shadow-[0_0_15px_rgba(56,189,248,0.5)] scale-105'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] text-white/70 hover:text-white border border-white/10'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </header>

        {/* 2. Main Body Content: Wallpapers vs News Feed */}
        <main className="p-4 sm:p-6 lg:p-8 pb-20">
          {activeTab === 'WALLPAPERS' ? (
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
                    className="group relative rounded-2xl overflow-hidden bg-[#090d16] border border-[#38bdf8]/15 hover:border-[#38bdf8]/40 shadow-[0_12px_30px_rgba(0,0,0,0.85)] hover:shadow-[0_20px_45px_rgba(56,189,248,0.25)] transition-all duration-300 hover:scale-[1.02] cursor-pointer flex flex-col justify-end aspect-[3/4]"
                  >
                    {/* Background Image */}
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
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase text-white/90 bg-black/60 backdrop-blur-md border border-white/15 shadow-sm">
                        <Tag className="w-2.5 h-2.5 text-[#38bdf8]" />
                        <span>{item.category}</span>
                      </span>
                    </div>

                    {/* Hover Maximize Pip */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                      <div className="w-12 h-12 rounded-full bg-white/90 text-neutral-950 flex items-center justify-center shadow-[0_0_25px_rgba(56,189,248,0.7)] backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
                        <Maximize2 className="w-5 h-5 text-neutral-950" />
                      </div>
                    </div>

                    {/* Bottom Dark Gradient Caption Overlay */}
                    <div className="relative z-10 p-4 bg-gradient-to-t from-[#020408]/95 via-[#020408]/60 to-transparent flex flex-col gap-1 pointer-events-none">
                      <span className="font-['Roboto_Condensed'] font-black tracking-widest text-xs uppercase text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                        {item.name}
                      </span>
                      <span className="font-sans text-[11px] text-neutral-300 line-clamp-1 leading-snug">
                        {item.title}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* BROADSHEET NEWSPAPER EDITORIAL SECTION */
            <CelebrityNewsPaper
              articles={filteredNews}
              onResetFilter={() => setActiveFilter('ALL')}
              activeFilter={activeFilter}
            />
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
    </div>
  );
};

export default CelebrityShowcase;
