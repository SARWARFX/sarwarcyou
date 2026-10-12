import React from 'react';
import type { AlbumData } from '../types';

interface AlbumProgressDotsProps {
  albums: AlbumData[];
  activeAlbumIndex: number;
  onSelectAlbum: (index: number) => void;
  isLightMode?: boolean;
}

export const AlbumProgressDots: React.FC<AlbumProgressDotsProps> = ({
  albums,
  activeAlbumIndex,
  onSelectAlbum,
  isLightMode = false,
}) => {
  return (
    <nav
      aria-label="12 Album Progress"
      className={`fixed right-5 sm:right-7 top-1/2 -translate-y-1/2 z-35 flex flex-col items-center gap-2.5 p-2 rounded-full border backdrop-blur-xl select-none pointer-events-auto transition-all duration-500 ${
        isLightMode
          ? 'bg-white/80 border-black/10 shadow-[0_8px_30px_rgba(0,0,0,0.12)]'
          : 'bg-black/40 border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.6)]'
      }`}
    >
      {albums.map((album, idx) => {
        const isActive = idx === activeAlbumIndex;
        const isComingSoon = album.itemCount === 0 || album.layoutType.startsWith('coming-soon');

        return (
          <button
            key={album.id}
            onClick={() => onSelectAlbum(idx)}
            className="group relative flex items-center justify-center p-1 cursor-pointer focus:outline-none"
            aria-label={`Go to Album ${idx + 1}: ${album.name}`}
          >
            {/* Tooltip on Hover (appears on the left side of dot) */}
            <div className="absolute right-7 px-2.5 py-1 rounded-lg bg-black/90 border border-white/15 text-[10px] font-mono tracking-wider text-white whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 shadow-xl z-50">
              <span className="text-[#00D2FF] font-bold mr-1.5">
                {(idx + 1).toString().padStart(2, '0')}
              </span>
              <span>{album.name}</span>
              {isComingSoon && <span className="text-white/40 ml-1.5">(SOON)</span>}
            </div>

            {/* Indicator Dot / Pill */}
            <div
              className={`rounded-full transition-all duration-300 ${
                isActive
                  ? isLightMode
                    ? 'h-5 w-1.5 bg-[#0090C8] shadow-[0_0_10px_#0090C8]'
                    : 'h-5 w-1.5 bg-[#00D2FF] shadow-[0_0_10px_#00D2FF]'
                  : isLightMode
                  ? 'h-1.5 w-1.5 bg-black/25 group-hover:bg-black/70 group-hover:scale-125'
                  : 'h-1.5 w-1.5 bg-white/25 group-hover:bg-white/70 group-hover:scale-125'
              }`}
            />
          </button>
        );
      })}
    </nav>
  );
};
