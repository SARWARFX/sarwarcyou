import React, { useState, useEffect, useRef } from 'react';
import { Home, Camera, Film, Smartphone, X, Folder } from 'lucide-react';
import type { CyberFilterType } from './CyberHeader';

export interface AlbumJumpItem {
  id: string;
  name: string;
  count: number;
}

export interface ResponsiveNavProps {
  activeFilter: CyberFilterType;
  onFilterChange: (filter: CyberFilterType) => void;
  onHomeClick?: () => void;
  imageAlbums: AlbumJumpItem[];
  videoAlbums: AlbumJumpItem[];
  shortAlbums: AlbumJumpItem[];
  onJumpToAlbum: (albumId: string, category: CyberFilterType) => void;
}

export const ResponsiveNav: React.FC<ResponsiveNavProps> = ({
  activeFilter,
  onFilterChange,
  onHomeClick,
  imageAlbums,
  videoAlbums,
  shortAlbums,
  onJumpToAlbum,
}) => {
  // Currently open album jump menu category ('images' | 'clips' | 'shorts' | null)
  const [openCategory, setOpenCategory] = useState<CyberFilterType | null>(null);

  const navRef = useRef<HTMLDivElement>(null);

  const handleHomeClick = () => {
    setOpenCategory(null);
    onFilterChange('all');
    if (onHomeClick) {
      onHomeClick();
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Close menus when clicking outside
  useEffect(() => {
    if (!openCategory) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenCategory(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenCategory(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openCategory]);

  const getCategoryAlbums = (cat: CyberFilterType): AlbumJumpItem[] => {
    if (cat === 'images') return imageAlbums;
    if (cat === 'clips') return videoAlbums;
    if (cat === 'shorts') return shortAlbums;
    return [];
  };

  const getCategoryLabel = (cat: CyberFilterType): string => {
    if (cat === 'images') return 'Images';
    if (cat === 'clips') return 'Videos';
    if (cat === 'shorts') return 'Shorts';
    return 'All';
  };

  const activeAlbums = openCategory ? getCategoryAlbums(openCategory) : [];

  return (
    <div ref={navRef} className="w-full">
      {/* =========================================================================
          1. TOP-LEFT WEBSITE BRAND TITLE (No black bar, smaller refined size)
         ========================================================================= */}
      <div className="fixed top-3.5 sm:top-5 left-3 sm:left-6 z-50 select-none">
        <button
          type="button"
          onClick={handleHomeClick}
          title="SARWARCYOU - Back to Top"
          className="flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-black/40 hover:bg-black/75 backdrop-blur-xl border border-white/10 hover:border-[#00E5FF]/50 shadow-lg hover:shadow-[0_0_20px_rgba(0,229,255,0.25)] transition-all duration-200 cursor-pointer group active:scale-95"
        >
          <div className="w-2 h-2 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF] group-hover:scale-125 transition-transform" />
          <span
            className="text-xs sm:text-sm md:text-base font-black uppercase tracking-[0.18em] text-white group-hover:text-[#00E5FF] transition-colors"
            style={{
              fontFamily: "'Orbitron', 'Syne', monospace, sans-serif",
            }}
          >
            SARWARCYOU
          </span>
        </button>
      </div>

      {/* =========================================================================
          2. DESKTOP VIEWPORT (>= 768px): Vertical Floating Icon-Only Dock
             - Fixed right-4 sm:right-6 top-1/2 -translate-y-1/2
             - Icon-only: Home, Images, Videos, Shorts
             - Album jump flyout to the left of the dock
         ========================================================================= */}
      <nav
        aria-label="Desktop Floating Navigation"
        className="hidden md:flex flex-col items-center p-2 rounded-2xl shadow-2xl transition-all duration-200 select-none fixed right-4 sm:right-6 top-1/2 -translate-y-1/2 z-[1000] w-auto max-h-[82vh] gap-2 backdrop-blur-2xl border"
        style={{
          backgroundColor: 'var(--nav-bg)',
          borderColor: 'var(--nav-border)',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Home */}
        <button
          type="button"
          onClick={handleHomeClick}
          title="Home"
          aria-label="Home"
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
            activeFilter === 'all'
              ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 shadow-[0_0_15px_rgba(0,229,255,0.3)]'
              : 'text-zinc-400 hover:text-white hover:bg-white/10 border border-transparent'
          }`}
        >
          <Home className="w-5 h-5" />
        </button>

        {/* Images */}
        <button
          type="button"
          onClick={() => {
            if (activeFilter === 'images' && imageAlbums.length > 0) {
              setOpenCategory((prev) => (prev === 'images' ? null : 'images'));
            } else {
              onFilterChange('images');
              if (imageAlbums.length > 0) setOpenCategory('images');
            }
          }}
          title="Photographs"
          aria-label="Photographs"
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative active:scale-95 ${
            activeFilter === 'images'
              ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 shadow-[0_0_15px_rgba(0,229,255,0.3)]'
              : 'text-zinc-400 hover:text-white hover:bg-white/10 border border-transparent'
          }`}
        >
          <Camera className="w-5 h-5" />
          {imageAlbums.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />
          )}
        </button>

        {/* Videos */}
        <button
          type="button"
          onClick={() => {
            if (activeFilter === 'clips' && videoAlbums.length > 0) {
              setOpenCategory((prev) => (prev === 'clips' ? null : 'clips'));
            } else {
              onFilterChange('clips');
              if (videoAlbums.length > 0) setOpenCategory('clips');
            }
          }}
          title="Videos"
          aria-label="Videos"
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative active:scale-95 ${
            activeFilter === 'clips'
              ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 shadow-[0_0_15px_rgba(0,229,255,0.3)]'
              : 'text-zinc-400 hover:text-white hover:bg-white/10 border border-transparent'
          }`}
        >
          <Film className="w-5 h-5" />
          {videoAlbums.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />
          )}
        </button>

        {/* Shorts */}
        <button
          type="button"
          onClick={() => {
            if (activeFilter === 'shorts' && shortAlbums.length > 0) {
              setOpenCategory((prev) => (prev === 'shorts' ? null : 'shorts'));
            } else {
              onFilterChange('shorts');
              if (shortAlbums.length > 0) setOpenCategory('shorts');
            }
          }}
          title="Shorts"
          aria-label="Shorts"
          className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer relative active:scale-95 ${
            activeFilter === 'shorts'
              ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 shadow-[0_0_15px_rgba(0,229,255,0.3)]'
              : 'text-zinc-400 hover:text-white hover:bg-white/10 border border-transparent'
          }`}
        >
          <Smartphone className="w-5 h-5" />
          {shortAlbums.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />
          )}
        </button>

        {/* Desktop Album Jump Flyout (Opens to the left of the dock) */}
        {openCategory && (
          <div
            className="hidden md:flex flex-col absolute right-full mr-3 top-1/2 -translate-y-1/2 w-64 max-h-[60vh] rounded-2xl p-3.5 shadow-[0_16px_50px_rgba(0,0,0,0.9)] border backdrop-blur-2xl z-[1001] animate-in fade-in slide-in-from-right-3 duration-200"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--nav-border)',
            }}
          >
            {/* Flyout Header */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
              <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#00E5FF] uppercase">
                <Folder className="w-3.5 h-3.5" />
                <span>{getCategoryLabel(openCategory)} Albums</span>
              </div>
              <button
                type="button"
                onClick={() => setOpenCategory(null)}
                className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Flyout Album List */}
            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-1 max-h-[45vh]">
              {activeAlbums.map((album) => (
                <button
                  key={album.id}
                  type="button"
                  onClick={() => {
                    onJumpToAlbum(album.id, openCategory);
                    setOpenCategory(null);
                  }}
                  className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium hover:bg-white/10 active:bg-white/20 transition-colors cursor-pointer group"
                >
                  <span className="truncate pr-2 text-zinc-300 group-hover:text-white transition-colors">
                    {album.name}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 bg-white/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                    {album.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* =========================================================================
          3. MOBILE VIEWPORT (< 768px): Slim Bottom Dock (Icon Only)
         ========================================================================= */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-[1000] select-none shadow-[0_-4px_24px_rgba(0,0,0,0.7)] backdrop-blur-2xl transition-colors duration-200"
        style={{
          backgroundColor: 'var(--nav-bg)',
          borderTop: '1px solid var(--nav-border)',
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="w-full max-w-sm mx-auto px-4 py-2 flex items-center justify-around gap-2">
          {/* Home */}
          <button
            type="button"
            onClick={handleHomeClick}
            title="Home"
            aria-label="Home"
            className={`p-2.5 rounded-2xl transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
              activeFilter === 'all'
                ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 shadow-[0_0_12px_rgba(0,229,255,0.3)] scale-105'
                : 'text-zinc-400 hover:text-white border border-transparent'
            }`}
          >
            <Home className="w-5 h-5" />
          </button>

          {/* Images */}
          <button
            type="button"
            onClick={() => {
              if (activeFilter === 'images' && imageAlbums.length > 0) {
                setOpenCategory((prev) => (prev === 'images' ? null : 'images'));
              } else {
                setOpenCategory(null);
                onFilterChange('images');
              }
            }}
            title="Photographs"
            aria-label="Images"
            className={`p-2.5 rounded-2xl transition-all cursor-pointer flex items-center justify-center relative active:scale-95 ${
              activeFilter === 'images'
                ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 shadow-[0_0_12px_rgba(0,229,255,0.3)] scale-105'
                : 'text-zinc-400 hover:text-white border border-transparent'
            }`}
          >
            <Camera className="w-5 h-5" />
            {imageAlbums.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />
            )}
          </button>

          {/* Videos */}
          <button
            type="button"
            onClick={() => {
              if (activeFilter === 'clips' && videoAlbums.length > 0) {
                setOpenCategory((prev) => (prev === 'clips' ? null : 'clips'));
              } else {
                setOpenCategory(null);
                onFilterChange('clips');
              }
            }}
            title="Videos"
            aria-label="Videos"
            className={`p-2.5 rounded-2xl transition-all cursor-pointer flex items-center justify-center relative active:scale-95 ${
              activeFilter === 'clips'
                ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 shadow-[0_0_12px_rgba(0,229,255,0.3)] scale-105'
                : 'text-zinc-400 hover:text-white border border-transparent'
            }`}
          >
            <Film className="w-5 h-5" />
            {videoAlbums.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />
            )}
          </button>

          {/* Shorts */}
          <button
            type="button"
            onClick={() => {
              if (activeFilter === 'shorts' && shortAlbums.length > 0) {
                setOpenCategory((prev) => (prev === 'shorts' ? null : 'shorts'));
              } else {
                setOpenCategory(null);
                onFilterChange('shorts');
              }
            }}
            title="Shorts"
            aria-label="Shorts"
            className={`p-2.5 rounded-2xl transition-all cursor-pointer flex items-center justify-center relative active:scale-95 ${
              activeFilter === 'shorts'
                ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/40 shadow-[0_0_12px_rgba(0,229,255,0.3)] scale-105'
                : 'text-zinc-400 hover:text-white border border-transparent'
            }`}
          >
            <Smartphone className="w-5 h-5" />
            {shortAlbums.length > 0 && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#00E5FF]" />
            )}
          </button>
        </div>
      </nav>

      {/* =========================================================================
          4. MOBILE BOTTOM SHEET / POPOVER FOR QUICK ALBUM JUMP
         ========================================================================= */}
      {openCategory && (
        <div className="md:hidden fixed inset-0 z-[1001] select-none">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setOpenCategory(null)}
          />

          {/* Bottom Popover Sheet right above the bottom dock */}
          <div
            className="absolute bottom-[calc(64px+env(safe-area-inset-bottom))] inset-x-3 max-w-md mx-auto rounded-2xl p-4 shadow-[0_-10px_35px_rgba(0,0,0,0.85)] border flex flex-col max-h-[62vh] transition-transform duration-200 animate-in slide-in-from-bottom-5"
            style={{
              backgroundColor: 'var(--card-bg)',
              borderColor: 'var(--nav-border)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-[#00E5FF]" />
                <h3 className="text-sm font-sans font-bold tracking-wide uppercase">
                  {getCategoryLabel(openCategory)} Albums
                </h3>
                <span className="text-[11px] font-mono text-zinc-400 bg-white/10 px-2 py-0.5 rounded-full">
                  {activeAlbums.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpenCategory(null)}
                className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-1.5 divide-y divide-white/5">
              {activeAlbums.length === 0 ? (
                <div className="py-6 text-center text-xs font-mono text-zinc-500">
                  No albums found in this category
                </div>
              ) : (
                activeAlbums.map((album) => (
                  <button
                    key={album.id}
                    type="button"
                    onClick={() => {
                      onJumpToAlbum(album.id, openCategory);
                      setOpenCategory(null);
                    }}
                    className="w-full text-left pt-2 pb-1.5 px-2 rounded-xl flex items-center justify-between hover:bg-white/10 active:bg-white/20 transition-colors cursor-pointer group"
                  >
                    <span className="text-xs font-sans font-medium text-white group-hover:text-[#00E5FF] transition-colors truncate pr-3">
                      {album.name}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 bg-white/10 px-2 py-0.5 rounded-full flex-shrink-0">
                      {album.count} items
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResponsiveNav;
