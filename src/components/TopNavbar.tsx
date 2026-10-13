import React, { useState, useEffect } from 'react';
import type { AlbumData } from '../types';

interface TopNavbarProps {
  albums?: AlbumData[];
  activeAlbumIndex?: number;
  onSelectAlbum?: (index: number) => void;
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

export const TopNavbar: React.FC<TopNavbarProps> = () => {
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
      <div className="w-full bg-black px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between">
        {/* Left: Brand Monogram & Wordmark (Prominent & Bold) */}
        <div className="flex items-center gap-3 sm:gap-3.5 flex-shrink-0">
          <div className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill={currentColor}
              style={{ filter: `drop-shadow(0 0 14px ${currentColor}aa)`, transition: 'filter 0.3s ease' }}
              className="w-6 h-6 sm:w-7 sm:h-7"
            >
              <path d="M5.5 3.868v16.264a1.5 1.5 0 002.28 1.282l13.553-8.132a1.5 1.5 0 000-2.564L7.78 2.586A1.5 1.5 0 005.5 3.868z" />
            </svg>
          </div>
          <span
            style={{
              backgroundImage: `linear-gradient(135deg, #FFFFFF 0%, ${currentColor} 60%, #FFFFFF 100%)`,
            }}
            className="font-space font-black tracking-[0.22em] text-sm sm:text-base md:text-lg bg-clip-text text-transparent uppercase select-none leading-none"
          >
            SARWARCYOU
          </span>
        </div>
      </div>
    </header>
  );
};
