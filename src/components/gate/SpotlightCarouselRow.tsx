import React, { useRef } from 'react';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import type { StageMediaItem } from '../../types';
import { LivingMediaCard } from './LivingMediaCard';
import { hapticLight } from '../../utils/hapticsManager';

export interface SpotlightCarouselRowProps {
  title: string;
  badge?: string;
  items: StageMediaItem[];
  aspectRatio: '9/16' | '16/9' | '3/4';
  cardWidthClass?: string;
  onOpenItem: (item: StageMediaItem, idx: number) => void;
  subfolderLabelResolver?: (item: StageMediaItem) => string;
}

export const SpotlightCarouselRow: React.FC<SpotlightCarouselRowProps> = ({
  title,
  badge = 'CURATOR PICK',
  items,
  aspectRatio,
  cardWidthClass = 'w-40 sm:w-48 lg:w-56',
  onOpenItem,
  subfolderLabelResolver,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  if (!items || items.length === 0) return null;

  const spotlightPool = items.slice(0, 10);

  const handleScroll = (direction: 'left' | 'right') => {
    hapticLight();
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -320 : 320;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full mb-8 flex flex-col shrink-0">
      {/* Spotlight Row Header */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#ccff00]" />
          <span className="text-xs font-mono font-bold tracking-widest uppercase text-white">
            {title}
          </span>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-[#ccff00]/10 border border-[#ccff00]/30 text-[#ccff00] text-[9px] font-mono font-bold tracking-widest uppercase">
            {badge}
          </span>
        </div>

        {/* Carousel Arrow Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleScroll('left')}
            className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-[#ccff00]/15 hover:border-[#ccff00] border border-white/10 text-neutral-300 hover:text-[#ccff00] flex items-center justify-center transition-all cursor-pointer"
            title="Scroll Left"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleScroll('right')}
            className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-[#ccff00]/15 hover:border-[#ccff00] border border-white/10 text-neutral-300 hover:text-[#ccff00] flex items-center justify-center transition-all cursor-pointer"
            title="Scroll Right"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Carousel Track */}
      <div
        ref={scrollRef}
        className="w-full overflow-x-auto space-scrollbar flex gap-3.5 sm:gap-4 pb-2 snap-x snap-mandatory select-none"
        style={{ scrollbarWidth: 'thin' }}
      >
        {spotlightPool.map((item, idx) => (
          <div
            key={`spotlight-${item.id || item.url || idx}`}
            className={`shrink-0 ${cardWidthClass} snap-start`}
          >
            <LivingMediaCard
              item={item}
              aspectRatio={aspectRatio}
              featuredBadge="SPOTLIGHT"
              subfolderLabel={subfolderLabelResolver ? subfolderLabelResolver(item) : undefined}
              delayIdx={idx}
              onClick={() => onOpenItem(item, idx)}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SpotlightCarouselRow;
