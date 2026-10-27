import React, { useState, useMemo } from 'react';
import {
  Folder,
  Film,
  Camera,
  Smartphone,
  Layers,
  ArrowUpDown,
  Search,
  Check,
} from 'lucide-react';
import type { Album, MediaItem, SortOrder } from '../../models/media';
import { MediaCard } from '../cards/MediaCard';

export interface AlbumViewProps {
  album: Album;
  onSelectMedia: (item: MediaItem) => void;
}

type FilterTab = 'all' | 'clips' | 'shorts' | 'photos';

export const AlbumView: React.FC<AlbumViewProps> = ({ album, onSelectMedia }) => {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [localSearch, setLocalSearch] = useState('');
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Filter items
  const filteredItems = useMemo(() => {
    let result = [...album.items];

    // Filter by tab
    if (activeTab === 'clips') {
      result = result.filter((i) => i.type === 'video' && i.variant === 'standard');
    } else if (activeTab === 'shorts') {
      result = result.filter((i) => i.type === 'video' && i.variant === 'short');
    } else if (activeTab === 'photos') {
      result = result.filter((i) => i.type === 'image');
    }

    // Filter by search
    if (localSearch.trim()) {
      const q = localSearch.trim().toLowerCase();
      result = result.filter((i) => i.title.toLowerCase().includes(q));
    }

    // Sort
    result.sort((a, b) => {
      if (sortOrder === 'newest') return b.date - a.date;
      if (sortOrder === 'oldest') return a.date - b.date;
      return a.title.localeCompare(b.title);
    });

    return result;
  }, [album.items, activeTab, localSearch, sortOrder]);

  const hasPhotos = album.typeCounts.photos > 0;
  const hasClips = album.typeCounts.clips > 0;
  const hasShorts = album.typeCounts.shorts > 0;
  const hasMultipleTypes = [hasPhotos, hasClips, hasShorts].filter(Boolean).length > 1;

  // Layout grid columns based on dominant tab/variant
  const gridClasses = useMemo(() => {
    if (activeTab === 'shorts' || (activeTab === 'all' && album.variant === 'short')) {
      return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6';
    }
    if (activeTab === 'photos' || (activeTab === 'all' && album.variant === 'photo')) {
      return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6';
    }
    return 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6';
  }, [activeTab, album.variant]);

  return (
    <div className="space-y-8 pb-16">
      {/* Album Header Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#0e1017] via-[#090a0f] to-black border border-white/10 p-6 sm:p-10 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E5FF]/15 border border-[#00E5FF]/30 text-[#00E5FF] text-xs font-mono font-bold uppercase tracking-wider">
              <Folder className="w-3.5 h-3.5" />
              <span>Album Directory</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black font-sans text-white uppercase tracking-tight">
              {album.title}
            </h1>

            <p className="text-xs sm:text-sm font-mono text-zinc-400">
              Path: <span className="text-zinc-200">{album.folderPath}</span>
            </p>

            {/* Type Count Badges */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="px-3 py-1 rounded-full bg-white/10 text-white text-xs font-mono font-medium">
                Total: {album.itemCount}
              </span>
              {hasClips && (
                <span className="px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-mono flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5" /> {album.typeCounts.clips} Clips
                </span>
              )}
              {hasShorts && (
                <span className="px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" /> {album.typeCounts.shorts} Shorts
                </span>
              )}
              {hasPhotos && (
                <span className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5" /> {album.typeCounts.photos} Photos
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Sort Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        {/* Sub-Filters */}
        {hasMultipleTypes ? (
          <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10 w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#00E5FF] text-black shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              All ({album.itemCount})
            </button>
            {hasClips && (
              <button
                type="button"
                onClick={() => setActiveTab('clips')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'clips'
                    ? 'bg-[#00E5FF] text-black shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Film className="w-3.5 h-3.5" /> Clips ({album.typeCounts.clips})
              </button>
            )}
            {hasShorts && (
              <button
                type="button"
                onClick={() => setActiveTab('shorts')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'shorts'
                    ? 'bg-[#00E5FF] text-black shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" /> Shorts ({album.typeCounts.shorts})
              </button>
            )}
            {hasPhotos && (
              <button
                type="button"
                onClick={() => setActiveTab('photos')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'photos'
                    ? 'bg-[#00E5FF] text-black shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Camera className="w-3.5 h-3.5" /> Photos ({album.typeCounts.photos})
              </button>
            )}
          </div>
        ) : (
          <div className="text-sm font-mono text-zinc-400">
            Showing {filteredItems.length} items
          </div>
        )}

        {/* Right Controls: Local Search & Sort Dropdown */}
        <div className="flex items-center gap-3">
          {/* Search within album */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search in album..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-[#00E5FF]/60 w-36 sm:w-48"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/40 border border-white/10 hover:border-white/20 text-xs font-mono text-zinc-300 hover:text-white transition cursor-pointer"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-[#00E5FF]" />
              <span className="capitalize">{sortOrder.replace('-', ' ')}</span>
            </button>

            {showSortDropdown && (
              <div className="absolute right-0 mt-2 w-40 bg-[#0d0e14] border border-white/20 rounded-xl p-1.5 shadow-2xl backdrop-blur-xl z-50 flex flex-col gap-1">
                {(
                  [
                    { id: 'newest', label: 'Newest First' },
                    { id: 'oldest', label: 'Oldest First' },
                    { id: 'name-asc', label: 'Name (A–Z)' },
                  ] as { id: SortOrder; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSortOrder(opt.id);
                      setShowSortDropdown(false);
                    }}
                    className={`px-2.5 py-1.5 text-xs font-mono text-left rounded-lg transition cursor-pointer flex items-center justify-between ${
                      sortOrder === opt.id
                        ? 'bg-[#00E5FF]/20 text-[#00E5FF] font-bold'
                        : 'text-zinc-300 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span>{opt.label}</span>
                    {sortOrder === opt.id && <Check className="w-3 h-3 text-[#00E5FF]" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Media Items Grid */}
      {filteredItems.length > 0 ? (
        <div className={gridClasses}>
          {filteredItems.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              variant={activeTab === 'shorts' ? 'short' : activeTab === 'photos' ? 'photo' : item.variant}
              onClick={onSelectMedia}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white/[0.02] border border-dashed border-white/10 rounded-2xl">
          <Layers className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">
            No matching media found
          </h3>
          <p className="text-xs font-mono text-zinc-500">
            {localSearch ? `No results for "${localSearch}"` : 'This category contains no items.'}
          </p>
        </div>
      )}
    </div>
  );
};
