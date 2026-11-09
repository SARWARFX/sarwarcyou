import React, { useState, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Maximize2,
  Tag,
  Image as ImageIcon,
  Newspaper,
  Clock,
  ExternalLink,
} from 'lucide-react';
import celebrityData from '../data/celebrityGallery.json';
import celebrityNewsData from '../data/celebrityNews.json';
import type { StageMediaItem } from '../types';
import { MediaModal } from './MediaModal';
import { hapticMedium } from '../utils/hapticsManager';

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

function formatTimeAgo(isoString: string): string {
  try {
    const pub = new Date(isoString).getTime();
    if (isNaN(pub)) return 'Recent';
    const diffMs = Date.now() - pub;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;
    return new Date(isoString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Recent';
  }
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
    <div className={`w-full h-full flex flex-col min-w-0 select-none ${className}`}>
      {/* 1. Header Bar: Title, View Switcher & Quick Filters */}
      <header className="flex-shrink-0 pb-3 mb-4 border-b border-white/[0.08] flex flex-col gap-3">
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
      <main className="flex-1 overflow-y-auto space-scrollbar pr-1 pb-16">
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
          /* NEWS TELEMETRY FEED */
          <div className="flex flex-col gap-4 max-w-5xl mx-auto">
            {filteredNews.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-white/[0.02] border border-white/10 flex flex-col items-center justify-center gap-3">
                <Newspaper className="w-8 h-8 text-neutral-500" />
                <p className="text-sm font-mono text-neutral-400">
                  NO RECENT HEADLINES MATCHING THIS FILTER
                </p>
              </div>
            ) : (
              filteredNews.map((article) => {
                return (
                  <article
                    key={article.id}
                    className="group relative rounded-2xl p-4 sm:p-5 border border-[#38bdf8]/20 hover:border-[#38bdf8]/50 transition-all duration-300 flex flex-col sm:flex-row gap-4 items-start shadow-[0_8px_30px_rgba(0,0,0,0.6)] hover:shadow-[0_12px_40px_rgba(56,189,248,0.15)]"
                    style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)' }}
                  >
                    {/* Optional Thumbnail Preview */}
                    {article.imageUrl && (
                      <div className="w-full sm:w-44 h-36 sm:h-28 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-black/40 relative">
                        <img
                          src={article.imageUrl}
                          alt={article.headline}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          onError={(e) => {
                            // Hide image if broken
                            (e.currentTarget as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      {/* Meta Tags Bar */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Actress Badge */}
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/30">
                          [ {article.celebrity.toUpperCase()} ]
                        </span>

                        {/* Category Badge */}
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono tracking-wider uppercase text-neutral-300 bg-white/[0.05] border border-white/10">
                          {article.category}
                        </span>

                        {/* Time-ago & Source Badge */}
                        <span className="text-[11px] font-mono text-neutral-400 flex items-center gap-1.5 ml-auto">
                          <Clock className="w-3 h-3 text-[#38bdf8]" />
                          <span>{formatTimeAgo(article.publishedAt)}</span>
                          <span className="text-neutral-600">•</span>
                          <span className="text-neutral-300 font-semibold">{article.source}</span>
                        </span>
                      </div>

                      {/* Headline */}
                      <a
                        href={article.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm sm:text-base font-bold text-white group-hover:text-[#38bdf8] group-hover:underline transition-colors leading-snug line-clamp-2"
                      >
                        {article.headline}
                      </a>

                      {/* Summary Excerpt */}
                      <p className="text-xs sm:text-[13px] text-neutral-300/90 line-clamp-2 leading-relaxed">
                        {article.summary}
                      </p>

                      {/* Action Button */}
                      <div className="pt-1 flex items-center justify-between">
                        <a
                          href={article.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold tracking-wider text-[#38bdf8] hover:text-white bg-[#38bdf8]/10 hover:bg-[#38bdf8]/20 border border-[#38bdf8]/30 transition-all active:scale-95 cursor-pointer"
                        >
                          <span>READ FULL REPORT</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}
      </main>

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
