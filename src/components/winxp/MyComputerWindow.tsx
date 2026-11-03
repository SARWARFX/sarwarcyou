import React, { useState, useMemo, useEffect } from 'react';
import type { StageMediaItem } from '../../types';
import {
  Monitor,
  HardDrive,
  Folder,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  X,
  Minus,
  Square,
  Copy,
  Search,
  RotateCw,
  Film,
  Camera,
  FileText,
} from 'lucide-react';
import { sortMediaItemsDescending } from '../../utils/albumExtractor';

interface MyComputerWindowProps {
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  items: StageMediaItem[];
  initialDrive?: 'C:' | 'D:' | 'E:' | 'F:';
  onClose: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onOpenPhoto: (photo: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo: (video: StageMediaItem, playlist: StageMediaItem[]) => void;
  onOpenShort: (short: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => void;
}

interface DriveDefinition {
  id: 'C:' | 'D:' | 'E:' | 'F:';
  name: string;
  label: string;
  icon: React.ReactNode;
  filter: (item: StageMediaItem) => boolean;
  totalSpace: string;
  freeSpace: string;
}

export const MyComputerWindow: React.FC<MyComputerWindowProps> = ({
  isOpen,
  isMinimized,
  isMaximized,
  items,
  initialDrive,
  onClose,
  onMinimize,
  onToggleMaximize,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
}) => {
  // Navigation stack: [] is root "My Computer", ['F:'] is drive, ['F:', 'Images 2027'] is subfolder
  const [currentPath, setCurrentPath] = useState<string[]>(initialDrive ? [initialDrive] : []);
  const [history, setHistory] = useState<string[][]>([initialDrive ? [initialDrive] : []]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Sync initialDrive if changed from outside
  useEffect(() => {
    if (initialDrive) {
      setCurrentPath([initialDrive]);
      setHistory((prev) => [...prev.slice(0, historyIndex + 1), [initialDrive]]);
      setHistoryIndex((prev) => prev + 1);
    }
  }, [initialDrive]);

  // Navigate to path with history tracking
  const navigateTo = (newPath: string[]) => {
    setCurrentPath(newPath);
    setHistory((prev) => [...prev.slice(0, historyIndex + 1), newPath]);
    setHistoryIndex((prev) => prev + 1);
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      setHistoryIndex((prev) => prev - 1);
      setCurrentPath(history[historyIndex - 1]);
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex((prev) => prev + 1);
      setCurrentPath(history[historyIndex + 1]);
    }
  };

  const handleUp = () => {
    if (currentPath.length > 0) {
      navigateTo(currentPath.slice(0, -1));
    }
  };

  // 4 Core Windows XP Hard Disk Drives mapped to catalog media categories
  const drives: DriveDefinition[] = useMemo(
    () => [
      {
        id: 'C:',
        name: 'Local Disk (C:)',
        label: 'REALTube',
        icon: <HardDrive className="w-8 h-8 text-neutral-600" />,
        filter: (it) =>
          it.path?.toLowerCase().includes('realtube') ||
          it.parentAlbum?.toLowerCase().includes('realtube') ||
          it.category?.toLowerCase().includes('realtube'),
        totalSpace: '120 GB',
        freeSpace: '48.2 GB free',
      },
      {
        id: 'D:',
        name: 'Video Clips (D:)',
        label: 'Clips',
        icon: <HardDrive className="w-8 h-8 text-blue-600" />,
        filter: (it) =>
          it.mediaType === 'clip' ||
          (it.type === 'video' &&
            !it.path?.toLowerCase().includes('short') &&
            !it.path?.toLowerCase().includes('realtube')),
        totalSpace: '250 GB',
        freeSpace: '112 GB free',
      },
      {
        id: 'E:',
        name: 'Short Clips (E:)',
        label: 'Shorts',
        icon: <HardDrive className="w-8 h-8 text-emerald-600" />,
        filter: (it) =>
          it.mediaType === 'short' ||
          it.path?.toLowerCase().includes('short') ||
          it.parentAlbum?.toLowerCase().includes('short') ||
          it.category?.toLowerCase().includes('short'),
        totalSpace: '180 GB',
        freeSpace: '89.5 GB free',
      },
      {
        id: 'F:',
        name: 'Photography (F:)',
        label: 'Images',
        icon: <HardDrive className="w-8 h-8 text-amber-600" />,
        filter: (it) =>
          it.mediaType === 'photo' ||
          it.type === 'image' ||
          /\.(jpe?g|png|webp|avif)$/i.test(it.path || it.url || it.name || ''),
        totalSpace: '500 GB',
        freeSpace: '320 GB free',
      },
    ],
    []
  );

  // Filter items in current view
  const currentDriveId = currentPath[0] as 'C:' | 'D:' | 'E:' | 'F:' | undefined;
  const currentSubfolder = currentPath[1];

  const driveItems = useMemo(() => {
    if (!currentDriveId) return [];
    const def = drives.find((d) => d.id === currentDriveId);
    if (!def) return [];
    return items.filter(def.filter);
  }, [items, currentDriveId, drives]);

  // Subfolders inside active drive
  const subfolders = useMemo(() => {
    if (!currentDriveId || currentSubfolder) return [];
    const map = new Map<string, StageMediaItem[]>();

    for (const it of driveItems) {
      // Determine folder name from parentAlbum or path
      let folderName = it.parentAlbum || '';
      if (!folderName && it.path) {
        const segs = it.path.split('/');
        if (segs.length > 2) {
          folderName = segs[1];
        } else if (segs.length > 1) {
          folderName = segs[0];
        }
      }
      if (!folderName) folderName = 'General Archive';

      const existing = map.get(folderName) || [];
      existing.push(it);
      map.set(folderName, existing);
    }

    return Array.from(map.entries()).map(([name, list]) => ({
      name,
      count: list.length,
      items: sortMediaItemsDescending(list),
    }));
  }, [driveItems, currentDriveId, currentSubfolder]);

  // Files in current active subfolder
  const activeFiles = useMemo(() => {
    if (!currentDriveId || !currentSubfolder) return [];
    const filtered = driveItems.filter((it) => {
      const p = (it.parentAlbum || it.path || '').toLowerCase();
      const sub = currentSubfolder.toLowerCase();
      return p.includes(sub);
    });
    return sortMediaItemsDescending(filtered);
  }, [driveItems, currentDriveId, currentSubfolder]);

  // Handle clicking a media file to trigger existing untouched players
  const handleFileClick = (file: StageMediaItem, index: number) => {
    if (file.mediaType === 'short' || file.path?.toLowerCase().includes('short')) {
      onOpenShort(file, activeFiles, index, currentSubfolder || 'Shorts');
    } else if (file.type === 'video' || file.mediaType === 'clip') {
      onOpenVideo(file, activeFiles);
    } else {
      onOpenPhoto(file, activeFiles, index);
    }
  };

  if (!isOpen || isMinimized) return null;

  const addressString =
    currentPath.length === 0
      ? 'My Computer'
      : currentPath.length === 1
      ? `My Computer\\${drives.find((d) => d.id === currentPath[0])?.name || currentPath[0]}`
      : `My Computer\\${drives.find((d) => d.id === currentPath[0])?.name || currentPath[0]}\\${currentPath[1]}`;

  return (
    <div
      role="dialog"
      aria-modal="false"
      className={`fixed z-[9970] shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-t-lg overflow-hidden flex flex-col select-none border-2 border-[#0055ea] ${
        isMaximized
          ? 'inset-0 bottom-[30px] rounded-none border-none'
          : 'top-8 left-4 right-4 md:left-24 md:right-24 md:top-12 bottom-[50px] md:bottom-[70px] max-w-5xl mx-auto'
      }`}
      style={{
        fontFamily: 'Tahoma, Arial, sans-serif',
        background: '#ece9d8',
      }}
    >
      {/* ------------------------------------------------------------- */}
      {/* 1. Luna Gradient Title Bar */}
      {/* ------------------------------------------------------------- */}
      <div
        className="flex items-center justify-between px-2.5 py-1 text-white shadow-inner"
        style={{
          background: 'linear-gradient(to right, #0055ea 0%, #2989d8 50%, #207cca 100%)',
          borderBottom: '1px solid #002d80',
        }}
      >
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-white filter drop-shadow" />
          <span
            className="text-xs font-bold tracking-wide select-none"
            style={{ textShadow: '1px 1px 2px #002d80' }}
          >
            {currentPath.length === 0
              ? 'My Computer'
              : currentPath.length === 1
              ? drives.find((d) => d.id === currentPath[0])?.name
              : currentPath[1]}
          </span>
        </div>

        {/* Windows Control Buttons (Minimize, Maximize, Close) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMinimize}
            className="w-5 h-5 rounded-sm bg-gradient-to-b from-[#3887f6] to-[#004cd8] hover:brightness-125 border border-white/60 flex items-center justify-center text-white text-[11px] font-bold shadow-sm"
            title="Minimize"
          >
            <Minus className="w-3 h-3 stroke-[3]" />
          </button>
          <button
            type="button"
            onClick={onToggleMaximize}
            className="w-5 h-5 rounded-sm bg-gradient-to-b from-[#3887f6] to-[#004cd8] hover:brightness-125 border border-white/60 flex items-center justify-center text-white text-[11px] font-bold shadow-sm"
            title={isMaximized ? 'Restore Down' : 'Maximize'}
          >
            {isMaximized ? (
              <Copy className="w-2.5 h-2.5 stroke-[2.5]" />
            ) : (
              <Square className="w-2.5 h-2.5 stroke-[2.5]" />
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-5 h-5 rounded-sm bg-gradient-to-b from-[#e36140] to-[#c72605] hover:brightness-125 border border-white/60 flex items-center justify-center text-white text-[11px] font-bold shadow-sm"
            title="Close"
          >
            <X className="w-3.5 h-3.5 stroke-[3]" />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. Classic XP Menu Bar */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center gap-4 px-2 py-0.5 bg-[#ece9d8] border-b border-[#d8d4c4] text-xs text-neutral-800">
        <span className="hover:bg-[#2f71cd] hover:text-white px-1.5 py-0.5 rounded cursor-default">File</span>
        <span className="hover:bg-[#2f71cd] hover:text-white px-1.5 py-0.5 rounded cursor-default">Edit</span>
        <span className="hover:bg-[#2f71cd] hover:text-white px-1.5 py-0.5 rounded cursor-default">View</span>
        <span className="hover:bg-[#2f71cd] hover:text-white px-1.5 py-0.5 rounded cursor-default">Favorites</span>
        <span className="hover:bg-[#2f71cd] hover:text-white px-1.5 py-0.5 rounded cursor-default">Tools</span>
        <span className="hover:bg-[#2f71cd] hover:text-white px-1.5 py-0.5 rounded cursor-default">Help</span>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. XP Standard Navigation Toolbar & Address Bar */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col gap-1 px-2 py-1.5 bg-[#ece9d8] border-b border-[#999]">
        {/* Navigation Buttons Row */}
        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={handleBack}
            disabled={historyIndex <= 0}
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-black/5 active:bg-black/10 disabled:opacity-30 disabled:pointer-events-none border border-transparent hover:border-[#999]"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow">
              <ArrowLeft className="w-3 h-3 stroke-[3]" />
            </div>
            <span>Back</span>
          </button>
          <button
            type="button"
            onClick={handleForward}
            disabled={historyIndex >= history.length - 1}
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-black/5 active:bg-black/10 disabled:opacity-30 disabled:pointer-events-none border border-transparent hover:border-[#999]"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow">
              <ArrowRight className="w-3 h-3 stroke-[3]" />
            </div>
          </button>
          <button
            type="button"
            onClick={handleUp}
            disabled={currentPath.length === 0}
            className="p-1 rounded hover:bg-black/5 disabled:opacity-30 disabled:pointer-events-none border border-transparent hover:border-[#999]"
            title="Up One Level"
          >
            <ArrowUp className="w-4 h-4 text-amber-700" />
          </button>

          <div className="h-5 border-r border-[#999] mx-1" />

          <button
            type="button"
            onClick={() => navigateTo(currentPath)}
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-black/5 border border-transparent hover:border-[#999]"
          >
            <RotateCw className="w-3.5 h-3.5 text-blue-600" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Address Input Bar */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-neutral-600 font-sans">Address</span>
          <div className="flex-1 flex items-center gap-1.5 px-2 py-0.5 bg-white border border-[#7f9db9] shadow-inner text-neutral-800">
            <Monitor className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            <input
              type="text"
              readOnly
              value={addressString}
              className="w-full bg-transparent outline-none text-xs text-neutral-800 font-mono"
            />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. Main Body: Left Collapsible Tasks Panel + Right File View */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 flex flex-row overflow-hidden bg-white">
        {/* Classic Blue XP Tasks Sidebar (collapsible on mobile) */}
        <div
          className="hidden md:flex flex-col w-52 p-3 overflow-y-auto border-r border-[#7f9db9] select-none text-xs gap-3"
          style={{
            background: 'linear-gradient(to bottom, #7ba2e7 0%, #6375d6 100%)',
          }}
        >
          {/* System Tasks Box */}
          <div className="rounded-t bg-white overflow-hidden shadow">
            <div className="px-2 py-1 font-bold text-[#0c327d] bg-gradient-to-r from-white to-[#c6d7f2] border-b border-[#c6d7f2]">
              System Tasks
            </div>
            <div className="p-2 space-y-1.5 text-[#0c327d]">
              <div className="flex items-center gap-1.5 hover:underline cursor-pointer">
                <Monitor className="w-3.5 h-3.5 text-blue-600" />
                <span>View system info</span>
              </div>
              <div className="flex items-center gap-1.5 hover:underline cursor-pointer">
                <Search className="w-3.5 h-3.5 text-amber-600" />
                <span>Search files</span>
              </div>
            </div>
          </div>

          {/* Other Places Box */}
          <div className="rounded-t bg-white overflow-hidden shadow">
            <div className="px-2 py-1 font-bold text-[#0c327d] bg-gradient-to-r from-white to-[#c6d7f2] border-b border-[#c6d7f2]">
              Other Places
            </div>
            <div className="p-2 space-y-1.5 text-[#0c327d]">
              <div
                onClick={() => navigateTo([])}
                className="flex items-center gap-1.5 hover:underline cursor-pointer"
              >
                <Monitor className="w-3.5 h-3.5 text-blue-600" />
                <span>My Computer</span>
              </div>
              <div
                onClick={() => navigateTo(['F:'])}
                className="flex items-center gap-1.5 hover:underline cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-amber-600" />
                <span>My Pictures</span>
              </div>
              <div
                onClick={() => navigateTo(['D:'])}
                className="flex items-center gap-1.5 hover:underline cursor-pointer"
              >
                <Film className="w-3.5 h-3.5 text-blue-600" />
                <span>My Videos</span>
              </div>
            </div>
          </div>

          {/* Details Box */}
          <div className="rounded-t bg-white overflow-hidden shadow">
            <div className="px-2 py-1 font-bold text-[#0c327d] bg-gradient-to-r from-white to-[#c6d7f2] border-b border-[#c6d7f2]">
              Details
            </div>
            <div className="p-2 text-neutral-700 space-y-1">
              <div className="font-bold text-[#0c327d]">
                {currentPath.length === 0
                  ? 'My Computer'
                  : currentPath.length === 1
                  ? drives.find((d) => d.id === currentPath[0])?.name
                  : currentPath[1]}
              </div>
              <div className="text-[11px] text-neutral-500">
                {currentPath.length === 0
                  ? 'System Folder'
                  : currentPath.length === 1
                  ? `Drive ${currentPath[0]}`
                  : `${activeFiles.length} item(s)`}
              </div>
            </div>
          </div>
        </div>

        {/* Right Content View Area */}
        <div className="flex-1 p-4 overflow-y-auto bg-white">
          {/* LEVEL 1: MY COMPUTER (DRIVES OVERVIEW) */}
          {currentPath.length === 0 && (
            <div className="space-y-6">
              <div>
                <div className="text-xs font-bold text-[#003399] border-b border-[#003399]/30 pb-1 mb-3">
                  Hard Disk Drives
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                  {drives.map((d) => (
                    <div
                      key={d.id}
                      onClick={() => navigateTo([d.id])}
                      className="flex items-center gap-3 p-2.5 rounded-sm hover:bg-[#e0eaf8] cursor-pointer border border-transparent hover:border-[#b6d3f2] group transition-all"
                    >
                      <div className="flex-shrink-0 group-hover:scale-105 transition-transform">
                        {d.icon}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-neutral-900 truncate">
                          {d.name}
                        </div>
                        <div className="text-[11px] text-neutral-500">
                          {d.label} • {d.freeSpace}
                        </div>
                        {/* Capacity bar */}
                        <div className="w-full h-2 bg-neutral-200 rounded-full mt-1.5 overflow-hidden border border-neutral-300">
                          <div className="h-full bg-blue-500 rounded-full w-2/3" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* LEVEL 2: INSIDE A DRIVE (SUBFOLDERS OVERVIEW) */}
          {currentPath.length === 1 && (
            <div>
              <div className="text-xs font-bold text-[#003399] border-b border-[#003399]/30 pb-1 mb-3">
                Folders in {drives.find((d) => d.id === currentPath[0])?.name}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {subfolders.map((f) => (
                  <div
                    key={f.name}
                    onClick={() => navigateTo([currentPath[0], f.name])}
                    className="flex flex-col items-center p-3 rounded hover:bg-[#e0eaf8] cursor-pointer border border-transparent hover:border-[#b6d3f2] group text-center transition-all"
                  >
                    <Folder className="w-12 h-12 text-amber-500 fill-amber-400 drop-shadow group-hover:scale-105 transition-transform" />
                    <span className="text-xs font-medium text-neutral-800 mt-1 truncate max-w-full">
                      {f.name}
                    </span>
                    <span className="text-[10px] text-neutral-500">
                      {f.count} items
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LEVEL 3: INSIDE A SUBFOLDER (FILES LIST WITH THUMBNAILS) */}
          {currentPath.length >= 2 && (
            <div>
              <div className="flex items-center justify-between text-xs font-bold text-[#003399] border-b border-[#003399]/30 pb-1 mb-3">
                <span>{currentPath[1]} ({activeFiles.length} files)</span>
                <span className="text-[11px] text-neutral-500 font-normal">
                  Showing newest uploads first
                </span>
              </div>

              {activeFiles.length === 0 ? (
                <div className="p-8 text-center text-neutral-400 text-xs">
                  This folder is empty.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {activeFiles.map((file, idx) => {
                    const thumbUrl = file.thumbnail || file.poster || file.url;
                    return (
                      <div
                        key={file.id || idx}
                        onClick={() => handleFileClick(file, idx)}
                        className="flex flex-col items-center p-2 rounded hover:bg-[#e0eaf8] cursor-pointer border border-transparent hover:border-[#b6d3f2] group transition-all"
                      >
                        {/* Media Thumbnail */}
                        <div className="w-full aspect-square rounded overflow-hidden bg-neutral-100 border border-neutral-300 relative group-hover:shadow transition-shadow">
                          {thumbUrl ? (
                            <img
                              src={thumbUrl}
                              alt={file.title || file.name}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-neutral-400">
                              <FileText className="w-8 h-8" />
                            </div>
                          )}
                          {/* Type badge */}
                          {file.mediaType === 'short' && (
                            <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-emerald-600 text-white text-[9px] font-bold">
                              SHORT
                            </span>
                          )}
                          {(file.type === 'video' || file.mediaType === 'clip') && (
                            <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-blue-600 text-white text-[9px] font-bold">
                              VIDEO
                            </span>
                          )}
                        </div>

                        {/* File Name */}
                        <span className="text-xs font-medium text-neutral-800 mt-1.5 truncate max-w-full text-center">
                          {file.title || file.name}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. XP Status Bar */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center justify-between px-3 py-0.5 bg-[#ece9d8] border-t border-[#d8d4c4] text-[11px] text-neutral-600">
        <span>
          {currentPath.length === 0
            ? '4 object(s)'
            : currentPath.length === 1
            ? `${subfolders.length} folder(s)`
            : `${activeFiles.length} object(s)`}
        </span>
        <span>My Computer</span>
      </div>
    </div>
  );
};
