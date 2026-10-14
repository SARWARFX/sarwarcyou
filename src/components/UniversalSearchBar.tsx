/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Search, X, Play, Camera, Film } from 'lucide-react';
import { getDirectImageUrl } from '../utils/imageUrlResolver';
import { isVideoExtension } from '../utils/mediaTypeDetector';
import { resolveMultiFrameThumbnails } from '../utils/thumbnailResolver';
import type { AlbumData, StageMediaItem } from '../types';

interface UniversalSearchBarProps {
  albums?: AlbumData[];
  onSelectItem?: (item: StageMediaItem, albumIdx: number) => void;
  onSelectAlbum?: (albumIdx: number) => void;
  accentColor?: string;
}

interface SearchEntry {
  item: StageMediaItem;
  album: AlbumData;
  albumIndex: number;
  cleanTitle: string;
  isShort: boolean;
  isVideo: boolean;
  thumbnailUrl: string;
  companionFrames: string[];
}

type FilterType = 'all' | 'videos' | 'shorts' | 'photos';

export const UniversalSearchBar: React.FC<UniversalSearchBarProps> = ({
  albums = [],
  onSelectItem,
  onSelectAlbum,
  accentColor = '#00D2FF',
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Detect OS for shortcut hint (⌘K for Mac, Ctrl+K for others)
  const isMac = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return /mac|iphone|ipad|ipod/i.test(navigator.userAgent);
  }, []);

  // Flatten all media items from albums into an indexed catalog
  const catalog = useMemo<SearchEntry[]>(() => {
    const entries: SearchEntry[] = [];
    const seenIds = new Set<string>();

    for (let aIdx = 0; aIdx < albums.length; aIdx++) {
      const album = albums[aIdx];
      for (const item of album.items) {
        // De-duplicate items that might appear in multiple virtual albums
        const uniqueKey = item.id || item.url;
        if (seenIds.has(uniqueKey)) continue;
        seenIds.add(uniqueKey);

        const isShort = Boolean(
          album.name.toLowerCase().includes('short') ||
          album.name.toLowerCase().includes('reel') ||
          album.layoutType === 'vertical-waterfall' ||
          item.category?.toLowerCase().includes('short') ||
          item.category?.toLowerCase().includes('reel') ||
          item.url?.toLowerCase().includes('/shorts/') ||
          item.id?.toLowerCase().includes('shorts/')
        );

        const isVideo = isVideoExtension(item.url || item.id || item.title) || item.type === 'video';

        const rawTitle = item.title || '';
        const cleanTitle = rawTitle
          .replace(/\.[^/.]+$/, '')
          .replace(/[-_]+/g, ' ')
          .replace(/\b(smartselect|videocapture|screenshot)\b/gi, '')
          .trim() || (isShort ? 'Short Reel' : isVideo ? 'Cinema Clip' : 'Photograph');

        const companionFrames = resolveMultiFrameThumbnails(item);
        const thumb = companionFrames.length > 0 ? companionFrames[0] : getDirectImageUrl(item);

        entries.push({
          item,
          album,
          albumIndex: aIdx,
          cleanTitle,
          isShort,
          isVideo,
          thumbnailUrl: thumb,
          companionFrames,
        });
      }
    }

    return entries;
  }, [albums]);

  // Global Keyboard Shortcut: Cmd+K / Ctrl+K & Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(true);
        if (window.innerWidth < 640) {
          setIsMobileSearchOpen(true);
          setTimeout(() => mobileInputRef.current?.focus(), 100);
        } else {
          inputRef.current?.focus();
        }
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        setIsMobileSearchOpen(false);
        inputRef.current?.blur();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter items matching query and active category filter
  const filteredResults = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    return catalog.filter((entry) => {
      // Type filter
      if (activeFilter === 'videos' && (!entry.isVideo || entry.isShort)) return false;
      if (activeFilter === 'shorts' && !entry.isShort) return false;
      if (activeFilter === 'photos' && entry.isVideo) return false;

      // Search match: title, category, album name, or file path
      const matchTitle = entry.cleanTitle.toLowerCase().includes(trimmed);
      const matchAlbum = entry.album.name.toLowerCase().includes(trimmed);
      const matchCat = (entry.item.category || '').toLowerCase().includes(trimmed);
      const matchUrl = entry.item.url.toLowerCase().includes(trimmed);
      const matchType = (entry.isVideo ? 'video clip' : 'photo image').includes(trimmed);

      return matchTitle || matchAlbum || matchCat || matchUrl || matchType;
    });
  }, [catalog, query, activeFilter]);

  // Category counts for quick tabs
  const filterCounts = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return { all: 0, videos: 0, shorts: 0, photos: 0 };

    const matches = catalog.filter((entry) => {
      const matchTitle = entry.cleanTitle.toLowerCase().includes(trimmed);
      const matchAlbum = entry.album.name.toLowerCase().includes(trimmed);
      const matchCat = (entry.item.category || '').toLowerCase().includes(trimmed);
      const matchUrl = entry.item.url.toLowerCase().includes(trimmed);
      return matchTitle || matchAlbum || matchCat || matchUrl;
    });

    return {
      all: matches.length,
      videos: matches.filter((e) => e.isVideo && !e.isShort).length,
      shorts: matches.filter((e) => e.isShort).length,
      photos: matches.filter((e) => !e.isVideo).length,
    };
  }, [catalog, query]);

  const handleSelectResult = useCallback(
    (entry: SearchEntry) => {
      setIsOpen(false);
      setIsMobileSearchOpen(false);
      setQuery('');
      onSelectItem?.(entry.item, entry.albumIndex);
    },
    [onSelectItem]
  );

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
    mobileInputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative flex items-center">
      {/* ================= DESKTOP SEARCH BAR ================= */}
      <div className="hidden sm:flex items-center relative">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-950/80 border transition-all duration-300 backdrop-blur-xl ${
            isOpen || query
              ? 'w-72 md:w-80 border-white/25 shadow-[0_0_20px_rgba(255,255,255,0.06)]'
              : 'w-56 md:w-64 border-white/10 hover:border-white/20'
          }`}
        >
          <Search className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder="Search media, albums, reels..."
            className="w-full bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 font-mono tracking-wide focus:outline-none"
          />

          {query ? (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          ) : (
            <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-zinc-900 border border-white/10 text-[9px] font-mono text-zinc-400 select-none flex-shrink-0">
              <span>{isMac ? '⌘' : 'Ctrl'}</span>
              <span>K</span>
            </div>
          )}
        </div>
      </div>

      {/* ================= MOBILE SEARCH TRIGGER ICON ================= */}
      <div className="flex sm:hidden items-center">
        <button
          type="button"
          onClick={() => {
            setIsMobileSearchOpen(true);
            setIsOpen(true);
            setTimeout(() => mobileInputRef.current?.focus(), 150);
          }}
          className="p-2 rounded-xl bg-zinc-900/90 border border-white/10 text-zinc-300 hover:text-white transition-colors cursor-pointer"
          title="Search"
          aria-label="Open search"
        >
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* ================= MOBILE FULLSCREEN SEARCH OVERLAY ================= */}
      {isMobileSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col p-4 animate-fade-in sm:hidden">
          <div className="flex items-center gap-3 pb-3 border-b border-white/10">
            <div className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-white/15">
              <Search className="w-4 h-4 text-zinc-400 flex-shrink-0" />
              <input
                ref={mobileInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search media, albums..."
                className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 font-mono focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="p-1 rounded-full hover:bg-zinc-800 text-zinc-400"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setIsMobileSearchOpen(false);
                setIsOpen(false);
              }}
              className="p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mobile Filter Tabs */}
          {query.trim() && (
            <div className="flex items-center gap-1.5 py-3 overflow-x-auto no-scrollbar">
              {(['all', 'videos', 'shorts', 'photos'] as FilterType[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveFilter(tab)}
                  className={`px-3 py-1 rounded-full text-[10px] font-mono tracking-wider uppercase transition-colors cursor-pointer ${
                    activeFilter === tab
                      ? 'bg-white text-black font-semibold'
                      : 'bg-zinc-900 text-zinc-400 border border-white/5'
                  }`}
                >
                  {tab} ({filterCounts[tab]})
                </button>
              ))}
            </div>
          )}

          {/* Mobile Results Scrollable */}
          <div className="flex-1 overflow-y-auto py-2 space-y-2">
            {!query.trim() ? (
              <div className="flex flex-col items-center justify-center h-48 text-zinc-500 text-xs font-mono">
                Type to search across all albums and reels...
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-zinc-500 text-xs font-mono text-center">
                <p>No media found for "{query}"</p>
                <p className="text-[10px] text-zinc-600 mt-1">Try searching by title, album, or file type</p>
              </div>
            ) : (
              filteredResults.map((entry) => (
                <div
                  key={entry.item.id || entry.item.url}
                  onClick={() => handleSelectResult(entry)}
                  className="flex items-center gap-3 p-2 rounded-xl bg-zinc-950 border border-white/10 active:bg-zinc-800"
                >
                  <div className="relative w-20 aspect-video rounded-lg overflow-hidden bg-zinc-900 flex-shrink-0">
                    <img
                      src={entry.thumbnailUrl}
                      alt={entry.cleanTitle}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-zinc-200 font-medium truncate block">
                      {entry.cleanTitle}
                    </span>
                    <div className="flex items-center gap-1.5 mt-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsMobileSearchOpen(false);
                          setIsOpen(false);
                          onSelectAlbum?.(entry.albumIndex);
                        }}
                        className="px-1.5 py-0.5 rounded text-[8px] font-mono tracking-wider uppercase bg-zinc-900 border border-white/10 text-zinc-400"
                      >
                        {entry.album.name}
                      </button>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold tracking-wider uppercase ${
                          entry.isShort
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
                            : entry.isVideo
                            ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-500/30'
                            : 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/30'
                        }`}
                      >
                        {entry.isShort ? 'SHORTS' : entry.isVideo ? 'VIDEO' : 'PHOTO'}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ================= DESKTOP RESULTS DROPDOWN ================= */}
      {isOpen && query.trim() && (
        <div className="hidden sm:flex flex-col absolute top-full right-0 mt-2.5 w-[420px] md:w-[480px] max-h-[70vh] bg-zinc-950/95 border border-white/15 rounded-2xl shadow-2xl backdrop-blur-2xl z-50 overflow-hidden animate-fade-in">
          {/* Header & Filter Tabs */}
          <div className="p-3 border-b border-white/10 bg-zinc-900/50 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {(['all', 'videos', 'shorts', 'photos'] as FilterType[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveFilter(tab)}
                  className={`px-2.5 py-1 rounded-full text-[9px] font-mono tracking-wider uppercase transition-colors cursor-pointer ${
                    activeFilter === tab
                      ? 'bg-white text-black font-bold'
                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-white/5'
                  }`}
                >
                  {tab} ({filterCounts[tab]})
                </button>
              ))}
            </div>
            <span className="text-[10px] font-mono text-zinc-500">
              {filteredResults.length} {filteredResults.length === 1 ? 'match' : 'matches'}
            </span>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-[50vh] no-scrollbar">
            {filteredResults.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-xs font-mono text-zinc-400">No media found matching "{query}"</p>
                <p className="text-[10px] font-mono text-zinc-600 mt-1">
                  Try checking for typos or searching by another category
                </p>
              </div>
            ) : (
              filteredResults.map((entry, idx) => {
                const isHovered = hoveredIdx === idx;
                const activeThumb =
                  isHovered && entry.companionFrames.length > 0
                    ? entry.companionFrames[1] || entry.thumbnailUrl
                    : entry.thumbnailUrl;

                return (
                  <div
                    key={entry.item.id || `${entry.item.url}-${idx}`}
                    onClick={() => handleSelectResult(entry)}
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-zinc-900/90 border border-transparent hover:border-white/10 transition-all duration-150 cursor-pointer group"
                  >
                    {/* Thumbnail */}
                    <div className="relative w-24 aspect-video rounded-lg overflow-hidden bg-zinc-900 flex-shrink-0 border border-white/5">
                      <img
                        src={activeThumb}
                        alt={entry.cleanTitle}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      {entry.isVideo && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Play className="w-3.5 h-3.5 text-white fill-current" />
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="flex-1 min-w-0">
                      <span className="text-xs text-zinc-100 font-medium truncate block group-hover:text-cyan-300 transition-colors">
                        {entry.cleanTitle}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsOpen(false);
                            onSelectAlbum?.(entry.albumIndex);
                          }}
                          className="px-1.5 py-0.5 rounded text-[8px] font-mono tracking-widest uppercase bg-zinc-900 hover:bg-zinc-800 border border-white/10 hover:border-white/20 text-zinc-400 hover:text-zinc-200 cursor-pointer transition-colors"
                          title={`Navigate to ${entry.album.name}`}
                        >
                          {entry.album.name}
                        </button>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold tracking-widest uppercase flex items-center gap-1 ${
                            entry.isShort
                              ? 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                              : entry.isVideo
                              ? 'bg-indigo-950/60 text-indigo-300 border border-indigo-500/30'
                              : 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30'
                          }`}
                        >
                          {entry.isShort ? (
                            <>
                              <Film className="w-2.5 h-2.5" /> SHORTS
                            </>
                          ) : entry.isVideo ? (
                            <>
                              <Play className="w-2.5 h-2.5" /> VIDEO
                            </>
                          ) : (
                            <>
                              <Camera className="w-2.5 h-2.5" /> PHOTO
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer note */}
          <div className="p-2 border-t border-white/5 bg-black/60 flex items-center justify-between text-[9px] font-mono text-zinc-600 px-3">
            <span>Press Esc to close</span>
            <span style={{ color: accentColor }}>Instant Repository Search</span>
          </div>
        </div>
      )}
    </div>
  );
};
