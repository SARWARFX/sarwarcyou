import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CyberCard } from './CyberCard';
import type { StageMediaItem } from '../types';

export interface CyberCarouselRowProps {
  title: string;
  subtitle?: string;
  badge?: string | number;
  items: StageMediaItem[];
  variant?: 'standard' | 'shorts' | 'photo';
  onSelectItem: (item: StageMediaItem) => void;
}

export const CyberCarouselRow: React.FC<CyberCarouselRowProps> = ({
  title,
  subtitle,
  badge,
  items,
  variant = 'standard',
  onSelectItem,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const scrollByDelta = (delta: number) => {
    if (!trackRef.current) return;
    trackRef.current.scrollBy({ left: delta, behavior: 'smooth' });
  };

  if (!items || items.length === 0) return null;

  return (
    <section className="w-full flex flex-col gap-3.5 select-none">
      {/* Row Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-baseline gap-2.5">
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

        {/* Scroll Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scrollByDelta(-480)}
            aria-label={`Scroll ${title} left`}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer border border-transparent hover:border-white/10"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollByDelta(480)}
            aria-label={`Scroll ${title} right`}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer border border-transparent hover:border-white/10"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable Track */}
      <div
        ref={trackRef}
        className="flex items-center gap-3.5 sm:gap-4 overflow-x-auto no-scrollbar scroll-smooth py-2 px-1"
      >
        {items.map((item) => (
          <CyberCard
            key={item.id}
            item={item}
            variant={variant}
            onClick={onSelectItem}
          />
        ))}
      </div>
    </section>
  );
};

export default CyberCarouselRow;
