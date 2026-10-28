import React from 'react';
import { Sparkles, Smartphone, Film, Camera } from 'lucide-react';
import type { CyberFilterType } from './CyberHeader';

export interface HomeFilterChipsProps {
  activeFilter: CyberFilterType;
  onFilterChange: (filter: CyberFilterType) => void;
  counts?: {
    all?: number;
    shorts?: number;
    videos?: number;
    photos?: number;
  };
  className?: string;
}

interface FilterChip {
  id: CyberFilterType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  countKey?: 'all' | 'shorts' | 'videos' | 'photos';
}

const FILTER_CHIPS: FilterChip[] = [
  { id: 'all', label: 'All', icon: Sparkles, countKey: 'all' },
  { id: 'shorts', label: 'Shorts', icon: Smartphone, countKey: 'shorts' },
  { id: 'clips', label: 'Videos', icon: Film, countKey: 'videos' },
  { id: 'images', label: 'Photographs', icon: Camera, countKey: 'photos' },
];

export const HomeFilterChips: React.FC<HomeFilterChipsProps> = ({
  activeFilter,
  onFilterChange,
  counts,
  className = '',
}) => {
  return (
    <nav
      aria-label="Content category filters"
      className={`w-full overflow-x-auto no-scrollbar scrollbar-none py-2 select-none ${className}`}
    >
      <div className="flex items-center gap-2.5 sm:gap-3 px-1 min-w-max">
        {FILTER_CHIPS.map((chip) => {
          const isActive = activeFilter === chip.id;
          const Icon = chip.icon;
          const count = chip.countKey && counts ? counts[chip.countKey] : undefined;

          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onFilterChange(chip.id)}
              aria-pressed={isActive}
              className={`relative flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer backdrop-blur-xl border ${
                isActive
                  ? 'bg-[#00E5FF]/15 text-[#00E5FF] border-[#00E5FF]/60 shadow-[0_0_20px_rgba(0,229,255,0.35)] scale-[1.02]'
                  : 'bg-white/[0.04] text-zinc-300 hover:text-white hover:bg-white/[0.08] border-white/10 hover:border-white/20'
              }`}
            >
              <Icon
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${
                  isActive ? 'text-[#00E5FF] scale-110' : 'text-zinc-400 group-hover:text-zinc-200'
                }`}
              />
              <span className="tracking-wide">{chip.label}</span>
              {typeof count === 'number' && count > 0 && (
                <span
                  className={`text-[10px] sm:text-xs font-mono px-1.5 py-0.2 rounded-full transition-colors ${
                    isActive
                      ? 'bg-[#00E5FF]/25 text-[#00E5FF]'
                      : 'bg-white/10 text-zinc-400'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default HomeFilterChips;
