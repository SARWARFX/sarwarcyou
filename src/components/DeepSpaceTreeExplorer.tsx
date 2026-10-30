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

function getFolderSegments(item: StageMediaItem): { root: string; subfolders: string[] } {
  const raw = item.path || item.parentAlbum || item.category || '';
  let clean = raw.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (clean.includes('://')) {
    clean = clean.split('://')[1].split('/').slice(1).join('/');
  }
  const parts = clean.split('/').map((s) => s.trim()).filter(Boolean);

  // If the last part has a media extension, strip it to only keep folder segments
  const hasExt = parts.length > 0 && /\.[a-z0-9]{2,5}$/i.test(parts[parts.length - 1]);
  const dirParts = hasExt ? parts.slice(0, -1) : parts;

  let root = dirParts.length > 0 ? dirParts[0] : '';
  let sub = dirParts.slice(1);

  // Normalize canonical top-level folder names
  if (/^(?:video\s*clips|clips)$/i.test(root)) {
    root = 'Clips';
  } else if (/^(?:photographs|images)$/i.test(root)) {
    root = 'Images';
  } else if (/^shorts$/i.test(root)) {
    root = 'Shorts';
  } else if (/^realtube$/i.test(root)) {
    root = 'REALTube';
  } else {
    // Infer canonical root from media metadata if missing from path
    if (item.mediaType === 'short' || item.category?.toLowerCase().includes('short') || item.url?.toLowerCase().includes('short')) {
      root = 'Shorts';
      sub = dirParts.length > 0 ? dirParts : ['Shorts Classic'];
    } else if (item.type === 'image' || isPhotoExtension(item.url || item.name)) {
      root = 'Images';
      sub = dirParts.length > 0 ? dirParts : ['H2025'];
    } else {
      root = 'Clips';
      sub = dirParts.length > 0 ? dirParts : ['Favorite'];
    }
  }

  // Ensure subfolder is never empty so every media file lives inside an actual subfolder
  if (sub.length === 0) {
    if (root === 'Shorts') sub = ['Shorts Classic'];
    else if (root === 'REALTube') sub = ['REALTube Shorts'];
    else if (root === 'Images') sub = ['H2025'];
    else sub = ['Favorite'];
  }

  return { root, subfolders: sub };
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
      const { root, subfolders } = getFolderSegments(item);
      if (!root) continue;

      if (!map.has(root)) {
        map.set(root, {
          name: root,
          fullPath: root,
          subfolders: new Map(),
          files: [],
        });
      }

      const rootNode = map.get(root)!;
      let currentMap = rootNode.subfolders;
      let currentNode: DirectoryNode = rootNode;
      let accumulatedPath = root;

      for (const seg of subfolders) {
        accumulatedPath = `${accumulatedPath}/${seg}`;
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

      currentNode.files.push(item);
    }

    return map;
  }, [items]);

  // Order root folders logically: Clips, Shorts, Images, REALTube
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

  // Active path selection chain (starts completely empty [] on root homepage)
  const [selectedPath, setSelectedPath] = useState<string[]>([]);

  // Deep-linking: Only expand path if an explicit album parameter was provided in the URL
  useEffect(() => {
    if (!initialAlbum || rootFolders.length === 0 || selectedPath.length > 0) return;

    const cleanTarget = initialAlbum.toLowerCase().replace(/[-_]+/g, ' ').trim();
    for (const root of rootFolders) {
      if (root.name.toLowerCase() === cleanTarget) {
        setSelectedPath([root.name]);
        return;
      }
      for (const sub of root.subfolders.values()) {
        const subClean = sub.name.toLowerCase().replace(/[-_]+/g, ' ').trim();
        if (subClean === cleanTarget) {
          setSelectedPath([root.name, sub.name]);
          return;
        }
      }
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

  // The active leaf folder node (only active when user has drilled down into an actual media folder)
  const activeLeafNode = useMemo(() => {
    if (selectedNodeChain.length < 2) return null;
    const leaf = selectedNodeChain[selectedNodeChain.length - 1];
    return leaf && leaf.files.length > 0 ? leaf : null;
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

  // Handler to toggle or select root folder (Depth 0)
  const handleSelectRoot = (rootName: string) => {
    if (selectedPath[0] === rootName) {
      // Toggle off to return to clean root homepage
      setSelectedPath([]);
    } else {
      setSelectedPath([rootName]);
    }
  };

  // Handler to toggle or select subfolder (Depth 1)
  const handleSelectSubfolder = (subfolderName: string) => {
    const rootName = selectedPath[0];
    if (!rootName) return;

    if (selectedPath[1] === subfolderName) {
      // Toggle off subfolder, stay on root folder
      setSelectedPath([rootName]);
    } else {
      setSelectedPath([rootName, subfolderName]);
    }
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
              onClick={() => handleSelectRoot(node.name)}
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

      {/* COLUMN 1: Subfolders in Horizontal Tree Column Layout (Only visible when a root folder is clicked) */}
      {selectedPath[0] && rootMap.get(selectedPath[0]) && (
        <div className="flex-shrink-0 flex flex-col min-w-[140px] sm:min-w-[180px] md:min-w-[210px] max-w-[260px] h-full overflow-y-auto no-scrollbar gap-4 py-4">
          {Array.from(rootMap.get(selectedPath[0])!.subfolders.values()).map((subNode) => {
            const isSubActive = selectedPath[1] === subNode.name;
            return (
              <button
                key={subNode.name}
                type="button"
                onClick={() => handleSelectSubfolder(subNode.name)}
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
      )}

      {/* COLUMN 2: Files in the Active Leaf Folder (ONLY visible when user drills down into an actual media folder) */}
      {activeLeafNode && (
        <div className="flex-shrink-0 md:flex-1 min-w-[280px] sm:min-w-[340px] md:min-w-[420px] h-full overflow-y-auto no-scrollbar py-4 pl-2 pr-6 flex flex-col gap-6">
          {/* Photos: Floating transparent grid directly over galaxy background */}
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

          {/* Videos: Listed as underlined titles */}
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

          {/* Shorts: Listed as underlined titles */}
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
