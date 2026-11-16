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
              className={`reticle-chip ${
                isActive ? 'active-chip' : ''
              }`}
            >
              <Icon
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${
                  isActive ? 'text-[#00f0ff] scale-110' : 'text-neutral-400 group-hover:text-white'
                }`}
              />
              <span className="tracking-wide uppercase font-mono">{chip.label}</span>
              {typeof count === 'number' && count > 0 && (
                <span
                  className={`text-[10px] sm:text-xs font-mono px-1.5 py-0.5 rounded transition-colors ${
                    isActive
                      ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40'
                      : 'bg-white/10 text-neutral-400'
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
