import React, { useState, useEffect } from 'react';
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

export const TopNavbar: React.FC<TopNavbarProps> = ({
  albums = [],
  activeAlbumIndex = 0,
  onSelectAlbum,
  onResetHome,
  onSelectItem,
  isScrolled: propIsScrolled,
}) => {
  const [windowScrolled, setWindowScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY =
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;
      setWindowScrolled(scrollY > 60);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, []);

  // Coordinate SSOT global header docking
  const isScrolled = Boolean(propIsScrolled || windowScrolled || activeAlbumIndex > 0);

  useEffect(() => {
    const header = document.getElementById('global-site-header');
    if (header) {
      if (isScrolled) {
        header.classList.add('scrolled', 'docked-left');
      } else {
        header.classList.remove('scrolled', 'docked-left');
      }
    }
  }, [isScrolled]);

  useEffect(() => {
    const onReset = () => {
      onResetHome?.();
    };
    window.addEventListener('sarwarcyou:reset-home', onReset);
    return () => window.removeEventListener('sarwarcyou:reset-home', onReset);
  }, [onResetHome]);

  return (
    <div className="fixed top-4 right-4 sm:right-6 z-[1001] flex items-center pointer-events-auto">
      <UniversalSearchBar
        albums={albums}
        onSelectItem={onSelectItem}
        onSelectAlbum={onSelectAlbum}
        accentColor="var(--brand-color-a)"
      />
    </div>
  );
};
