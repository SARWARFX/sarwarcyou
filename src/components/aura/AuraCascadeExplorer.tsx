import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { StageMediaItem } from '../../types';
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
  Sparkles,
} from 'lucide-react';
import { sortMediaItemsDescending } from '../../utils/albumExtractor';

export type PrimaryHubId = 'realtube' | 'clips' | 'shorts' | 'images';

interface PrimaryHub {
  id: PrimaryHubId;
  label: string;
  icon: React.ReactNode;
  subtitle: string;
}

const PRIMARY_HUBS: PrimaryHub[] = [
  {
    id: 'realtube',
    label: 'REALTube',
    icon: <Film className="w-5 h-5" />,
    subtitle: 'Broadcast Chronicles',
  },
  {
    id: 'clips',
    label: 'Clips',
    icon: <Film className="w-5 h-5" />,
    subtitle: 'Motion Sequences',
  },
  {
    id: 'shorts',
    label: 'Shorts',
    icon: <Layers className="w-5 h-5" />,
    subtitle: 'Vertical Vignettes',
  },
  {
    id: 'images',
    label: 'Images',
    icon: <Camera className="w-5 h-5" />,
    subtitle: 'Still Photography',
  },
];

interface FolderGroup {
  name: string;
  count: number;
  items: StageMediaItem[];
}

