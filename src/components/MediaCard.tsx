import React, { useState, useMemo } from 'react';
import { Play } from 'lucide-react';
import { getDirectImageUrl } from '../utils/imageUrlResolver';
import { prewarmVideoStream, getCachedVideoPoster } from '../utils/videoPosterGenerator';
import { useVideoThumbnail, getCachedThumbnailSync } from '../utils/clientVideoThumbnails';
import {
  resolveMultiFrameThumbnails,
  resolveMultiFrameThumbnailsExt,
  useHoverThumbnailScrub,
} from '../utils/thumbnailResolver';
import type { AlbumData, StageMediaItem } from '../types';

export interface MediaCardProps {
  item: StageMediaItem;
  idx: number;
  album: AlbumData;
  variant?: string;
  heightClass?: string;
  staggeredOffset?: string;
  diptychMargin?: string;
  isHovered: boolean;
  onHover: (idx: number | null) => void;
  onSelectItem: (item: StageMediaItem, posterUrl?: string) => void;
  onActiveIndexChange?: (index: number) => void;
  updateMaxScroll?: () => void;
  hasDragged?: () => boolean;
}

export const MediaCard: React.FC<MediaCardProps> = ({
  item,
  idx,
  album,
  variant = 'filmstrip',
  heightClass = 'h-[36vh] sm:h-[42vh] md:h-[46vh]',
  staggeredOffset = '',
  diptychMargin = '',
  isHovered,
  onHover,
  onSelectItem,
  onActiveIndexChange,
  updateMaxScroll,
  hasDragged,
}) => {
  const isVideo = item.type === 'video';
  const isShort =
    variant === 'shorts' ||
    album.name.toLowerCase().includes('short') ||
    album.name.toLowerCase().includes('reel');

  const [useExtFallback, setUseExtFallback] = useState(false);
  const [remoteImageFailed, setRemoteImageFailed] = useState(false);
  const [staticFallbackFailed, setStaticFallbackFailed] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // 1. Resolve Multi-Frame WebP thumbnails (stem vs extension)
  const primaryThumbnails = useMemo(() => {
    return isVideo ? resolveMultiFrameThumbnails(item) : [];
  }, [isVideo, item]);

  const extThumbnails = useMemo(() => {
    return isVideo ? resolveMultiFrameThumbnailsExt(item) : [];
  }, [isVideo, item]);

  const activeThumbList = useExtFallback ? extThumbnails : primaryThumbnails;

  // 2. Client-side Canvas/IndexedDB thumbnail fallback if remote WebP isn't ready
  const { thumbnail: clientThumbnail } = useVideoThumbnail(
    isVideo ? item.url : undefined,
    isShort
  );

  const directImgUrl = getDirectImageUrl(item, idx);
  const staticFallbackThumbnail = isVideo
    ? clientThumbnail || getCachedThumbnailSync(item.url) || getCachedVideoPoster(item.url) || item.thumbnail
    : directImgUrl;

  // 3. YouTube-style Hover Scrubbing hook
  const {
    activeThumbnail: scrubThumbnail,
    activeFrameIndex,
    isScrubbing,
    totalFrames,
  } = useHoverThumbnailScrub({
    thumbnails: activeThumbList,
    defaultThumbnail: staticFallbackThumbnail,
    isHovered,
    intervalMs: 380,
    enabled: isVideo && activeThumbList.length > 0 && !remoteImageFailed,
  });

  // Active display thumbnail: prioritize scrubbed WebP frame; fall back to client thumbnail
  let activeThumbnail: string | null = null;
  if (!remoteImageFailed && scrubThumbnail) {
    activeThumbnail = scrubThumbnail;
  } else if (!staticFallbackFailed && staticFallbackThumbnail) {
    activeThumbnail = staticFallbackThumbnail;
  }

  const cleanCardTitle = (item.title || album.name)
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  const badgeLabel = isVideo ? (isShort ? 'SHORT' : 'VIDEO') : 'PHOTO';

  return (
    <div
      onMouseEnter={() => {
        onHover(idx);
        if (isVideo) prewarmVideoStream(item.url);
      }}
      onTouchStart={() => {
        if (isVideo) prewarmVideoStream(item.url);
      }}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => {
        e.stopPropagation();
        if (!hasDragged || !hasDragged()) {
          onActiveIndexChange?.(idx);
          onSelectItem(item, activeThumbnail || undefined);
        }
      }}
      role="article"
      aria-label={item.title ? `${item.title} — ${album.name}` : `${album.name} media item`}
      className={`relative flex-shrink-0 cursor-pointer group rounded-xl sm:rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-900 to-black border border-white/[0.07] shadow-2xl hover:shadow-[0_24px_60px_rgba(0,0,0,0.95)] hover:border-white/20 transition-all duration-300 ease-out hover:scale-[1.018] hover:-translate-y-1 select-none animate-fade-in ${heightClass} ${staggeredOffset} ${diptychMargin}`}
    >
      {/* Intentional Obsidian Typography Surface (Zero Black Screen Fallback) */}
      <div className="absolute inset-0 flex flex-col justify-between p-4 sm:p-5 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black select-none pointer-events-none z-0">
        <div className="flex items-center justify-between">
          <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
            <Play className="w-3 h-3 text-zinc-400 fill-current ml-0.5" />
          </div>
          <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest font-semibold">
            SARWARCYOU
          </span>
        </div>
        <div className="mt-auto">
          <span className="text-xs sm:text-sm font-medium text-zinc-200 tracking-wide line-clamp-2 block leading-snug">
            {cleanCardTitle}
          </span>
          <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider block mt-1">
            {badgeLabel} STREAM
          </span>
        </div>
      </div>

      {/* Subtle Micro-Badge (VIDEO, SHORT, PHOTO) */}
      <div className="absolute top-2.5 left-2.5 z-20 pointer-events-none">
        <span className="px-1.5 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-white/10 text-[8px] font-mono font-semibold tracking-wider text-zinc-300 uppercase shadow-md">
          {badgeLabel}
        </span>
      </div>

      {/* YouTube-Style Multi-Frame Hover Scrubbing Progress Bar */}
      {isVideo && isScrubbing && totalFrames > 1 && (
        <div className="absolute top-2.5 right-2.5 z-30 pointer-events-none flex items-center gap-1 bg-black/80 backdrop-blur-md px-2 py-1 rounded-full border border-white/15 animate-fade-in">
          {Array.from({ length: totalFrames }).map((_, fIdx) => (
            <div
              key={fIdx}
              className={`h-1 rounded-full transition-all duration-200 ${
                fIdx === activeFrameIndex
                  ? 'w-3.5 bg-zinc-100 shadow-[0_0_8px_rgba(255,255,255,0.8)]'
                  : 'w-1 bg-zinc-600'
              }`}
            />
          ))}
        </div>
      )}

      {/* Visual Thumbnail Presentation */}
      {activeThumbnail ? (
        <img
          key={activeThumbnail}
          src={activeThumbnail}
          alt={cleanCardTitle}
          loading="lazy"
          draggable={false}
          onLoad={() => {
            setImageLoaded(true);
            updateMaxScroll?.();
          }}
          onError={() => {
            if (!useExtFallback && extThumbnails.length > 0) {
              setUseExtFallback(true);
            } else if (!remoteImageFailed) {
              setRemoteImageFailed(true);
            } else {
              setStaticFallbackFailed(true);
            }
          }}
          className={`h-full w-auto max-w-[85vw] object-contain block group-hover:scale-104 transition-all duration-300 ease-out select-none pointer-events-none relative z-10 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : null}

      {/* Specular gloss highlight on hover */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.04] to-white/[0.18] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20" />

      {/* Video Play Glyph indicator */}
      {isVideo && !isHovered && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/25 backdrop-blur-[1px] pointer-events-none z-20">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-xl">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        </div>
      )}

      {/* Razor-thin border sheen on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-xl sm:rounded-2xl border border-transparent group-hover:border-white/15 transition-colors duration-300 z-20" />
    </div>
  );
};
