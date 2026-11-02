import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, X, Play, Film, Camera, Sparkles, CornerDownLeft, ArrowDown, ArrowUp } from 'lucide-react';
import type { StageMediaItem } from '../types';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';
import { resolveStaticVideoThumbnail } from '../utils/thumbnailResolver';
import { getMediaUrl } from '../utils/imageUrlResolver';

export interface CyberCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: StageMediaItem[];
  allShorts: StageMediaItem[];
  onOpenPhoto: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo: (item: StageMediaItem, playlist: StageMediaItem[]) => void;
  onOpenShort: (item: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => void;
}

type MediaFilter = 'ALL' | 'SHORTS' | 'VIDEOS' | 'PHOTOS';

export const CyberCommandPalette: React.FC<CyberCommandPaletteProps> = ({
  isOpen,
  onClose,
  items,
  allShorts,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<MediaFilter>('ALL');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when opened & reset search
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setFilter('ALL');
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Fast in-memory fuzzy search & filtering
  const filteredItems = useMemo(() => {
    if (!items || items.length === 0) return [];

    const q = query.trim().toLowerCase();
    const tokens = q.split(/\s+/).filter(Boolean);

    return items
      .filter((item) => {
        // Filter by tab
        const isShort = item.mediaType === 'short';
        const isVideo = item.type === 'video' && !isShort;
        const isPhoto = item.type === 'image';

        if (filter === 'SHORTS' && !isShort) return false;
        if (filter === 'VIDEOS' && !isVideo) return false;
        if (filter === 'PHOTOS' && !isPhoto) return false;

        // Filter by query tokens
        if (tokens.length === 0) return true;

        const targetString = `${item.title || ''} ${item.name || ''} ${item.parentAlbum || ''} ${item.category || ''} ${item.path || ''}`.toLowerCase();
        return tokens.every((token) => targetString.includes(token));
      })
      .slice(0, 40); // Cap to 40 results for ultra-responsive rendering
  }, [items, query, filter]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, filter]);

  const handleSelectItem = useCallback((item: StageMediaItem) => {
    onClose();

    if (item.mediaType === 'short') {
      // Find short index in shorts list
      const idx = allShorts.findIndex((s) => s.id === item.id || s.url === item.url);
      const targetIndex = idx >= 0 ? idx : 0;
      onOpenShort(item, allShorts.length > 0 ? allShorts : [item], targetIndex, item.category || item.parentAlbum);
    } else if (item.type === 'video') {
      onOpenVideo(item, [item]);
    } else {
      onOpenPhoto(item, [item], 0);
    }
  }, [allShorts, onClose, onOpenPhoto, onOpenShort, onOpenVideo]);

  // Synchronous refs to prevent stale closure reads in keydown listeners
  const filteredItemsRef = useRef(filteredItems);
  filteredItemsRef.current = filteredItems;
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;
  const handleSelectItemRef = useRef(handleSelectItem);
  handleSelectItemRef.current = handleSelectItem;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Global keydown listeners for Palette navigation & dismissal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }

      const currentFiltered = filteredItemsRef.current;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (currentFiltered.length > 0 ? (prev + 1) % currentFiltered.length : 0));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (currentFiltered.length > 0 ? (prev - 1 + currentFiltered.length) % currentFiltered.length : 0));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const curIdx = selectedIndexRef.current;
        if (currentFiltered.length > 0 && currentFiltered[curIdx]) {
          handleSelectItemRef.current(currentFiltered[curIdx]);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Keep highlighted item in view
  useEffect(() => {
    if (!resultsContainerRef.current) return;
    const selectedEl = resultsContainerRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-[100] flex items-start justify-center pt-14 sm:pt-20 md:pt-24 px-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Centered Command Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-lg overflow-hidden shadow-2xl flex flex-col transition-all border border-neutral-800 animate-in zoom-in-95 duration-200"
        style={{
          background: 'rgba(12, 14, 18, 0.95)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
        }}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-800 bg-white/[0.02]">
          <Search className="w-5 h-5 text-neutral-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search clips, shorts, photographs, or archives..."
            className="flex-1 bg-transparent text-white placeholder-neutral-500 font-serif text-sm sm:text-base outline-none tracking-normal"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-neutral-400 hover:text-white transition-colors p-1"
              title="Clear"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700 font-serif text-[10px]">
            ESC
          </kbd>
        </div>

        {/* Filter Badges & Quick Stats */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800/80 bg-black/40 text-xs font-serif">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(['ALL', 'SHORTS', 'VIDEOS', 'PHOTOS'] as MediaFilter[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-1 rounded text-[11px] font-normal tracking-wider transition-all cursor-pointer ${
                  filter === tab
                    ? 'bg-neutral-800 text-white border border-neutral-600'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900 border border-transparent'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <span className="text-neutral-500 text-[11px] flex-shrink-0">
            {filteredItems.length} {filteredItems.length === 1 ? 'match' : 'matches'}
          </span>
        </div>

        {/* Search Result List */}
        <div
          ref={resultsContainerRef}
          className="max-h-[60vh] sm:max-h-[380px] overflow-y-auto space-scrollbar divide-y divide-neutral-850"
        >
          {filteredItems.length > 0 ? (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const isShort = item.mediaType === 'short';
              const isVideo = item.type === 'video' && !isShort;
              const isPhoto = item.type === 'image';

              const cleanTitle = sanitizeMediaTitle(item.title || item.name, item.category);
              const folderLabel = item.parentAlbum || item.category || 'Archive';
              const thumbnailSrc = isPhoto ? getMediaUrl(item.url) : resolveStaticVideoThumbnail(item);

              return (
                <div
                  key={item.id || idx}
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center gap-3.5 px-4 py-2.5 cursor-pointer transition-colors text-left ${
                    isSelected
                      ? 'bg-neutral-800/80 border-l-2 border-white'
                      : 'hover:bg-neutral-900/60 border-l-2 border-transparent'
                  }`}
                >
                  {/* Thumbnail / Poster */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/[0.04] border border-white/10 flex-shrink-0 flex items-center justify-center relative">
                    {thumbnailSrc ? (
                      <img
                        src={thumbnailSrc}
                        alt={cleanTitle}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-white/30">
                        {isShort ? <Play className="w-4 h-4 ml-0.5" /> : isVideo ? <Film className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                      </div>
                    )}
                  </div>

                  {/* Title & Folder Path */}
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span
                      className={`text-sm font-serif truncate leading-snug transition-colors ${
                        isSelected ? 'text-white font-semibold' : 'text-neutral-200'
                      }`}
                    >
                      {cleanTitle}
                    </span>
                    <span className="text-xs font-serif text-neutral-400 truncate">
                      {folderLabel}
                    </span>
                  </div>

                  {/* Type Badge */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-serif font-normal tracking-wider uppercase border bg-neutral-800 text-neutral-300 border-neutral-700"
                    >
                      {isShort ? 'SHORT' : isVideo ? 'VIDEO' : 'PHOTO'}
                    </span>

                    {/* Enter indicator on selected */}
                    {isSelected && (
                      <CornerDownLeft className="w-4 h-4 text-white hidden sm:inline" />
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-neutral-400 font-serif text-xs sm:text-sm flex flex-col items-center gap-2">
              <Sparkles className="w-5 h-5 text-neutral-500" />
              <span>No matching media items found in catalog.</span>
            </div>
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-neutral-800 bg-black/50 text-[11px] font-serif text-neutral-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 bg-neutral-800 rounded text-[9px]"><ArrowUp className="w-2.5 h-2.5 inline" /></kbd>
              <kbd className="px-1 py-0.2 bg-neutral-800 rounded text-[9px]"><ArrowDown className="w-2.5 h-2.5 inline" /></kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 bg-neutral-800 rounded text-[9px]">↵</kbd> Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 bg-neutral-800 rounded text-[9px]">ESC</kbd> Close
            </span>
          </div>
          <span className="text-neutral-400 hidden sm:inline uppercase tracking-widest text-[10px]">SARWARCYOU ARCHIVE</span>
        </div>
      </div>
    </div>
  );
};
