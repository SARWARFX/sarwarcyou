import React, { useState, useEffect, useRef } from 'react';
import { Home, Camera, Film, Smartphone, ChevronUp, ChevronDown, X, Folder } from 'lucide-react';
import type { CyberFilterType } from './CyberHeader';

export interface AlbumJumpItem {
  id: string;
  name: string;
  count: number;
}

export interface ResponsiveNavProps {
  activeFilter: CyberFilterType;
  onFilterChange: (filter: CyberFilterType) => void;
  imageAlbums: AlbumJumpItem[];
  videoAlbums: AlbumJumpItem[];
  shortAlbums: AlbumJumpItem[];
  onJumpToAlbum: (albumId: string, category: CyberFilterType) => void;
}

export const ResponsiveNav: React.FC<ResponsiveNavProps> = ({
  activeFilter,
  onFilterChange,
  imageAlbums,
  videoAlbums,
  shortAlbums,
  onJumpToAlbum,
}) => {
  // Currently open album jump menu category ('images' | 'clips' | 'shorts' | null)
  const [openCategory, setOpenCategory] = useState<CyberFilterType | null>(null);

  const navRef = useRef<HTMLDivElement>(null);

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

  const toggleCategoryMenu = (category: CyberFilterType, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenCategory((prev) => (prev === category ? null : category));
  };

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
          1. DESKTOP VIEWPORT (>= 768px): Top Brand Title + Horizontal Nav Bar
         ========================================================================= */}
      <header className="hidden md:flex flex-col items-center justify-center w-full max-w-7xl mx-auto pt-6 pb-4 px-4 select-none">
        {/* Brand Title: Futuristic modern cyber/tech typography */}
        <h1
          className="text-2xl lg:text-3xl font-black uppercase text-center tracking-[0.25em] transition-colors duration-200"
          style={{
            fontFamily: "'Orbitron', 'Syne', monospace, sans-serif",
            letterSpacing: '0.25em',
            color: 'var(--text-primary)',
            textShadow: '0 0 25px rgba(0, 229, 255, 0.3)',
          }}
        >
          SARWAR.CYOU
        </h1>

        {/* Horizontal Navigation Bar with Down Arrows (▼) */}
        <nav
          aria-label="Desktop Navigation"
          className="mt-4 flex items-center gap-1.5 p-1.5 rounded-2xl shadow-xl transition-colors duration-200"
          style={{
            backgroundColor: 'var(--nav-bg)',
            border: '1px solid var(--nav-border)',
          }}
        >
          {/* Home */}
          <button
            type="button"
            onClick={() => {
              setOpenCategory(null);
              onFilterChange('all');
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-sans font-semibold tracking-wide transition-all cursor-pointer"
            style={{
              backgroundColor: activeFilter === 'all' ? 'var(--nav-active-bg)' : 'transparent',
              color: activeFilter === 'all' ? 'var(--nav-active-text)' : 'var(--nav-btn-text)',
            }}
          >
            <Home className="w-3.5 h-3.5" />
            <span>Home</span>
          </button>

          {/* Images Split Button with Down Arrow (▼) */}
          <div className="relative flex items-center rounded-xl overflow-visible">
            <button
              type="button"
              onClick={() => {
                setOpenCategory(null);
                onFilterChange('images');
              }}
              className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-l-xl text-xs font-sans font-semibold tracking-wide transition-all cursor-pointer"
              style={{
                backgroundColor: activeFilter === 'images' ? 'var(--nav-active-bg)' : 'transparent',
                color: activeFilter === 'images' ? 'var(--nav-active-text)' : 'var(--nav-btn-text)',
              }}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Images</span>
            </button>
            <button
              type="button"
              onClick={(e) => toggleCategoryMenu('images', e)}
              aria-label="Jump to Image Albums"
              aria-expanded={openCategory === 'images'}
              className="p-1.5 pr-2 rounded-r-xl transition-all cursor-pointer hover:opacity-80"
              style={{
                backgroundColor: activeFilter === 'images' ? 'var(--nav-active-bg)' : 'transparent',
                color: activeFilter === 'images' ? 'var(--nav-active-text)' : 'var(--nav-btn-text)',
              }}
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  openCategory === 'images' ? 'rotate-180 text-[#00E5FF]' : ''
                }`}
              />
            </button>

            {/* Desktop Down Dropdown Menu */}
            {openCategory === 'images' && (
              <div
                className="absolute top-full left-0 mt-2 min-w-[240px] max-h-[360px] overflow-y-auto rounded-xl p-1.5 shadow-2xl z-50 flex flex-col gap-1 border transition-all"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--nav-border)',
                }}
              >
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400 border-b border-white/10 flex items-center justify-between">
                  <span>Image Folders</span>
                  <span>{imageAlbums.length}</span>
                </div>
                {imageAlbums.map((album) => (
                  <button
                    key={album.id}
                    type="button"
                    onClick={() => {
                      onJumpToAlbum(album.id, 'images');
                      setOpenCategory(null);
                    }}
                    className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-sans font-medium hover:bg-white/10 active:bg-white/20 transition-colors cursor-pointer"
                  >
                    <span className="truncate pr-2">{album.name}</span>
                    <span className="text-[10px] font-mono text-zinc-400 bg-white/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      {album.count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Videos Split Button with Down Arrow (▼) */}
          <div className="relative flex items-center rounded-xl overflow-visible">
            <button
              type="button"
              onClick={() => {
                setOpenCategory(null);
                onFilterChange('clips');
              }}
              className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-l-xl text-xs font-sans font-semibold tracking-wide transition-all cursor-pointer"
              style={{
                backgroundColor: activeFilter === 'clips' ? 'var(--nav-active-bg)' : 'transparent',
                color: activeFilter === 'clips' ? 'var(--nav-active-text)' : 'var(--nav-btn-text)',
              }}
            >
              <Film className="w-3.5 h-3.5" />
              <span>Videos</span>
            </button>
            <button
              type="button"
              onClick={(e) => toggleCategoryMenu('clips', e)}
              aria-label="Jump to Video Albums"
              aria-expanded={openCategory === 'clips'}
              className="p-1.5 pr-2 rounded-r-xl transition-all cursor-pointer hover:opacity-80"
              style={{
                backgroundColor: activeFilter === 'clips' ? 'var(--nav-active-bg)' : 'transparent',
                color: activeFilter === 'clips' ? 'var(--nav-active-text)' : 'var(--nav-btn-text)',
              }}
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  openCategory === 'clips' ? 'rotate-180 text-[#00E5FF]' : ''
                }`}
              />
            </button>

            {/* Desktop Down Dropdown Menu */}
            {openCategory === 'clips' && (
              <div
                className="absolute top-full left-0 mt-2 min-w-[240px] max-h-[360px] overflow-y-auto rounded-xl p-1.5 shadow-2xl z-50 flex flex-col gap-1 border transition-all"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--nav-border)',
                }}
              >
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400 border-b border-white/10 flex items-center justify-between">
                  <span>Video Folders</span>
                  <span>{videoAlbums.length}</span>
                </div>
                {videoAlbums.map((album) => (
                  <button
                    key={album.id}
                    type="button"
                    onClick={() => {
                      onJumpToAlbum(album.id, 'clips');
                      setOpenCategory(null);
                    }}
                    className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-sans font-medium hover:bg-white/10 active:bg-white/20 transition-colors cursor-pointer"
                  >
                    <span className="truncate pr-2">{album.name}</span>
                    <span className="text-[10px] font-mono text-zinc-400 bg-white/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      {album.count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Shorts Split Button with Down Arrow (▼) */}
          <div className="relative flex items-center rounded-xl overflow-visible">
            <button
              type="button"
              onClick={() => {
                setOpenCategory(null);
                onFilterChange('shorts');
              }}
              className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-l-xl text-xs font-sans font-semibold tracking-wide transition-all cursor-pointer"
              style={{
                backgroundColor: activeFilter === 'shorts' ? 'var(--nav-active-bg)' : 'transparent',
                color: activeFilter === 'shorts' ? 'var(--nav-active-text)' : 'var(--nav-btn-text)',
              }}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Shorts</span>
            </button>
            <button
              type="button"
              onClick={(e) => toggleCategoryMenu('shorts', e)}
              aria-label="Jump to Shorts Albums"
              aria-expanded={openCategory === 'shorts'}
              className="p-1.5 pr-2 rounded-r-xl transition-all cursor-pointer hover:opacity-80"
              style={{
                backgroundColor: activeFilter === 'shorts' ? 'var(--nav-active-bg)' : 'transparent',
                color: activeFilter === 'shorts' ? 'var(--nav-active-text)' : 'var(--nav-btn-text)',
              }}
            >
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  openCategory === 'shorts' ? 'rotate-180 text-[#00E5FF]' : ''
                }`}
              />
            </button>

            {/* Desktop Down Dropdown Menu */}
            {openCategory === 'shorts' && (
              <div
                className="absolute top-full left-0 mt-2 min-w-[240px] max-h-[360px] overflow-y-auto rounded-xl p-1.5 shadow-2xl z-50 flex flex-col gap-1 border transition-all"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  borderColor: 'var(--nav-border)',
                }}
              >
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-400 border-b border-white/10 flex items-center justify-between">
                  <span>Shorts Folders</span>
                  <span>{shortAlbums.length}</span>
                </div>
                {shortAlbums.map((album) => (
                  <button
                    key={album.id}
                    type="button"
                    onClick={() => {
                      onJumpToAlbum(album.id, 'shorts');
                      setOpenCategory(null);
                    }}
                    className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-sans font-medium hover:bg-white/10 active:bg-white/20 transition-colors cursor-pointer"
                  >
                    <span className="truncate pr-2">{album.name}</span>
                    <span className="text-[10px] font-mono text-zinc-400 bg-white/10 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      {album.count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* =========================================================================
          2. MOBILE VIEWPORT (< 768px): Fixed Bottom Dock with Up Arrows (▲)
         ========================================================================= */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-[1000] select-none shadow-[0_-4px_24px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-colors duration-200"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          backgroundColor: 'var(--nav-bg)',
          borderTop: '1px solid var(--nav-border)',
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="w-full max-w-lg mx-auto px-2 py-1.5 flex items-center justify-between gap-1">
          {/* Home */}
          <button
            type="button"
            onClick={() => {
              setOpenCategory(null);
              onFilterChange('all');
            }}
            className="flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all cursor-pointer"
            style={{
              backgroundColor: activeFilter === 'all' ? 'var(--nav-active-bg)' : 'transparent',
              color: activeFilter === 'all' ? 'var(--nav-active-text)' : 'var(--nav-btn-text)',
            }}
          >
            <Home className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-sans font-semibold leading-none">Home</span>
          </button>

          {/* Images + Up Arrow (▲) */}
          <div
            className="flex-1 flex items-center justify-center rounded-xl p-0.5 transition-all"
            style={{
              backgroundColor: activeFilter === 'images' ? 'var(--nav-active-bg)' : 'transparent',
              color: activeFilter === 'images' ? 'var(--nav-active-text)' : 'var(--nav-btn-text)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setOpenCategory(null);
                onFilterChange('images');
              }}
              className="flex-1 flex flex-col items-center justify-center py-1 cursor-pointer"
            >
              <Camera className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] font-sans font-semibold leading-none">Images</span>
            </button>
            <button
              type="button"
              onClick={(e) => toggleCategoryMenu('images', e)}
              aria-label="Open Images Album Menu"
              className="px-1.5 py-1.5 hover:opacity-80 active:scale-90 transition-transform cursor-pointer"
            >
              <ChevronUp
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  openCategory === 'images' ? 'rotate-180 text-[#00E5FF]' : ''
                }`}
              />
            </button>
          </div>

          {/* Videos + Up Arrow (▲) */}
          <div
            className="flex-1 flex items-center justify-center rounded-xl p-0.5 transition-all"
            style={{
              backgroundColor: activeFilter === 'clips' ? 'var(--nav-active-bg)' : 'transparent',
              color: activeFilter === 'clips' ? 'var(--nav-active-text)' : 'var(--nav-btn-text)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setOpenCategory(null);
                onFilterChange('clips');
              }}
              className="flex-1 flex flex-col items-center justify-center py-1 cursor-pointer"
            >
              <Film className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] font-sans font-semibold leading-none">Videos</span>
            </button>
            <button
              type="button"
              onClick={(e) => toggleCategoryMenu('clips', e)}
              aria-label="Open Videos Album Menu"
              className="px-1.5 py-1.5 hover:opacity-80 active:scale-90 transition-transform cursor-pointer"
            >
              <ChevronUp
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  openCategory === 'clips' ? 'rotate-180 text-[#00E5FF]' : ''
                }`}
              />
            </button>
          </div>

          {/* Shorts + Up Arrow (▲) */}
          <div
            className="flex-1 flex items-center justify-center rounded-xl p-0.5 transition-all"
            style={{
              backgroundColor: activeFilter === 'shorts' ? 'var(--nav-active-bg)' : 'transparent',
              color: activeFilter === 'shorts' ? 'var(--nav-active-text)' : 'var(--nav-btn-text)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setOpenCategory(null);
                onFilterChange('shorts');
              }}
              className="flex-1 flex flex-col items-center justify-center py-1 cursor-pointer"
            >
              <Smartphone className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] font-sans font-semibold leading-none">Shorts</span>
            </button>
            <button
              type="button"
              onClick={(e) => toggleCategoryMenu('shorts', e)}
              aria-label="Open Shorts Album Menu"
              className="px-1.5 py-1.5 hover:opacity-80 active:scale-90 transition-transform cursor-pointer"
            >
              <ChevronUp
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  openCategory === 'shorts' ? 'rotate-180 text-[#00E5FF]' : ''
                }`}
              />
            </button>
          </div>
        </div>
      </nav>

      {/* =========================================================================
          3. MOBILE BOTTOM SHEET / POPOVER FOR QUICK ALBUM JUMP
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
