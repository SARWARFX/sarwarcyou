import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  onOpenShort: (item: StageMediaItem, shorts: StageMediaItem[], index: number) => void;
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

  // Global keydown listeners for Palette navigation & dismissal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems.length > 0 && filteredItems[selectedIndex]) {
          handleSelectItem(filteredItems[selectedIndex]);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex]);

  // Keep highlighted item in view
  useEffect(() => {
    if (!resultsContainerRef.current) return;
    const selectedEl = resultsContainerRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (selectedEl) {
      selectedEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

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

  const handleSelectItem = (item: StageMediaItem) => {
    onClose();

    if (item.mediaType === 'short') {
      // Find short index in shorts list
      const idx = allShorts.findIndex((s) => s.id === item.id || s.url === item.url);
      const targetIndex = idx >= 0 ? idx : 0;
      onOpenShort(item, allShorts.length > 0 ? allShorts : [item], targetIndex);
    } else if (item.type === 'video') {
      onOpenVideo(item, [item]);
    } else {
      onOpenPhoto(item, [item], 0);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      className="fixed inset-0 z-[100] flex items-start justify-center pt-14 sm:pt-20 md:pt-24 px-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Centered Glass Command Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col transition-all border animate-in zoom-in-95 duration-200"
        style={{
          background: 'rgba(4, 6, 12, 0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(0, 240, 255, 0.3)',
          boxShadow: '0 0 35px rgba(0, 240, 255, 0.18), 0 20px 40px rgba(0,0,0,0.8)',
        }}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/10 bg-white/[0.02]">
          <Search className="w-5 h-5 text-[#00f0ff] flex-shrink-0 animate-pulse" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search clips, shorts, photographs, or albums..."
            className="flex-1 bg-transparent text-white placeholder-white/40 font-mono text-sm sm:text-base outline-none tracking-wide"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-white/40 hover:text-white transition-colors p-1"
              title="Clear"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/[0.08] text-white/50 border border-white/10 font-mono text-[10px]">
            ESC
          </kbd>
        </div>

        {/* Filter Badges & Quick Stats */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06] bg-black/30 text-xs font-mono">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(['ALL', 'SHORTS', 'VIDEOS', 'PHOTOS'] as MediaFilter[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold tracking-wider transition-all cursor-pointer ${
                  filter === tab
                    ? 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/40 shadow-[0_0_10px_rgba(0,240,255,0.25)]'
                    : 'text-white/50 hover:text-white hover:bg-white/[0.05] border border-transparent'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <span className="text-white/40 text-[11px] flex-shrink-0">
            {filteredItems.length} {filteredItems.length === 1 ? 'match' : 'matches'}
          </span>
        </div>

        {/* Search Result List */}
        <div
          ref={resultsContainerRef}
          className="max-h-[60vh] sm:max-h-[380px] overflow-y-auto space-scrollbar divide-y divide-white/[0.04]"
        >
          {filteredItems.length > 0 ? (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const isShort = item.mediaType === 'short';
              const isVideo = item.type === 'video' && !isShort;
              const isPhoto = item.type === 'image';

              const cleanTitle = sanitizeMediaTitle(item.title || item.name, item.category);
              const folderLabel = item.parentAlbum || item.category || 'Vault';
              const thumbnailSrc = isPhoto ? getMediaUrl(item.url) : resolveStaticVideoThumbnail(item);

              return (
                <div
                  key={item.id || idx}
                  onClick={() => handleSelectItem(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center gap-3.5 px-4 py-2.5 cursor-pointer transition-colors text-left ${
                    isSelected
                      ? 'bg-[#00f0ff]/15 border-l-2 border-[#00f0ff] shadow-[inset_0_0_15px_rgba(0,240,255,0.12)]'
                      : 'hover:bg-white/[0.04] border-l-2 border-transparent'
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
                      className={`text-sm font-mono truncate leading-snug transition-colors ${
                        isSelected ? 'text-[#00f0ff] font-semibold' : 'text-white/90'
                      }`}
                      style={{ textShadow: '0 1px 4px #000, 0 0 8px #000' }}
                    >
                      {cleanTitle}
                    </span>
                    <span className="text-xs font-mono text-white/40 truncate">
                      {folderLabel}
                    </span>
                  </div>

                  {/* Type Badge */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase border ${
                        isShort
                          ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                          : isVideo
                          ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                          : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      }`}
                    >
                      {isShort ? 'SHORT' : isVideo ? 'VIDEO' : 'PHOTO'}
                    </span>

                    {/* Enter indicator on selected */}
                    {isSelected && (
                      <CornerDownLeft className="w-4 h-4 text-[#00f0ff] animate-pulse hidden sm:inline" />
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-white/40 font-mono text-xs sm:text-sm flex flex-col items-center gap-2">
              <Sparkles className="w-5 h-5 text-white/20" />
              <span>No matching media items found in catalog.</span>
            </div>
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/[0.06] bg-black/40 text-[11px] font-mono text-white/40">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 bg-white/10 rounded text-[9px]"><ArrowUp className="w-2.5 h-2.5 inline" /></kbd>
              <kbd className="px-1 py-0.2 bg-white/10 rounded text-[9px]"><ArrowDown className="w-2.5 h-2.5 inline" /></kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 bg-white/10 rounded text-[9px]">↵</kbd> Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.2 bg-white/10 rounded text-[9px]">ESC</kbd> Close
            </span>
          </div>
          <span className="text-[#00f0ff]/60 hidden sm:inline">SARWARCYOU // STREAM VAULT</span>
        </div>
      </div>
    </div>
  );
};
