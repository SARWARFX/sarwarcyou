import React, { useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { CyberCard } from './CyberCard';
import type { StageMediaItem } from '../types';

export interface CyberCarouselRowProps {
  title: string;
  items: StageMediaItem[];
  variant?: 'standard' | 'shorts' | 'photo';
  onSelectItem: (item: StageMediaItem, currentFilteredItems?: StageMediaItem[]) => void;
  onViewAll?: () => void;
  // Optional backwards-compatibility props
  subtitle?: string;
  badge?: string | number;
  hasMultipleTypes?: boolean;
  typeCounts?: {
    photos: number;
    clips: number;
    shorts: number;
  };
}

export const CyberCarouselRow: React.FC<CyberCarouselRowProps> = ({
  title,
  items,
  variant = 'standard',
  onSelectItem,
  onViewAll,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);

  if (!items || items.length === 0) return null;

  return (
    <section className="w-full flex flex-col gap-2.5 select-none">
      {/* Clean Album Header: Only Album Name + View All */}
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-sm sm:text-base md:text-lg font-bold font-sans tracking-wide uppercase truncate" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h2>

        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="flex items-center gap-1 text-xs font-mono transition-colors cursor-pointer flex-shrink-0"
            style={{ color: 'var(--text-secondary)' }}
            aria-label={`View all items in ${title}`}
          >
            <span>View All</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Lightweight Horizontal Track */}
      <div
        ref={trackRef}
        className="flex gap-3 overflow-x-auto no-scrollbar scrollbar-none py-1 select-none touch-scroll-container"
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'auto',
        }}
      >
        {items.map((item, idx) => (
          <CyberCard
            key={item.id || `${item.url}-${idx}`}
            item={item}
            variant={variant}
            albumItems={items}
            initialIndex={idx % items.length}
            onClick={(it) => onSelectItem(it, items)}
          />
        ))}
      </div>
    </section>
  );
};

export default CyberCarouselRow;
