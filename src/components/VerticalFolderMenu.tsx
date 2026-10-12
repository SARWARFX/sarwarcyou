import React, { useState } from 'react';
import { Sparkles, Video, Zap, Image, Lock, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AlbumData } from '../types';

interface VerticalFolderMenuProps {
  albums: AlbumData[];
  activeAlbumIndex: number;
  onSelectAlbum: (index: number) => void;
}

export const VerticalFolderMenu: React.FC<VerticalFolderMenuProps> = ({
  albums,
  activeAlbumIndex,
  onSelectAlbum,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const getAlbumIcon = (album: AlbumData) => {
    if (album.itemCount === 0 || album.layoutType.startsWith('coming-soon')) {
      return <Lock className="w-3.5 h-3.5 text-cyan-400" />;
    }
    if (album.index === 0) {
      return <Sparkles className="w-3.5 h-3.5 text-[#00D2FF]" />;
    }
    if (album.layoutType === 'vertical-waterfall') {
      return <Zap className="w-3.5 h-3.5 text-pink-400" />;
    }
    if (album.type === 'video') {
      return <Video className="w-3.5 h-3.5 text-purple-400" />;
    }
    return <Image className="w-3.5 h-3.5 text-emerald-400" />;
  };

  return (
    <aside
      aria-label="12 Albums Navigation Dock"
      className={`fixed right-3 sm:right-6 top-1/2 -translate-y-1/2 z-30 select-none pointer-events-auto transition-all duration-300 ${
        isCollapsed ? 'translate-x-1 sm:translate-x-0' : ''
      }`}
    >
      <div className="relative flex items-center">
        {/* Toggle Collapse Button on left of the dock */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden sm:flex -mr-2 z-40 w-6 h-10 items-center justify-center rounded-l-lg bg-black/60 border-y border-l border-white/10 hover:border-[#00D2FF]/50 text-white/50 hover:text-white transition-all backdrop-blur-md cursor-pointer"
          title={isCollapsed ? 'Expand 12 Albums' : 'Collapse Menu'}
        >
          {isCollapsed ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {/* Floating Vertical Pill Navigation Sidebar */}
        <nav
          aria-label="Albums List"
          className={`flex flex-col gap-1 p-2 rounded-2xl bg-black/60 backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.7)] max-h-[82vh] overflow-y-auto no-scrollbar transition-all duration-300 ${
            isCollapsed ? 'w-12 sm:w-14 items-center' : 'w-48 sm:w-56'
          }`}
        >
          {/* Header Tag */}
          {!isCollapsed && (
            <div className="px-2.5 pt-1 pb-1.5 flex items-center justify-between border-b border-white/10 mb-0.5">
              <span className="text-[9px] font-mono tracking-[0.25em] text-[#00D2FF] font-bold uppercase">
                12 3D ALBUMS
              </span>
              <span className="text-[9px] font-mono text-white/40">
                {(activeAlbumIndex + 1).toString().padStart(2, '0')}/12
              </span>
            </div>
          )}

          {/* 12 Album List Items */}
          {albums.map((album, idx) => {
            const isActive = idx === activeAlbumIndex;
            const isComingSoon = album.itemCount === 0 || album.layoutType.startsWith('coming-soon');

            return (
              <button
                key={album.id}
                onClick={() => onSelectAlbum(idx)}
                title={`${album.name} (${isComingSoon ? 'Coming Soon' : `${album.itemCount} items`})`}
                className={`group relative flex items-center justify-between w-full rounded-xl transition-all duration-200 cursor-pointer ${
                  isCollapsed ? 'p-2 justify-center' : 'px-2.5 py-1.5'
                } ${
                  isActive
                    ? 'bg-gradient-to-r from-[#00D2FF]/20 via-[#00D2FF]/10 to-transparent border border-[#00D2FF]/60 text-white shadow-[0_0_18px_rgba(0,210,255,0.22)]'
                    : 'bg-white/[0.03] border border-transparent hover:border-white/15 hover:bg-white/[0.08] text-white/70 hover:text-white'
                }`}
              >
                {/* Left: Icon & Label */}
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`p-1 rounded-lg transition-transform group-hover:scale-110 ${
                      isActive ? 'bg-[#00D2FF]/20' : 'bg-white/5'
                    }`}
                  >
                    {getAlbumIcon(album)}
                  </div>

                  {!isCollapsed && (
                    <div className="flex flex-col items-start min-w-0 text-left leading-tight">
                      <span className="text-[11px] font-semibold tracking-wide truncate max-w-[110px] sm:max-w-[130px]">
                        {album.name}
                      </span>
                      <span className="text-[8px] font-mono text-white/40 uppercase">
                        {isComingSoon ? 'SOON' : album.type}
                      </span>
                    </div>
                  )}
                </div>

                {/* Right: Badge & Active Indicator */}
                {!isCollapsed && (
                  <div className="flex items-center gap-1.5 ml-2">
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md ${
                        isActive
                          ? 'bg-[#00D2FF]/20 text-[#00D2FF] font-bold'
                          : 'bg-white/5 text-white/40'
                      }`}
                    >
                      {isComingSoon ? 'SOON' : album.itemCount}
                    </span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00D2FF] shadow-[0_0_8px_#00D2FF] animate-pulse" />
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
};
