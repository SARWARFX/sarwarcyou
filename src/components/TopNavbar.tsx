import React from 'react';
import { UniversalSearchBar } from './UniversalSearchBar';
import type { AlbumData, StageMediaItem } from '../types';

interface TopNavbarProps {
  albums?: AlbumData[];
  activeAlbumIndex?: number;
  onSelectAlbum?: (index: number) => void;
  onResetHome?: () => void;
  onSelectItem?: (item: StageMediaItem, albumIdx: number) => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  albums = [],
  onSelectAlbum,
  onResetHome,
  onSelectItem,
}) => {

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
          className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 md:static md:translate-x-0 md:top-auto md:translate-y-0 brand-lockup inline-flex items-center justify-center gap-[10px] m-0 p-0 flex-shrink-0 cursor-pointer group bg-transparent border-none focus:outline-none select-none z-10"
          title="Return to Home / Top"
          aria-label="Return to Home"
        >
          <svg
            id="brand-delta-logo"
            className="brand-delta-logo w-[38px] h-[38px] sm:w-[42px] sm:h-[42px] overflow-visible transition-transform duration-300 group-hover:scale-105"
            viewBox="0 0 100 100"
            width="42"
            height="42"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: 'block', flexShrink: 0 }}
          >
            <defs>
              <linearGradient id="brand-dynamic-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ffffff" />
                <stop id="svg-gradient-mid" className="svg-gradient-mid" offset="50%" stop-color="hsl(205, 100%, 65%)" />
                <stop offset="100%" stop-color="#ffffff" />
              </linearGradient>
            </defs>
            {/* Segment 1: Top-Left Apex Bar */}
            <path d="M 50,6 L 62,28 L 47,56 L 31,56 Z" fill="url(#brand-dynamic-gradient)" />
            {/* Segment 2: Bottom-Left Foot & Center Fold */}
            <path d="M 24,67 L 41,67 L 54,92 L 11,92 L 24,67 Z M 44,67 L 58,41 L 69,61 L 55,61 Z" fill="url(#brand-dynamic-gradient)" />
            {/* Segment 3: Right Slanted Leg */}
            <path d="M 64,19 L 50,46 L 63,69 L 89,92 L 100,92 Z" fill="url(#brand-dynamic-gradient)" />
          </svg>
          <h1 className="brand-title font-brand font-black select-none leading-none whitespace-nowrap m-0 p-0 flex items-center transition-opacity group-hover:opacity-95">
            SARWARCYOU
          </h1>
        </a>

        {/* Empty placeholder on mobile to balance flex layout */}
        <div className="w-8 md:hidden" aria-hidden="true" />

        {/* Right: Universal Search Bar & Fast Navigation */}
        <div className="flex items-center flex-shrink-0 ml-auto z-20">
          <UniversalSearchBar
            albums={albums}
            onSelectItem={onSelectItem}
            onSelectAlbum={onSelectAlbum}
            accentColor="var(--brand-color-a)"
          />
        </div>
      </div>
    </header>
  );
};
