import React, { useState, useEffect } from 'react';
import { UniversalSearchBar } from './UniversalSearchBar';
import type { AlbumData, StageMediaItem } from '../types';

interface TopNavbarProps {
  albums?: AlbumData[];
  activeAlbumIndex?: number;
  onSelectAlbum?: (index: number) => void;
  onResetHome?: () => void;
  onSelectItem?: (item: StageMediaItem, albumIdx: number) => void;
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

export const TopNavbar: React.FC<TopNavbarProps> = ({
  albums = [],
  onSelectAlbum,
  onResetHome,
  onSelectItem,
}) => {
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

  return (
    <header className="fixed top-0 left-0 right-0 z-40 pointer-events-auto">
      <div className="w-full bg-black/90 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3 sm:gap-4 relative">
        {/* Brand Logo & Wordmark: Centered on mobile (<768px), Left-aligned on desktop (>=768px) */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onResetHome?.();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 md:static md:translate-x-0 md:top-auto md:translate-y-0 flex items-center gap-2 sm:gap-3 flex-shrink-0 cursor-pointer group bg-transparent border-none p-0 text-left focus:outline-none select-none z-10"
          title="Return to Home / Top"
          aria-label="Return to Home"
        >
          <img
            src="/brand-logo.png"
            alt="SARWARCYOU"
            className="brand-harmonic-graphic h-8 sm:h-9 md:h-10 w-auto object-contain flex-shrink-0"
          />
          <span className="font-brand font-black text-xl sm:text-2xl md:text-3xl tracking-widest uppercase brand-harmonic-text select-none leading-none whitespace-nowrap transition-opacity group-hover:opacity-90">
            SARWARCYOU
          </span>
        </a>

        {/* Empty placeholder on mobile to balance flex layout */}
        <div className="w-8 md:hidden" aria-hidden="true" />

        {/* Right: Universal Search Bar & Fast Navigation */}
        <div className="flex items-center flex-shrink-0 ml-auto z-20">
          <UniversalSearchBar
            albums={albums}
            onSelectItem={onSelectItem}
            onSelectAlbum={onSelectAlbum}
            accentColor={currentColor}
          />
        </div>
      </div>
    </header>
  );
};
