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
  { r: 0, g: 210, b: 255 },
  { r: 157, g: 0, b: 255 },
  { r: 255, g: 0, b: 85 },
  { r: 255, g: 153, b: 0 },
  { r: 255, g: 255, b: 255 },
];

function interpolateColor(t: number): string {
  const scaled = t * (CHROMATIC_STOPS.length - 1);
  const index = Math.floor(scaled);
  const frac = scaled - index;
  const c1 = CHROMATIC_STOPS[index];
  const c2 = CHROMATIC_STOPS[Math.min(index + 1, CHROMATIC_STOPS.length - 1)];

  const r = Math.round(c1.r + (c2.r - c1.r) * frac);
  const g = Math.round(c1.g + (c2.g - c1.g) * frac);
  const b = Math.round(c1.b + (c2.b - c1.b) * frac);

  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  albums,
  activeAlbumIndex,
  onSelectAlbum,
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [currentColor, setCurrentColor] = useState('#00D2FF');

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
      if (e.key === 'Escape' && isDrawerOpen) {
        setIsDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDrawerOpen]);

  return (
    <>
      {/* ================= TOP-LEFT PILL NAVBAR ================= */}
      <header className="fixed top-5 left-5 sm:top-6 sm:left-6 z-40 pointer-events-auto">
        <div className="flex items-center gap-3.5 px-4 py-2.5 rounded-full border border-white/10 bg-[#0a0a0c]/80 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.7)] hover:border-white/20 transition-all duration-300">
          {/* Chromatic Glowing Play Glyph */}
          <div className="flex items-center justify-center">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill={currentColor}
              style={{
                filter: `drop-shadow(0 0 14px ${currentColor})`,
                transition: 'filter 0.3s ease',
              }}
            >
              <path d="M5.5 3.868v16.264a1.5 1.5 0 002.28 1.282l13.553-8.132a1.5 1.5 0 000-2.564L7.78 2.586A1.5 1.5 0 005.5 3.868z" />
            </svg>
          </div>

          {/* Living Chromatic Wordmark */}
          <span
            style={{
              backgroundImage: `linear-gradient(135deg, #FFFFFF 0%, ${currentColor} 60%, #FFFFFF 100%)`,
              textShadow: `0 0 20px ${currentColor}33`,
            }}
            className="font-space font-black tracking-[0.22em] text-sm sm:text-base bg-clip-text text-transparent uppercase select-none leading-none"
          >
            SARWAR C YOU
          </span>

          {/* Hairline Divider */}
          <div className="w-[1px] h-4 bg-white/15" />

          {/* Hamburger Drawer Trigger */}
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-1.5 text-xs font-mono uppercase tracking-widest text-white/70 hover:text-[#00D2FF] transition-colors cursor-pointer group"
            title="Open Albums Drawer"
          >
            <Menu className="w-4 h-4 text-white/80 group-hover:text-[#00D2FF] transition-colors" />
            <span className="hidden sm:inline text-[11px] font-semibold">MENU</span>
          </button>
        </div>
      </header>

      {/* ================= SLEEK 12 ALBUMS DRAWER ================= */}
      {isDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex bg-black/80 backdrop-blur-2xl animate-fade-in select-none"
          onClick={() => setIsDrawerOpen(false)}
        >
          {/* Drawer Slide-in Panel */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg h-full bg-[#0d0f17] border-r border-white/10 shadow-[0_0_60px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden animate-slide-right"
          >
            {/* Drawer Header */}
            <div className="px-6 sm:px-8 py-6 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div>
                <span className="text-[10px] font-mono tracking-[0.3em] text-[#00D2FF] uppercase font-bold block">
                  ARCHIVE SELECTOR
                </span>
                <h2 className="text-xl font-black font-space tracking-tight text-white uppercase mt-0.5">
                  12 CURATED ALBUMS
                </h2>
              </div>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Close Drawer (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Album List */}
            <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-4 divide-y divide-white/5 space-y-1 no-scrollbar">
              {albums.map((album, idx) => {
                const isActive = idx === activeAlbumIndex;
                const formattedNum = String(idx + 1).padStart(2, '0');
                const isComingSoon =
                  album.itemCount === 0 || album.layoutType.startsWith('coming-soon');

                return (
                  <button
                    key={album.id}
                    onClick={() => {
                      onSelectAlbum(idx);
                      setIsDrawerOpen(false);
                    }}
                    className={`w-full py-3.5 px-3 rounded-xl flex items-center justify-between text-left transition-all duration-300 group cursor-pointer ${
                      isActive
                        ? 'bg-[#00D2FF]/10 border border-[#00D2FF]/30 text-white shadow-[0_0_25px_rgba(0,210,255,0.15)]'
                        : 'hover:bg-white/5 text-white/70 hover:text-white border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Album Index */}
                      <span
                        className={`font-mono text-xs tracking-wider font-bold ${
                          isActive ? 'text-[#00D2FF]' : 'text-white/40 group-hover:text-white/80'
                        }`}
                      >
                        {formattedNum}
                      </span>

                      {/* Album Title */}
                      <div>
                        <span
                          className={`font-space font-bold text-sm sm:text-base tracking-wide block uppercase transition-colors ${
                            isActive
                              ? 'text-white font-black'
                              : 'text-white/80 group-hover:text-white'
                          }`}
                        >
                          {album.name}
                        </span>
                        <span className="text-[10px] font-mono tracking-widest text-white/40 uppercase block">
                          {isComingSoon
                            ? 'COMING SOON'
                            : album.type === 'video'
                            ? `${album.items.length} CINEMA VIDEOS`
                            : `${album.items.length} PHOTOGRAPHS`}
                        </span>
                      </div>
                    </div>

                    {/* Active Indicator or Jump Arrow */}
                    <div className="flex items-center gap-2">
                      {isActive ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#00D2FF] text-black font-mono text-[9px] font-black uppercase tracking-widest">
                          VIEWING
                        </span>
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-white/30 group-hover:text-[#00D2FF] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Drawer Footer */}
            <div className="px-6 sm:px-8 py-4 border-t border-white/10 bg-black/40 flex items-center justify-between text-[10px] font-mono tracking-widest text-white/40">
              <span>SARWAR C YOU</span>
              <span className="text-[#00D2FF]">PORTFOLIO 2026</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
