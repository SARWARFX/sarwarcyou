import React from 'react';

export type CyberFilterType = 'all' | 'clips' | 'images' | 'shorts';

export interface CyberHeaderProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  activeFilter: CyberFilterType;
  onFilterChange: (filter: CyberFilterType) => void;
  onReset?: () => void;
}

const FILTER_OPTIONS: { id: CyberFilterType; label: string }[] = [
  { id: 'clips', label: 'Video Clips' },
  { id: 'images', label: 'Images' },
  { id: 'shorts', label: 'Shorts' },
];

export const CyberHeader: React.FC<CyberHeaderProps> = ({
  activeFilter,
  onFilterChange,
}) => {
  return (
    <header className="fixed top-3 sm:top-5 left-0 right-0 z-50 flex justify-center px-3 sm:px-4 pointer-events-none">
      <div className="cyber-pill pointer-events-auto flex items-center justify-center gap-2.5 sm:gap-4 px-4 sm:px-6 py-2 w-auto max-w-4xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] transition-all duration-300">
        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar flex-shrink-0">
          {FILTER_OPTIONS.map((f) => {
            const isActive = activeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onFilterChange(f.id)}
                className={`px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold font-sans tracking-wider transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-white text-black font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};

export default CyberHeader;