interface AuraCascadeExplorerProps {
  items: StageMediaItem[];
  isNavDisabled?: boolean;
  onOpenPhoto: (photo: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo: (video: StageMediaItem, playlist: StageMediaItem[]) => void;
  onOpenShort: (short: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => void;
}

export const AuraCascadeExplorer: React.FC<AuraCascadeExplorerProps> = ({
  items,
  isNavDisabled = false,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
}) => {
  const [activeHub, setActiveHub] = useState<PrimaryHubId>('images');
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [mobileStep, setMobileStep] = useState<'hubs' | 'subfolders' | 'media'>('hubs');

  const subfolderContainerRef = useRef<HTMLDivElement>(null);

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

  // Automatically select the first subfolder into view on hub change
  useEffect(() => {
    if (subfolders.length > 0) {
      const firstFolderName = subfolders[0].name;
      setSelectedFolder(firstFolderName);
      if (subfolderContainerRef.current) {
        subfolderContainerRef.current.scrollTop = 0;
      }
    } else {
      setSelectedFolder('');
    }
  }, [subfolders, activeHub]);

  // Active media items in selected subfolder
  const activeFiles = useMemo(() => {
    if (!selectedFolder) return [];
    const group = subfolders.find((f) => f.name === selectedFolder);
    return group ? group.items : [];
  }, [subfolders, selectedFolder]);

  // Media click launcher
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

  const currentHubMeta = PRIMARY_HUBS.find((h) => h.id === activeHub);

  return (
    <div
      className="relative w-full h-[100dvh] flex flex-col justify-center overflow-hidden p-6 sm:p-8 md:p-12 select-none"
      style={{ fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" }}
    >
      {/* ------------------------------------------------------------- */}
      {/* DESKTOP AURA 3-TIER PROGRESSIVE CASCADE */}
      {/* ------------------------------------------------------------- */}
      <div className="hidden md:flex flex-row items-center w-full h-[85vh] max-w-[1550px] mx-auto gap-8 lg:gap-10">
        {/* ========================================================= */}
        {/* TIER 1: CORE AXIS (Vertically Centered Navigation Column) */}
        {/* ========================================================= */}
        <div className="w-52 flex flex-col justify-center space-y-6 select-none z-20 flex-shrink-0">
          <div className="flex items-center gap-2 pl-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] font-semibold tracking-[0.2em] text-neutral-400 uppercase">
              Core Axis
            </span>
          </div>

          <div className="space-y-4">
            {PRIMARY_HUBS.map((hub) => {
              const isActive = activeHub === hub.id;
              return (
                <button
                  key={hub.id}
                  type="button"
                  onClick={() => setActiveHub(hub.id)}
                  className={`group flex items-center gap-3.5 w-full text-left transition-all duration-300 cursor-pointer ${
                    isActive ? 'translate-x-2' : 'hover:translate-x-1'
                  }`}
                >
                  {/* Glowing Micro-Orb / Pill Indicator */}
                  <div
                    className={`w-1.5 rounded-full transition-all duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                      isActive
                        ? 'h-6 bg-gradient-to-b from-blue-400 via-indigo-400 to-purple-400 shadow-[0_0_14px_rgba(129,140,248,0.7)] opacity-100'
                        : 'h-1.5 bg-neutral-700 opacity-0 group-hover:opacity-40'
                    }`}
                  />

                  <div className="flex flex-col">
                    <span
                      className={`text-2xl font-semibold tracking-tight transition-all duration-300 ${
                        isActive
                          ? 'text-white drop-shadow-[0_2px_16px_rgba(255,255,255,0.35)]'
                          : 'text-neutral-400 group-hover:text-neutral-200'
                      }`}
                    >
                      {hub.label}
                    </span>
                    <span
                      className={`text-xs font-normal transition-opacity duration-300 ${
                        isActive ? 'text-neutral-400 opacity-90' : 'text-neutral-500 opacity-0 group-hover:opacity-75'
                      }`}
                    >
                      {hub.subtitle}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* TIER 2: CHANNEL VAULT (Optical Quartz Drawer with Fade Mask) */}
        {/* ========================================================= */}
        <div
          className="relative w-80 max-h-[74vh] flex flex-col bg-white/[0.03] backdrop-blur-2xl border border-white/[0.08] border-t-white/[0.15] rounded-3xl p-5 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.7)] z-20 flex-shrink-0 animate-fade-in"
          style={{
            transition: 'transform 400ms cubic-bezier(0.16, 1, 0.3, 1), opacity 300ms ease',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/[0.08]">
            <span className="text-[11px] font-semibold text-neutral-400 tracking-[0.12em] uppercase">
              {currentHubMeta?.label} Vault ({subfolders.length})
            </span>
            <span className="text-[10px] text-neutral-500 font-medium">Newest First</span>
          </div>

          {/* Subfolder Reel with Optical Bottom Fade Mask */}
          <div
            ref={subfolderContainerRef}
            className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar"
            style={{
              maskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 85%, transparent 100%)',
            }}
          >
            {subfolders.map((folder) => {
              const isSelected = selectedFolder === folder.name;
              return (
                <button
                  key={folder.name}
                  type="button"
                  onClick={() => setSelectedFolder(folder.name)}
                  className={`w-full rounded-2xl px-4 py-3 cursor-pointer transition-all duration-200 flex items-center justify-between text-left ${
                    isSelected
                      ? 'bg-white/[0.08] text-white border border-white/[0.14] shadow-sm translate-x-1 font-medium'
                      : 'text-neutral-400 hover:text-white hover:bg-white/[0.03] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {isSelected ? (
                      <FolderOpen className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    ) : (
                      <Folder className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                    )}
                    <span className="text-xs truncate tracking-tight">{folder.name}</span>
                  </div>
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full flex-shrink-0 font-medium ${
                      isSelected
                        ? 'bg-white/15 text-white'
                        : 'bg-white/[0.05] text-neutral-500'
                    }`}
                  >
                    {folder.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================= */}
        {/* TIER 3: ARTIFACT STAGE (Cinematic Media Grid) */}
        {/* ========================================================= */}
        <div className="flex-1 h-[78vh] overflow-y-auto rounded-3xl bg-white/[0.02] backdrop-blur-xl border border-white/[0.06] border-t-white/[0.12] p-7 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] z-20 flex flex-col no-scrollbar">
          {/* Stage Header */}
          <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-white tracking-tight">
                {selectedFolder || 'Media Artifacts'}
              </h2>
              <span className="text-xs px-3 py-1 rounded-full bg-white/[0.08] border border-white/[0.08] text-neutral-300 font-medium">
                {activeFiles.length} items
              </span>
            </div>
            <div className="text-xs text-neutral-500 hidden sm:block">
              {currentHubMeta?.label} Archive
            </div>
          </div>

          {/* Grid of Micro-Elevation Media Cards */}
          {activeFiles.length === 0 ? (
            <div className="h-full flex items-center justify-center text-neutral-500 text-sm">
              No artifacts cataloged in this sector.
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
              {activeFiles.map((file, idx) => {
                const thumbUrl = file.thumbnail || file.poster || file.url;
                const isShort = file.mediaType === 'short' || file.path?.toLowerCase().includes('short');
                const isVid = file.type === 'video' || file.mediaType === 'clip' || isShort;

                return (
                  <div
                    key={file.id || idx}
                    onClick={() => handleMediaClick(file, idx)}
                    className="group relative flex flex-col bg-white/[0.03] rounded-2xl overflow-hidden border border-white/[0.07] hover:border-white/[0.22] hover:-translate-y-1.5 hover:scale-[1.02] hover:shadow-[0_15px_30px_-5px_rgba(0,0,0,0.8)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] cursor-pointer"
                  >
                    {/* Thumbnail Image Container */}
                    <div
                      className={`relative w-full overflow-hidden bg-neutral-950 ${
                        isShort ? 'aspect-[9/16]' : 'aspect-[4/5]'
                      }`}
                    >
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={file.title || file.name}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-600">
                          <Film className="w-8 h-8 opacity-40" />
                        </div>
                      )}

                      {/* Optical bottom gradient shadow */}
                      <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/85 via-neutral-950/20 to-transparent pointer-events-none" />

                      {/* Play hover pill for videos */}
                      {isVid && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity">
                          <div className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-md border border-white/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-lg">
                            <Play className="w-4 h-4 fill-white ml-0.5" />
                          </div>
                        </div>
                      )}

                      {/* Type Badge */}
                      <div className="absolute top-2.5 right-2.5">
                        {isShort ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wider bg-black/60 backdrop-blur-md text-amber-300 border border-amber-400/30">
                            SHORT
                          </span>
                        ) : file.type === 'video' || file.mediaType === 'clip' ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-wider bg-black/60 backdrop-blur-md text-indigo-300 border border-indigo-400/30">
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
                    <div className="p-3.5 bg-neutral-950/60 flex flex-col justify-between">
                      <h3
                        className="text-xs font-medium text-neutral-200 group-hover:text-white truncate tracking-tight"
                        title={file.title || file.name}
                      >
                        {file.title || file.name}
                      </h3>
                      {file.date ? (
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-500 mt-1.5">
                          <Clock className="w-3 h-3 text-neutral-600" />
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

      {/* ------------------------------------------------------------- */}
      {/* MOBILE ADAPTIVE VIEW (< 768px) - Single Thumb Drill-Down */}
      {/* ------------------------------------------------------------- */}
      <div className="md:hidden flex flex-col w-full h-[90vh] z-20">
        {/* STEP 1: Centered Primary Hubs */}
        {mobileStep === 'hubs' && (
          <div className="flex flex-col justify-center h-full space-y-4 px-2 animate-fade-in">
            <div className="text-xs font-semibold tracking-[0.2em] text-neutral-500 uppercase pl-2 mb-2">
              Select Hub
            </div>
            {PRIMARY_HUBS.map((hub) => (
              <button
                key={hub.id}
                type="button"
                onClick={() => {
                  setActiveHub(hub.id);
                  setMobileStep('subfolders');
                }}
                className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 active:scale-[0.98] transition-all text-left"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-white/[0.08] flex items-center justify-center text-white">
                    {hub.icon}
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-white tracking-tight">
                      {hub.label}
                    </div>
                    <div className="text-xs text-neutral-400 font-normal">
                      {hub.subtitle}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-neutral-500" />
              </button>
            ))}
          </div>
        )}

        {/* STEP 2: Subfolder Reel */}
        {mobileStep === 'subfolders' && (
          <div className="flex flex-col h-full bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-3xl p-5 animate-fade-in overflow-hidden shadow-2xl">
            {/* Top Back Nav Pill */}
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-white/10">
              <button
                type="button"
                onClick={() => setMobileStep('hubs')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-neutral-200 active:scale-95 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Hubs</span>
              </button>
              <span className="text-sm font-semibold text-white">
                {currentHubMeta?.label} Vault
              </span>
            </div>

            {/* Subfolder items */}
            <div className="flex-1 overflow-y-auto space-y-2.5 no-scrollbar">
              {subfolders.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => {
                    setSelectedFolder(f.name);
                    setMobileStep('media');
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06] text-left active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Folder className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-white truncate">{f.name}</span>
                  </div>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-neutral-300 font-medium">
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: Vertical Media Grid */}
        {mobileStep === 'media' && (
          <div className="flex flex-col h-full bg-white/[0.03] backdrop-blur-3xl border border-white/10 rounded-3xl p-5 animate-fade-in overflow-hidden shadow-2xl">
            {/* Top Back Nav Pill */}
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-white/10">
              <button
                type="button"
                onClick={() => setMobileStep('subfolders')}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-xs font-medium text-neutral-200 active:scale-95 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Vault</span>
              </button>
              <span className="text-sm font-semibold text-white truncate max-w-[180px]">
                {selectedFolder}
              </span>
            </div>

            {/* Media Items */}
            <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-3.5 no-scrollbar">
              {activeFiles.map((file, idx) => {
                const thumbUrl = file.thumbnail || file.poster || file.url;
                const isShort = file.mediaType === 'short' || file.path?.toLowerCase().includes('short');
                const isVid = file.type === 'video' || file.mediaType === 'clip' || isShort;

                return (
                  <div
                    key={file.id || idx}
                    onClick={() => handleMediaClick(file, idx)}
                    className="flex flex-col bg-white/[0.04] rounded-2xl overflow-hidden border border-white/10 active:scale-95 transition-transform"
                  >
                    <div
                      className={`relative w-full overflow-hidden bg-neutral-950 ${
                        isShort ? 'aspect-[9/16]' : 'aspect-[4/5]'
                      }`}
                    >
                      {thumbUrl && (
                        <img
                          src={thumbUrl}
                          alt={file.title || file.name}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      )}
                      {isVid && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-9 h-9 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white">
                            <Play className="w-4 h-4 fill-white ml-0.5" />
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-2.5 bg-neutral-950/80">
                      <span className="text-xs text-neutral-200 truncate block font-medium">
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
