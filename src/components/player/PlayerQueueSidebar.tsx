import React from 'react';
import { ListMusic, Play, Check } from 'lucide-react';
import type { MediaItem } from '../../models/media';
import { ThumbnailPlaceholder } from '../cards/ThumbnailPlaceholder';

export interface PlayerQueueSidebarProps {
  queue: MediaItem[];
  currentItemId: string;
  albumTitle?: string;
  onSelectItem: (item: MediaItem) => void;
  className?: string;
}

export const PlayerQueueSidebar: React.FC<PlayerQueueSidebarProps> = ({
  queue,
  currentItemId,
  albumTitle,
  onSelectItem,
  className = '',
}) => {
  return (
    <aside
      className={`w-full lg:w-96 flex flex-col bg-[#0a0b10] border border-white/10 rounded-2xl overflow-hidden shadow-2xl ${className}`}
    >
      {/* Sidebar Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <ListMusic className="w-5 h-5 text-[#00E5FF]" />
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-sans">
              Up Next
            </h2>
            {albumTitle && (
              <p className="text-xs text-zinc-400 font-mono truncate max-w-[200px]">
                {albumTitle}
              </p>
            )}
          </div>
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">
          {queue.length} videos
        </span>
      </div>

      {/* Queue Item List */}
      <div className="flex-1 overflow-y-auto max-h-[600px] divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10 p-2 space-y-1">
        {queue.map((item, idx) => {
          const isActive = item.id === currentItemId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectItem(item)}
              className={`w-full group p-2.5 rounded-xl flex items-center gap-3 text-left transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-[#00E5FF]/15 border border-[#00E5FF]/40 shadow-[0_0_15px_rgba(0,229,255,0.1)]'
                  : 'hover:bg-white/[0.06] border border-transparent'
              }`}
            >
              {/* Queue Index / Playing Status */}
              <div className="w-6 text-center font-mono text-xs flex-shrink-0">
                {isActive ? (
                  <Play className="w-3.5 h-3.5 fill-[#00E5FF] text-[#00E5FF] mx-auto animate-pulse" />
                ) : (
                  <span className="text-zinc-500 group-hover:text-zinc-300">{idx + 1}</span>
                )}
              </div>

              {/* Thumbnail Container */}
              <div className="relative w-24 aspect-video rounded-lg overflow-hidden bg-black/50 flex-shrink-0 border border-white/10">
                <ThumbnailPlaceholder variant={item.variant} title={item.title} />
                {item.thumbnailUrl && (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.title}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                {isActive && (
                  <div className="absolute inset-0 bg-[#00E5FF]/20 flex items-center justify-center">
                    <div className="w-6 h-6 rounded-full bg-black/80 flex items-center justify-center">
                      <Play className="w-3 h-3 fill-[#00E5FF] text-[#00E5FF]" />
                    </div>
                  </div>
                )}
              </div>

              {/* Title & Metadata */}
              <div className="flex-1 min-w-0 pr-1">
                <h4
                  className={`text-xs font-semibold line-clamp-2 leading-snug transition-colors ${
                    isActive ? 'text-[#00E5FF]' : 'text-zinc-200 group-hover:text-white'
                  }`}
                >
                  {item.title}
                </h4>
                <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-zinc-500">
                  <span className="uppercase">{item.variant}</span>
                  {isActive && (
                    <span className="text-[#00E5FF] font-bold flex items-center gap-0.5">
                      <Check className="w-3 h-3" /> NOW PLAYING
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
};
