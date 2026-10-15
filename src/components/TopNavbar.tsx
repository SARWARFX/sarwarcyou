import React, { useMemo } from 'react';
import { UniversalSearchBar } from './UniversalSearchBar';
import type { AlbumData, StageMediaItem } from '../types';

interface TopNavbarProps {
  albums?: AlbumData[];
  activeAlbumIndex?: number;
  onSelectAlbum?: (index: number) => void;
  onResetHome?: () => void;
  onSelectItem?: (item: StageMediaItem, albumIdx: number) => void;
  isScrolled?: boolean;
}

type CategoryChip = 'ALL' | 'LATEST' | 'CINEMA' | 'SHORTS' | 'PHOTOS';

const CATEGORIES: CategoryChip[] = ['ALL', 'LATEST', 'CINEMA', 'SHORTS', 'PHOTOS'];

export const TopNavbar: React.FC<TopNavbarProps> = ({
  albums = [],
  activeAlbumIndex = 0,
  onSelectAlbum,
  onResetHome,
  onSelectItem,
}) => {
  const activeCategory = useMemo<CategoryChip>(() => {
    if (activeAlbumIndex === 0) return 'LATEST';
    const cur = albums[activeAlbumIndex];
    if (!cur) return 'ALL';
    const isShorts =
      cur.id === 'album-shorts' ||
      cur.name.toLowerCase().includes('short') ||
      cur.layoutType === 'vertical-waterfall';
    if (isShorts) return 'SHORTS';
    if (cur.type === 'image') return 'PHOTOS';
    if (cur.type === 'video') return 'CINEMA';
    return 'ALL';
  }, [albums, activeAlbumIndex]);

  const handleCategoryClick = (category: CategoryChip) => {
    if (category === 'ALL') {
      if (onResetHome) {
        onResetHome();
      } else {
        onSelectAlbum?.(0);
      }
      return;
    }
    if (category === 'LATEST') {
      onSelectAlbum?.(0);
      return;
    }
    if (category === 'CINEMA') {
      const idx = albums.findIndex(
        (a) =>
          a.type === 'video' &&
          a.id !== 'album-shorts' &&
          !a.name.toLowerCase().includes('short') &&
          a.id !== 'album-latest'
      );
      if (idx !== -1) {
        onSelectAlbum?.(idx);
      } else {
        onSelectAlbum?.(0);
      }
      return;
    }
    if (category === 'SHORTS') {
      const idx = albums.findIndex(
        (a) =>
          a.id === 'album-shorts' ||
          a.name.toLowerCase().includes('short') ||
          a.layoutType === 'vertical-waterfall'
      );
      if (idx !== -1) {
        onSelectAlbum?.(idx);
      }
      return;
    }
    if (category === 'PHOTOS') {
      const idx = albums.findIndex((a) => a.type === 'image' && a.id !== 'album-latest');
      if (idx !== -1) {
        onSelectAlbum?.(idx);
      }
      return;
    }
  };

  return (
    <header className="fixed top-3 sm:top-4 left-0 right-0 z-[1001] flex justify-center px-3 sm:px-4 pointer-events-none">
      <div className="glass-pill pointer-events-auto flex items-center justify-between gap-2 sm:gap-4 px-2.5 sm:px-4 py-1.5 sm:py-2 w-full max-w-4xl shadow-[0_8px_32px_rgba(0,0,0,0.7)] transition-all duration-300">
        {/* Category Filter Chips */}
        <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => handleCategoryClick(cat)}
                className={`px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold font-brand tracking-wider transition-all duration-200 cursor-pointer flex-shrink-0 ${
                  isActive
                    ? 'bg-white/10 text-[#00D2FF] border border-[#00D2FF]/40 shadow-[0_0_12px_rgba(0,210,255,0.25)]'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/5 border border-transparent'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </nav>

        {/* Omnisearch Bar */}
        <div className="flex-shrink-0">
          <UniversalSearchBar
            albums={albums}
            onSelectItem={onSelectItem}
            onSelectAlbum={onSelectAlbum}
            accentColor="#00D2FF"
          />
        </div>
      </div>
    </header>
  );
};

export default TopNavbar;
