import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Search, X, Video, Image as ImageIcon, Flame, Star, Sparkles } from 'lucide-react';
import type { StageMediaItem } from '../types';
import { isPhotoExtension, isVideoExtension } from '../utils/mediaTypeDetector';
import { isItemFavorite } from '../utils/favoritesManager';
import { useBackButton } from '../utils/backButtonManager';
import { hapticLight, hapticSelection } from '../utils/hapticsManager';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: StageMediaItem[];
  onOpenPhoto: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo: (item: StageMediaItem, playlist: StageMediaItem[]) => void;
  onOpenShort: (item: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => void;
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({
  isOpen,
  onClose,
  items,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
}) => {
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'clips' | 'shorts' | 'photos' | 'favorites'>('all');
  const inputRef = useRef<HTMLInputElement>(null);

  useBackButton(onClose, isOpen);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setActiveFilter('all');
    }
  }, [isOpen]);

  const filteredResults = useMemo(() => {
    if (!isOpen) return [];
    const q = query.trim().toLowerCase();

    return items.filter((item) => {
      const isShort = Boolean(
        item.mediaType === 'short' ||
        item.category?.toLowerCase().includes('short') ||
        item.category?.toLowerCase().includes('reel') ||
        item.url?.toLowerCase().includes('/shorts/') ||
        item.id?.toLowerCase().includes('shorts')
      );
      const isVid = !isShort && (item.type === 'video' || item.mediaType === 'clip' || isVideoExtension(item.url || item.id || item.path));
      const isPhoto = !isShort && !isVid && (item.type === 'image' || isPhotoExtension(item.url || item.id || item.path));
      const isFav = isItemFavorite(item);

      if (activeFilter === 'clips' && !isVid) return false;
      if (activeFilter === 'shorts' && !isShort) return false;
      if (activeFilter === 'photos' && !isPhoto) return false;
      if (activeFilter === 'favorites' && !isFav) return false;

      if (!q) return true;

      const title = (item.title || item.name || '').toLowerCase();
      const cat = (item.category || item.parentAlbum || '').toLowerCase();
      const path = (item.path || '').toLowerCase();

      return title.includes(q) || cat.includes(q) || path.includes(q);
    }).slice(0, 40);
  }, [isOpen, items, query, activeFilter]);

  if (!isOpen) return null;

  const handleSelectItem = (item: StageMediaItem) => {
    hapticLight();
    const isShort = Boolean(
      item.mediaType === 'short' ||
      item.category?.toLowerCase().includes('short') ||
      item.category?.toLowerCase().includes('reel') ||
      item.url?.toLowerCase().includes('/shorts/') ||
      item.id?.toLowerCase().includes('shorts')
    );
    const isVid = !isShort && (item.type === 'video' || item.mediaType === 'clip' || isVideoExtension(item.url || item.id || item.path));

    onClose();
    if (isShort) {
      onOpenShort(item, [item], 0);
    } else if (isVid) {
      onOpenVideo(item, [item]);
    } else {
      onOpenPhoto(item, [item], 0);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-2xl flex flex-col items-center justify-start pt-12 md:pt-20 px-4 sm:px-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#090c14]/95 border border-white/15 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10 bg-white/[0.02]">
          <Search className="w-5 h-5 text-[var(--accent-color)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search vault media, categories, titles..."
            className="w-full bg-transparent border-none outline-none text-white text-base font-['Roboto_Condensed'] font-sans tracking-wide placeholder:text-slate-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 rounded-full text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-xs uppercase tracking-wider font-mono text-slate-400 hover:text-white px-2 py-1 rounded border border-white/10 hover:border-white/30 shrink-0 ml-1"
          >
            ESC
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto no-scrollbar border-b border-white/5 bg-black/20">
          {(
            [
              { id: 'all', label: 'All Vault', icon: Sparkles },
              { id: 'clips', label: 'Clips', icon: Video },
              { id: 'shorts', label: 'Shorts', icon: Flame },
              { id: 'photos', label: 'Photos', icon: ImageIcon },
              { id: 'favorites', label: 'Favorites', icon: Star },
            ] as const
          ).map((filter) => {
            const Icon = filter.icon;
            const isActive = activeFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => {
                  hapticSelection();
                  setActiveFilter(filter.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-['Roboto_Condensed'] font-sans uppercase tracking-wider transition-all duration-150 shrink-0 cursor-pointer border ${
                  isActive
                    ? 'bg-[var(--accent-glow)] border-[var(--accent-color)] text-white shadow-[0_0_12px_var(--accent-glow)]'
                    : 'bg-white/[0.04] border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.08]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[var(--accent-color)]' : 'text-slate-400'}`} />
                <span>{filter.label}</span>
              </button>
            );
          })}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto space-scrollbar divide-y divide-white/5 p-2">
          {filteredResults.length === 0 ? (
            <div className="py-14 text-center text-slate-500 font-['Roboto_Condensed'] font-sans uppercase tracking-wider text-sm">
              No matching media found in vault
            </div>
          ) : (
            filteredResults.map((item, idx) => {
              const isShort = Boolean(
                item.mediaType === 'short' ||
                item.category?.toLowerCase().includes('short') ||
                item.category?.toLowerCase().includes('reel')
              );
              const isVid = !isShort && (item.type === 'video' || item.mediaType === 'clip' || isVideoExtension(item.url || item.id || item.path));
              const title = item.title || item.name || 'Untitled';
              const cat = item.category || item.parentAlbum || 'Catalog';
              const isFav = isItemFavorite(item);

              return (
                <button
                  key={`${item.id || item.url || idx}`}
                  type="button"
                  onClick={() => handleSelectItem(item)}
                  className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.06] transition-colors text-left group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-3">
                    <div className="w-9 h-9 rounded-lg bg-black/60 border border-white/10 flex items-center justify-center shrink-0 text-slate-400 group-hover:text-[var(--accent-color)] group-hover:border-[var(--accent-color)]/40 transition-colors">
                      {isShort ? <Flame className="w-4 h-4 text-amber-400" /> : isVid ? <Video className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex flex-col">
                      <span className="text-sm font-semibold text-white truncate group-hover:text-[var(--accent-color)] transition-colors">
                        {title}
                      </span>
                      <span className="text-[11px] text-slate-400 font-mono tracking-wider truncate uppercase">
                        {cat}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isFav && <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />}
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10">
                      {isShort ? 'SHORT' : isVid ? 'CLIP' : 'PHOTO'}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
