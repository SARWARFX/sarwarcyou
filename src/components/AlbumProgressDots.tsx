import React from 'react';
import type { AlbumData } from '../types';

interface AlbumProgressDotsProps {
  albums: AlbumData[];
  activeAlbumIndex: number;
  onSelectAlbum: (index: number) => void;
  isLightMode?: boolean;
  isHidden?: boolean;
}

export const AlbumProgressDots: React.FC<AlbumProgressDotsProps> = ({
  albums,
  activeAlbumIndex,
  onSelectAlbum,
  isLightMode: _isLightMode = false,
  isHidden = false,
}) => {
  if (isHidden) return null;

  return (
    <nav
      aria-label="12 Album Progress"
      className="fixed right-3 sm:right-5 top-1/2 -translate-y-1/2 z-35 flex flex-col items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 rounded-full border backdrop-blur-2xl select-none pointer-events-auto bg-black/75 border-white/[0.09] shadow-2xl transition-opacity duration-300"
    >
      {albums.map((album, idx) => {
        const isActive = idx === activeAlbumIndex;
        const count = album.itemCount || album.items.length;

        return (
          <button
            key={album.id}
            onClick={() => onSelectAlbum(idx)}
            className="group relative flex items-center justify-center p-1 cursor-pointer focus:outline-none"
            aria-label={`Go to Album ${idx + 1}: ${album.name}`}
          >
            {/* Frosted Tooltip: Album Title • Count items */}
            <div className="absolute right-7 px-3 py-1.5 rounded-lg bg-black/95 backdrop-blur-2xl border border-white/15 text-[10px] font-mono tracking-wider text-zinc-200 whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 shadow-2xl z-50 flex items-center gap-1.5">
              <span className="text-zinc-500 font-semibold">{(idx + 1).toString().padStart(2, '0')}</span>
              <span className="font-semibold text-zinc-100">{album.name}</span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-400 font-medium">{count} items</span>
            </div>

            {/* Dynamic Dot */}
            <div
              className={`rounded-full transition-all duration-300 ${
                isActive
                  ? 'h-4 w-1.5 bg-zinc-100 shadow-[0_0_10px_rgba(255,255,255,0.7)]'
                  : 'h-1.5 w-1.5 bg-zinc-700 group-hover:bg-zinc-300'
              }`}
            />
          </button>
        );
      })}
    </nav>
  );
};
