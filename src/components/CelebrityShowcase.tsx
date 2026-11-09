import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
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
    <div className={`w-full h-full flex flex-col min-w-0 select-none relative overflow-hidden bg-[#09090b] ${className}`}>
      {/* Scrollable Container with Auto-Hiding Sticky Control Header */}
      <div
        ref={scrollContainerRef}
        className="w-full h-full overflow-y-auto space-scrollbar relative"
      >
        {/* 1. Header Bar: Title, View Switcher & Minimalist Flat Filters (Auto-Hiding Sticky) */}
        <header
          className={`showcase-control-header ${
            headerVisible ? 'visible' : 'hidden'
          } flex flex-col gap-3.5`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-base sm:text-lg font-serif font-bold tracking-widest text-[#f4f4f5] uppercase">
                  BOLLYWOOD ARCHIVE
                </h1>
                <p className="text-[11px] tracking-wide text-neutral-400">
                  Curated Celebrity Photography & Cultural Chronicles
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
                    setActiveTab('WALLPAPERS');
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-sans tracking-wide transition-all duration-200 cursor-pointer ${
                    activeTab === 'WALLPAPERS'
                      ? 'bg-white text-neutral-950 font-semibold shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>GALLERY</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    hapticMedium();
                    setActiveTab('NEWS');
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-sans tracking-wide transition-all duration-200 cursor-pointer ${
                    activeTab === 'NEWS'
                      ? 'bg-white text-neutral-950 font-semibold shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Newspaper className="w-3.5 h-3.5" />
                  <span>CHRONICLE</span>
                </button>
              </div>

              {/* Item Count Pill */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#121215] border border-white/[0.08] text-xs text-neutral-400 shrink-0">
                {activeTab === 'WALLPAPERS' ? (
                  <span>{filteredWallpapers.length} PORTRAITS</span>
                ) : (
                  <span>{filteredNews.length} DISPATCHES</span>
                )}
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
                  className={`text-xs uppercase tracking-widest transition-all duration-150 cursor-pointer flex-shrink-0 pb-1.5 ${
                    isActive
                      ? 'text-white font-bold border-b-2 border-white'
                      : 'text-neutral-400 hover:text-neutral-200 border-b-2 border-transparent'
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
                    className="group relative rounded-xl overflow-hidden bg-[#121215] border border-white/[0.08] hover:border-white/30 shadow-md hover:shadow-xl transition-all duration-300 hover:scale-[1.01] cursor-pointer flex flex-col justify-end aspect-[3/4]"
                  >
                    {/* Background Image */}
                    <img
                      src={item.thumb || item.src}
                      alt={item.title}
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />

                    {/* Ambient Top Vignette */}
                    <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />

                    {/* Top Category Badge */}
                    <div className="absolute top-3 right-3 z-10">
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] tracking-wider uppercase text-neutral-300 bg-[#09090b]/80 backdrop-blur-md border border-white/[0.08]">
                        <Tag className="w-2.5 h-2.5 text-neutral-400" />
                        <span>{item.category}</span>
                      </span>
                    </div>

                    {/* Hover Maximize Pip */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
                      <div className="w-11 h-11 rounded-full bg-white text-neutral-950 flex items-center justify-center shadow-lg backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
                        <Maximize2 className="w-4 h-4 text-neutral-950" />
                      </div>
                    </div>

                    {/* Bottom Dark Gradient Caption Overlay */}
                    <div className="relative z-10 p-4 bg-gradient-to-t from-[#09090b]/95 via-[#09090b]/60 to-transparent flex flex-col gap-1 pointer-events-none">
                      <span className="font-serif font-bold tracking-wide text-sm text-[#f4f4f5]">
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
