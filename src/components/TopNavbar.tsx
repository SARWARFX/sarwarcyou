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
      <div className="w-full bg-black/90 backdrop-blur-md px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3 sm:gap-4">
        {/* Left: Brand Monogram & Wordmark (Prominent, Bold & Interactive Home Link) */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onResetHome?.();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="flex items-center gap-2 sm:gap-3.5 flex-shrink-0 cursor-pointer group bg-transparent border-none p-0 text-left focus:outline-none"
          title="Return to Home / Top"
          aria-label="Return to Home"
        >
          <div className="flex items-center justify-center w-7 h-7 sm:w-10 sm:h-10 transition-transform duration-300 group-hover:scale-105">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill={currentColor}
              style={{ filter: `drop-shadow(0 0 16px ${currentColor}aa)`, transition: 'filter 0.3s ease' }}
              className="w-6 h-6 sm:w-9 sm:h-9"
            >
              <path d="M5.5 3.868v16.264a1.5 1.5 0 002.28 1.282l13.553-8.132a1.5 1.5 0 000-2.564L7.78 2.586A1.5 1.5 0 005.5 3.868z" />
            </svg>
          </div>
          <span
            style={{
              backgroundImage: `linear-gradient(135deg, #FFFFFF 0%, ${currentColor} 60%, #FFFFFF 100%)`,
            }}
            className="font-space font-extrabold tracking-tight text-xl sm:text-3xl md:text-4xl bg-clip-text text-transparent uppercase select-none leading-none whitespace-nowrap transition-opacity group-hover:opacity-90"
          >
            SARWARCYOU
          </span>
        </button>

        {/* Right: Universal Search Bar & Fast Navigation */}
        <div className="flex items-center flex-shrink-0">
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
