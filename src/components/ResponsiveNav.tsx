import React, { useState, useEffect, useRef } from 'react';
import { Home, Camera, Film, Smartphone, X, Folder, ChevronUp, ChevronDown } from 'lucide-react';
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
  showBackToTop?: boolean;
  onScrollToTop?: () => void;
}

export const ResponsiveNav: React.FC<ResponsiveNavProps> = ({
  activeFilter,
  onFilterChange,
  onHomeClick,
  imageAlbums,
  videoAlbums,
  shortAlbums,
  onJumpToAlbum,
  showBackToTop,
  onScrollToTop,
}) => {
  // Currently open album jump menu category ('all' | 'images' | 'clips' | 'shorts' | null)
  const [openCategory, setOpenCategory] = useState<CyberFilterType | null>(null);
  const [selectedSubTab, setSelectedSubTab] = useState<'clips' | 'images' | 'shorts'>('clips');

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

  const totalAlbums = imageAlbums.length + videoAlbums.length + shortAlbums.length;

  const currentDisplayAlbums =
    selectedSubTab === 'clips'
      ? videoAlbums
      : selectedSubTab === 'images'
      ? imageAlbums
      : shortAlbums;

  return (
    <div ref={navRef} className="w-full">
      {/* =========================================================================
          1. TOP NAVIGATION BAR (Header): Standard Streaming Website Layout
             - Sticky top-0 inset-x-0 z-50
             - Glassmorphic dark styling (bg-black/85 backdrop-blur-2xl border-b border-white/10)
             - Left: SARWARCYOU brand with cyan glow pip
             - Center (Desktop): Clean horizontal navigation tabs (Home, Videos, Shorts, Photos)
             - Right: Quick Collections dropdown menu + Back-to-Top shortcut
         ========================================================================= */}
      <header className="sticky top-0 inset-x-0 z-50 w-full bg-black/85 backdrop-blur-2xl border-b border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.8)] select-none">
        <div className="max-w-7xl mx-auto h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          {/* Left: Brand Logo */}
          <button
            type="button"
            onClick={handleHomeClick}
            title="SARWARCYOU - Streaming Vault"
            aria-label="SARWARCYOU Home"
            className="flex items-center gap-2.5 py-1.5 px-2 rounded-xl hover:bg-white/5 active:scale-95 transition-all cursor-pointer group"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] shadow-[0_0_10px_#00E5FF] group-hover:scale-125 transition-transform" />
            <span
              className="text-base sm:text-lg font-black uppercase tracking-[0.18em] text-white group-hover:text-[#00E5FF] transition-colors"
              style={{ fontFamily: "'Orbitron', 'Syne', monospace, sans-serif" }}
            >
              SARWARCYOU
            </span>
          </button>

          {/* Center (Desktop): Standard Streaming Navigation Links */}
          <nav
            aria-label="Main Navigation"
            className="hidden md:flex items-center gap-1 bg-white/[0.04] p-1.5 rounded-full border border-white/10 shadow-inner"
          >
            {/* Home / All */}
            <button
              type="button"
              onClick={handleHomeClick}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeFilter === 'all'
                  ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/50 shadow-[0_0_15px_rgba(0,229,255,0.3)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Home</span>
            </button>

            {/* Videos */}
            <button
              type="button"
              onClick={() => onFilterChange('clips')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeFilter === 'clips'
                  ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/50 shadow-[0_0_15px_rgba(0,229,255,0.3)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Videos</span>
              {videoAlbums.length > 0 && (
                <span className="text-[10px] font-mono bg-white/10 px-1.5 py-0.2 rounded-full text-zinc-400">
                  {videoAlbums.length}
                </span>
              )}
            </button>

            {/* Shorts */}
            <button
              type="button"
              onClick={() => onFilterChange('shorts')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeFilter === 'shorts'
                  ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/50 shadow-[0_0_15px_rgba(0,229,255,0.3)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-red-400" />
              <span>Shorts</span>
              {shortAlbums.length > 0 && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
              )}
            </button>

            {/* Photos */}
            <button
              type="button"
              onClick={() => onFilterChange('images')}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                activeFilter === 'images'
                  ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/50 shadow-[0_0_15px_rgba(0,229,255,0.3)]'
                  : 'text-zinc-400 hover:text-white hover:bg-white/10 border border-transparent'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Photos</span>
              {imageAlbums.length > 0 && (
                <span className="text-[10px] font-mono bg-white/10 px-1.5 py-0.2 rounded-full text-zinc-400">
                  {imageAlbums.length}
                </span>
              )}
            </button>
          </nav>

          {/* Right: Quick Collections Dropdown */}
          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpenCategory((prev) => (prev ? null : 'all'))}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer border active:scale-95 ${
                openCategory
                  ? 'bg-[#00E5FF]/20 text-[#00E5FF] border-[#00E5FF]/50 shadow-[0_0_12px_rgba(0,229,255,0.25)]'
                  : 'bg-white/[0.04] text-zinc-300 hover:text-white hover:bg-white/[0.08] border-white/10'
              }`}
              title="Browse Collections"
              aria-label="Browse Collections"
            >
              <Folder className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span className="hidden sm:inline">Collections</span>
              {totalAlbums > 0 && (
                <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded-full text-zinc-400 font-mono">
                  {totalAlbums}
                </span>
              )}
              <ChevronDown
                className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 ${
                  openCategory ? 'rotate-180 text-[#00E5FF]' : ''
                }`}
              />
            </button>

            {/* Desktop Back to Top Quick Action */}
            {showBackToTop && onScrollToTop && (
              <button
                type="button"
                onClick={onScrollToTop}
                title="Back to Top"
                aria-label="Scroll back to top"
                className="hidden md:flex p-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[#00E5FF] transition-all cursor-pointer active:scale-90"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            )}

            {/* Desktop Collections Dropdown Popover */}
            {openCategory && (
              <div
                className="hidden md:flex flex-col absolute right-0 top-full mt-2 w-80 max-h-[70vh] rounded-2xl p-4 shadow-[0_16px_50px_rgba(0,0,0,0.95)] border backdrop-blur-2xl z-[1001] gap-3 animate-in fade-in slide-in-from-top-2 duration-150"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--nav-border)',
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-[#00E5FF] uppercase">
                    <Folder className="w-4 h-4 text-[#00E5FF]" />
                    <span>Collections</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenCategory(null)}
                    className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Category Tabs inside Dropdown */}
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSelectedSubTab('clips')}
                    className={`flex-1 py-1 text-xs font-medium rounded-lg transition-all ${
                      selectedSubTab === 'clips'
                        ? 'bg-[#00E5FF]/20 text-[#00E5FF] font-semibold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Videos ({videoAlbums.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSubTab('images')}
                    className={`flex-1 py-1 text-xs font-medium rounded-lg transition-all ${
                      selectedSubTab === 'images'
                        ? 'bg-[#00E5FF]/20 text-[#00E5FF] font-semibold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Photos ({imageAlbums.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedSubTab('shorts')}
                    className={`flex-1 py-1 text-xs font-medium rounded-lg transition-all ${
                      selectedSubTab === 'shorts'
                        ? 'bg-[#00E5FF]/20 text-[#00E5FF] font-semibold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Shorts ({shortAlbums.length})
                  </button>
                </div>

                {/* Album List */}
                <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-1 max-h-[45vh] pr-1 divide-y divide-white/5">
                  {currentDisplayAlbums.length === 0 ? (
                    <div className="py-8 text-center text-xs font-mono text-zinc-500">
                      No albums in this category
                    </div>
                  ) : (
                    currentDisplayAlbums.map((album) => (
                      <button
                        key={album.id}
                        type="button"
                        onClick={() => {
                          onJumpToAlbum(album.id, selectedSubTab);
                          setOpenCategory(null);
                        }}
                        className="w-full text-left py-2 px-2.5 rounded-xl text-xs font-medium hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer group flex items-center justify-between"
                      >
                        <span className="truncate pr-2 text-zinc-300 group-hover:text-white transition-colors">
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
            )}
          </div>
        </div>
      </header>

      {/* =========================================================================
          2. MOBILE VIEWPORT (< 768px): Sleek Floating Cyberpunk Bottom Dock
             - Standard mobile streaming layout (YouTube / Netflix style)
             - Instant switching between Home, Videos, Shorts, Photos
             - Integrated Back-to-Top quick action
         ========================================================================= */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-50 select-none pointer-events-auto"
        style={{
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div
          className="flex items-center gap-1 sm:gap-1.5 px-2 py-1.5 rounded-2xl bg-black/85 backdrop-blur-2xl border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.85),0_0_15px_rgba(0,229,255,0.18)]"
          style={{
            borderColor: 'var(--nav-border)',
          }}
        >
          {/* Home */}
          <button
            type="button"
            onClick={handleHomeClick}
            title="Home"
            aria-label="Home"
            className={`w-9 h-9 rounded-xl transition-all cursor-pointer flex items-center justify-center active:scale-90 ${
              activeFilter === 'all'
                ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/50 shadow-[0_0_10px_rgba(0,229,255,0.35)]'
                : 'text-zinc-400 hover:text-white border border-transparent'
            }`}
          >
            <Home className="w-4 h-4" />
          </button>

          {/* Videos */}
          <button
            type="button"
            onClick={() => onFilterChange('clips')}
            title="Videos"
            aria-label="Videos"
            className={`w-9 h-9 rounded-xl transition-all cursor-pointer flex items-center justify-center relative active:scale-90 ${
              activeFilter === 'clips'
                ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/50 shadow-[0_0_10px_rgba(0,229,255,0.35)]'
                : 'text-zinc-400 hover:text-white border border-transparent'
            }`}
          >
            <Film className="w-4 h-4" />
            {videoAlbums.length > 0 && (
              <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-[#00E5FF]" />
            )}
          </button>

          {/* Shorts */}
          <button
            type="button"
            onClick={() => onFilterChange('shorts')}
            title="Shorts"
            aria-label="Shorts"
            className={`w-9 h-9 rounded-xl transition-all cursor-pointer flex items-center justify-center relative active:scale-90 ${
              activeFilter === 'shorts'
                ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/50 shadow-[0_0_10px_rgba(0,229,255,0.35)]'
                : 'text-zinc-400 hover:text-white border border-transparent'
            }`}
          >
            <Smartphone className="w-4 h-4 text-red-400" />
            {shortAlbums.length > 0 && (
              <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]" />
            )}
          </button>

          {/* Photographs */}
          <button
            type="button"
            onClick={() => onFilterChange('images')}
            title="Photographs"
            aria-label="Photographs"
            className={`w-9 h-9 rounded-xl transition-all cursor-pointer flex items-center justify-center relative active:scale-90 ${
              activeFilter === 'images'
                ? 'bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/50 shadow-[0_0_10px_rgba(0,229,255,0.35)]'
                : 'text-zinc-400 hover:text-white border border-transparent'
            }`}
          >
            <Camera className="w-4 h-4" />
            {imageAlbums.length > 0 && (
              <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-[#00E5FF]" />
            )}
          </button>

          {/* Cyber Divider */}
          <div className="w-px h-4 bg-white/15 mx-0.5" />

          {/* Integrated Back-to-Top Button */}
          <button
            type="button"
            onClick={onScrollToTop || handleHomeClick}
            title="Back to Top"
            aria-label="Scroll back to top"
            className={`w-9 h-9 rounded-xl transition-all cursor-pointer flex items-center justify-center active:scale-90 ${
              showBackToTop
                ? 'text-[#00E5FF] bg-[#00E5FF]/15 border border-[#00E5FF]/40 shadow-[0_0_10px_rgba(0,229,255,0.3)] animate-pulse'
                : 'text-zinc-400 hover:text-white border border-transparent'
            }`}
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* =========================================================================
          3. MOBILE BOTTOM SHEET FOR QUICK ALBUM JUMP
         ========================================================================= */}
      {openCategory && (
        <div className="md:hidden fixed inset-0 z-[1001] select-none">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setOpenCategory(null)}
          />

          {/* Bottom Popover Sheet */}
          <div
            className="absolute bottom-[calc(56px+env(safe-area-inset-bottom,0px))] inset-x-3 max-w-md mx-auto rounded-2xl p-4 shadow-[0_-10px_35px_rgba(0,0,0,0.85)] border flex flex-col max-h-[62vh] transition-transform duration-200 animate-in slide-in-from-bottom-5"
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
                  Collections
                </h3>
                <span className="text-[11px] font-mono text-zinc-400 bg-white/10 px-2 py-0.5 rounded-full">
                  {totalAlbums}
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

            {/* Category Tabs inside Mobile Sheet */}
            <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl my-2">
              <button
                type="button"
                onClick={() => setSelectedSubTab('clips')}
                className={`flex-1 py-1 text-xs font-medium rounded-lg transition-all ${
                  selectedSubTab === 'clips'
                    ? 'bg-[#00E5FF]/20 text-[#00E5FF] font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Videos ({videoAlbums.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedSubTab('images')}
                className={`flex-1 py-1 text-xs font-medium rounded-lg transition-all ${
                  selectedSubTab === 'images'
                    ? 'bg-[#00E5FF]/20 text-[#00E5FF] font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Photos ({imageAlbums.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedSubTab('shorts')}
                className={`flex-1 py-1 text-xs font-medium rounded-lg transition-all ${
                  selectedSubTab === 'shorts'
                    ? 'bg-[#00E5FF]/20 text-[#00E5FF] font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Shorts ({shortAlbums.length})
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-1.5 divide-y divide-white/5">
              {currentDisplayAlbums.length === 0 ? (
                <div className="py-6 text-center text-xs font-mono text-zinc-500">
                  No albums found in this category
                </div>
              ) : (
                currentDisplayAlbums.map((album) => (
                  <button
                    key={album.id}
                    type="button"
                    onClick={() => {
                      onJumpToAlbum(album.id, selectedSubTab);
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