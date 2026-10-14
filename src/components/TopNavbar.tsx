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
          className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 md:static md:translate-x-0 md:top-auto md:translate-y-0 flex items-center justify-center gap-2.5 sm:gap-3.5 flex-shrink-0 cursor-pointer group bg-transparent border-none p-0 focus:outline-none select-none z-10"
          title="Return to Home / Top"
          aria-label="Return to Home"
        >
          <svg
            id="brand-triangle-logo"
            className="brand-triangle-logo w-8 h-8 sm:w-9 sm:h-9 md:w-11 md:h-11 flex-shrink-0 overflow-visible transition-transform duration-300 group-hover:scale-105"
            viewBox="0 0 100 100"
            width="48"
            height="48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Component A: Left Quadrilateral Body (SARWAR) */}
            <polygon id="logo-part-a" className="logo-part-a" points="50,10 63,36 33,90 20,90" fill="currentColor" />
            {/* Component B: Bottom-Right Triangle (CYOU) */}
            <polygon id="logo-part-b" className="logo-part-b" points="68,46 90,90 46,90" fill="currentColor" />
          </svg>
          <h1 className="brand-title font-brand font-black text-xl sm:text-2xl md:text-3xl tracking-wider select-none leading-none whitespace-nowrap m-0 p-0 flex items-center transition-opacity group-hover:opacity-95">
            <span id="title-sarwar" className="brand-part-a">SARWAR</span><span id="title-cyou" className="brand-part-b">CYOU</span>
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
