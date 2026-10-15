import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  onShuffle?: () => void;
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
  const [isDesktopHovered, setIsDesktopHovered] = useState(false);
  const [isMobileVisible, setIsMobileVisible] = useState(false);
  const mobileTimerRef = useRef<number | null>(null);

  // Auto-hide timer for phone: shows on scroll, remains for a few moments, then auto-hides
  const triggerMobileVisibility = useCallback(() => {
    setIsMobileVisible(true);
    if (mobileTimerRef.current) window.clearTimeout(mobileTimerRef.current);
    mobileTimerRef.current = window.setTimeout(() => {
      setIsMobileVisible(false);
    }, 2800);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      triggerMobileVisibility();
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (mobileTimerRef.current) window.clearTimeout(mobileTimerRef.current);
    };
  }, [triggerMobileVisibility]);

  const navItems: { id: CyberFilterType; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'all', label: 'Home', icon: Home },
    { id: 'clips', label: 'Videos', icon: Film },
    { id: 'images', label: 'Images', icon: Camera },
    { id: 'shorts', label: 'Shorts', icon: Smartphone },
  ];

  return (
    <>
      {/* ============================================================== */}
      {/* 1. DESKTOP: VERTICAL CAPSULE BAR (Auto-hides, reveals on hover) */}
      {/* ============================================================== */}
      <div
        className="hidden md:flex fixed left-3 lg:left-4 top-1/2 -translate-y-1/2 z-40 flex-col items-center group py-4 pl-1 pr-3 pointer-events-auto"
        onMouseEnter={() => setIsDesktopHovered(true)}
        onMouseLeave={() => setIsDesktopHovered(false)}
      >
        <aside
          className={`cyber-glass rounded-full py-4 px-2 lg:px-2.5 flex flex-col items-center gap-3 border border-white/15 shadow-[0_12px_45px_rgba(0,0,0,0.85),0_0_20px_rgba(0,229,255,0.12)] transition-all duration-300 ${
            isDesktopHovered || showSearchInput || searchQuery
              ? 'opacity-100 translate-x-0 scale-100'
              : 'opacity-25 -translate-x-3 scale-95'
          }`}
        >
          {/* Navigation Items (Home, Videos, Images, Shorts) */}
          <nav className="flex flex-col items-center gap-2">
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
                  className={`group/btn relative w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 shadow-[0_0_16px_rgba(0,229,255,0.4)]'
                      : 'text-zinc-400 hover:text-white hover:bg-white/10 border border-transparent'
                  }`}
                  title={item.label}
                >
                  <Icon className="w-4 h-4 transition-transform duration-200 group-hover/btn:scale-110" />
                </button>
              );
            })}
          </nav>

          <div className="w-5 h-px bg-white/15 my-0.5" />

          {/* Search Toggle */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSearchInput(!showSearchInput)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                showSearchInput || searchQuery
                  ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 shadow-[0_0_16px_rgba(0,229,255,0.4)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
              title="Search Vault"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Desktop Sliding Omnisearch Input Field */}
            {showSearchInput && (
              <div className="absolute left-14 top-1/2 -translate-y-1/2 w-72 bg-[#0c0c12]/95 backdrop-blur-2xl border border-white/20 p-2 rounded-2xl shadow-2xl flex items-center gap-2 z-50 animate-slide-right">
                <Search className="w-4 h-4 text-zinc-400 ml-1.5 flex-shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  placeholder="Search titles, folders, tags..."
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
        </aside>
      </div>

      {/* ============================================================== */}
      {/* 2. MOBILE: TOP BAR (Quick Search & Shuffle Controls)           */}
      {/* ============================================================== */}
      <header className="md:hidden fixed top-0 inset-x-0 h-14 bg-gradient-to-b from-[#030305]/95 via-[#030305]/80 to-transparent z-30 px-4 flex items-center justify-end gap-2 pt-[env(safe-area-inset-top)] pointer-events-auto">
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
      {/* 3. MOBILE: VERTICAL CAPSULE BAR (Auto-shows on scroll, auto-hides) */}
      {/* ============================================================== */}
      <div
        className={`md:hidden fixed left-3 top-1/2 -translate-y-1/2 z-40 transition-all duration-300 transform select-none ${
          isMobileVisible || showSearchInput || searchQuery
            ? 'opacity-100 translate-x-0 scale-100 pointer-events-auto'
            : 'opacity-0 -translate-x-8 scale-90 pointer-events-none'
        }`}
        onClick={triggerMobileVisibility}
        onTouchStart={triggerMobileVisibility}
      >
        <nav className="cyber-glass rounded-full py-3 px-2 flex flex-col items-center gap-2.5 border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.9),0_0_25px_rgba(0,229,255,0.2)]">
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
                  triggerMobileVisibility();
                }}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 shadow-[0_0_14px_rgba(0,229,255,0.4)]'
                    : 'text-zinc-400 hover:text-white hover:bg-white/10 border border-transparent'
                }`}
                title={item.label}
              >
                <Icon className="w-4 h-4" />
              </button>
            );
          })}

          <div className="w-4 h-px bg-white/15 my-0.5" />

          {/* Quick Search Tab in Mobile Capsule */}
          <button
            type="button"
            onClick={() => {
              setShowSearchInput(!showSearchInput);
              triggerMobileVisibility();
            }}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer ${
              showSearchInput || searchQuery
                ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 shadow-[0_0_14px_rgba(0,229,255,0.4)]'
                : 'text-zinc-400 hover:text-white hover:bg-white/10 border border-transparent'
            }`}
            title="Search"
          >
            <Search className="w-4 h-4" />
          </button>
        </nav>
      </div>
    </>
  );
};

export default NetflixNav;
