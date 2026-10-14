/* oxlint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  Check,
  Download,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  RotateCw,
  Repeat,
  PictureInPicture2,
  Gauge,
  Film,
  Camera,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { getDirectImageUrl } from '../utils/imageUrlResolver';
import { isVideoExtension, isHiddenOrSystemFolder, encodeStreamUrl } from '../utils/mediaTypeDetector';
import { downloadMedia } from '../utils/downloadMedia';
import {
  getCachedVideoPoster,
  prewarmVideoStream,
} from '../utils/videoPosterGenerator';
import { useVideoThumbnail, getCachedThumbnailSync } from '../utils/clientVideoThumbnails';
import {
  resolveMultiFrameThumbnails,
  resolveMultiFrameThumbnailsExt,
  useHoverThumbnailScrub,
  preloadImageFrames,
} from '../utils/thumbnailResolver';
import type { AlbumData, StageMediaItem } from '../types';

interface YouTubeTheaterModalProps {
  isOpen: boolean;
  onClose: () => void;
  album: AlbumData | null;
  allAlbums?: AlbumData[];
  initialIndex: number;
  posterUrl?: string;
  onSwitchAlbum?: (album: AlbumData, initialIndex?: number) => void;
  onNextAlbum?: () => void;
  onPrevAlbum?: () => void;
  onIndexChange?: (newIndex: number) => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const PLAYBACK_RATES = [0.5, 1, 1.25, 1.5, 2];

interface SuggestedReelCardProps {
  item: StageMediaItem;
  idx: number;
  album: AlbumData;
  isVideo: boolean;
  onSelectItem: (album: AlbumData, itemIndex: number) => void;
  hasDragged: () => boolean;
}

const SuggestedReelCard: React.FC<SuggestedReelCardProps> = ({
  item,
  idx,
  album,
  isVideo,
  onSelectItem,
  hasDragged,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const multiFrameThumbnails = useMemo(() => {
    return isVideo
      ? (item.thumbnails && item.thumbnails.length > 0
          ? item.thumbnails
          : resolveMultiFrameThumbnails(item))
      : [];
  }, [isVideo, item]);

  const extThumbnails = useMemo(() => {
    return isVideo ? resolveMultiFrameThumbnailsExt(item) : [];
  }, [isVideo, item]);

  const { thumbnail: videoThumbnail } = useVideoThumbnail(
    isVideo ? item.url : undefined,
    album.layoutType === 'vertical-waterfall'
  );

  const directThumb = getDirectImageUrl(item, idx);
  const staticFallbackThumbnail = isVideo
    ? videoThumbnail || getCachedThumbnailSync(item.url) || getCachedVideoPoster(item.url) || item.thumbnail
    : directThumb;

  const {
    activeThumbnail: scrubThumbnail,
    activeFrameIndex,
    isScrubbing,
    totalFrames,
  } = useHoverThumbnailScrub({
    thumbnails: multiFrameThumbnails,
    defaultThumbnail: staticFallbackThumbnail,
    isHovered,
    intervalMs: 380,
    enabled: isVideo && multiFrameThumbnails.length > 0,
  });

  const activeThumb = scrubThumbnail || staticFallbackThumbnail;

  const itemTitle = (item.title || `${album.name} ${idx + 1}`)
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  return (
    <div
      onMouseEnter={() => {
        setIsHovered(true);
        if (isVideo) {
          if (multiFrameThumbnails.length > 0) preloadImageFrames(multiFrameThumbnails);
          if (extThumbnails.length > 0) preloadImageFrames(extThumbnails);
        }
      }}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        if (!hasDragged()) {
          onSelectItem(album, idx);
        }
      }}
      className={`relative flex-shrink-0 cursor-pointer group rounded-xl overflow-hidden bg-gradient-to-br from-zinc-900 to-black border border-white/[0.06] hover:border-white/25 shadow-lg hover:shadow-2xl transition-all duration-300 ${
        isVideo ? 'w-48 sm:w-56 aspect-video' : 'w-36 sm:w-44 aspect-[3/4]'
      }`}
    >
      {/* Intentional Obsidian Surface Background */}
      <div className="absolute inset-0 flex flex-col justify-between p-2.5 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black select-none pointer-events-none z-0">
        <div className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center">
          <Play className="w-2.5 h-2.5 text-zinc-400 fill-current ml-0.5" />
        </div>
        <span className="text-[10px] font-medium text-zinc-300 truncate">
          {itemTitle}
        </span>
      </div>

      {/* Visual Thumbnail Image */}
      {activeThumb ? (
        <img
          src={activeThumb}
          alt={itemTitle}
          loading="lazy"
          style={{ contentVisibility: 'auto' }}
          className="w-full h-full object-cover pointer-events-none relative z-10 group-hover:scale-105 transition-transform duration-300"
        />
      ) : null}

      {/* Multi-Frame Hover Scrubbing Progress Dots */}
      {isVideo && isScrubbing && totalFrames > 1 && (
        <div className="absolute top-1.5 right-1.5 z-30 pointer-events-none flex items-center gap-1 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded-full border border-white/15 animate-fade-in">
          {Array.from({ length: totalFrames }).map((_, fIdx) => (
            <div
              key={fIdx}
              className={`h-1 rounded-full transition-all duration-200 ${
                fIdx === activeFrameIndex
                  ? 'w-2.5 bg-zinc-100'
                  : 'w-1 bg-zinc-600'
              }`}
            />
          ))}
        </div>
      )}

      {/* Hover Play / Stream Badge */}
      {(!isScrubbing || totalFrames <= 1) && (
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 duration-200 z-20 pointer-events-none">
          <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
            <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
          </div>
        </div>
      )}

      {/* Micro Badge */}
      <div className="absolute top-1.5 left-1.5 z-20 pointer-events-none">
        <span className="px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-[8px] font-mono text-zinc-400 uppercase tracking-widest">
          {isVideo ? 'VIDEO' : 'PHOTO'}
        </span>
      </div>
    </div>
  );
};

interface QueueCardItemProps {
  item: StageMediaItem;
  idx: number;
  isActive: boolean;
  onSelect: () => void;
}

