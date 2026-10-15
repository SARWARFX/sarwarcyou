import React, { useRef, useEffect, useMemo } from 'react';
import { Camera, Film, Sparkles, Folder, ChevronRight, X } from 'lucide-react';
import type { StageMediaItem, MediaFolderEntry } from '../types';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';
import { getMediaUrl } from '../utils/imageUrlResolver';

export interface CyberMediaSidebarProps {
  items: StageMediaItem[];
  activeItem: StageMediaItem | null;
  activeIdx: number;
  onSelectItem: (item: StageMediaItem, index: number) => void;
  mediaType: 'video' | 'image';
  currentFolderName?: string;
  allFolders?: MediaFolderEntry[];
  onSelectFolder?: (folder: MediaFolderEntry) => void;
  className?: string;
  onClose?: () => void;
}

export const CyberMediaSidebar: React.FC<CyberMediaSidebarProps> = ({
  items,
  activeItem,
  activeIdx,
  onSelectItem,
  mediaType,
  currentFolderName,
  allFolders = [],
  onSelectFolder,
  className = '',
  onClose,
}) => {
  const activeItemRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the active item into view inside the queue list
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }
  }, [activeIdx]);

  // Compute 2 suggested folders different from the current folder
  const suggestedFolders = useMemo(() => {
    if (!allFolders || allFolders.length === 0) return [];
    const normCurrent = (currentFolderName || '').trim().toLowerCase();
    return allFolders
      .filter((f) => {
        const normF = (f.name || f.id || '').trim().toLowerCase();
        return normF !== normCurrent && f.items && f.items.length > 0;
      })
      .slice(0, 2);
  }, [allFolders, currentFolderName]);

  return (
    <aside
      className={`w-full sm:w-[320px] md:w-[340px] max-w-[90vw] h-full overflow-y-auto overscroll-contain border-l border-white/10 p-4 space-y-6 flex-shrink-0 bg-[#07070a]/98 backdrop-blur-3xl no-scrollbar select-none z-30 shadow-2xl ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header bar to allow closing or showing queue info */}
      <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          {mediaType === 'video' ? (
            <Film className="w-4 h-4 text-amber-400" />
          ) : (
            <Camera className="w-4 h-4 text-cyan-400" />
          )}
          <h2 className="text-sm font-bold font-sans text-white uppercase tracking-wider">
            {mediaType === 'video' ? 'Video Queue' : 'Photo Gallery'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-white/5 text-[#00E5FF] border border-[#00E5FF]/20">
            {activeIdx + 1} / {items.length}
          </span>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-zinc-300 hover:text-white transition-colors cursor-pointer border border-white/10"
              title="Close Queue (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* SECTION 1: "Now Playing / Current Album" (Queue) */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-mono font-bold tracking-widest text-zinc-400 uppercase truncate max-w-[240px]">
            {currentFolderName || (mediaType === 'video' ? 'Current Queue' : 'Current Album')}
          </span>
          <span className="text-[10px] font-mono text-zinc-500 uppercase">
            {items.length} {mediaType === 'video' ? 'Clips' : 'Photos'}
          </span>
        </div>

        {/* Compact Horizontal Cards List */}
        <div className="flex flex-col gap-2">
          {items.map((it, idx) => {
            const isActive =
              idx === activeIdx ||
              it.id === activeItem?.id ||
              it.url === activeItem?.url;
            const thumbUrl = it.thumbnail || it.poster || it.url;
            const cleanTitle = sanitizeMediaTitle(it.title, it.category);

            return (
              <div
                key={it.id || idx}
                ref={isActive ? activeItemRef : undefined}
                onClick={() => onSelectItem(it, idx)}
                className={`group flex items-center gap-3 p-2 rounded-xl transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-white/10 border border-[#00E5FF]/50 shadow-[0_0_15px_rgba(0,229,255,0.18)]'
                    : 'bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-white/10'
                }`}
              >
                {/* Thumbnail on the left */}
                <div
                  className={`relative ${
                    mediaType === 'video' ? 'w-20 aspect-video' : 'w-16 h-12'
                  } rounded-lg overflow-hidden bg-black flex-shrink-0 border border-white/10`}
                >
                  {thumbUrl && (
                    <img
                      src={getMediaUrl(thumbUrl)}
                      alt={cleanTitle}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      loading="lazy"
                    />
                  )}
                  {isActive && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="w-2 h-2 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF] animate-ping" />
                      <span className="w-2 h-2 rounded-full bg-[#00E5FF] absolute" />
                    </div>
                  )}
                </div>

                {/* Right Details: Clean Title, Index/Type */}
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-xs font-semibold block truncate leading-tight ${
                      isActive
                        ? 'text-[#00E5FF]'
                        : 'text-zinc-200 group-hover:text-white'
                    }`}
                  >
                    {cleanTitle}
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono text-zinc-500">
                      #{idx + 1}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider truncate">
                      {it.category || (mediaType === 'video' ? 'Clip' : 'Photo')}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: "Explore More" (Suggested Folders) */}
      {suggestedFolders.length > 0 && (
        <div className="pt-4 border-t border-white/10 flex flex-col gap-3">
          <div className="flex items-center gap-2 px-1">
            <Sparkles className="w-3.5 h-3.5 text-[#00E5FF]" />
            <h3 className="text-xs font-bold font-sans tracking-wider text-zinc-300 uppercase">
              Explore More
            </h3>
            <span className="text-[10px] font-mono text-zinc-500 uppercase ml-auto">
              Suggested Archives
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {suggestedFolders.map((folder) => {
              const coverItem = folder.items[0];
              const coverThumb =
                coverItem?.thumbnail || coverItem?.poster || coverItem?.url;
              return (
                <div
                  key={folder.id}
                  onClick={() => onSelectFolder?.(folder)}
                  className="group flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-[#00E5FF]/40 transition-all duration-200 cursor-pointer shadow-md hover:shadow-[0_4px_20px_rgba(0,229,255,0.15)]"
                >
                  <div className="relative w-16 h-12 rounded-xl overflow-hidden bg-black flex-shrink-0 border border-white/10 group-hover:scale-105 transition-transform duration-200">
                    {coverThumb && (
                      <img
                        src={getMediaUrl(coverThumb)}
                        alt={folder.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-1">
                      <Folder className="w-3 h-3 text-[#00E5FF]" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold font-sans text-zinc-100 group-hover:text-white truncate">
                      {folder.name}
                    </h4>
                    <span className="text-[10px] font-mono text-zinc-400 block mt-0.5">
                      {folder.count || folder.items.length}{' '}
                      {mediaType === 'video' ? 'Videos' : 'Photos'}
                    </span>
                  </div>

                  <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-[#00E5FF] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};

export default CyberMediaSidebar;
