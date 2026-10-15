import React from 'react';
import { Search, X } from 'lucide-react';

export type CyberFilterType = 'all' | 'clips' | 'images' | 'shorts';

export interface CyberHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
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
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  onReset,
}) => {
  return (
    <header className="fixed top-3 sm:top-5 left-0 right-0 z-50 flex justify-center px-3 sm:px-4 pointer-events-none">
      <div className="cyber-pill pointer-events-auto flex items-center justify-between gap-2.5 sm:gap-4 px-3 sm:px-5 py-2 w-full max-w-4xl shadow-[0_12px_40px_rgba(0,0,0,0.85)] transition-all duration-300">
        {/* Brand Wordmark */}
        <button
          type="button"
          onClick={onReset}
          className="cyber-wordmark text-xs sm:text-sm font-black tracking-[0.2em] cursor-pointer flex-shrink-0"
          title="Sarwar C You Media Vault"
        >
          SARWARCYOU
        </button>

        {/* Omnisearch Input */}
        <div className="relative flex-1 max-w-xs sm:max-w-sm flex items-center">
          <Search className="absolute left-3 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search vault..."
            className="w-full pl-8 pr-7 py-1.5 rounded-full bg-white/5 hover:bg-white/10 focus:bg-white/10 text-xs text-white placeholder-zinc-500 font-sans outline-none border border-transparent focus:border-[#00E5FF]/40 transition-all duration-200"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 p-0.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0">
          {FILTER_OPTIONS.map((f) => {
            const isActive = activeFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onFilterChange(f.id)}
                className={`px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold font-sans tracking-wider transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-white/15 text-[#00E5FF] border border-[#00E5FF]/40 shadow-[0_0_12px_rgba(0,229,255,0.35)]'
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
