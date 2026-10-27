import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ArrowLeft, Play, Image as ImageIcon, Film, Smartphone, Sparkles, Share2, Check, ArrowUpDown } from 'lucide-react';
import type { StageMediaItem, SortOrder } from '../types';
import { CyberCard } from './CyberCard';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';
import { getMediaUrl } from '../utils/imageUrlResolver';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';
import { isVideoExtension } from '../utils/mediaTypeDetector';
import { sortMediaItems } from '../utils/albumExtractor';
import { createShareableAlbumUrl, copyToClipboard } from '../utils/urlRouter';

export type FullAlbumSubFilter = 'all' | 'photos' | 'clips' | 'shorts';

export interface FullAlbumViewModalProps {
  isOpen: boolean;
  title: string;
  subtitle?: string;
  items: StageMediaItem[];
  variant?: 'standard' | 'shorts' | 'photo';
  hasMultipleTypes?: boolean;
  typeCounts?: {
    photos: number;
    clips: number;
    shorts: number;
  };
  onClose: () => void;
  onSelectItem: (item: StageMediaItem, currentList: StageMediaItem[]) => void;
}

/**
 * Natural Aspect Ratio Masonry Image Card
 * Renders native dimensions (landscape remains landscape, portrait remains portrait)
 * with zero forced cropping and dense CSS-column packing.
 */
