/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { Menu, X, ArrowUpRight } from 'lucide-react';
import type { AlbumData } from '../types';

interface TopNavbarProps {
  albums: AlbumData[];
  activeAlbumIndex: number;
  onSelectAlbum: (index: number) => void;
}

// Chromatic stops for living brand flow
const CHROMATIC_STOPS = [
  { r: 255, g: 255, b: 255 },
  { r: 0,   g: 210, b: 255 },
  { r: 157, g: 0,   b: 255 },
  { r: 255, g: 0,   b: 85  },
  { r: 255, g: 153, b: 0   },
  { r: 255, g: 255, b: 255 },
];

function interpolateColor(t: number): string {
  const scaled = t * (CHROMATIC_STOPS.length - 1);
  const index  = Math.floor(scaled);
  const frac   = scaled - index;
  const c1     = CHROMATIC_STOPS[index];
  const c2     = CHROMATIC_STOPS[Math.min(index + 1, CHROMATIC_STOPS.length - 1)];
  const r = Math.round(c1.r + (c2.r - c1.r) * frac);
  const g = Math.round(c1.g + (c2.g - c1.g) * frac);
  const b = Math.round(c1.b + (c2.b - c1.b) * frac);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

type FilterCategory = 'all' | 'clips' | 'shorts' | 'gallery';

export const TopNavbar: React.FC<TopNavbarProps> = ({
  albums,
  activeAlbumIndex,
  onSelectAlbum,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentColor, setCurrentColor] = useState('#00D2FF');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');

  // Living chromatic cycle
  useEffect(() => {
    let frameId: number;
    const startTime = performance.now();
    const updateColor = (time: number) => {
      const progress = ((time - startTime) % 10000) / 10000;
      setCurrentColor(interpolateColor(progress));
      frameId = requestAnimationFrame(updateColor);
    };
    frameId = requestAnimationFrame(updateColor);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Close drawer on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDrawerOpen) setIsDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDrawerOpen]);

  // Sync activeFilter with active album index
  useEffect(() => {
    const cur = albums[activeAlbumIndex];
    if (!cur) return;
    if (cur.name.toLowerCase().includes('short') || cur.name.toLowerCase().includes('reel')) {
      setActiveFilter('shorts');
    } else if (cur.type === 'video') {
      setActiveFilter('clips');
    } else if (cur.type === 'image') {
      setActiveFilter('gallery');
    }
  }, [activeAlbumIndex, albums]);

  const handleFilterClick = (cat: FilterCategory) => {
    setActiveFilter(cat);
    if (cat === 'all') {
      onSelectAlbum(0);
    } else if (cat === 'clips') {
      const idx = albums.findIndex(
        (a) => a.type === 'video' && !a.name.toLowerCase().includes('short')
      );
      if (idx !== -1) onSelectAlbum(idx);
    } else if (cat === 'shorts') {
      const idx = albums.findIndex(
        (a) => a.name.toLowerCase().includes('short') || a.name.toLowerCase().includes('reel')
      );
      if (idx !== -1) onSelectAlbum(idx);
    } else if (cat === 'gallery') {
      const idx = albums.findIndex((a) => a.type === 'image');
      if (idx !== -1) onSelectAlbum(idx);
    }
  };

  const FILTER_PILLS: { id: FilterCategory; label: string }[] = [
    { id: 'all',     label: 'All'     },
    { id: 'clips',   label: 'Clips'   },
    { id: 'shorts',  label: 'Shorts'  },
    { id: 'gallery', label: 'Gallery' },
  ];

  const filteredAlbums = albums.filter(a => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'clips')   return a.type === 'video' && !a.name.toLowerCase().includes('short');
    if (activeFilter === 'shorts')  return a.name.toLowerCase().includes('short') || a.name.toLowerCase().includes('reel');
    if (activeFilter === 'gallery') return a.type === 'image';
    return true;
  });

  return (
    <>
      {/* ===== GLASSMORPHIC TOP NAVBAR ===== */}
      <header className="fixed top-0 left-0 right-0 z-40 pointer-events-auto">
        <div className="w-full backdrop-blur-md bg-black/50 border-b border-white/[0.05] px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          {/* Left: Brand pill */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            {/* Chromatic play glyph */}
            <div className="flex items-center justify-center w-6 h-6">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill={currentColor}
                style={{ filter: `drop-shadow(0 0 10px ${currentColor}88)`, transition: 'filter 0.3s ease' }}
              >
                <path d="M5.5 3.868v16.264a1.5 1.5 0 002.28 1.282l13.553-8.132a1.5 1.5 0 000-2.564L7.78 2.586A1.5 1.5 0 005.5 3.868z" />
              </svg>
            </div>
            <span
              style={{
                backgroundImage: `linear-gradient(135deg, #FFFFFF 0%, ${currentColor} 60%, #FFFFFF 100%)`,
              }}
              className="font-space font-black tracking-[0.2em] text-[11px] sm:text-xs bg-clip-text text-transparent uppercase select-none leading-none"
            >
              SARWAR C YOU
            </span>
          </div>

          {/* Center: Category filter pills */}
          <nav className="hidden sm:flex items-center gap-1" aria-label="Category filter">
            {FILTER_PILLS.map(pill => (
              <button
                key={pill.id}
                onClick={() => handleFilterClick(pill.id)}
                className={`px-3 py-1 rounded-full text-[10px] font-mono font-semibold tracking-wider uppercase transition-all duration-200 cursor-pointer ${
                  activeFilter === pill.id
                    ? 'bg-zinc-800 text-zinc-100 border border-white/15'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60 border border-transparent'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </nav>

          {/* Right: Hamburger */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-1.5 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/60 transition-all duration-200 cursor-pointer border border-transparent hover:border-white/10 flex-shrink-0"
            title="Open albums drawer"
          >
            <Menu className="w-4 h-4" />
            <span className="hidden sm:inline text-[10px] font-mono uppercase tracking-widest">Menu</span>
          </button>
        </div>
      </header>

      {/* ===== ALBUMS DRAWER ===== */}
      {isDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex bg-black/75 backdrop-blur-xl animate-fade-in select-none"
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-md h-full bg-[#09090b] border-r border-white/[0.07] shadow-2xl flex flex-col overflow-hidden animate-slide-right"
          >
            {/* Drawer Header */}
            <div className="px-5 sm:px-6 py-5 border-b border-white/[0.07] flex items-center justify-between flex-shrink-0">
              <div>
                <span className="text-[9px] font-mono tracking-[0.35em] text-zinc-600 uppercase block">Archive Selector</span>
                <h2 className="text-base font-bold font-space text-zinc-100 uppercase tracking-tight mt-0.5">
                  {albums.length} Albums
                </h2>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-100 transition-colors cursor-pointer border border-white/[0.07]"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile filter pills inside drawer */}
            <div className="sm:hidden flex items-center gap-1.5 px-5 py-3 border-b border-white/[0.05]">
              {FILTER_PILLS.map(pill => (
                <button
                  key={pill.id}
                  onClick={() => setActiveFilter(pill.id)}
                  className={`px-2.5 py-1 rounded-full text-[9px] font-mono font-semibold tracking-wider uppercase transition-all duration-200 cursor-pointer ${
                    activeFilter === pill.id
                      ? 'bg-zinc-800 text-zinc-100 border border-white/15'
                      : 'text-zinc-600 hover:text-zinc-300 border border-transparent'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Album List */}
            <nav aria-label="Curated Archives" className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5 no-scrollbar">
              {filteredAlbums.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <span className="text-zinc-700 text-xs font-mono uppercase tracking-widest">No albums in this category</span>
                </div>
              ) : (
                filteredAlbums.map(album => {
                  const originalIdx = albums.indexOf(album);
                  const isActive = originalIdx === activeAlbumIndex;
                  const formattedNum = String(originalIdx + 1).padStart(2, '0');
                  const isComingSoon = album.itemCount === 0 || album.layoutType.startsWith('coming-soon');

                  return (
                    <button
                      key={album.id}
                      onClick={() => { onSelectAlbum(originalIdx); setIsDrawerOpen(false); }}
                      className={`w-full py-3 px-3 rounded-xl flex items-center justify-between text-left transition-all duration-200 group cursor-pointer ${
                        isActive
                          ? 'bg-zinc-800/60 border border-white/[0.1] text-zinc-100'
                          : 'hover:bg-zinc-900/60 text-zinc-500 hover:text-zinc-200 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`font-mono text-[10px] tracking-wider font-semibold flex-shrink-0 ${isActive ? 'text-zinc-400' : 'text-zinc-700 group-hover:text-zinc-500'}`}>
                          {formattedNum}
                        </span>
                        <div className="min-w-0">
                          <span className={`font-space font-semibold text-[11px] sm:text-xs tracking-wide block uppercase truncate transition-colors ${isActive ? 'text-zinc-100' : 'text-zinc-400 group-hover:text-zinc-200'}`}>
                            {album.name}
                          </span>
                          <span className="text-[9px] font-mono tracking-widest text-zinc-700 uppercase block mt-0.5">
                            {isComingSoon ? 'Coming Soon' : album.type === 'video' ? `${album.items.length} videos` : `${album.items.length} photos`}
                          </span>
                        </div>
                      </div>
                      <div className="flex-shrink-0 ml-2">
                        {isActive ? (
                          <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-black font-mono text-[8px] font-bold uppercase tracking-widest">LIVE</span>
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </nav>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-white/[0.06] flex items-center justify-between text-[9px] font-mono text-zinc-800 tracking-widest uppercase flex-shrink-0">
              <span>Sarwar C You</span>
              <span>Portfolio 2026</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
