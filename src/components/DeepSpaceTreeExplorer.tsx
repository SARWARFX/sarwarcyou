import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Play, Film } from 'lucide-react';
import type { StageMediaItem } from '../types';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';
import { isPhotoExtension, isVideoExtension } from '../utils/mediaTypeDetector';
import { getMediaUrl } from '../utils/imageUrlResolver';
import { getCachedVideoThumbnail, generateVideoThumbnail } from '../utils/videoThumbnailGenerator';

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

/**
 * 9:16 Vertical Card for Shorts directory items
 */
const ShortCardItem: React.FC<{
  short: StageMediaItem;
  allShorts: StageMediaItem[];
  index: number;
  onOpenShort: (item: StageMediaItem, shorts: StageMediaItem[], index: number) => void;
  folderName: string;
}> = ({ short, allShorts, index, onOpenShort, folderName }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isInViewport, setIsInViewport] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const cleanTitle = sanitizeMediaTitle(short.title || short.name, folderName);
  const streamUrl = getMediaUrl(short.url || short.path || short.id);

  const staticPoster =
    short.posterUrl ||
    short.poster ||
    short.thumbnails?.[0] ||
    short.thumbnail;

  const posterSrc = staticPoster && !isVideoExtension(staticPoster) ? getMediaUrl(staticPoster) : null;

  const [videoThumb, setVideoThumb] = useState<string | null>(() => {
    return !posterSrc ? getCachedVideoThumbnail(streamUrl) : null;
  });

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting);
      },
      { rootMargin: '250px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (posterSrc || !isInViewport) return;

    const cached = getCachedVideoThumbnail(streamUrl);
    if (cached) {
      setVideoThumb(cached);
      return;
    }

    let isSubscribed = true;
    generateVideoThumbnail(streamUrl, '9/16').then((dataUrl) => {
      if (isSubscribed && dataUrl) {
        setVideoThumb(dataUrl);
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, [posterSrc, streamUrl, isInViewport]);

  const displayImage = posterSrc || videoThumb;

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      onClick={() => onOpenShort(short, allShorts, index)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenShort(short, allShorts, index);
        }
      }}
      aria-label={`Play short: ${cleanTitle}`}
      className="group flex flex-col gap-2 cursor-pointer select-none text-left transition-all duration-300 transform hover:-translate-y-1"
    >
      {/* 9:16 Vertical Poster Container */}
      <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-transparent border border-white/20 group-hover:border-[#00f0ff] shadow-none group-hover:shadow-[0_0_20px_rgba(0,240,255,0.45)] transition-all duration-300">
        {displayImage ? (
          <img
            src={displayImage}
            alt={cleanTitle}
            loading="lazy"
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            className={`w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div className="w-full h-full bg-white/[0.04] backdrop-blur-[2px] flex items-center justify-center">
            <Play className="w-6 h-6 text-white/30 ml-0.5" />
          </div>
        )}

        {/* Play Icon Badge / Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="w-10 h-10 rounded-full bg-[#00f0ff]/90 text-black flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.8)]">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        </div>
      </div>

      {/* Title beneath the thumbnail with high-contrast text shadow */}
      <span
        className="text-xs sm:text-sm font-mono text-white/95 line-clamp-2 leading-snug group-hover:text-[#00f0ff] transition-colors"
        style={{
          textShadow: '0 1px 4px #000, 0 0 8px #000',
        }}
      >
        {cleanTitle}
      </span>
    </div>
  );
};

/**
 * 16:9 Landscape Card for Video & Clip directory items
 */
const VideoCardItem: React.FC<{
  video: StageMediaItem;
  allVideos: StageMediaItem[];
  onOpenVideo: (item: StageMediaItem, playlist: StageMediaItem[]) => void;
  folderName: string;
}> = ({ video, allVideos, onOpenVideo, folderName }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimerRef = useRef<number | null>(null);

  const [isInViewport, setIsInViewport] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoDuration, setVideoDuration] = useState<string | null>(null);

  const cleanTitle = sanitizeMediaTitle(video.title || video.name, folderName);
  const streamUrl = getMediaUrl(video.url || video.path || video.id);

  const staticPoster =
    video.posterUrl ||
    video.poster ||
    video.thumbnails?.[0] ||
    video.thumbnail;

  const posterSrc = staticPoster && !isVideoExtension(staticPoster) ? getMediaUrl(staticPoster) : null;

  const [videoThumb, setVideoThumb] = useState<string | null>(() => {
    return !posterSrc ? getCachedVideoThumbnail(streamUrl) : null;
  });

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting);
      },
      { rootMargin: '250px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (posterSrc || !isInViewport) return;

    const cached = getCachedVideoThumbnail(streamUrl);
    if (cached) {
      setVideoThumb(cached);
      return;
    }

    let isSubscribed = true;
    generateVideoThumbnail(streamUrl, '16/9').then((dataUrl) => {
      if (isSubscribed && dataUrl) {
        setVideoThumb(dataUrl);
      }
    });

    return () => {
      isSubscribed = false;
    };
  }, [posterSrc, streamUrl, isInViewport]);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      setIsPreviewActive(true);
    }, 500); // 500ms hover intent
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsPreviewActive(false);
    setVideoLoaded(false);
  };

  const displayImage = posterSrc || videoThumb;

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      onClick={() => onOpenVideo(video, allVideos)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenVideo(video, allVideos);
        }
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label={`Watch video: ${cleanTitle}`}
      className="group flex flex-col gap-2 cursor-pointer select-none text-left transition-all duration-300 transform hover:-translate-y-1"
    >
      {/* 16:9 Widescreen Frame */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-transparent border border-white/20 group-hover:border-[#00f0ff] shadow-none group-hover:shadow-[0_0_20px_rgba(0,240,255,0.45)] transition-all duration-300">
        {/* High-res Poster / Thumbnail */}
        {displayImage ? (
          <img
            src={displayImage}
            alt={cleanTitle}
            loading="lazy"
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            className={`w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            } ${isPreviewActive && videoLoaded ? 'opacity-0' : 'opacity-100'}`}
          />
        ) : (
          <div className="w-full h-full bg-white/[0.04] backdrop-blur-[2px] flex items-center justify-center">
            <Film className="w-7 h-7 text-white/30" />
          </div>
        )}

        {/* Desktop Video Preview (Mounted on >500ms hover) */}
        {isPreviewActive && streamUrl && (
          <video
            ref={videoRef}
            src={streamUrl}
            autoPlay
            muted
            loop
            playsInline
            crossOrigin="anonymous"
            onLoadedMetadata={(e) => {
              const dur = e.currentTarget.duration;
              if (dur && isFinite(dur)) {
                const m = Math.floor(dur / 60);
                const s = Math.floor(dur % 60);
                setVideoDuration(`${m}:${s < 10 ? '0' : ''}${s}`);
              }
            }}
            onLoadedData={() => setVideoLoaded(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              videoLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Duration / HD Badge */}
        <div className="absolute bottom-2 right-2 z-10 flex items-center gap-1 pointer-events-none">
          <span className="px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-md text-[10px] sm:text-[11px] font-mono font-medium text-white border border-white/10 shadow">
            {videoDuration || 'HD'}
          </span>
        </div>

        {/* Play Pulse Overlay on Hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="w-11 h-11 rounded-full bg-[#00f0ff]/90 text-black flex items-center justify-center shadow-[0_0_18px_rgba(0,240,255,0.8)] transform scale-90 group-hover:scale-100 transition-transform">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        </div>
      </div>

      {/* Title with high-contrast text shadow */}
      <span
        className="text-xs sm:text-sm font-mono text-white/95 line-clamp-2 leading-snug group-hover:text-[#00f0ff] transition-colors"
        style={{
          textShadow: '0 1px 4px #000, 0 0 8px #000',
        }}
      >
        {cleanTitle}
      </span>
    </div>
  );
};

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

    const isShortDir =
      activeLeafNode.fullPath.toLowerCase().includes('short') ||
      selectedPath.some((p) => p.toLowerCase().includes('short'));

    for (const file of activeLeafNode.files) {
      const isPhoto = file.type === 'image' || isPhotoExtension(file.path || file.url || file.name || '');
      if (isPhoto) {
        photos.push(file);
      } else {
        const isShort =
          isShortDir ||
          file.mediaType === 'short' ||
          file.path?.toLowerCase().includes('short') ||
          file.url?.toLowerCase().includes('short') ||
          file.category?.toLowerCase().includes('short');

        if (isShort) {
          shorts.push(file);
        } else {
          videos.push(file);
        }
      }
    }

    return { photoFiles: photos, videoFiles: videos, shortFiles: shorts };
  }, [activeLeafNode, selectedPath]);

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
    <div className="w-full h-[100dvh] overflow-x-auto overflow-y-hidden flex flex-row items-stretch p-6 sm:p-10 md:p-14 gap-6 sm:gap-10 md:gap-12 no-scrollbar select-none">
      {/* COLUMN 0: Root Folders (Clean Text with Subtle Underline, NO Icons) */}
      <div className="flex-shrink-0 flex flex-col min-w-[130px] sm:min-w-[160px] md:min-w-[190px] max-w-[240px] h-full overflow-y-auto space-scrollbar gap-5 py-4">
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
        <div className="flex-shrink-0 flex flex-col min-w-[130px] sm:min-w-[160px] md:min-w-[190px] max-w-[240px] h-full overflow-y-auto space-scrollbar gap-4 py-4">
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

      {/* COLUMN 2 (Column 3 in Explorer): Files in the Active Leaf Folder (ONLY visible when user drills down into an actual media folder) */}
      {activeLeafNode && (
        <div className="flex-1 min-w-[300px] sm:min-w-[420px] md:min-w-[540px] h-full overflow-y-auto space-scrollbar py-4 pl-2 pr-4 sm:pr-8 flex flex-col gap-6">
          {/* 1. Photos: Floating transparent grid directly over galaxy background */}
          {photoFiles.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 p-1">
              {photoFiles.map((photo, idx) => (
                <div
                  key={photo.id || idx}
                  onClick={() => onOpenPhoto(photo, photoFiles, idx)}
                  className="relative aspect-square cursor-pointer overflow-hidden rounded-xl group bg-transparent border border-white/15 hover:border-[#00f0ff] p-0 shadow-none hover:shadow-[0_0_20px_rgba(0,240,255,0.45)] transition-all duration-300 transform hover:scale-[1.03]"
                >
                  <img
                    src={getMediaUrl(photo.url)}
                    alt={photo.title || photo.name || 'Photo'}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover rounded-xl transition-all duration-300 group-hover:brightness-110"
                  />
                </div>
              ))}
            </div>
          )}

          {/* 2. Videos: 16:9 Landscape Widescreen Cards Grid */}
          {videoFiles.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 p-1">
              {videoFiles.map((video) => (
                <VideoCardItem
                  key={video.id || video.url}
                  video={video}
                  allVideos={videoFiles}
                  onOpenVideo={onOpenVideo}
                  folderName={activeLeafNode.name}
                />
              ))}
            </div>
          )}

          {/* 3. Shorts: 9:16 Vertical Cards Grid */}
          {shortFiles.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 p-1">
              {shortFiles.map((short, idx) => (
                <ShortCardItem
                  key={short.id || short.url}
                  short={short}
                  allShorts={shortFiles}
                  index={idx}
                  onOpenShort={onOpenShort}
                  folderName={activeLeafNode.name}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DeepSpaceTreeExplorer;