const MasonryImageCard: React.FC<{
  item: StageMediaItem;
  onClick: () => void;
}> = ({ item, onClick }) => {
  const [loaded, setLoaded] = useState(false);
  const cleanTitle = useMemo(
    () => sanitizeMediaTitle(item.title || item.name, item.category),
    [item.title, item.name, item.category]
  );
  const isVideo =
    item.type === 'video' ||
    item.mediaType === 'clip' ||
    item.mediaType === 'short' ||
    isVideoExtension(item.url || item.id || item.path);
  const cleanMediaUrl = getMediaUrl(item.url || item.path || item.id);

  const posterImage = useMemo(() => {
    if (!isVideo) return cleanMediaUrl;
    if (item.poster && !isVideoExtension(item.poster)) return getMediaUrl(item.poster);
    if (item.posterUrl && !isVideoExtension(item.posterUrl)) return getMediaUrl(item.posterUrl);
    if (item.thumbnail && !isVideoExtension(item.thumbnail)) return getMediaUrl(item.thumbnail);
    return null;
  }, [isVideo, cleanMediaUrl, item.poster, item.posterUrl, item.thumbnail]);

  return (
    <div
      onClick={onClick}
      className="break-inside-avoid mb-3 relative group rounded-xl overflow-hidden bg-[#0c0d12] border border-white/10 hover:border-[#00E5FF]/60 transition-all duration-200 shadow-sm cursor-pointer select-none"
      style={{ contain: 'paint', transform: 'translateZ(0)' }}
    >
      {isVideo ? (
        <div className="w-full aspect-video bg-gradient-to-br from-[#13141c] via-[#0b0c10] to-[#050608] flex flex-col items-center justify-center p-4 relative overflow-hidden">
          {posterImage && (
            <img
              src={posterImage}
              alt={cleanTitle}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          )}
          <div className="relative z-10 w-11 h-11 rounded-full bg-white/15 group-hover:bg-[#00E5FF]/25 border border-white/20 group-hover:border-[#00E5FF]/60 flex items-center justify-center text-white group-hover:text-[#00E5FF] transition-all duration-200 shadow-md group-hover:scale-110">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
          <span className="relative z-10 text-[10px] font-mono text-zinc-300 mt-2 font-semibold tracking-wider uppercase">
            Stream Video
          </span>
        </div>
      ) : (
        <>
          {!loaded && (
            <div className="w-full aspect-[4/3] bg-zinc-900 animate-pulse rounded-xl" />
          )}
          <img
            src={cleanMediaUrl}
            alt={cleanTitle}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={`w-full h-auto block object-contain transition-all duration-300 group-hover:scale-[1.02] ${
              loaded ? 'opacity-100' : 'opacity-0 absolute inset-0'
            }`}
          />
        </>
      )}
      {/* Sleek Gradient Overlay on Hover */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3 pointer-events-none">
        <span className="text-xs font-bold font-sans text-white line-clamp-1 drop-shadow">
          {cleanTitle}
        </span>
        <div className="flex items-center gap-1.5 mt-1 text-[10px] font-mono text-zinc-300">
          <span className="text-[#00E5FF] font-semibold tracking-wider">{isVideo ? 'STREAM VIDEO' : 'VIEW PHOTO'}</span>
        </div>
      </div>
    </div>
  );
};

export const FullAlbumViewModal: React.FC<FullAlbumViewModalProps> = ({
  isOpen,
  title,
  subtitle,
  items,
  variant = 'standard',
  hasMultipleTypes,
  typeCounts,
  onClose,
  onSelectItem,
}) => {
  useLockBodyScroll(isOpen);
  const [subFilter, setSubFilter] = useState<FullAlbumSubFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleShareAlbum = useCallback(async () => {
    const url = createShareableAlbumUrl(title);
    const success = await copyToClipboard(url);
    if (success) {
      setCopied(true);
      setToastMessage('Album link copied to clipboard!');
      setTimeout(() => setCopied(false), 2200);
      setTimeout(() => setToastMessage(null), 2500);
    }
  }, [title]);

  // Reset subfilter & sort when opening a new album
  useEffect(() => {
    if (isOpen) {
      setSubFilter('all');
      setSortOrder('newest');
      setCopied(false);
      setToastMessage(null);
    }
  }, [isOpen, title]);

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 1. Sort items by active sort order (Newest First by default)
  const sortedItems = useMemo(() => {
    return sortMediaItems(items, sortOrder);
  }, [items, sortOrder]);

  // Compute breakdown counts
  const counts = useMemo(() => {
    if (typeCounts) return typeCounts;
    let photos = 0;
    let clips = 0;
    let shorts = 0;
    for (const it of sortedItems) {
      if (it.mediaType === 'short') shorts++;
      else if (it.mediaType === 'clip' || it.type === 'video') clips++;
      else photos++;
    }
    return { photos, clips, shorts };
  }, [sortedItems, typeCounts]);

  const showFilters =
    hasMultipleTypes ??
    ((counts.photos > 0 && counts.clips > 0) ||
      (counts.photos > 0 && counts.shorts > 0) ||
      (counts.clips > 0 && counts.shorts > 0));

  // Filtered items based on active subfilter tab (from sortedItems)
  const filteredItems = useMemo(() => {
    if (!showFilters || subFilter === 'all') return sortedItems;
    return sortedItems.filter((it) => {
      const isShort = it.mediaType === 'short';
      const isClip = !isShort && (it.mediaType === 'clip' || it.type === 'video');
      const isPhoto = !isShort && !isClip;

      if (subFilter === 'photos') return isPhoto;
      if (subFilter === 'clips') return isClip;
      if (subFilter === 'shorts') return isShort;
      return true;
    });
  }, [sortedItems, showFilters, subFilter]);

  if (!isOpen) return null;

  // Determine current active display mode
  const isImageMode =
    variant === 'photo' ||
    subFilter === 'photos' ||
    (!showFilters && sortedItems.length > 0 && sortedItems.every((it) => it.type === 'image' || it.mediaType === 'photo'));

  const isShortsMode =
    variant === 'shorts' ||
    subFilter === 'shorts' ||
    (!showFilters && sortedItems.length > 0 && sortedItems.every((it) => it.mediaType === 'short'));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} Full Album View`}
      className="fixed inset-0 z-50 bg-[#030305]/98 text-white flex flex-col overflow-hidden animate-fade-in"
    >
      {/* 1. Header Bar */}
      <header className="sticky top-0 z-40 bg-[#030305]/95 backdrop-blur-2xl border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Left: Back button & Title (Sole navigation button on screen) */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white border border-white/15 transition-all duration-200 cursor-pointer text-xs font-mono font-medium hover:scale-105 active:scale-95 flex-shrink-0"
            title="Back to Vault (Esc)"
          >
            <ArrowLeft className="w-4 h-4 text-[#00E5FF]" />
            <span className="hidden xs:inline">Back</span>
          </button>

          <div className="flex items-center gap-2.5 min-w-0">
            <h1 className="text-base sm:text-xl font-bold font-sans tracking-wide text-white uppercase truncate">
              {title}
            </h1>
            <span className="text-[10px] sm:text-xs font-mono font-semibold px-2 py-0.5 rounded-full bg-[#00E5FF]/10 text-[#00E5FF] border border-[#00E5FF]/25 whitespace-nowrap flex-shrink-0">
              {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'items'}
            </span>
            {subtitle && (
              <span className="text-xs font-mono text-zinc-400 hidden md:inline truncate">
                — {subtitle}
              </span>
            )}
          </div>
        </div>

        {/* Right: Sub-filter tabs & Subtle Share button (No redundant X close button) */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-shrink-0">
          {showFilters && (
            <div className="hidden sm:flex items-center gap-1 bg-white/[0.05] p-1 rounded-full border border-white/10">
              <button
                type="button"
                onClick={() => setSubFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition-all cursor-pointer ${
                  subFilter === 'all'
                    ? 'bg-[#00E5FF] text-black font-bold shadow-[0_0_12px_rgba(0,229,255,0.4)]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                All ({sortedItems.length})
              </button>
              {counts.photos > 0 && (
                <button
                  type="button"
                  onClick={() => setSubFilter('photos')}
                  className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    subFilter === 'photos'
                      ? 'bg-cyan-400 text-black font-bold shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Photos ({counts.photos})</span>
                </button>
              )}
              {counts.clips > 0 && (
                <button
                  type="button"
                  onClick={() => setSubFilter('clips')}
                  className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    subFilter === 'clips'
                      ? 'bg-amber-400 text-black font-bold shadow-[0_0_12px_rgba(251,191,36,0.4)]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>Clips ({counts.clips})</span>
                </button>
              )}
              {counts.shorts > 0 && (
                <button
                  type="button"
                  onClick={() => setSubFilter('shorts')}
                  className={`px-3 py-1 rounded-full text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-1 ${
                    subFilter === 'shorts'
                      ? 'bg-fuchsia-400 text-black font-bold shadow-[0_0_12px_rgba(232,121,249,0.4)]'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Shorts ({counts.shorts})</span>
                </button>
              )}
            </div>
          )}

          {/* Sort Dropdown Control */}
          <div className="flex items-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.08] px-2.5 py-1 rounded-full border border-white/10 transition-colors text-xs font-mono">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#00E5FF] flex-shrink-0" />
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="bg-transparent text-zinc-300 hover:text-white font-medium text-[11px] focus:outline-none cursor-pointer pr-1"
              aria-label="Sort album media"
            >
              <option value="newest" className="bg-[#0b0c10] text-white">Newest First</option>
              <option value="oldest" className="bg-[#0b0c10] text-white">Oldest First</option>
              <option value="name-asc" className="bg-[#0b0c10] text-white">Name (A–Z)</option>
            </select>
          </div>

          {/* Subtle Share / Copy Link Button */}
          <button
            type="button"
            onClick={handleShareAlbum}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all cursor-pointer text-xs font-mono font-medium hover:scale-105 active:scale-95 ${
              copied
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                : 'bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white border-white/15'
            }`}
            title="Share / Copy Link to this Album"
            aria-label="Share album direct link"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>COPIED</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span className="hidden xs:inline">SHARE</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Mobile Sub-filter Pills Bar (shown only on small screens if multi-type) */}
      {showFilters && (
        <div className="sm:hidden px-4 py-2 bg-[#0c0c12]/95 border-b border-white/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setSubFilter('all')}
            className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono whitespace-nowrap cursor-pointer ${
              subFilter === 'all'
                ? 'bg-[#00E5FF] text-black font-bold'
                : 'bg-white/5 text-zinc-400'
            }`}
          >
            All ({items.length})
          </button>
          {counts.photos > 0 && (
            <button
              type="button"
              onClick={() => setSubFilter('photos')}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                subFilter === 'photos'
                  ? 'bg-cyan-400 text-black font-bold'
                  : 'bg-white/5 text-zinc-400'
              }`}
            >
              Photos ({counts.photos})
            </button>
          )}
          {counts.clips > 0 && (
            <button
              type="button"
              onClick={() => setSubFilter('clips')}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                subFilter === 'clips'
                  ? 'bg-amber-400 text-black font-bold'
                  : 'bg-white/5 text-zinc-400'
              }`}
            >
              Clips ({counts.clips})
            </button>
          )}
          {counts.shorts > 0 && (
            <button
              type="button"
              onClick={() => setSubFilter('shorts')}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                subFilter === 'shorts'
                  ? 'bg-fuchsia-400 text-black font-bold'
                  : 'bg-white/5 text-zinc-400'
              }`}
            >
              Shorts ({counts.shorts})
            </button>
          )}
        </div>
      )}

      {/* 2. Scrollable Album Content Grid */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 max-w-7xl mx-auto w-full touch-scroll-container" style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain" }}>
        {filteredItems.length === 0 ? (
          <div className="w-full py-32 flex flex-col items-center justify-center gap-3 text-center">
            <Sparkles className="w-10 h-10 text-zinc-600" />
            <p className="text-zinc-400 text-sm font-sans">No items found in this section.</p>
          </div>
        ) : isImageMode ? (
          /* Natural Aspect Ratio Masonry Grid (CSS Columns: 2 to 5 cols) */
          <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-3 space-y-3 pb-24">
            {filteredItems.map((item, idx) => (
              <MasonryImageCard
                key={item.id || idx}
                item={item}
                onClick={() => onSelectItem(item, filteredItems)}
              />
            ))}
          </div>
        ) : isShortsMode ? (
          /* Dedicated 9:16 Vertical Grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 pb-24">
            {filteredItems.map((item, idx) => (
              <CyberCard
                key={item.id || idx}
                item={item}
                variant="shorts"
                onClick={(it) => onSelectItem(it, filteredItems)}
              />
            ))}
          </div>
        ) : (
          /* Standard Video Grid (16:9 Widescreen Cards) */
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-24">
            {filteredItems.map((item, idx) => (
              <CyberCard
                key={item.id || idx}
                item={item}
                variant="standard"
                onClick={(it) => onSelectItem(it, filteredItems)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Floating Success Toast */}
      {toastMessage && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2 px-5 py-2.5 rounded-full bg-black/90 backdrop-blur-2xl border border-white/20 text-white text-xs font-mono shadow-[0_12px_40px_rgba(0,0,0,0.85),0_0_20px_rgba(0,229,255,0.2)] animate-fade-in pointer-events-none">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};

export default FullAlbumViewModal;
