import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { StageMediaItem } from '../types';
import {
  Folder,
  FolderOpen,
  Play,
  Film,
  Camera,
  Layers,
  ArrowLeft,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { sortMediaItemsDescending } from '../utils/albumExtractor';

export type PrimaryHubId = 'realtube' | 'clips' | 'shorts' | 'images';

interface PrimaryHub {
  id: PrimaryHubId;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const PRIMARY_HUBS: PrimaryHub[] = [
  {
    id: 'realtube',
    label: 'REALTube',
    icon: <Film className="w-5 h-5" />,
    description: 'Long-form cinematic broadcasts',
  },
  {
    id: 'clips',
    label: 'Clips',
    icon: <Film className="w-5 h-5" />,
    description: 'Curated video sequences',
  },
  {
    id: 'shorts',
    label: 'Shorts',
    icon: <Layers className="w-5 h-5" />,
    description: 'Vertical reels and vignettes',
  },
  {
    id: 'images',
    label: 'Images',
    icon: <Camera className="w-5 h-5" />,
    description: 'High-definition photography',
  },
];

interface FolderGroup {
  name: string;
  count: number;
  items: StageMediaItem[];
}

interface ModernCascadeExplorerProps {
  items: StageMediaItem[];
  isNavDisabled?: boolean;
  onOpenPhoto: (photo: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo: (video: StageMediaItem, playlist: StageMediaItem[]) => void;
  onOpenShort: (short: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => void;
}

export const ModernCascadeExplorer: React.FC<ModernCascadeExplorerProps> = ({
  items,
  isNavDisabled = false,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
}) => {
  const [activeHub, setActiveHub] = useState<PrimaryHubId>('images');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [mobileStep, setMobileStep] = useState<'hubs' | 'subfolders' | 'media'>('hubs');

  const subfolderListRef = useRef<HTMLDivElement>(null);

  // Filter items matching active primary hub
  const hubItems = useMemo(() => {
    switch (activeHub) {
      case 'realtube':
        return items.filter(
          (it) =>
            it.path?.toLowerCase().includes('realtube') ||
            it.parentAlbum?.toLowerCase().includes('realtube') ||
            it.category?.toLowerCase().includes('realtube')
        );
      case 'clips':
        return items.filter(
          (it) =>
            it.mediaType === 'clip' ||
            (it.type === 'video' &&
              !it.path?.toLowerCase().includes('short') &&
              !it.path?.toLowerCase().includes('realtube'))
        );
      case 'shorts':
        return items.filter(
          (it) =>
            it.mediaType === 'short' ||
            it.path?.toLowerCase().includes('short') ||
            it.parentAlbum?.toLowerCase().includes('short') ||
            it.category?.toLowerCase().includes('short')
        );
      case 'images':
        return items.filter(
          (it) =>
            it.mediaType === 'photo' ||
            it.type === 'image' ||
            /\.(jpe?g|png|webp|avif)$/i.test(it.path || it.url || it.name || '')
        );
      default:
        return items;
    }
  }, [items, activeHub]);

  // Group items by subfolder and sort chronologically (2027 -> 2026 -> 2025 -> Classic -> Favourite)
  const subfolders: FolderGroup[] = useMemo(() => {
    const map = new Map<string, StageMediaItem[]>();

    for (const it of hubItems) {
      let folderName = it.parentAlbum || it.category || '';
      if (!folderName && it.path) {
        const segs = it.path.split('/');
        if (segs.length > 2) folderName = segs[1];
        else if (segs.length > 1) folderName = segs[0];
      }
      if (!folderName) {
        folderName = PRIMARY_HUBS.find((h) => h.id === activeHub)?.label || 'General';
      }

      const existing = map.get(folderName) || [];
      existing.push(it);
      map.set(folderName, existing);
    }

    const groups: FolderGroup[] = Array.from(map.entries()).map(([name, list]) => ({
      name,
      count: list.length,
      items: sortMediaItemsDescending(list),
    }));

    // Sort subfolders newest year first
    groups.sort((a, b) => {
      const yearMatchA = a.name.match(/(?:H|Year)?(20[2-3][0-9])/i);
      const yearMatchB = b.name.match(/(?:H|Year)?(20[2-3][0-9])/i);
      const yearA = yearMatchA ? parseInt(yearMatchA[1], 10) : null;
      const yearB = yearMatchB ? parseInt(yearMatchB[1], 10) : null;
      if (yearA !== null && yearB !== null && yearA !== yearB) {
        return yearB - yearA;
      }
      if (yearA !== null && yearB === null) return -1;
      if (yearB !== null && yearA === null) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });

    return groups;
  }, [hubItems, activeHub]);

  // Automatically select the first subfolder whenever active hub changes
  useEffect(() => {
    if (subfolders.length > 0) {
      const firstFolderName = subfolders[0].name;
      setSelectedFolder(firstFolderName);
      if (subfolderListRef.current) {
        subfolderListRef.current.scrollTop = 0;
      }
    } else {
      setSelectedFolder('');
    }
  }, [subfolders, activeHub]);

  // Current active files in selected subfolder
  const activeFiles = useMemo(() => {
    if (!selectedFolder) return [];
    const group = subfolders.find((f) => f.name === selectedFolder);
    return group ? group.items : [];
  }, [subfolders, selectedFolder]);

  // Handle clicking a media item
  const handleMediaClick = (file: StageMediaItem, index: number) => {
    if (isNavDisabled) return;
    if (file.mediaType === 'short' || file.path?.toLowerCase().includes('short')) {
      onOpenShort(file, activeFiles, index, selectedFolder || 'Shorts');
    } else if (file.type === 'video' || file.mediaType === 'clip') {
      onOpenVideo(file, activeFiles);
    } else {
      onOpenPhoto(file, activeFiles, index);
    }
  };

  return (
    <div className="relative w-full h-[100dvh] flex flex-col justify-center overflow-hidden p-4 sm:p-8 md:p-12 select-none">
      {/* ------------------------------------------------------------- */}
      {/* DESKTOP 3-TIER PROGRESSIVE CASCADE (md and above) */}
      {/* ------------------------------------------------------------- */}
      <div className="hidden md:flex flex-row items-center w-full h-[85vh] max-w-7xl mx-auto gap-8">
        {/* ========================================================= */}
        {/* COLUMN 1: Primary Hubs (Vertically Middle-Aligned) */}
        {/* ========================================================= */}
        <div className="flex flex-col justify-center min-w-[200px] space-y-5 z-20">
          <div className="text-[11px] font-semibold tracking-[0.25em] text-neutral-500 uppercase pl-1">
            Library Hubs
          </div>
          <div className="space-y-3">
            {PRIMARY_HUBS.map((hub) => {
              const isActive = activeHub === hub.id;
              return (
                <button
                  key={hub.id}
                  type="button"
                  onClick={() => {
                    setActiveHub(hub.id);
                  }}
                  className={`group flex items-center gap-3.5 w-full text-left transition-all duration-300 cursor-pointer ${
                    isActive ? 'translate-x-2' : 'hover:translate-x-1'
                  }`}
                >
                  {/* Active Indicator Bar */}
                  <div
                    className={`h-6 w-1 rounded-full transition-all duration-300 ${
                      isActive ? 'bg-white opacity-100' : 'bg-transparent opacity-0'
                    }`}
                  />
                  <div className="flex flex-col">
                    <span
                      className={`text-2xl font-semibold tracking-tight transition-colors duration-300 ${
                        isActive
                          ? 'text-white drop-shadow-[0_2px_12px_rgba(255,255,255,0.4)]'
                          : 'text-neutral-400 group-hover:text-neutral-200'
                      }`}
                    >
                      {hub.label}
                    </span>
                    <span
                      className={`text-xs font-normal transition-opacity duration-300 ${
                        isActive ? 'text-neutral-300 opacity-90' : 'text-neutral-500 opacity-0 group-hover:opacity-75'
                      }`}
                    >
                      {hub.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* COLUMN 2: Subfolders Panel (Frosted glass with scroll list) */}
        {/* ========================================================= */}
        <div className="relative w-80 max-h-[72vh] flex flex-col bg-neutral-950/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl z-20 animate-fade-in transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)]">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/10 text-xs font-semibold tracking-wider text-neutral-400 uppercase">
            <span>Archives ({subfolders.length})</span>
            <span className="text-[10px] text-neutral-500 font-normal">Newest First</span>
          </div>

          {/* Scrollable Subfolder List */}
          <div
            ref={subfolderListRef}
            className="flex-1 overflow-y-auto space-y-1.5 pr-1 no-scrollbar"
          >
            {subfolders.map((folder) => {
              const isSelected = selectedFolder === folder.name;
              return (
                <button
                  key={folder.name}
                  type="button"
                  onClick={() => setSelectedFolder(folder.name)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-white/15 text-white font-medium border border-white/20 shadow-md translate-x-1'
                      : 'text-neutral-400 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isSelected ? (
                      <FolderOpen className="w-4 h-4 text-white flex-shrink-0" />
                    ) : (
                      <Folder className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                    )}
                    <span className="text-xs truncate tracking-tight">{folder.name}</span>
                  </div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full flex-shrink-0 font-medium ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-neutral-500'
                    }`}
                  >
                    {folder.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Bottom subtle gradient fade mask to signal scrollability */}
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-neutral-950/60 to-transparent pointer-events-none rounded-b-2xl" />
        </div>

        {/* ========================================================= */}
        {/* COLUMN 3: Media Grid */}
        {/* ========================================================= */}
        <div className="flex-1 h-[75vh] flex flex-col bg-neutral-950/20 backdrop-blur-md border border-white/5 rounded-2xl p-6 overflow-hidden z-20 shadow-2xl">
          {/* Header of Active Folder */}
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white tracking-tight">
                {selectedFolder || 'Media Gallery'}
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-neutral-300 font-medium">
                {activeFiles.length} files
              </span>
            </div>
          </div>

          {/* Scrollable Media Grid */}
          <div className="flex-1 overflow-y-auto pr-1 no-scrollbar">
            {activeFiles.length === 0 ? (
              <div className="h-full flex items-center justify-center text-neutral-500 text-sm">
                No files found in this archive.
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {activeFiles.map((file, idx) => {
                  const thumbUrl = file.thumbnail || file.poster || file.url;
                  const isVid = file.type === 'video' || file.mediaType === 'clip' || file.mediaType === 'short';

                  return (
                    <div
                      key={file.id || idx}
                      onClick={() => handleMediaClick(file, idx)}
                      className="group relative flex flex-col bg-neutral-900/40 rounded-xl overflow-hidden border border-white/5 hover:border-white/20 hover:scale-[1.02] transition-all duration-300 cursor-pointer shadow-lg"
                    >
                      {/* Thumbnail Container */}
                      <div className="relative aspect-[4/5] w-full overflow-hidden bg-neutral-950">
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={file.title || file.name}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-600">
                            <Film className="w-8 h-8 opacity-40" />
                          </div>
                        )}

                        {/* Subtle dark gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-transparent to-transparent pointer-events-none" />

                        {/* Video Play Overlay */}
                        {isVid && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                            <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                              <Play className="w-4 h-4 fill-white ml-0.5" />
                            </div>
                          </div>
                        )}

                        {/* Type Badge */}
                        <div className="absolute top-2 right-2">
                          {file.mediaType === 'short' ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wider bg-black/60 backdrop-blur-md text-amber-300 border border-amber-400/30">
                              SHORT
                            </span>
                          ) : file.type === 'video' ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wider bg-black/60 backdrop-blur-md text-blue-300 border border-blue-400/30">
                              VIDEO
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wider bg-black/60 backdrop-blur-md text-neutral-300 border border-white/20">
                              PHOTO
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Details */}
                      <div className="p-3 bg-neutral-950/60 flex flex-col justify-between">
                        <h3
                          className="text-xs font-medium text-neutral-200 group-hover:text-white truncate"
                          title={file.title || file.name}
                        >
                          {file.title || file.name}
                        </h3>
                        {file.date ? (
                          <div className="flex items-center gap-1 text-[10px] text-neutral-500 mt-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(file.date).toLocaleDateString()}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MOBILE ADAPTIVE DRILL-DOWN VIEW (< 768px) */}
      {/* ------------------------------------------------------------- */}
      <div className="md:hidden flex flex-col w-full h-[90vh] z-20">
        {/* STEP 1: Categories */}
        {mobileStep === 'hubs' && (
          <div className="flex flex-col justify-center h-full space-y-4 px-4 animate-fade-in">
            <div className="text-xs font-semibold tracking-[0.25em] text-neutral-500 uppercase mb-2">
              Select Library
            </div>
            {PRIMARY_HUBS.map((hub) => (
              <button
                key={hub.id}
                type="button"
                onClick={() => {
                  setActiveHub(hub.id);
                  setMobileStep('subfolders');
                }}
                className="flex items-center justify-between p-4 rounded-2xl bg-neutral-950/50 backdrop-blur-xl border border-white/10 text-left active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white">
                    {hub.icon}
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-white tracking-tight">
                      {hub.label}
                    </div>
                    <div className="text-xs text-neutral-400 font-normal">
                      {hub.description}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-neutral-500" />
              </button>
            ))}
          </div>
        )}

        {/* STEP 2: Subfolders */}
        {mobileStep === 'subfolders' && (
          <div className="flex flex-col h-full bg-neutral-950/50 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 animate-fade-in overflow-hidden">
            {/* Top Back Navigation Bar */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
              <button
                type="button"
                onClick={() => setMobileStep('hubs')}
                className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Libraries</span>
              </button>
              <span className="text-sm font-semibold text-white">
                {PRIMARY_HUBS.find((h) => h.id === activeHub)?.label}
              </span>
            </div>

            {/* Subfolders List */}
            <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
              {subfolders.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => {
                    setSelectedFolder(f.name);
                    setMobileStep('media');
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-left active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Folder className="w-4 h-4 text-neutral-400" />
                    <span className="text-sm font-medium text-white">{f.name}</span>
                  </div>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-neutral-300">
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Media Grid */}
        {mobileStep === 'media' && (
          <div className="flex flex-col h-full bg-neutral-950/50 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 animate-fade-in overflow-hidden">
            {/* Top Back Navigation Bar */}
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
              <button
                type="button"
                onClick={() => setMobileStep('subfolders')}
                className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Archives</span>
              </button>
              <span className="text-sm font-semibold text-white truncate max-w-[180px]">
                {selectedFolder}
              </span>
            </div>

            {/* Media Items Grid */}
            <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-3 no-scrollbar">
              {activeFiles.map((file, idx) => {
                const thumbUrl = file.thumbnail || file.poster || file.url;
                return (
                  <div
                    key={file.id || idx}
                    onClick={() => handleMediaClick(file, idx)}
                    className="flex flex-col bg-neutral-900/60 rounded-xl overflow-hidden border border-white/10 active:scale-95 transition-transform"
                  >
                    <div className="relative aspect-[3/4] w-full overflow-hidden bg-neutral-950">
                      {thumbUrl && (
                        <img
                          src={thumbUrl}
                          alt={file.title || file.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      )}
                      {(file.type === 'video' || file.mediaType === 'clip' || file.mediaType === 'short') && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white">
                            <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-2 bg-neutral-950">
                      <span className="text-xs text-neutral-200 truncate block">
                        {file.title || file.name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
