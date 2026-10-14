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

  // Dock to top-left when scrolled past 60px or navigating albums
  const isScrolled = Boolean(propIsScrolled || windowScrolled || activeAlbumIndex > 0);

  return (
    <>
      {/* Brand Header: Horizontally centered initially, glides to top-left on scroll */}
      <header
        className={`main-header ${isScrolled ? 'scrolled' : ''}`}
      >
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onResetHome?.();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="brand-link flex items-center m-0 p-0 cursor-pointer select-none border-none outline-none group"
          aria-label="SARWARCYOU Home"
        >
          <img
            src="/SARWARCYOU.svg"
            alt="SARWARCYOU"
            className="site-brand-logo transition-transform duration-300 group-hover:scale-105"
          />
        </a>
      </header>

      {/* Right: Universal Search Bar & Fast Navigation */}
      <div className="fixed top-4 right-4 sm:right-6 z-[1001] flex items-center">
        <UniversalSearchBar
          albums={albums}
          onSelectItem={onSelectItem}
          onSelectAlbum={onSelectAlbum}
          accentColor="var(--brand-color-a)"
        />
      </div>
    </>
  );
};
