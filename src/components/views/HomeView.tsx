import React from 'react';
import { Film, Sparkles, Folder, Play, Smartphone } from 'lucide-react';
import type { MediaItem, Album, CatalogState } from '../../models/media';
import { MediaCard } from '../cards/MediaCard';
import { AlbumCoverCard } from '../cards/AlbumCoverCard';

export interface HomeViewProps {
  catalog: CatalogState;
  searchQuery: string;
  onSelectMedia: (item: MediaItem) => void;
  onSelectAlbum: (album: Album) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  catalog,
  searchQuery,
  onSelectMedia,
  onSelectAlbum,
}) => {
  const query = searchQuery.trim().toLowerCase();

  // Filter items & albums based on search query
  const filteredAlbums = query
    ? catalog.albums.filter(
        (a) =>
          a.title.toLowerCase().includes(query) ||
          a.items.some((i) => i.title.toLowerCase().includes(query))
      )
    : catalog.albums;

  const filteredShorts = query
    ? catalog.shorts.filter((s) => s.title.toLowerCase().includes(query))
    : catalog.shorts;

  const filteredLatest = query
    ? catalog.latestReleases.filter((i) => i.title.toLowerCase().includes(query))
    : catalog.latestReleases;

  const heroItem = catalog.latestReleases[0];

  return (
    <div className="space-y-12 pb-16">
      {/* Hero Billboard (When not searching) */}
      {!query && heroItem && (
        <section className="relative w-full rounded-3xl overflow-hidden bg-black/60 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.9)] aspect-[16/9] sm:aspect-[21/9] max-h-[520px] flex items-end">
          {/* Background image & gradient overlay */}
          <div className="absolute inset-0 z-0">
            {heroItem.thumbnailUrl && (
              <img
                src={heroItem.thumbnailUrl}
                alt={heroItem.title}
                className="w-full h-full object-cover object-center filter brightness-75 scale-105"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#07080c] via-[#07080c]/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#07080c]/90 via-transparent to-transparent" />
          </div>

          {/* Hero Content */}
          <div className="relative z-10 p-6 sm:p-12 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E5FF]/20 border border-[#00E5FF]/40 text-[#00E5FF] text-xs font-mono font-bold uppercase tracking-wider backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Latest Featured Stream</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black font-sans text-white uppercase tracking-tight leading-none drop-shadow-lg line-clamp-2">
              {heroItem.title}
            </h1>

            <p className="text-xs sm:text-sm text-zinc-300 font-mono flex items-center gap-2">
              <span>{heroItem.albumTitle || 'Vault Stream'}</span>
              <span>•</span>
              <span className="uppercase text-[#00E5FF] font-semibold">{heroItem.variant}</span>
            </p>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => onSelectMedia(heroItem)}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-[#00E5FF] hover:bg-[#00c8e0] text-black font-sans font-black text-sm uppercase tracking-wider transition-all duration-300 shadow-[0_0_25px_rgba(0,229,255,0.4)] hover:shadow-[0_0_35px_rgba(0,229,255,0.7)] cursor-pointer active:scale-95"
              >
                <Play className="w-4 h-4 fill-black text-black" />
                <span>Stream Now</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Shorts Row */}
      {filteredShorts.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
                <Smartphone className="w-4 h-4" />
              </div>
              <h2 className="text-lg sm:text-xl font-bold font-sans text-white uppercase tracking-wider">
                Shorts
              </h2>
            </div>
            <span className="text-xs font-mono text-zinc-400">
              {filteredShorts.length} clips
            </span>
          </div>

          {/* Horizontal Reel */}
          <div className="flex gap-4 overflow-x-auto pb-4 pt-1 scrollbar-thin scrollbar-thumb-white/10 snap-x">
            {filteredShorts.slice(0, 16).map((item) => (
              <div key={item.id} className="w-40 sm:w-48 flex-shrink-0 snap-start">
                <MediaCard item={item} variant="short" onClick={onSelectMedia} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Dynamic Albums Directory */}
      <section className="space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-[#00E5FF]/20 text-[#00E5FF] border border-[#00E5FF]/30">
              <Folder className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-sans text-white uppercase tracking-wider">
                Albums & Categories
              </h2>
              <p className="text-xs font-mono text-zinc-400">
                Every folder in the vault dynamically mapped into standalone collections
              </p>
            </div>
          </div>
          <span className="text-xs font-mono px-3 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-300">
            {filteredAlbums.length} {filteredAlbums.length === 1 ? 'Album' : 'Albums'}
          </span>
        </div>

        {/* Albums Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAlbums.map((album) => (
            <AlbumCoverCard key={album.id} album={album} onClick={onSelectAlbum} />
          ))}
        </div>
      </section>

      {/* Latest Releases Grid */}
      {filteredLatest.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Film className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold font-sans text-white uppercase tracking-wider">
                  Latest Releases
                </h2>
                <p className="text-xs font-mono text-zinc-400">
                  Chronologically ordered stream vault uploads
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredLatest.slice(0, 12).map((item) => (
              <MediaCard key={item.id} item={item} onClick={onSelectMedia} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
