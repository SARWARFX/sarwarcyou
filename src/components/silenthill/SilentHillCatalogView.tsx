import React, { useState, useMemo } from 'react';
import type { StageMediaItem } from '../../types';
import type { CardinalDirection } from './SpecterCompass';
import { Compass, Film, Camera, Layers, Play, Clock } from 'lucide-react';
import { sortMediaItemsDescending } from '../../utils/albumExtractor';

interface SilentHillCatalogViewProps {
  section: CardinalDirection;
  items: StageMediaItem[];
  onBackToFog: () => void;
  onOpenPhoto: (photo: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo: (video: StageMediaItem, playlist: StageMediaItem[]) => void;
  onOpenShort: (short: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => void;
}

export const SilentHillCatalogView: React.FC<SilentHillCatalogViewProps> = ({
  section,
  items,
  onBackToFog,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
}) => {
  const [selectedFolder, setSelectedFolder] = useState<string>('ALL');

  // Filter items matching the chosen cardinal direction
  const sectionItems = useMemo(() => {
    switch (section) {
      case 'north': // REALTube
        return items.filter(
          (it) =>
            it.path?.toLowerCase().includes('realtube') ||
            it.parentAlbum?.toLowerCase().includes('realtube') ||
            it.category?.toLowerCase().includes('realtube')
        );
      case 'south': // Short Clips
        return items.filter(
          (it) =>
            it.mediaType === 'short' ||
            it.path?.toLowerCase().includes('short') ||
            it.parentAlbum?.toLowerCase().includes('short') ||
            it.category?.toLowerCase().includes('short')
        );
      case 'west': // Video Clips
        return items.filter(
          (it) =>
            it.mediaType === 'clip' ||
            (it.type === 'video' &&
              !it.path?.toLowerCase().includes('short') &&
              !it.path?.toLowerCase().includes('realtube'))
        );
      case 'east': // Photography
        return items.filter(
          (it) =>
            it.mediaType === 'photo' ||
            it.type === 'image' ||
            /\.(jpe?g|png|webp|avif)$/i.test(it.path || it.url || it.name || '')
        );
      default:
        return items;
    }
  }, [items, section]);

  // Extract distinct folders within this section
  const availableFolders = useMemo(() => {
    const set = new Set<string>();
    for (const it of sectionItems) {
      let fName = it.parentAlbum || it.category || '';
      if (!fName && it.path) {
        const segs = it.path.split('/');
        if (segs.length > 2) fName = segs[1];
        else if (segs.length > 1) fName = segs[0];
      }
      if (fName) set.add(fName);
    }
    return Array.from(set).sort((a, b) => {
      // Newest year first (2027 -> 2026 -> 2025)
      const numA = parseInt((a.match(/\d+/) || ['0'])[0], 10);
      const numB = parseInt((b.match(/\d+/) || ['0'])[0], 10);
      if (numA && numB && numA !== numB) return numB - numA;
      return a.localeCompare(b);
    });
  }, [sectionItems]);

  // Filter by selected folder and sort strictly descending (newest first)
  const displayItems = useMemo(() => {
    const list =
      selectedFolder === 'ALL'
        ? sectionItems
        : sectionItems.filter((it) => {
            const p = (it.parentAlbum || it.category || it.path || '').toLowerCase();
            return p.includes(selectedFolder.toLowerCase());
          });
    return sortMediaItemsDescending(list);
  }, [sectionItems, selectedFolder]);

  // Section titles and icons
  const sectionMeta = useMemo(() => {
    switch (section) {
      case 'north':
        return {
          title: 'NORTH · REALTUBE',
          subtitle: 'Uncut broadcast reel and long-form visual chronicles',
          icon: <Film className="w-5 h-5 text-neutral-400" />,
        };
      case 'south':
        return {
          title: 'SOUTH · SHORT CLIPS',
          subtitle: 'Vertical vignettes and ephemeral cinematic moments',
          icon: <Layers className="w-5 h-5 text-neutral-400" />,
        };
      case 'west':
        return {
          title: 'WEST · VIDEO CLIPS',
          subtitle: 'Selected motion sequences and musical archives',
          icon: <Film className="w-5 h-5 text-neutral-400" />,
        };
      case 'east':
        return {
          title: 'EAST · PHOTOGRAPHY',
          subtitle: 'Static silver-halide memories and portrait portfolios',
          icon: <Camera className="w-5 h-5 text-neutral-400" />,
        };
    }
  }, [section]);

  const handleItemClick = (item: StageMediaItem, index: number) => {
    if (item.mediaType === 'short' || item.path?.toLowerCase().includes('short')) {
      onOpenShort(item, displayItems, index, selectedFolder !== 'ALL' ? selectedFolder : 'Shorts');
    } else if (item.type === 'video' || item.mediaType === 'clip') {
      onOpenVideo(item, displayItems);
    } else {
      onOpenPhoto(item, displayItems, index);
    }
  };

  return (
    <div
      className="relative w-full min-h-[100dvh] overflow-y-auto px-4 sm:px-8 py-6 z-20"
      style={{ fontFamily: '"Times New Roman", Times, Georgia, serif' }}
    >
      {/* ------------------------------------------------------------- */}
      {/* Top Header Bar with Minimalist "Return to the Fog" Button */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-neutral-800/80">
        <button
          type="button"
          onClick={onBackToFog}
          className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-md bg-[#131519]/80 hover:bg-[#1c2026] text-neutral-300 hover:text-amber-400 border border-neutral-800 hover:border-amber-500/40 transition-all duration-300 cursor-pointer shadow-lg w-fit group"
        >
          <Compass className="w-4 h-4 text-neutral-400 group-hover:text-amber-400 transition-colors group-hover:rotate-45 duration-500" />
          <span className="text-xs uppercase tracking-[0.2em] font-serif">
            Return to the Fog
          </span>
        </button>

        {/* Section Heading */}
        <div className="text-left sm:text-right">
          <div className="flex items-center sm:justify-end gap-2 text-neutral-200">
            {sectionMeta.icon}
            <h1 className="text-lg sm:text-xl font-bold tracking-[0.25em] text-neutral-100 uppercase drop-shadow">
              {sectionMeta.title}
            </h1>
          </div>
          <p className="text-xs text-neutral-400 font-serif italic mt-0.5 tracking-wide">
            {sectionMeta.subtitle} • {displayItems.length} indexed files
          </p>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Weathered Subfolder Filter Chips (if section contains folders) */}
      {/* ------------------------------------------------------------- */}
      {availableFolders.length > 1 && (
        <div className="flex items-center gap-2 py-4 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setSelectedFolder('ALL')}
            className={`px-3 py-1 rounded text-xs tracking-[0.15em] uppercase font-serif transition-all cursor-pointer border ${
              selectedFolder === 'ALL'
                ? 'bg-neutral-800 text-amber-300 border-amber-600/50 shadow-[0_0_12px_rgba(212,140,56,0.3)]'
                : 'bg-neutral-900/60 text-neutral-400 hover:text-neutral-200 border-neutral-800/80 hover:border-neutral-700'
            }`}
          >
            All Archives ({sectionItems.length})
          </button>
          {availableFolders.map((fName) => (
            <button
              key={fName}
              type="button"
              onClick={() => setSelectedFolder(fName)}
              className={`px-3 py-1 rounded text-xs tracking-[0.15em] uppercase font-serif whitespace-nowrap transition-all cursor-pointer border ${
                selectedFolder === fName
                  ? 'bg-neutral-800 text-amber-300 border-amber-600/50 shadow-[0_0_12px_rgba(212,140,56,0.3)]'
                  : 'bg-neutral-900/60 text-neutral-400 hover:text-neutral-200 border-neutral-800/80 hover:border-neutral-700'
              }`}
            >
              {fName}
            </button>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Archival Media Grid with Weathered Aesthetic */}
      {/* ------------------------------------------------------------- */}
      {displayItems.length === 0 ? (
        <div className="py-24 text-center text-neutral-500 font-serif italic text-sm">
          No cataloged artifacts found in this sector of the mist.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 pt-4">
          {displayItems.map((item, idx) => {
            const thumbUrl = item.thumbnail || item.poster || item.url;
            const isVideo = item.type === 'video' || item.mediaType === 'clip' || item.mediaType === 'short';

            return (
              <div
                key={item.id || idx}
                onClick={() => handleItemClick(item, idx)}
                className="group relative flex flex-col bg-[#111317]/90 rounded-lg overflow-hidden border border-neutral-800/80 hover:border-amber-600/50 transition-all duration-300 cursor-pointer shadow-lg hover:shadow-[0_4px_25px_rgba(0,0,0,0.8)]"
              >
                {/* Media Image / Thumbnail */}
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-neutral-950">
                  {thumbUrl ? (
                    <img
                      src={thumbUrl}
                      alt={item.title || item.name}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 filter contrast-[1.05] brightness-95 group-hover:brightness-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-600">
                      <Camera className="w-8 h-8 opacity-40" />
                    </div>
                  )}

                  {/* Dark subtle vignette over thumbnail */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

                  {/* Play badge for videos/shorts */}
                  {isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm border border-white/20 flex items-center justify-center text-neutral-200 group-hover:scale-110 group-hover:border-amber-500/60 transition-all">
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      </div>
                    </div>
                  )}

                  {/* Type badge in corner */}
                  <div className="absolute top-2 right-2">
                    {item.mediaType === 'short' ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-900/60 text-amber-300 border border-amber-600/30">
                        SHORT
                      </span>
                    ) : item.type === 'video' ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-950/60 text-blue-300 border border-blue-600/30">
                        VIDEO
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-neutral-900/60 text-neutral-300 border border-neutral-700/30">
                        PHOTO
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Title & Info */}
                <div className="p-2.5 flex flex-col justify-between flex-1 bg-[#101216]">
                  <h3
                    className="text-xs font-serif text-neutral-200 group-hover:text-amber-300 transition-colors truncate tracking-wide"
                    title={item.title || item.name}
                  >
                    {item.title || item.name}
                  </h3>
                  <div className="flex items-center justify-between text-[10px] text-neutral-500 font-serif mt-1">
                    <span className="truncate max-w-[100px]">{item.parentAlbum || item.category || 'Archive'}</span>
                    {item.date ? (
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(item.date).getFullYear()}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
