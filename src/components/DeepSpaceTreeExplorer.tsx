import React, { useState, useMemo, useEffect } from 'react';
import type { StageMediaItem } from '../types';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';
import { isPhotoExtension } from '../utils/mediaTypeDetector';
import { getMediaUrl } from '../utils/imageUrlResolver';

export interface DeepSpaceTreeExplorerProps {
  items: StageMediaItem[];
  onOpenPhoto: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo: (item: StageMediaItem, playlist: StageMediaItem[]) => void;
  onOpenShort: (item: StageMediaItem, shorts: StageMediaItem[], index: number) => void;
  initialAlbum?: string;
}

export interface DirectoryNode {
  name: string;
  fullPath: string;
  subfolders: Map<string, DirectoryNode>;
  files: StageMediaItem[];
}

export const DeepSpaceTreeExplorer: React.FC<DeepSpaceTreeExplorerProps> = ({
  items,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
  initialAlbum,
}) => {
  // Build the hierarchical tree directly from in-memory catalog items
  const rootMap = useMemo(() => {
    const map = new Map<string, DirectoryNode>();

    for (const item of items) {
      const rawPath = (item.path || item.name || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
      if (!rawPath) continue;

      const parts = rawPath.split('/').map((s) => s.trim()).filter(Boolean);
      if (parts.length === 0) continue;

      const folderParts = parts.length > 1 ? parts.slice(0, -1) : ['Root'];
      let currentMap = map;
      let currentNode: DirectoryNode | null = null;
      let accumulatedPath = '';

      for (const seg of folderParts) {
        accumulatedPath = accumulatedPath ? `${accumulatedPath}/${seg}` : seg;
        if (!currentMap.has(seg)) {
          currentMap.set(seg, {
            name: seg,
            fullPath: accumulatedPath,
            subfolders: new Map(),
            files: [],
          });
        }
        currentNode = currentMap.get(seg)!;
        currentMap = currentNode.subfolders;
      }

      if (currentNode) {
        currentNode.files.push(item);
      }
    }

    return map;
  }, [items]);

  // Order root folders logically: Clips, Shorts, Images, REALTube, etc.
  const rootFolders = useMemo(() => {
    const list = Array.from(rootMap.values());
    const preferredOrder = ['clips', 'shorts', 'images', 'realtube'];
    return list.sort((a, b) => {
      const idxA = preferredOrder.indexOf(a.name.toLowerCase());
      const idxB = preferredOrder.indexOf(b.name.toLowerCase());
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [rootMap]);

  // Active path selection chain (e.g. ['Clips', 'Favorite'])
  const [selectedPath, setSelectedPath] = useState<string[]>([]);

  // Automatically select initial or first root folder and subfolder on load
  useEffect(() => {
    if (rootFolders.length === 0 || selectedPath.length > 0) return;

    if (initialAlbum) {
      const cleanTarget = initialAlbum.toLowerCase().replace(/[-_]+/g, ' ').trim();
      // Look for a matching subfolder first
      for (const root of rootFolders) {
        if (root.name.toLowerCase() === cleanTarget) {
          const firstSub = Array.from(root.subfolders.values())[0];
          setSelectedPath(firstSub ? [root.name, firstSub.name] : [root.name]);
          return;
        }
        for (const sub of root.subfolders.values()) {
          if (sub.name.toLowerCase() === cleanTarget || sub.name.toLowerCase().replace(/[-_]+/g, ' ').trim() === cleanTarget) {
            setSelectedPath([root.name, sub.name]);
            return;
          }
        }
      }
    }

    // Default to first root folder and its first subfolder
    const firstRoot = rootFolders[0];
    const firstSub = Array.from(firstRoot.subfolders.values())[0];
    if (firstSub) {
      setSelectedPath([firstRoot.name, firstSub.name]);
    } else {
      setSelectedPath([firstRoot.name]);
    }
  }, [rootFolders, selectedPath.length, initialAlbum]);

  // Compute the chain of selected directory nodes
  const selectedNodeChain = useMemo(() => {
    const chain: DirectoryNode[] = [];
    let currentMap = rootMap;

    for (const segment of selectedPath) {
      const node = currentMap.get(segment);
      if (!node) break;
      chain.push(node);
      currentMap = node.subfolders;
    }

    return chain;
  }, [rootMap, selectedPath]);

  // The active leaf folder node that contains the files to display
  const activeLeafNode = useMemo(() => {
    if (selectedNodeChain.length === 0) return null;
    return selectedNodeChain[selectedNodeChain.length - 1];
  }, [selectedNodeChain]);

  // Categorize leaf files
  const { photoFiles, videoFiles, shortFiles } = useMemo(() => {
    if (!activeLeafNode) return { photoFiles: [], videoFiles: [], shortFiles: [] };

    const photos: StageMediaItem[] = [];
    const videos: StageMediaItem[] = [];
    const shorts: StageMediaItem[] = [];

    for (const file of activeLeafNode.files) {
      const isPhoto = file.type === 'image' || isPhotoExtension(file.path || file.url || file.name || '');
      if (isPhoto) {
        photos.push(file);
      } else {
        const isShort = file.mediaType === 'short' || file.path?.toLowerCase().includes('short');
        if (isShort) {
          shorts.push(file);
        } else {
          videos.push(file);
        }
      }
    }

    return { photoFiles: photos, videoFiles: videos, shortFiles: shorts };
  }, [activeLeafNode]);

  // Handler to select folder at depth N
  const handleSelectFolderAtDepth = (depth: number, folderName: string) => {
    if (selectedPath[depth] === folderName) {
      return;
    }

    const newPath = [...selectedPath.slice(0, depth), folderName];

    // Traverse down to check if this folder has subfolders, and auto-select the first subfolder if available
    let currentMap = rootMap;
    let node: DirectoryNode | undefined;
    for (const seg of newPath) {
      node = currentMap.get(seg);
      if (!node) break;
      currentMap = node.subfolders;
    }

    if (node && node.subfolders.size > 0 && node.files.length === 0) {
      const firstSub = Array.from(node.subfolders.values())[0];
      if (firstSub) {
        newPath.push(firstSub.name);
      }
    }

    setSelectedPath(newPath);
  };

  return (
    <div className="w-full h-[100dvh] overflow-x-auto overflow-y-hidden flex flex-row items-stretch p-6 sm:p-10 md:p-16 gap-8 sm:gap-12 md:gap-16 no-scrollbar select-none">
      {/* COLUMN 0: Root Folders (Clean Text with Subtle Underline, NO Icons) */}
      <div className="flex-shrink-0 flex flex-col min-w-[140px] sm:min-w-[180px] md:min-w-[210px] max-w-[260px] h-full overflow-y-auto no-scrollbar gap-5 py-4">
        {rootFolders.map((node) => {
          const isActive = selectedPath[0] === node.name;
          return (
            <button
              key={node.name}
              type="button"
              onClick={() => handleSelectFolderAtDepth(0, node.name)}
              className={`text-left text-base sm:text-lg md:text-xl font-mono tracking-wider transition-all duration-300 cursor-pointer pb-1.5 w-fit border-b-[1.5px] ${
                isActive
                  ? 'text-[#00f0ff] font-bold border-[#00f0ff] shadow-[0_2px_10px_rgba(0,240,255,0.4)] [text-shadow:0_0_15px_rgba(0,240,255,0.8)]'
                  : 'text-white/80 border-white/40 hover:text-[#00f0ff] hover:border-[#00f0ff] hover:shadow-[0_2px_8px_rgba(0,240,255,0.35)] hover:[text-shadow:0_0_12px_rgba(0,240,255,0.7)]'
              }`}
            >
              {node.name}
            </button>
          );
        })}
      </div>

      {/* COLUMNS 1..N: Subfolders in Horizontal Tree Column Layout */}
      {selectedNodeChain.map((parentNode, depth) => {
        const subfolderList = Array.from(parentNode.subfolders.values());
        if (subfolderList.length === 0) return null;

        const nextSelectedName = selectedPath[depth + 1];

        return (
          <div
            key={parentNode.fullPath}
            className="flex-shrink-0 flex flex-col min-w-[140px] sm:min-w-[180px] md:min-w-[210px] max-w-[260px] h-full overflow-y-auto no-scrollbar gap-4 py-4"
          >
            {subfolderList.map((subNode) => {
              const isSubActive = nextSelectedName === subNode.name;
              return (
                <button
                  key={subNode.name}
                  type="button"
                  onClick={() => handleSelectFolderAtDepth(depth + 1, subNode.name)}
                  className={`text-left text-sm sm:text-base md:text-lg font-mono tracking-wide transition-all duration-300 cursor-pointer pb-1 w-fit border-b-[1.5px] ${
                    isSubActive
                      ? 'text-[#00f0ff] font-bold border-[#00f0ff] shadow-[0_2px_8px_rgba(0,240,255,0.35)] [text-shadow:0_0_12px_rgba(0,240,255,0.75)]'
                      : 'text-white/80 border-white/40 hover:text-[#00f0ff] hover:border-[#00f0ff] hover:shadow-[0_2px_8px_rgba(0,240,255,0.35)] hover:[text-shadow:0_0_12px_rgba(0,240,255,0.7)]'
                  }`}
                >
                  {subNode.name}
                </button>
              );
            })}
          </div>
        );
      })}

      {/* FINAL COLUMN: Files in the Active Leaf Folder */}
      {activeLeafNode && activeLeafNode.files.length > 0 && (
        <div className="flex-shrink-0 md:flex-1 min-w-[280px] sm:min-w-[340px] md:min-w-[420px] h-full overflow-y-auto no-scrollbar py-4 pl-2 pr-6 flex flex-col gap-6">
          {/* 1. Photos Transparent Grid Directly Over Galaxy Background */}
          {photoFiles.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 p-1">
              {photoFiles.map((photo, idx) => (
                <div
                  key={photo.id || idx}
                  onClick={() => onOpenPhoto(photo, photoFiles, idx)}
                  className="relative aspect-square cursor-pointer overflow-hidden rounded group bg-transparent border-0 p-0 shadow-none transition-transform duration-300 hover:scale-[1.03]"
                >
                  <img
                    src={getMediaUrl(photo.url)}
                    alt={photo.title || photo.name || 'Photo'}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover rounded transition-all duration-300 group-hover:brightness-110 group-hover:shadow-[0_0_20px_rgba(0,240,255,0.5)]"
                  />
                </div>
              ))}
            </div>
          )}

          {/* 2. Videos Listed as Underlined Titles */}
          {videoFiles.length > 0 && (
            <div className="flex flex-col gap-3 py-1">
              {videoFiles.map((video) => (
                <button
                  key={video.id}
                  type="button"
                  onClick={() => onOpenVideo(video, videoFiles)}
                  className="text-left text-sm sm:text-base font-mono pb-1 w-fit transition-all duration-300 cursor-pointer border-b-[1.5px] border-white/30 text-white/85 hover:text-[#00f0ff] hover:border-[#00f0ff] hover:shadow-[0_2px_8px_rgba(0,240,255,0.35)] hover:[text-shadow:0_0_12px_rgba(0,240,255,0.7)]"
                >
                  {sanitizeMediaTitle(video.title || video.name, activeLeafNode.name)}
                </button>
              ))}
            </div>
          )}

          {/* 3. Shorts Listed as Underlined Titles */}
          {shortFiles.length > 0 && (
            <div className="flex flex-col gap-3 py-1">
              {shortFiles.map((short, idx) => (
                <button
                  key={short.id}
                  type="button"
                  onClick={() => onOpenShort(short, shortFiles, idx)}
                  className="text-left text-sm sm:text-base font-mono pb-1 w-fit transition-all duration-300 cursor-pointer border-b-[1.5px] border-white/30 text-white/85 hover:text-[#00f0ff] hover:border-[#00f0ff] hover:shadow-[0_2px_8px_rgba(0,240,255,0.35)] hover:[text-shadow:0_0_12px_rgba(0,240,255,0.7)]"
                >
                  {sanitizeMediaTitle(short.title || short.name, activeLeafNode.name)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DeepSpaceTreeExplorer;
