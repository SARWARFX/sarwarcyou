import React from 'react';
import { ChevronUp, ChevronDown, ArrowUpToLine } from 'lucide-react';

interface AlbumNavigationControlsProps {
  currentAlbumIndex: number;
  totalAlbums: number;
  currentAlbumName: string;
  onPrevAlbum: () => void;
  onNextAlbum: () => void;
  onBackToTop: () => void;
}

export const AlbumNavigationControls: React.FC<AlbumNavigationControlsProps> = ({
  currentAlbumIndex,
  totalAlbums,
  currentAlbumName,
  onPrevAlbum,
  onNextAlbum,
  onBackToTop,
}) => {
  return (
    <aside
      aria-label="Album Navigation"
      className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-40 flex items-center gap-2.5 select-none pointer-events-auto"
    >
      {/* 1. Active Album Counter Badge */}
      <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-black/65 border border-white/10 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.6)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#00D2FF] shadow-[0_0_8px_#00D2FF] animate-pulse" />
        <div className="flex flex-col text-left leading-tight">
          <span className="text-[11px] font-mono font-bold tracking-wider text-white">
            {(currentAlbumIndex + 1).toString().padStart(2, '0')} / {totalAlbums.toString().padStart(2, '0')}
          </span>
          <span className="text-[9px] font-mono tracking-widest text-[#00D2FF] truncate max-w-[85px] sm:max-w-[110px] uppercase font-semibold">
            {currentAlbumName}
          </span>
        </div>
      </div>

      {/* 2. Back to Top Button (Instant / Smooth jump to Album 1) */}
      <button
        onClick={onBackToTop}
        disabled={currentAlbumIndex === 0}
        title="Back to Top (Album 1)"
        className="flex items-center justify-center w-10 h-10 rounded-2xl bg-black/65 border border-white/10 hover:border-[#00D2FF]/60 hover:bg-[#00D2FF]/15 text-white/70 hover:text-white transition-all backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.6)] disabled:opacity-30 disabled:pointer-events-none active:scale-95 cursor-pointer group"
      >
        <ArrowUpToLine className="w-4 h-4 text-[#00D2FF] group-hover:scale-110 transition-transform" />
      </button>

      {/* 3. Vertical Up & Down Navigation Buttons */}
      <div className="flex flex-col items-center rounded-2xl bg-black/65 border border-white/10 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.6)] overflow-hidden">
        {/* Up Arrow (Previous Album) */}
        <button
          onClick={onPrevAlbum}
          disabled={currentAlbumIndex === 0}
          title="Previous Album (Up)"
          className="p-2 sm:p-2.5 text-white/70 hover:text-white hover:bg-[#00D2FF]/15 hover:text-[#00D2FF] transition-all disabled:opacity-20 disabled:pointer-events-none active:scale-90 cursor-pointer"
        >
          <ChevronUp className="w-4 h-4" />
        </button>

        {/* Subtle Divider */}
        <div className="w-full h-[1px] bg-white/10" />

        {/* Down Arrow (Next Album) */}
        <button
          onClick={onNextAlbum}
          disabled={currentAlbumIndex >= totalAlbums - 1}
          title="Next Album (Down)"
          className="p-2 sm:p-2.5 text-white/70 hover:text-white hover:bg-[#00D2FF]/15 hover:text-[#00D2FF] transition-all disabled:opacity-20 disabled:pointer-events-none active:scale-90 cursor-pointer"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
