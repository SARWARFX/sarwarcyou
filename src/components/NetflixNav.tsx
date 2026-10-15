import React, { useState } from 'react';
import {
  Home,
  Film,
  Camera,
  Smartphone,
  Search,
  Shuffle,
  X,
} from 'lucide-react';
import type { CyberFilterType } from './CyberHeader';

export interface NetflixNavProps {
  activeFilter: CyberFilterType;
  onFilterChange: (filter: CyberFilterType) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onShuffle: () => void;
  onResetHome: () => void;
}

export const NetflixNav: React.FC<NetflixNavProps> = ({
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  onShuffle,
  onResetHome,
}) => {
  const [showSearchInput, setShowSearchInput] = useState(false);

  const navItems: { id: CyberFilterType; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'all', label: 'Home', icon: Home },
    { id: 'clips', label: 'Videos', icon: Film },
    { id: 'images', label: 'Images', icon: Camera },
    { id: 'shorts', label: 'Shorts', icon: Smartphone },
  ];

  return (
    <>
      {/* ============================================================== */}
      {/* 1. DESKTOP / TABLET: PINNED VERTICAL LEFT RAIL                 */}
      {/* ============================================================== */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-16 lg:w-20 bg-black/85 backdrop-blur-2xl border-r border-white/[0.08] z-40 flex-col items-center justify-between py-6 select-none shadow-[4px_0_24px_rgba(0,0,0,0.8)]">
        {/* Top: Brand Monogram / Logo */}
        <div className="flex flex-col items-center gap-6">
          <button
            type="button"
            onClick={onResetHome}
            className="group flex flex-col items-center justify-center cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95"
            title="Sarwar C You — Home"
          >
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#00E5FF] to-cyan-600 flex items-center justify-center shadow-[0_0_20px_rgba(0,229,255,0.4)] group-hover:shadow-[0_0_28px_rgba(0,229,255,0.7)] transition-all">
              <span className="text-black font-black text-lg tracking-tighter font-sans">S</span>
            </div>
          </button>

          {/* Quick Search Toggle */}
          <div className="relative group/search">
            <button
              type="button"
              onClick={() => setShowSearchInput(!showSearchInput)}
              className={`p-3 rounded-2xl transition-all duration-200 cursor-pointer ${
                showSearchInput || searchQuery
                  ? 'bg-white/20 text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.3)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/10'
              }`}
              title="Search Vault"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Desktop Sliding Omnisearch Input Field */}
            {showSearchInput && (
              <div className="absolute left-16 top-0 w-72 bg-[#0c0c12]/95 backdrop-blur-2xl border border-white/15 p-2 rounded-2xl shadow-2xl flex items-center gap-2 z-50 animate-slide-right">
                <Search className="w-4 h-4 text-zinc-400 ml-1.5 flex-shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Titles, folders, tags..."
                  className="w-full bg-transparent text-xs text-white placeholder-zinc-500 outline-none font-sans"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    className="p-1 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowSearchInput(false)}
                  className="p-1 rounded-full hover:bg-white/10 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Center: Navigation Rail Icons */}
        <nav className="flex flex-col items-center gap-4 lg:gap-5 w-full px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeFilter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onFilterChange(item.id);
                  if (item.id === 'all') onResetHome();
                }}
                className={`group relative w-12 h-12 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-white/15 text-[#00E5FF] shadow-[0_0_20px_rgba(0,229,255,0.25)]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/5'
                }`}
                title={item.label}
              >
                {/* Active Indicator Bar on Left Edge */}
                {isActive && (
                  <div className="absolute left-0 top-3 bottom-3 w-1 bg-[#00E5FF] rounded-r-full shadow-[0_0_8px_#00E5FF]" />
                )}
                <Icon className="w-5 h-5 transition-transform duration-200 group-hover:scale-110" />
                <span className="text-[9px] font-mono font-bold tracking-tight mt-1 opacity-80 group-hover:opacity-100">
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Bottom: Surprise Me (Shuffle) & Scroll to Top */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onShuffle}
            className="p-3 rounded-2xl text-zinc-400 hover:text-[#00E5FF] hover:bg-white/10 transition-all duration-200 hover:rotate-180 cursor-pointer"
            title="Surprise Me (Play Random Media)"
          >
            <Shuffle className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* 2. MOBILE: TOP BAR (Brand Wordmark + Search + Shuffle)         */}
      {/* ============================================================== */}
      <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-gradient-to-b from-[#030305]/95 via-[#030305]/80 to-transparent z-40 px-4 flex items-center justify-between pt-[env(safe-area-inset-top)] pointer-events-auto">
        <button
          type="button"
          onClick={onResetHome}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#00E5FF] to-cyan-600 flex items-center justify-center shadow-[0_0_12px_rgba(0,229,255,0.4)]">
            <span className="text-black font-black text-sm tracking-tight font-sans">S</span>
          </div>
          <span className="text-xs font-black tracking-[0.2em] font-sans text-white uppercase drop-shadow">
            SARWARCYOU
          </span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onShuffle}
            className="p-2 rounded-full bg-black/60 text-zinc-300 hover:text-[#00E5FF] border border-white/10 cursor-pointer"
            title="Random Media"
          >
            <Shuffle className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowSearchInput(!showSearchInput)}
            className={`p-2 rounded-full border transition-all cursor-pointer ${
              showSearchInput || searchQuery
                ? 'bg-[#00E5FF]/20 text-[#00E5FF] border-[#00E5FF]/40'
                : 'bg-black/60 text-zinc-300 border-white/10'
            }`}
            title="Search"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Mobile Omnisearch Dropdown Bar */}
      {showSearchInput && (
        <div className="md:hidden fixed top-14 inset-x-0 z-40 px-4 py-2 bg-[#030305]/95 backdrop-blur-2xl border-b border-white/10 animate-fade-in">
          <div className="relative flex items-center bg-white/10 rounded-full px-3 py-1.5 border border-white/15">
            <Search className="w-4 h-4 text-zinc-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search video clips, albums, shorts..."
              className="w-full bg-transparent text-xs text-white placeholder-zinc-500 outline-none font-sans"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="p-1 rounded-full text-zinc-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowSearchInput(false)}
              className="ml-2 text-xs font-mono text-[#00E5FF]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. MOBILE: BOTTOM NAVIGATION BAR (Thumb Pinned)               */}
      {/* ============================================================== */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-[#050508]/95 backdrop-blur-2xl border-t border-white/[0.08] z-40 flex items-center justify-around px-2 pb-[env(safe-area-inset-bottom)] select-none shadow-[0_-4px_25px_rgba(0,0,0,0.85)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeFilter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onFilterChange(item.id);
                if (item.id === 'all') onResetHome();
              }}
              className={`flex-1 flex flex-col items-center justify-center py-1 transition-all duration-200 cursor-pointer ${
                isActive ? 'text-[#00E5FF]' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {isActive && (
                  <div className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-[#00E5FF] shadow-[0_0_6px_#00E5FF]" />
                )}
              </div>
              <span className={`text-[10px] font-sans font-semibold tracking-wider mt-1 ${
                isActive ? 'text-[#00E5FF]' : 'text-zinc-500'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* 5th Mobile Tab: Search */}
        <button
          type="button"
          onClick={() => setShowSearchInput(!showSearchInput)}
          className={`flex-1 flex flex-col items-center justify-center py-1 transition-all duration-200 cursor-pointer ${
            showSearchInput || searchQuery ? 'text-[#00E5FF]' : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Search className="w-5 h-5" />
          <span className="text-[10px] font-sans font-semibold tracking-wider mt-1 text-zinc-500">
            Search
          </span>
        </button>
      </nav>
    </>
  );
};

export default NetflixNav;