const QueueCardItem: React.FC<QueueCardItemProps> = ({ item, idx, isActive, onSelect }) => {
  const isVideo = isVideoExtension(item.url || item.id || item.title) || item.type === 'video';
  const [isHovered, setIsHovered] = useState(false);
  const multiFrameThumbnails = useMemo(() => {
    return isVideo
      ? (item.thumbnails && item.thumbnails.length > 0
          ? item.thumbnails
          : resolveMultiFrameThumbnails(item))
      : [];
  }, [isVideo, item]);

  const extThumbnails = useMemo(() => {
    return isVideo ? resolveMultiFrameThumbnailsExt(item) : [];
  }, [isVideo, item]);

  const { thumbnail: videoThumbnail } = useVideoThumbnail(
    isVideo ? item.url : undefined,
    false
  );

  const directThumb = getDirectImageUrl(item, idx);
  const staticFallbackThumbnail = isVideo
    ? videoThumbnail || getCachedThumbnailSync(item.url) || getCachedVideoPoster(item.url) || item.thumbnail
    : directThumb;

  const {
    activeThumbnail: scrubThumbnail,
  } = useHoverThumbnailScrub({
    thumbnails: multiFrameThumbnails,
    defaultThumbnail: staticFallbackThumbnail,
    isHovered,
    intervalMs: 380,
    enabled: isVideo && multiFrameThumbnails.length > 0,
  });

  const activeThumb = scrubThumbnail || staticFallbackThumbnail;

  const itemTitle = (item.title || `Media ${idx + 1}`)
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => {
        setIsHovered(true);
        if (isVideo) {
          prewarmVideoStream(item.url);
          if (multiFrameThumbnails.length > 0) preloadImageFrames(multiFrameThumbnails);
          if (extThumbnails.length > 0) preloadImageFrames(extThumbnails);
        }
      }}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => {
        if (isVideo) prewarmVideoStream(item.url);
      }}
      className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-all duration-200 group ${
        isActive
          ? 'bg-zinc-800/80 border border-white/[0.12] shadow-md'
          : 'hover:bg-zinc-900/80 border border-transparent'
      }`}
    >
      {/* Thumbnail Container (Obsidian Surface Backing) */}
      <div className="relative w-20 sm:w-24 aspect-video rounded-lg overflow-hidden bg-gradient-to-br from-zinc-900 to-black border border-white/[0.05] flex-shrink-0">
        {activeThumb ? (
          <img
            src={activeThumb}
            alt={itemTitle}
            loading="lazy"
            style={{ contentVisibility: 'auto' }}
            className="w-full h-full object-cover pointer-events-none group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-zinc-950">
            <Play className="w-3.5 h-3.5 text-zinc-600" />
          </div>
        )}

        {isActive ? (
          <div className="absolute inset-0 bg-white/10 flex items-center justify-center">
            <span className="px-1.5 py-0.5 rounded bg-zinc-100 text-black font-mono font-bold text-[8px] tracking-widest uppercase">
              PLAYING
            </span>
          </div>
        ) : isVideo ? (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Play className="w-3 h-3 text-white fill-current" />
          </div>
        ) : null}
      </div>

      {/* Meta */}
      <div className="flex-1 min-w-0">
        <span
          className={`text-[11px] font-medium truncate block leading-tight ${
            isActive ? 'text-zinc-100' : 'text-zinc-400 group-hover:text-zinc-200'
          } transition-colors duration-200`}
        >
          {itemTitle}
        </span>
        <span className="text-[9px] font-mono text-zinc-500 tracking-wider uppercase block mt-0.5">
          {String(idx + 1).padStart(2, '0')} • {isVideo ? 'VIDEO' : 'PHOTO'}
        </span>
      </div>
    </div>
  );
};

interface SuggestedAlbumReelProps {
  album: AlbumData;
  onSelectItem: (album: AlbumData, itemIndex: number) => void;
}

const SuggestedAlbumReel: React.FC<SuggestedAlbumReelProps> = ({ album, onSelectItem }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollOffsetRef = useRef(0);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, scrollX: 0 });
  const hasDraggedRef = useRef(false);
  const maxScrollRef = useRef(0);
  const lastWheelTimeRef = useRef(0);

  const items = useMemo(() => album.items || [], [album.items]);

  const updateMaxScroll = useCallback(() => {
    if (!containerRef.current || !trackRef.current) return;
    const cWidth = containerRef.current.clientWidth;
    const tWidth = trackRef.current.scrollWidth;
    maxScrollRef.current = Math.max(0, tWidth - cWidth + 60);
  }, []);

  useEffect(() => {
    updateMaxScroll();
    window.addEventListener('resize', updateMaxScroll);
    return () => window.removeEventListener('resize', updateMaxScroll);
  }, [items, updateMaxScroll]);

  // Continuous gentle auto-slide (Right to Left) without hover pausing
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    const SPEED = 24; // 24px per second gentle drift

    const loop = (now: number) => {
      const seconds = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      const isWheelActive = Date.now() - lastWheelTimeRef.current < 800;
      if (!isDraggingRef.current && !isWheelActive && items.length > 0) {
        scrollOffsetRef.current += SPEED * seconds;
        const max = maxScrollRef.current;
        if (max > 10 && scrollOffsetRef.current >= max + 20) {
          scrollOffsetRef.current = 0;
        }
      }

      if (trackRef.current) {
        trackRef.current.style.transform = `translate3d(${-scrollOffsetRef.current}px, 0, 0)`;
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [items.length]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    hasDraggedRef.current = false;
    dragStartRef.current = { x: e.clientX, scrollX: scrollOffsetRef.current };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    if (Math.abs(dx) > 6) hasDraggedRef.current = true;
    scrollOffsetRef.current = Math.max(0, dragStartRef.current.scrollX - dx);
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    setTimeout(() => {
      hasDraggedRef.current = false;
    }, 50);
  };

  const handleWheel = (e: React.WheelEvent) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (Math.abs(delta) > 4) {
      scrollOffsetRef.current = Math.max(0, scrollOffsetRef.current + delta * 0.75);
      lastWheelTimeRef.current = Date.now();
    }
  };

  const isVideo = album.type === 'video';

  return (
    <div className="w-full flex flex-col gap-2.5 select-none">
      {/* Folder Header: Prominent clean title with count in parentheses, pure borderless */}
      <div className="flex items-center justify-between px-1">
        <h4 className="text-xs sm:text-sm font-black font-space text-zinc-100 uppercase tracking-wider flex items-center gap-2">
          <span>{album.name}</span>
          <span className="text-zinc-500 font-mono text-[11px] font-normal">
            ({album.itemCount || items.length})
          </span>
        </h4>
        <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest hidden sm:inline">
          {isVideo ? 'CINEMA VAULT' : 'PHOTO VAULT'}
        </span>
      </div>

      {/* Auto-sliding Horizontal Reel */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className="w-full overflow-hidden cursor-grab active:cursor-grabbing scrollbar-none [&::-webkit-scrollbar]:hidden py-1"
        style={{ touchAction: 'pan-y' }}
      >
        <div ref={trackRef} className="flex items-center gap-3 will-change-transform">
          {items.map((item, idx) => (
            <SuggestedReelCard
              key={item.id || `sug-${album.id}-${idx}`}
              item={item}
              idx={idx}
              album={album}
              isVideo={isVideoExtension(item.url || item.id || item.title) || item.type === 'video' || isVideo}
              onSelectItem={onSelectItem}
              hasDragged={() => hasDraggedRef.current}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export const YouTubeTheaterModal: React.FC<YouTubeTheaterModalProps> = ({
  isOpen,
  onClose,
  album,
  allAlbums = [],
  initialIndex,
  posterUrl,
  onSwitchAlbum,
  onNextAlbum: _onNextAlbum,
  onPrevAlbum: _onPrevAlbum,
  onIndexChange,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isCrossfading, setIsCrossfading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);

  // Dynamic Suggested Albums Rotation (Rotate every 15s, pause on hover)
  const [suggestedBatchIndex, setSuggestedBatchIndex] = useState(0);
  const [isSuggestedHovered, setIsSuggestedHovered] = useState(false);

  // Floating HUD Visibility state (Auto-fade after 2.5s)
  const [isHudVisible, setIsHudVisible] = useState(true);
  const hudTimeoutRef = useRef<number | null>(null);

  // A-B Looper State
  const [isAbLoopActive, setIsAbLoopActive] = useState(false);
  const [loopStart, setLoopStart] = useState<number | null>(null);
  const [loopEnd, setLoopEnd] = useState<number | null>(null);
  const [posterFailed, setPosterFailed] = useState(false);
  const [modalImageLoaded, setModalImageLoaded] = useState(false);
  const [modalImageFailed, setModalImageFailed] = useState(false);
  const [isStalled, setIsStalled] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const stallTimerRef = useRef<number | null>(null);

  // Ripple feedback states
  const [centerRipple, setCenterRipple] = useState<'play' | 'pause' | null>(null);
  const [seekRipple, setSeekRipple] = useState<{ side: 'left' | 'right'; text: string } | null>(null);

  // Velocity Swipe-to-Dismiss State
  const [dismissOffsetY, setDismissOffsetY] = useState(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const playlistContainerRef = useRef<HTMLDivElement>(null);

  // Auto-sliding queue refs
  const isQueueHoveredRef = useRef(false);
  const isQueueInteractingRef = useRef(false);

  // Sync index when initialIndex changes
  useEffect(() => {
    setCurrentIndex(initialIndex);
    setIsZoomed(false);
    setHasStarted(false);
    setIsPlaying(false);
    setIsBuffering(true);
    setIsStalled(false);
    setPlaybackError(null);
    setCurrentTime(0);
    setDismissOffsetY(0);
    setIsAbLoopActive(false);
    setLoopStart(null);
    setLoopEnd(null);
    setPosterFailed(false);
    setModalImageLoaded(false);
    setModalImageFailed(false);
    if (stallTimerRef.current) {
      window.clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, [initialIndex, isOpen]);

  // Synchronize active media index with parent / URL router
  useEffect(() => {
    if (isOpen) {
      onIndexChange?.(currentIndex);
    }
  }, [currentIndex, isOpen, onIndexChange]);

  const items = useMemo(() => album?.items || [], [album]);
  const currentItem: StageMediaItem | undefined = items[currentIndex] || items[0];

  // Context-Aware Suggested Albums (Filtered strictly by media type)
  const suggestedAlbums = useMemo(() => {
    if (!allAlbums || allAlbums.length === 0) return [];
    const isVideo =
      isVideoExtension(currentItem?.url || currentItem?.id || currentItem?.title) ||
      currentItem?.type === 'video';
    return allAlbums.filter(
      (a) =>
        a.id !== album?.id &&
        !isHiddenOrSystemFolder(a.name) &&
        !isHiddenOrSystemFolder(a.id) &&
        (isVideo ? a.type === 'video' : a.type === 'image') &&
        a.items.length > 0
    );
  }, [allAlbums, album?.id, currentItem]);

  const SUGGESTED_BATCH_SIZE = 2;
  const totalSuggestedBatches = Math.max(1, Math.ceil(suggestedAlbums.length / SUGGESTED_BATCH_SIZE));

  useEffect(() => {
    setSuggestedBatchIndex(0);
  }, [album?.id, currentItem?.type]);

  useEffect(() => {
    if (!isOpen || totalSuggestedBatches <= 1 || isSuggestedHovered) return;
    const interval = setInterval(() => {
      setSuggestedBatchIndex((prev) => (prev + 1) % totalSuggestedBatches);
    }, 15000);
    return () => clearInterval(interval);
  }, [isOpen, totalSuggestedBatches, isSuggestedHovered]);

  const activeSuggestedBatch = useMemo(() => {
    const start = (suggestedBatchIndex % totalSuggestedBatches) * SUGGESTED_BATCH_SIZE;
    return suggestedAlbums.slice(start, start + SUGGESTED_BATCH_SIZE);
  }, [suggestedAlbums, suggestedBatchIndex, totalSuggestedBatches]);

  // Auto-hide HUD after 2.5s of inactivity
  const resetHudTimer = useCallback(() => {
    setIsHudVisible(true);
    if (hudTimeoutRef.current) {
      window.clearTimeout(hudTimeoutRef.current);
    }
    hudTimeoutRef.current = window.setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused && !showSpeedMenu) {
        setIsHudVisible(false);
      }
    }, 2500);
  }, [showSpeedMenu]);

  useEffect(() => {
    resetHudTimer();
    return () => {
      if (hudTimeoutRef.current) window.clearTimeout(hudTimeoutRef.current);
    };
  }, [resetHudTimer, isPlaying]);

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      resetHudTimer();
      if (e.key === 'Escape') {
        if (isFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowRight') {
        goToIndex(currentIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        goToIndex(currentIndex - 1);
      } else if (e.key === ' ' && currentItem?.type === 'video') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'm' || e.key === 'M') {
        handleMuteToggle();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'j' || e.key === 'J') {
        seekRelative(-10);
      } else if (e.key === 'l' || e.key === 'L') {
        seekRelative(10);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, currentIndex, items.length, onClose, isFullscreen, currentItem?.type, resetHudTimer]);

  // Auto-sliding queue: Gentle slow upward scroll animation
  useEffect(() => {
    if (!isOpen) return;
    let animId: number;
    let lastTime = performance.now();

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const el = playlistContainerRef.current;
      if (el && !isQueueHoveredRef.current && !isQueueInteractingRef.current) {
        const maxScroll = el.scrollHeight - el.clientHeight;
        if (maxScroll > 15) {
          if (el.scrollTop >= maxScroll - 2) {
            el.scrollTop = 0;
          } else {
            el.scrollTop += 18 * dt; // Gentle 18px per second drift
          }
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isOpen, currentIndex, items.length]);

  const goToIndex = useCallback(
    (idx: number) => {
      if (items.length === 0) return;
      const next = (idx + items.length) % items.length;
      setIsCrossfading(true);
      setIsZoomed(false);
      setHasStarted(false);
      setIsPlaying(false);
      setIsBuffering(true);
      setIsStalled(false);
      setPlaybackError(null);
      setCurrentIndex(next);
      setDismissOffsetY(0);
      setIsAbLoopActive(false);
      setLoopStart(null);
      setLoopEnd(null);
      setPosterFailed(false);
      setModalImageLoaded(false);
      setModalImageFailed(false);
      window.setTimeout(() => {
        setIsCrossfading(false);
      }, 200);
    },
    [items.length]
  );

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    resetHudTimer();
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      setCenterRipple('play');
      setTimeout(() => setCenterRipple(null), 550);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      setCenterRipple('pause');
      setTimeout(() => setCenterRipple(null), 550);
    }
  }, [resetHudTimer]);

  const seekRelative = useCallback((delta: number) => {
    if (!videoRef.current) return;
    resetHudTimer();
    const newTime = Math.max(0, Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + delta));
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);

    setSeekRipple({
      side: delta > 0 ? 'right' : 'left',
      text: delta > 0 ? '+10s' : '-10s',
    });
    setTimeout(() => setSeekRipple(null), 650);
  }, [resetHudTimer]);

  // A-B Looping Check on time update
  const handleTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    setCurrentTime(cur);

    if (isAbLoopActive && loopStart !== null && loopEnd !== null && loopEnd > loopStart) {
      if (cur >= loopEnd || cur < loopStart) {
        videoRef.current.currentTime = loopStart;
        setCurrentTime(loopStart);
      }
    }
  }, [isAbLoopActive, loopStart, loopEnd]);

  // Double-tap and touch gesture handling on video viewport
  const handleStageTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: performance.now(),
    };
  }, []);

  const handleStageTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    if (dy > 0) {
      setDismissOffsetY(dy);
    }
  }, []);

  const handleStageTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dy = touch.clientY - touchStartRef.current.y;
    const dt = performance.now() - touchStartRef.current.time;

    // Velocity swipe down to dismiss
    if ((dy > 110 && dt < 400) || dy > 180) {
      onClose();
      return;
    }
    setDismissOffsetY(0);

    // Double-tap detection
    const now = performance.now();
    const tapX = touch.clientX;
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeX = tapX - rect.left;
    const isRightHalf = relativeX > rect.width / 2;

    if (lastTapRef.current && now - lastTapRef.current.time < 300 && Math.abs(tapX - lastTapRef.current.x) < 50) {
      if (isRightHalf) {
        seekRelative(10);
      } else {
        seekRelative(-10);
      }
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { time: now, x: tapX };
      resetHudTimer();
    }
    touchStartRef.current = null;
  }, [onClose, seekRelative, resetHudTimer]);

  const handleDownload = useCallback(async () => {
    if (!currentItem || isDownloading) return;
    setIsDownloading(true);
    setDownloadSuccess(false);
    try {
      await downloadMedia(currentItem.url, currentItem.title || currentItem.id);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2200);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  }, [currentItem, isDownloading]);

  const handleMuteToggle = useCallback(() => {
    resetHudTimer();
    setIsMuted((prev) => {
      const next = !prev;
      if (videoRef.current) videoRef.current.muted = next;
      return next;
    });
  }, [resetHudTimer]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    resetHudTimer();
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  }, [resetHudTimer]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    resetHudTimer();
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  }, [resetHudTimer]);

  const handleSpeedSelect = useCallback((rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSpeedMenu(false);
    resetHudTimer();
  }, [resetHudTimer]);

  const togglePiP = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('PiP not supported or disallowed:', err);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = videoContainerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);


  const activePoster = useMemo(() => {
    if (!currentItem || posterFailed) return '';
    if (currentIndex === initialIndex && posterUrl) return posterUrl;

    const multiThumbs = resolveMultiFrameThumbnails(currentItem);
    const multiThumbsExt = resolveMultiFrameThumbnailsExt(currentItem);

    return (
      currentItem.thumbnails?.[0] ||
      multiThumbs[0] ||
      multiThumbsExt[0] ||
      getCachedThumbnailSync(currentItem.url) ||
      getCachedVideoPoster(currentItem.url) ||
      currentItem.posterUrl ||
      currentItem.thumbnail ||
      getDirectImageUrl(currentItem, currentIndex) ||
      ''
    );
  }, [currentItem, currentIndex, initialIndex, posterUrl, posterFailed]);

  const rawUrl = currentItem ? encodeStreamUrl(currentItem.url) : '';
  let streamUrl = rawUrl;
  if (streamUrl.includes('drive.google.com') && !streamUrl.includes('/preview')) {
    streamUrl = streamUrl.replace(/\/view(\?.*)?$/, '/preview');
    if (!streamUrl.includes('/preview')) {
      streamUrl = streamUrl.replace(/\?usp=.*$/, '') + '/preview';
    }
  }
  const cleanStreamUrl = encodeStreamUrl(streamUrl);

  // Strict file extension-based video detection: any .mp4/.mov/.mkv/.webm/.avi is strictly a VIDEO
  const isVideo =
    isVideoExtension(currentItem?.url || currentItem?.id || currentItem?.title) ||
    currentItem?.type === 'video';
  const isDirectVideo =
    isVideo &&
    (isVideoExtension(cleanStreamUrl) || cleanStreamUrl.includes('huggingface.co'));

  // Video Streaming Initialization and 15-Second Stall Detector
  useEffect(() => {
    if (!isOpen || !isVideo) return;
    setIsStalled(false);
    setPlaybackError(null);
    setIsBuffering(true);

    if (stallTimerRef.current) {
      window.clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }

    // 15-second stall detector: If a video fails or stays in readyState < 2 for over 15s
    stallTimerRef.current = window.setTimeout(() => {
      if (videoRef.current) {
        if (videoRef.current.readyState < 2) {
          setIsStalled(true);
          setIsBuffering(false);
        }
      } else {
        setIsStalled(true);
        setIsBuffering(false);
      }
    }, 15000);

    // Initial play trigger
    if (videoRef.current) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setHasStarted(true);
            setIsBuffering(false);
            setIsStalled(false);
            setPlaybackError(null);
          })
          .catch(() => {
            // Autoplay blocked by browser policy without gesture; reveal Play button
            setIsBuffering(false);
          });
      }
    }

    return () => {
      if (stallTimerRef.current) {
        window.clearTimeout(stallTimerRef.current);
        stallTimerRef.current = null;
      }
    };
  }, [currentIndex, isOpen, cleanStreamUrl, isVideo]);

  if (!isOpen || !currentItem) return null;

  const directImgUrl = getDirectImageUrl(currentItem, currentIndex);
  const rawTitle = currentItem.title || '';
  const cleanTitle =
    rawTitle.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim() ||
    (isVideo ? 'Cinema Stream' : 'Photograph');

  // Compute A-B loop percentage offsets for timeline
  const loopStartPct = duration > 0 && loopStart !== null ? Math.max(0, Math.min(100, (loopStart / duration) * 100)) : 0;
  const loopEndPct = duration > 0 && loopEnd !== null ? Math.max(0, Math.min(100, (loopEnd / duration) * 100)) : 100;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={cleanTitle}
      onMouseMove={resetHudTimer}
      style={{
        transform: dismissOffsetY > 0 ? `translate3d(0, ${dismissOffsetY}px, 0) scale(${Math.max(0.85, 1 - dismissOffsetY / 1200)})` : 'none',
        transition: dismissOffsetY === 0 ? 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
      }}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-2xl animate-fade-in select-none overflow-hidden"
    >
      {/* ===== TOP STATUS / ACTION BAR ===== */}
      <div className="w-full px-4 sm:px-6 py-3 border-b border-white/[0.06] bg-black/80 backdrop-blur-xl flex items-center justify-between text-xs font-mono z-30 flex-shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="px-2.5 py-0.5 rounded-full bg-zinc-800/80 border border-white/10 text-zinc-300 font-semibold tracking-widest text-[9px] uppercase flex-shrink-0">
            {album?.name || 'ALBUM'}
          </span>
          <span className="text-zinc-600 hidden sm:inline">•</span>
          <span className="text-zinc-300 font-medium tracking-wider hidden sm:inline text-[10px]">
            {isVideo ? 'Video' : 'Photo'} {currentIndex + 1} of {items.length}
          </span>
          <span className="text-zinc-200 font-medium truncate max-w-[180px] sm:max-w-xs md:max-w-md hidden md:inline text-[11px]">
            {cleanTitle}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!isVideo && (
            <button
              onClick={() => setIsZoomed(!isZoomed)}
              className="p-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors duration-200 cursor-pointer border border-white/[0.06]"
              title={isZoomed ? 'Zoom out (100%)' : 'Zoom in (160%)'}
            >
              {isZoomed ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Direct 1-Click Download Button */}
          <button
            onClick={handleDownload}
            disabled={isDownloading}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all duration-200 cursor-pointer border ${
              downloadSuccess
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                : 'bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border-white/[0.08]'
            } disabled:opacity-40`}
            title="Direct Media Download"
          >
            {downloadSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-[10px] hidden sm:inline">SAVED</span>
              </>
            ) : (
              <>
                <Download className={`w-3.5 h-3.5 ${isDownloading ? 'animate-bounce' : ''}`} />
                <span className="text-[10px] hidden sm:inline">
                  {isDownloading ? 'DOWNLOADING...' : 'DOWNLOAD'}
                </span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors duration-200 cursor-pointer border border-white/[0.06]"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ===== VERTICALLY SCROLLABLE MODAL BODY ===== */}
      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col p-2.5 sm:p-4 lg:p-5 gap-4">
        {/* ===== MAIN CINEMA STAGE & QUEUE ROW ===== */}
        <div className="w-full flex flex-col lg:flex-row gap-3.5 h-[56vh] sm:h-[65vh] lg:h-[72vh] min-h-[460px] flex-shrink-0">
          {/* ===== LEFT MAIN VIEWPORT (~72% DESKTOP) ===== */}
          <div className="w-full lg:w-[72%] h-full flex flex-col bg-[#09090b] rounded-2xl border border-white/[0.06] overflow-hidden flex-shrink-0 shadow-2xl relative group/stage">
            {/* Cinema Stage Container with Ambilight */}
            <div
              ref={videoContainerRef}
              onTouchStart={handleStageTouchStart}
              onTouchMove={handleStageTouchMove}
              onTouchEnd={handleStageTouchEnd}
              onClick={resetHudTimer}
              className={`relative flex-1 w-full bg-black flex items-center justify-center overflow-hidden transition-opacity duration-200 ${
                isCrossfading ? 'opacity-30' : 'opacity-100'
              }`}
            >
              {/* Dynamic Ambient Luminance Aura (Ambilight Effect) */}
              {isVideo && isDirectVideo && (
                <video
                  src={cleanStreamUrl}
                  aria-hidden="true"
                  muted
                  loop
                  playsInline
                  autoPlay
                  preload="none"
                  className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-40 scale-105 pointer-events-none z-0"
                />
              )}

              {/* Video Player */}
              {isVideo ? (
                isDirectVideo ? (
                  <div className="relative w-full h-full flex flex-col items-center justify-center z-10">
                    <video
                      ref={videoRef}
                      key={cleanStreamUrl}
                      src={cleanStreamUrl}
                      poster={activePoster}
                      autoPlay
                      playsInline
                      preload="metadata"
                      controls={false}
                      muted={isMuted}
                      onClick={togglePlay}
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={() => {
                        if (videoRef.current) setDuration(videoRef.current.duration);
                      }}
                      onLoadedData={() => {
                        if (videoRef.current && videoRef.current.readyState >= 2) {
                          setIsBuffering(false);
                          setIsStalled(false);
                          setPlaybackError(null);
                          if (stallTimerRef.current) {
                            window.clearTimeout(stallTimerRef.current);
                            stallTimerRef.current = null;
                          }
                        }
                      }}
                      onCanPlay={() => {
                        setIsBuffering(false);
                        setIsStalled(false);
                        setPlaybackError(null);
                        if (stallTimerRef.current) {
                          window.clearTimeout(stallTimerRef.current);
                          stallTimerRef.current = null;
                        }
                      }}
                      onPlaying={() => {
                        setHasStarted(true);
                        setIsPlaying(true);
                        setIsBuffering(false);
                        setIsStalled(false);
                        setPlaybackError(null);
                        if (stallTimerRef.current) {
                          window.clearTimeout(stallTimerRef.current);
                          stallTimerRef.current = null;
                        }
                      }}
                      onWaiting={() => {
                        if (!isStalled && !playbackError) {
                          setIsBuffering(true);
                        }
                      }}
                      onError={() => {
                        const err = videoRef.current?.error;
                        let msg = 'Failed to load video stream.';
                        if (err) {
                          if (err.code === 1) msg = 'Video loading aborted.';
                          else if (err.code === 2) msg = 'Network error while streaming video.';
                          else if (err.code === 3) msg = 'Video decoding failed or codec unsupported.';
                          else if (err.code === 4) msg = 'Video file unavailable or link expired.';
                        }
                        setPlaybackError(msg);
                        setIsStalled(true);
                        setIsBuffering(false);
                        if (stallTimerRef.current) {
                          window.clearTimeout(stallTimerRef.current);
                          stallTimerRef.current = null;
                        }
                      }}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => {
                        if (isRepeat) {
                          if (videoRef.current) {
                            videoRef.current.currentTime = 0;
                            videoRef.current.play().catch(() => {});
                          }
                        } else {
                          // Auto-advance to next item in album queue
                          if (items.length > 0) {
                            goToIndex((currentIndex + 1) % items.length);
                          }
                        }
                      }}
                      className="w-full h-full object-contain cursor-pointer relative z-10"
                    />

                    {/* Seamless YouTube-Style Zero-Black-Screen Poster & Typography Hand-off */}
                    <div
                      className={`absolute inset-0 z-20 flex flex-col items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-950 to-black transition-opacity duration-300 ease-out pointer-events-none ${
                        hasStarted ? 'opacity-0' : 'opacity-100'
                      }`}
                    >
                      {activePoster ? (
                        <img
                          src={activePoster}
                          alt={cleanTitle}
                          onError={() => setPosterFailed(true)}
                          className="w-full h-full object-contain pointer-events-none select-none"
                        />
                      ) : (
                        /* Aesthetic Obsidian Typography Card (Never an Unsplash Photo or Empty Black Card) */
                        <div className="flex flex-col items-center justify-center p-6 text-center max-w-md">
                          <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                            <Play className="w-6 h-6 text-zinc-300 fill-current ml-0.5" />
                          </div>
                          <h3 className="text-sm sm:text-base font-bold font-space text-zinc-100 uppercase tracking-wide truncate max-w-xs">
                            {cleanTitle}
                          </h3>
                          <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-1">
                            {album?.name || 'SARWARCYOU CINEMA'}
                          </span>
                        </div>
                      )}

                      {/* Sleek Minimal Glowing Buffering Indicator over Poster */}
                      {!hasStarted && isBuffering && !isStalled && !playbackError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/45 backdrop-blur-[2px]">
                          <div className="relative w-12 h-12 flex items-center justify-center">
                            <div className="absolute inset-0 rounded-full border-2 border-white/10 border-t-white animate-spin" />
                            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                              <Play className="w-3.5 h-3.5 text-zinc-300 fill-current ml-0.5" />
                            </div>
                          </div>
                          <span className="mt-3 font-mono text-[9px] uppercase tracking-[0.25em] text-zinc-300 font-semibold">
                            BUFFERING STREAM...
                          </span>
                        </div>
                      )}

                      {/* Click to Play Button if Autoplay was held by Browser */}
                      {!hasStarted && !isBuffering && !isStalled && !playbackError && !isPlaying && (
                        <div
                          className="absolute inset-0 flex flex-col items-center justify-center bg-black/35 pointer-events-auto cursor-pointer"
                          onClick={togglePlay}
                        >
                          <div className="w-16 h-16 rounded-full bg-white/15 hover:bg-white/25 border border-white/30 flex items-center justify-center transition-all transform hover:scale-110 shadow-2xl">
                            <Play className="w-7 h-7 text-white fill-current ml-1" />
                          </div>
                          <span className="mt-3 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-200 font-bold">
                            CLICK TO PLAY
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Explicit Stall / Error Fallback Overlay */}
                    {(isStalled || playbackError) && (
                      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/85 backdrop-blur-md p-6 text-center select-auto">
                        <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4 text-red-400">
                          <AlertCircle className="w-7 h-7" />
                        </div>

                        <span className="px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 font-mono text-[10px] uppercase tracking-widest font-bold mb-2">
                          {playbackError ? 'STREAM ERROR' : 'STREAM STALLED (>15S)'}
                        </span>

                        <h3 className="text-base sm:text-lg font-bold font-space text-zinc-100 max-w-md truncate mb-1">
                          {cleanTitle}
                        </h3>

                        <p className="text-xs text-zinc-400 max-w-sm mb-6 leading-relaxed">
                          {playbackError ||
                            'The video stream is taking longer than 15 seconds to buffer. You can retry loading or open/download the raw video directly.'}
                        </p>

                        <div className="flex flex-wrap items-center justify-center gap-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsStalled(false);
                              setPlaybackError(null);
                              setIsBuffering(true);
                              if (videoRef.current) {
                                videoRef.current.load();
                                videoRef.current.play().catch(() => {});
                              }
                            }}
                            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono font-medium flex items-center gap-2 border border-white/10 transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            RETRY STREAM
                          </button>

                          <a
                            href={cleanStreamUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            download={cleanTitle}
                            onClick={(e) => e.stopPropagation()}
                            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-semibold text-xs font-mono flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            OPEN / DOWNLOAD VIDEO
                          </a>
                        </div>
                      </div>
                    )}

                    {/* In-stream buffering spinner if video stalls during playback */}
                    {hasStarted && isBuffering && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-25 bg-black/20">
                        <div className="w-10 h-10 rounded-full border-2 border-white/15 border-t-white animate-spin" />
                      </div>
                    )}

                    {/* Center Play/Pause Animated Ripple */}
                    {centerRipple && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                        <div className="w-16 h-16 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white animate-ripple shadow-2xl">
                          {centerRipple === 'play' ? (
                            <Play className="w-7 h-7 fill-current ml-1" />
                          ) : (
                            <Pause className="w-7 h-7" />
                          )}
                        </div>
                      </div>
                    )}

                    {/* Double-tap Seek Indicator (Left / Right) */}
                    {seekRipple && (
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 z-30 pointer-events-none animate-double-tap ${
                          seekRipple.side === 'right' ? 'right-12 sm:right-20' : 'left-12 sm:left-20'
                        }`}
                      >
                        <div className="px-4 py-2.5 rounded-full bg-black/75 border border-white/20 text-zinc-100 text-xs font-mono font-bold tracking-wider flex items-center gap-1.5 shadow-2xl backdrop-blur-xl">
                          {seekRipple.side === 'right' ? (
                            <>
                              <span>{seekRipple.text}</span>
                              <RotateCw className="w-4 h-4 text-emerald-400" />
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-4 h-4 text-emerald-400" />
                              <span>{seekRipple.text}</span>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ================= DETACHED FLOATING GLASS HUD DOCK ================= */}
                    <div
                      onMouseEnter={() => {
                        if (hudTimeoutRef.current) window.clearTimeout(hudTimeoutRef.current);
                        setIsHudVisible(true);
                      }}
                      onMouseLeave={resetHudTimer}
                      className={`absolute bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 w-[94%] sm:w-[88%] max-w-3xl backdrop-blur-2xl bg-black/80 border border-white/10 rounded-2xl px-3.5 sm:px-5 py-2.5 sm:py-3 shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col gap-2 transition-all duration-300 ${
                        isHudVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
                      }`}
                    >
                      {/* Magnetic Scrubber Bar + A-B Loop Visualizer */}
                      <div className="relative w-full group/scrub py-1">
                        <div className="relative w-full h-1 group-hover/scrub:h-2 bg-white/20 rounded-full overflow-hidden transition-all duration-200">
                          <div
                            className="h-full bg-zinc-200 transition-all duration-75"
                            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                          />

                          {isAbLoopActive && loopStart !== null && (
                            <div
                              className="absolute top-0 bottom-0 bg-emerald-500/50 border-x border-emerald-400 pointer-events-none"
                              style={{
                                left: `${loopStartPct}%`,
                                width: `${Math.max(2, loopEndPct - loopStartPct)}%`,
                              }}
                            />
                          )}
                        </div>

                        <input
                          type="range"
                          min="0"
                          max={duration || 100}
                          step="0.1"
                          value={currentTime}
                          onChange={handleSeek}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />

                        {isAbLoopActive && loopStart !== null && (
                          <div
                            className="absolute -top-1.5 -translate-x-1/2 w-2 h-4 bg-amber-400 rounded-sm shadow-md pointer-events-none z-10"
                            style={{ left: `${loopStartPct}%` }}
                            title={`Point A: ${formatTime(loopStart)}`}
                          />
                        )}

                        {isAbLoopActive && loopEnd !== null && (
                          <div
                            className="absolute -top-1.5 -translate-x-1/2 w-2 h-4 bg-emerald-400 rounded-sm shadow-md pointer-events-none z-10"
                            style={{ left: `${loopEndPct}%` }}
                            title={`Point B: ${formatTime(loopEnd)}`}
                          />
                        )}
                      </div>

                      {/* HUD Controls Row */}
                      <div className="flex items-center justify-between text-xs font-mono text-zinc-300 gap-2">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <button
                            onClick={togglePlay}
                            className="p-1 hover:text-white transition-colors cursor-pointer"
                            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                          >
                            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                          </button>

                          <button
                            onClick={() => seekRelative(-10)}
                            className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center gap-0.5"
                            title="Rewind 10s (J)"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span className="text-[9px] hidden sm:inline">-10s</span>
                          </button>

                          <button
                            onClick={() => seekRelative(10)}
                            className="p-1 text-zinc-400 hover:text-white transition-colors cursor-pointer flex items-center gap-0.5"
                            title="Skip 10s (L)"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span className="text-[9px] hidden sm:inline">+10s</span>
                          </button>

                          <div className="flex items-center gap-1.5 group/vol">
                            <button
                              onClick={handleMuteToggle}
                              className="p-1 hover:text-white transition-colors cursor-pointer"
                              title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                            >
                              {isMuted || volume === 0 ? (
                                <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
                              ) : (
                                <Volume2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              value={isMuted ? 0 : volume}
                              onChange={handleVolumeChange}
                              className="w-12 sm:w-16 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-zinc-200 hidden sm:inline"
                            />
                          </div>

                          <span className="text-[10px] text-zinc-400 tracking-wider hidden sm:inline">
                            {formatTime(currentTime)} / {formatTime(duration)}
                          </span>
                          <span className="text-[9px] font-mono text-zinc-500 tracking-wider uppercase hidden md:inline ml-1">
                            ({isVideo ? 'Video' : 'Item'} {currentIndex + 1} of {items.length})
                          </span>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="flex items-center gap-1">
                            {/* Repeat Toggle Button: Repeat 1 vs Auto-advance */}
                            {isVideo && (
                              <button
                                onClick={() => setIsRepeat((prev) => !prev)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono transition-all cursor-pointer border ${
                                  isRepeat
                                    ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                    : 'bg-zinc-900/80 border-white/[0.08] text-zinc-400 hover:text-white'
                                }`}
                                title={
                                  isRepeat
                                    ? 'Repeat: One (Current video loops on finish)'
                                    : 'Auto-advance: On (Plays next video in queue on finish)'
                                }
                              >
                                <Repeat className="w-3 h-3" />
                                <span>{isRepeat ? '1' : 'AUTO'}</span>
                              </button>
                            )}

                            <button
                              onClick={() => {
                                setIsAbLoopActive(!isAbLoopActive);
                                if (!isAbLoopActive) {
                                  setLoopStart(currentTime);
                                  setLoopEnd(Math.min(duration, currentTime + 5));
                                }
                              }}
                              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-mono transition-all cursor-pointer border ${
                                isAbLoopActive
                                  ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                                  : 'bg-zinc-900/80 border-white/[0.08] text-zinc-400 hover:text-white'
                              }`}
                              title="Toggle A-B Section Repeat Mode"
                            >
                              <Repeat className="w-3 h-3" />
                              <span>A-B</span>
                            </button>

                            {isAbLoopActive && (
                              <div className="hidden sm:flex items-center gap-1 text-[9px]">
                                <button
                                  onClick={() => setLoopStart(currentTime)}
                                  className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 cursor-pointer"
                                  title="Set current time as Point A"
                                >
                                  Set A
                                </button>
                                <button
                                  onClick={() => setLoopEnd(currentTime)}
                                  className="px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 cursor-pointer"
                                  title="Set current time as Point B"
                                >
                                  Set B
                                </button>
                                <button
                                  onClick={() => {
                                    setLoopStart(0);
                                    setLoopEnd(duration);
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                                  title="Reset A-B boundaries"
                                >
                                  Clear
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="relative">
                            <button
                              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-900/80 border border-white/[0.08] text-[10px] font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer"
                              title="Playback Speed"
                            >
                              <Gauge className="w-3 h-3 text-zinc-400" />
                              <span>{playbackRate}x</span>
                            </button>

                            {showSpeedMenu && (
                              <div className="absolute bottom-9 right-0 bg-black/95 border border-white/15 rounded-xl p-1 shadow-2xl flex flex-col gap-0.5 z-40">
                                {PLAYBACK_RATES.map((rate) => (
                                  <button
                                    key={rate}
                                    onClick={() => handleSpeedSelect(rate)}
                                    className={`px-3 py-1 rounded-lg text-[10px] font-mono text-left transition-colors cursor-pointer ${
                                      playbackRate === rate
                                        ? 'bg-zinc-800 text-white font-bold'
                                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                                    }`}
                                  >
                                    {rate}x
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            onClick={togglePiP}
                            className="p-1 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer hidden sm:inline"
                            title="Picture in Picture"
                          >
                            <PictureInPicture2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={toggleFullscreen}
                            className="p-1 rounded text-zinc-400 hover:text-white transition-colors cursor-pointer"
                            title={isFullscreen ? 'Exit Fullscreen (F)' : 'Fullscreen (F)'}
                          >
                            {isFullscreen ? <Minimize className="w-3.5 h-3.5" /> : <Maximize className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <iframe
                    src={`${streamUrl}?autoplay=1`}
                    className="w-full h-full border-0 relative z-10"
                    allow="autoplay; encrypted-media; fullscreen"
                    allowFullScreen
                    title={cleanTitle}
                  />
                )
              ) : (
                /* Image Lightbox View with Skeleton Shimmer & Obsidian Fallback */
                <div
                  onClick={() => !modalImageFailed && setIsZoomed(!isZoomed)}
                  className="w-full h-full flex items-center justify-center p-3 cursor-pointer overflow-hidden z-10 relative"
                >
                  {/* Intuitive Skeleton Shimmer while loading */}
                  {!modalImageLoaded && !modalImageFailed && (
                    <div className="absolute inset-0 pointer-events-none overflow-hidden bg-zinc-950/40 z-0">
                      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                    </div>
                  )}

                  {!modalImageFailed ? (
                    <img
                      src={directImgUrl}
                      alt={cleanTitle}
                      loading="lazy"
                      onLoad={() => setModalImageLoaded(true)}
                      onError={() => setModalImageFailed(true)}
                      className={`max-w-full max-h-full object-contain rounded-xl shadow-2xl transition-all duration-300 ease-out relative z-10 ${
                        isZoomed ? 'scale-[1.65] cursor-zoom-out' : 'scale-100 cursor-zoom-in'
                      } ${modalImageLoaded ? 'opacity-100' : 'opacity-0'}`}
                    />
                  ) : (
                    /* Obsidian Typography Card Fallback for Image (Never a Black Slab) */
                    <div className="flex flex-col items-center justify-center p-6 text-center max-w-md relative z-10 select-none">
                      <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                        <Camera className="w-6 h-6 text-zinc-300" />
                      </div>
                      <h3 className="text-sm sm:text-base font-bold font-space text-zinc-100 uppercase tracking-wide truncate max-w-xs">
                        {cleanTitle}
                      </h3>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest mt-1">
                        {album?.name || 'SARWARCYOU PHOTOGRAPH'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Under-player Editorial Status Bar */}
            <div className="px-4 py-2.5 border-t border-white/[0.06] bg-[#09090b] flex items-center justify-between text-xs font-mono flex-shrink-0">
              <div className="truncate max-w-[70%]">
                <span className="font-medium text-zinc-100 text-[11px] tracking-wide block truncate">
                  {cleanTitle}
                </span>
                <span className="text-zinc-500 text-[9px] tracking-wider uppercase block mt-0.5">
                  {isVideo
                    ? `VIDEO ${currentIndex + 1} OF ${items.length} • SPATIAL HUD • 1080P CINEMATIC STREAM`
                    : isZoomed
                    ? `PHOTO ${currentIndex + 1} OF ${items.length} • ZOOMED 165% • LOSSLESS PHOTOGRAPHY`
                    : `PHOTO ${currentIndex + 1} OF ${items.length} • HIGH DEFINITION PHOTOGRAPHY`}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => goToIndex(currentIndex - 1)}
                  className="p-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer border border-white/[0.05]"
                  title="Previous (←)"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => goToIndex(currentIndex + 1)}
                  className="p-1.5 rounded-lg bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer border border-white/[0.05]"
                  title="Next (→)"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* ===== RIGHT PLAYLIST QUEUE (~28% DESKTOP) ===== */}
          <div className="w-full lg:w-[28%] h-full flex flex-col bg-[#09090b] rounded-2xl border border-white/[0.06] overflow-hidden shadow-xl flex-shrink-0">
            {/* Queue Header */}
            <div className="px-4 py-3 border-b border-white/[0.06] bg-[#09090b] flex items-center justify-between text-[10px] font-mono flex-shrink-0">
              <span className="font-semibold text-zinc-300 tracking-wider uppercase">
                QUEUE ({items.length})
              </span>
              <span className="text-zinc-500 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-400" /> READY
              </span>
            </div>

            {/* Scrollable Playlist Cards (With Slow Auto-Slide) */}
            <div
              ref={playlistContainerRef}
              onMouseEnter={() => {
                isQueueHoveredRef.current = true;
              }}
              onMouseLeave={() => {
                isQueueHoveredRef.current = false;
              }}
              onPointerDown={() => {
                isQueueInteractingRef.current = true;
              }}
              onPointerUp={() => {
                isQueueInteractingRef.current = false;
              }}
              className="flex-1 overflow-y-auto p-2.5 space-y-1.5 no-scrollbar"
            >
              {items.map((item, idx) => (
                <QueueCardItem
                  key={item.id || `queue-${idx}`}
                  item={item}
                  idx={idx}
                  isActive={idx === currentIndex}
                  onSelect={() => goToIndex(idx)}
                />
              ))}
            </div>

            <div className="px-4 py-2 border-t border-white/[0.04] bg-black text-center text-[9px] font-mono tracking-widest text-zinc-600 uppercase flex-shrink-0">
              CLICK OR SCROLL QUEUE
            </div>
          </div>
        </div>

        {/* ===== CONTEXT-AWARE RECOMMENDED ALBUMS (BELOW THE PLAYER) ===== */}
        {suggestedAlbums.length > 0 && (
          <div className="w-full mt-4 px-1 sm:px-2 pb-12 flex flex-col gap-6">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2.5">
                {currentItem.type === 'video' ? (
                  <Film className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Camera className="w-4 h-4 text-emerald-400" />
                )}
                <div>
                  <span className="text-[9px] font-mono tracking-[0.25em] text-zinc-500 uppercase block">
                    {currentItem.type === 'video' ? 'CURATED CINEMA VAULT' : 'CURATED PHOTOGRAPHY VAULT'}
                  </span>
                  <h3 className="text-sm sm:text-base font-bold font-space text-zinc-100 uppercase tracking-tight">
                    {currentItem.type === 'video' ? 'Suggested Video Albums' : 'Suggested Photo Albums'}
                  </h3>
                </div>
              </div>
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider hidden sm:inline">
                Click any reel item to switch playback
              </span>
            </div>

            {/* Horizontal Auto-Sliding Preview Reels (Dynamic 15s Batch Rotation with Hover Pause) */}
            <div
              onMouseEnter={() => setIsSuggestedHovered(true)}
              onMouseLeave={() => setIsSuggestedHovered(false)}
              className="flex flex-col gap-6"
            >
              {activeSuggestedBatch.map((sugAlbum) => (
                <SuggestedAlbumReel
                  key={sugAlbum.id}
                  album={sugAlbum}
                  onSelectItem={(targetAlbum, itemIdx) => {
                    if (onSwitchAlbum) {
                      onSwitchAlbum(targetAlbum, itemIdx);
                    }
                  }}
                />
              ))}

              {/* Batch rotation dots / indicator if more than 1 batch */}
              {totalSuggestedBatches > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  {Array.from({ length: totalSuggestedBatches }).map((_, bIdx) => (
                    <button
                      key={bIdx}
                      onClick={() => setSuggestedBatchIndex(bIdx)}
                      className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                        bIdx === suggestedBatchIndex % totalSuggestedBatches
                          ? 'w-6 bg-zinc-200'
                          : 'w-2 bg-zinc-700 hover:bg-zinc-500'
                      }`}
                      title={`Batch ${bIdx + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
