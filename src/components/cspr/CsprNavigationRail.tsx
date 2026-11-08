import React from 'react';

export type CsprTab = 'HOME' | 'CLIPS' | 'SHORTS' | 'PHOTOGRAPHY' | 'REALTUBE';

export interface CsprNavigationRailProps {
  activeTab: CsprTab;
  onSelectTab: (tab: CsprTab) => void;
}

interface NavItemDef {
  key: CsprTab;
  icon: string;
  label: string;
  shortLabel: string;
}

const NAV_ITEMS: NavItemDef[] = [
  { key: 'HOME', icon: 'H', label: 'HOME', shortLabel: 'HOME' },
  { key: 'CLIPS', icon: 'C', label: 'CLIPS', shortLabel: 'CLIPS' },
  { key: 'SHORTS', icon: 'S', label: 'SHORTS', shortLabel: 'SHORTS' },
  { key: 'PHOTOGRAPHY', icon: 'P', label: 'PHOTOGRAPHY', shortLabel: 'PHOTO' },
  { key: 'REALTUBE', icon: 'R', label: 'REALTUBE', shortLabel: 'REALTUBE' },
];

export const CsprNavigationRail: React.FC<CsprNavigationRailProps> = ({
  activeTab,
  onSelectTab,
}) => {
  return (
    <>
      {/* ========================================================= */}
      {/* 1. DESKTOP BORDER-ATTACHED RAIL (Flush Left, Centered Vertically) */}
      {/* ========================================================= */}
      <nav
        aria-label="CSPR Navigation Rail"
        className="fixed left-0 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col bg-black/80 backdrop-blur-2xl border-r border-white/10 rounded-r-2xl py-3 shadow-[0_8px_32px_rgba(0,0,0,0.85)] select-none"
      >
        <div className="flex flex-col space-y-2">
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectTab(item.key)}
                className="group relative flex items-center h-12 px-3 text-left transition-all duration-300 outline-none select-none cursor-pointer border-0 bg-transparent"
                title={item.label}
              >
                {/* Active Accent Indicator (Left Border Bar) */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 bg-white rounded-r shadow-[0_0_10px_rgba(255,255,255,0.9)]" />
                )}

                {/* Letter / Symbol Glyph */}
                <span
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-['Audiowide',cursive,sans-serif] text-sm transition-all duration-200 ${
                    isActive
                      ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.5)] scale-105'
                      : 'text-neutral-400 group-hover:text-white group-hover:bg-white/10'
                  }`}
                >
                  {item.icon}
                </span>

                {/* Hover Slide-Out Label: Smoothly expands to the right on hover */}
                <span
                  className={`overflow-hidden whitespace-nowrap font-['Audiowide',cursive,sans-serif] text-xs tracking-[0.22em] uppercase transition-all duration-300 max-w-0 opacity-0 group-hover:max-w-[200px] group-hover:opacity-100 group-hover:pl-3 group-hover:pr-4 ${
                    isActive ? 'text-white' : 'text-neutral-300'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ========================================================= */}
      {/* 2. MOBILE RESPONSIVE BOTTOM BAR (Flush Bottom, Full Width) */}
      {/* ========================================================= */}
      <nav
        aria-label="Mobile Navigation Bar"
        className="fixed bottom-0 left-0 right-0 h-16 z-40 md:hidden bg-black/85 backdrop-blur-2xl border-t border-white/10 flex items-center justify-around px-2 shadow-[0_-8px_32px_rgba(0,0,0,0.85)] select-none"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectTab(item.key)}
              className={`flex flex-col items-center justify-center w-14 h-12 rounded-xl transition-all active:scale-95 border-0 bg-transparent ${
                isActive ? 'text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >
              <span
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-['Audiowide',cursive,sans-serif] text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-white text-black shadow-md scale-105'
                    : 'bg-white/5 text-neutral-400'
                }`}
              >
                {item.icon}
              </span>
              <span className="text-[9px] font-['Audiowide',cursive,sans-serif] tracking-wider uppercase mt-1 line-clamp-1">
                {item.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
