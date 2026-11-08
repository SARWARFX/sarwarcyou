import React, { useMemo } from 'react';
import type { StageMediaItem } from '../../types';
import type { CsprTab } from './CsprNavigationRail';
import { isPhotoExtension } from '../../utils/mediaTypeDetector';
import { HorizontalMediaShelf, type ShelfAspectRatio } from './HorizontalMediaShelf';

export interface SubfolderArchiveViewProps {
  category: Exclude<CsprTab, 'HOME'>;
  items: StageMediaItem[];
  onOpenPhoto: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo: (item: StageMediaItem, playlist: StageMediaItem[]) => void;
  onOpenShort: (item: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => void;
}

interface SubfolderGroup {
  name: string;
  items: StageMediaItem[];
  aspectRatio: ShelfAspectRatio;
}

function getCleanSubfolder(item: StageMediaItem, category: string): string {
  const raw = item.path || item.parentAlbum || item.category || '';
  const clean = raw.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const parts = clean.split('/').filter(Boolean);
  const hasExt = parts.length > 0 && /\.[a-z0-9]{2,5}$/i.test(parts[parts.length - 1]);
  const dirParts = hasExt ? parts.slice(0, -1) : parts;

  if (dirParts.length > 1) {
    return dirParts.slice(1).join(' / ');
  }
  if (dirParts.length === 1 && dirParts[0].toLowerCase() !== category.toLowerCase()) {
    return dirParts[0];
  }

  // Fallback defaults
  if (category === 'SHORTS') return 'Shorts Classic';
  if (category === 'REALTUBE') return 'REALTube Vault';
  if (category === 'PHOTOGRAPHY') return 'Photography Archive';
  return 'Favorite';
}

export const SubfolderArchiveView: React.FC<SubfolderArchiveViewProps> = ({
  category,
  items,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
}) => {
  // 1. Filter items belonging strictly to this category
  const categoryItems = useMemo(() => {
    return items.filter((item) => {
      const raw = (item.path || item.parentAlbum || item.category || item.url || '').toLowerCase();
      const isShort = item.mediaType === 'short' || raw.includes('short');
      const isPhoto = item.type === 'image' || isPhotoExtension(item.url || item.name || item.path || '');
      const isRealTube = raw.includes('realtube');

      switch (category) {
        case 'REALTUBE':
          return isRealTube;
        case 'SHORTS':
          return !isRealTube && isShort;
        case 'PHOTOGRAPHY':
          return !isRealTube && isPhoto;
        case 'CLIPS':
        default:
          return !isRealTube && !isShort && !isPhoto;
      }
    });
  }, [items, category]);

  // 2. Group items into distinct subfolders
  const subfolderGroups = useMemo<SubfolderGroup[]>(() => {
    const map = new Map<string, StageMediaItem[]>();

    for (const item of categoryItems) {
      const sub = getCleanSubfolder(item, category);
      if (!map.has(sub)) {
        map.set(sub, []);
      }
      map.get(sub)!.push(item);
    }

    // Determine default aspect ratio based on category
    let defaultRatio: ShelfAspectRatio = 'video';
    if (category === 'SHORTS') defaultRatio = 'vertical';
    else if (category === 'PHOTOGRAPHY') defaultRatio = 'portrait';

    const groups: SubfolderGroup[] = Array.from(map.entries()).map(([name, groupItems]) => {
      let ratio = defaultRatio;
      if (category === 'REALTUBE') {
        const hasVertical = groupItems.some(
          (it) => it.mediaType === 'short' || it.category?.toLowerCase().includes('short')
        );
        ratio = hasVertical ? 'vertical' : 'video';
      }
      return {
        name,
        items: groupItems,
        aspectRatio: ratio,
      };
    });

    // Sort subfolders: 2027/Newest years and 'Favorite' first
    groups.sort((a, b) => {
      const isFavA = /fav/i.test(a.name);
      const isFavB = /fav/i.test(b.name);
      if (isFavA && !isFavB) return -1;
      if (!isFavA && isFavB) return 1;

      const yearMatchA = a.name.match(/(?:H|Year)?(20[2-3][0-9])/i);
      const yearMatchB = b.name.match(/(?:H|Year)?(20[2-3][0-9])/i);
      const yearA = yearMatchA ? parseInt(yearMatchA[1], 10) : null;
      const yearB = yearMatchB ? parseInt(yearMatchB[1], 10) : null;
      if (yearA !== null && yearB !== null && yearA !== yearB) {
        return yearB - yearA;
      }
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    return groups;
  }, [categoryItems, category]);

  const categoryTitles: Record<string, { title: string; desc: string }> = {
    CLIPS: { title: 'VIDEO CLIPS ARCHIVE', desc: 'Widescreen motion clips, trailers, and edits' },
    SHORTS: { title: 'SHORTS 2027 ARCHIVE', desc: 'Vertical high-impact short-form video reels' },
    PHOTOGRAPHY: { title: 'PHOTOGRAPHY ARCHIVE', desc: 'High-resolution portraits, landscapes, and album stills' },
    REALTUBE: { title: 'REALTUBE VAULT', desc: 'Exclusive classified transmissions and full-length archives' },
  };

  const currentInfo = categoryTitles[category] || { title: category, desc: '' };

  const handleOpenItem = (item: StageMediaItem, playlist: StageMediaItem[], idx: number, folderName: string) => {
    if (category === 'PHOTOGRAPHY' || item.type === 'image') {
      onOpenPhoto(item, playlist, idx);
    } else if (category === 'SHORTS' || item.mediaType === 'short') {
      onOpenShort(item, playlist, idx, folderName);
    } else {
      onOpenVideo(item, playlist);
    }
  };

  return (
    <div className="w-full flex flex-col space-y-8 animate-fade-in pb-20">
      {/* Category Banner Header */}
      <div className="px-4 sm:px-6 md:px-8 pt-2 pb-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <span className="text-[10px] font-mono tracking-[0.25em] text-neutral-400 uppercase">
            CATEGORY ARCHIVE // {category}
          </span>
          <h1 className="font-['Roboto',sans-serif] font-bold text-xl sm:text-2xl md:text-3xl tracking-[0.22em] text-white uppercase mt-1 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
            {currentInfo.title}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1 font-['Roboto',sans-serif]">
            {currentInfo.desc}
          </p>
        </div>

        <div className="text-xs font-mono text-neutral-400 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl self-start sm:self-auto">
          {categoryItems.length} TOTAL ASSETS · {subfolderGroups.length} SUBFOLDERS
        </div>
      </div>

      {/* Subfolder Sequential Shelves Down the Page */}
      {subfolderGroups.length === 0 ? (
        <div className="py-20 text-center text-neutral-500 font-mono text-sm tracking-wider uppercase">
          NO ASSETS INDEXED UNDER {category}
        </div>
      ) : (
        subfolderGroups.map((group) => (
          <HorizontalMediaShelf
            key={group.name}
            title={group.name}
            subtitle={`${category} ARCHIVE`}
            badge={`${group.items.length} ITEMS`}
            items={group.items}
            aspectRatio={group.aspectRatio}
            onOpenItem={(item, list, idx) => handleOpenItem(item, list, idx, group.name)}
          />
        ))
      )}
    </div>
  );
};
