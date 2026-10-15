import React, { useState, useMemo, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { CyberCard } from './CyberCard';
import type { StageMediaItem } from '../types';

export type AlbumCategoryFilter = 'all' | 'photos' | 'clips' | 'shorts';

export interface CyberCarouselRowProps {
  title: string;
  subtitle?: string;
  badge?: string | number;
  items: StageMediaItem[];
  variant?: 'standard' | 'shorts' | 'photo';
  onSelectItem: (item: StageMediaItem, currentFilteredItems?: StageMediaItem[]) => void;
  onViewAll?: () => void;
  hasMultipleTypes?: boolean;
  typeCounts?: {
    photos: number;
    clips: number;
    shorts: number;
  };
}

export const CyberCarouselRow: React.FC<CyberCarouselRowProps> = ({
  title,
  subtitle,
  badge,
  items,
  variant = 'standard',
  onSelectItem,
  onViewAll,
  hasMultipleTypes,
  typeCounts,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [subFilter, setSubFilter] = useState<AlbumCategoryFilter>('all');

  const counts = useMemo(() => {
    if (typeCounts) return typeCounts;
    let photos = 0;
    let clips = 0;
    let shorts = 0;
    for (const it of items) {
      if (it.mediaType === 'short') shorts++;
      else if (it.mediaType === 'clip' || it.type === 'video') clips++;
      else photos++;
    }
    return { photos, clips, shorts };
  }, [items, typeCounts]);

  const showFilters =
    hasMultipleTypes ??
    ((counts.photos > 0 && counts.clips > 0) ||
      (counts.photos > 0 && counts.shorts > 0) ||
      (counts.clips > 0 && counts.shorts > 0));

  const filteredItems = useMemo(() => {
    if (!showFilters || subFilter === 'all') return items;
    return items.filter((it) => {
      const isShort = it.mediaType === 'short';
      const isClip = !isShort && (it.mediaType === 'clip' || it.type === 'video');
      const isPhoto = !isShort && !isClip;

      if (subFilter === 'photos') return isPhoto;
      if (subFilter === 'clips') return isClip;
      if (subFilter === 'shorts') return isShort;
      return true;
    });
  }, [items, showFilters, subFilter]);

  if (!items || items.length === 0) return null;

  return (
    <section className="w-full flex flex-col gap-3.5 select-none">
      {/* Row Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-base sm:text-lg md:text-xl font-bold font-sans tracking-wide text-zinc-100 uppercase">
            {title}
          </h2>
          {badge !== undefined && (
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white/5 text-[#00E5FF] border border-[#00E5FF]/20">
              {badge}
            </span>
          )}
          {subtitle && (
            <span className="text-xs font-mono text-zinc-400 hidden sm:inline ml-1">
              — {subtitle}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
          {/* Category Filter Tabs for Multi-Type Albums */}
          {showFilters && (
            <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-full border border-white/[0.08] backdrop-blur-md">
              <button
                type="button"
                onClick={() => setSubFilter('all')}
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium transition-all cursor-pointer ${
                  subFilter === 'all'
                    ? 'bg-[#00E5FF] text-black font-bold shadow-[0_0_12px_rgba(0,229,255,0.4)]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                All
              </button>
              {counts.photos > 0 && (
                <button
                  type="button"
                  onClick={() => setSubFilter('photos')}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    subFilter === 'photos'
                      ? 'bg-cyan-400 text-black font-bold shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Photos ({counts.photos})
                </button>
              )}
              {counts.clips > 0 && (
                <button
                  type="button"
                  onClick={() => setSubFilter('clips')}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    subFilter === 'clips'
                      ? 'bg-amber-400 text-black font-bold shadow-[0_0_12px_rgba(251,191,36,0.4)]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Clips ({counts.clips})
                </button>
              )}
              {counts.shorts > 0 && (
                <button
                  type="button"
                  onClick={() => setSubFilter('shorts')}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    subFilter === 'shorts'
                      ? 'bg-fuchsia-400 text-black font-bold shadow-[0_0_12px_rgba(232,121,249,0.4)]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Shorts ({counts.shorts})
                </button>
              )}
            </div>
          )}

          {/* View All Action Button */}
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] hover:bg-[#00E5FF]/20 text-zinc-300 hover:text-[#00E5FF] border border-white/10 hover:border-[#00E5FF]/40 text-xs font-mono font-medium transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 group/viewall ml-auto"
              aria-label={`View all items in ${title}`}
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#00E5FF] transition-transform duration-200 group-hover/viewall:translate-x-0.5" />
            </button>
          )}
        </div>
      </div>

      {/* Natural Horizontal Carousel Track */}
      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto no-scrollbar scrollbar-none scroll-smooth px-4 md:px-12 py-2 select-none"
      >
        {filteredItems.map((item, idx) => (
          <CyberCard
            key={item.id || `${item.url}-${idx}`}
            item={item}
            variant={variant}
            albumItems={filteredItems}
            initialIndex={idx % filteredItems.length}
            onClick={(it) => onSelectItem(it, filteredItems)}
          />
        ))}
      </div>
    </section>
  );
};

export default CyberCarouselRow;

