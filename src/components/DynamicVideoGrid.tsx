import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Film, Calendar } from 'lucide-react';
import type { StageMediaItem } from '../types';
import { sanitizeMediaTitle } from '../utils/titleSanitizer';
import { getMediaUrl } from '../utils/imageUrlResolver';
import { isVideoExtension } from '../utils/mediaTypeDetector';
import { getCachedVideoThumbnail, generateVideoThumbnail } from '../utils/videoThumbnailGenerator';

export interface DynamicVideoGridProps {
  videos: StageMediaItem[];
  onPlayVideo: (item: StageMediaItem, playlistContext?: StageMediaItem[]) => void;
  title?: string;
  className?: string;
  limit?: number;
}

const VideoCardItem: React.FC<{
  item: StageMediaItem;
  allVideos: StageMediaItem[];
  onPlay: (item: StageMediaItem, playlistContext?: StageMediaItem[]) => void;
}> = ({ item, allVideos, onPlay }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverIntentTimerRef = useRef<number | null>(null);
  const previewDurationTimerRef = useRef<number | null>(null);

  const [isInViewport, setIsInViewport] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);

  const cleanTitle = sanitizeMediaTitle(item.title || item.name || 'Stream Vault Clip', item.category);
  const streamUrl = getMediaUrl(item.url || item.path || item.id);

  const staticPoster =
    item.thumbnails?.[0] ||
    item.posterUrl ||
    item.poster ||
    item.thumbnail;

  const posterSrc = staticPoster && !isVideoExtension(staticPoster) ? getMediaUrl(staticPoster) : null;

  const [videoThumb, setVideoThumb] = useState<string | null>(() => {
    return !posterSrc ? getCachedVideoThumbnail(streamUrl) : null;
  });

  // Observe viewport visibility
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting);
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Generate thumbnail if missing static poster
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

  // Clean up all timers on unmount
  useEffect(() => {
    return () => {
      if (hoverIntentTimerRef.current) clearTimeout(hoverIntentTimerRef.current);
      if (previewDurationTimerRef.current) clearTimeout(previewDurationTimerRef.current);
    };
  }, []);

  // 600ms Intent Engine: only trigger 3s muted preview if hover >600ms continuously
  const handleMouseEnter = useCallback(() => {
    if (hoverIntentTimerRef.current) clearTimeout(hoverIntentTimerRef.current);

    hoverIntentTimerRef.current = window.setTimeout(() => {
      setIsPreviewActive(true);

      // Snippet duration cap: strictly 3 seconds
      if (previewDurationTimerRef.current) clearTimeout(previewDurationTimerRef.current);
      previewDurationTimerRef.current = window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.pause();
        }
      }, 3000);
    }, 600);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverIntentTimerRef.current) {
      clearTimeout(hoverIntentTimerRef.current);
      hoverIntentTimerRef.current = null;
    }
    if (previewDurationTimerRef.current) {
      clearTimeout(previewDurationTimerRef.current);
      previewDurationTimerRef.current = null;
    }
    setIsPreviewActive(false);
    setVideoLoaded(false);
  }, []);

  const displayImage = posterSrc || videoThumb;

  return (
    <div
      ref={cardRef}
      role="button"
      tabIndex={0}
      onClick={() => onPlay(item, allVideos)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onPlay(item, allVideos);
        }
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-label={`Watch video: ${cleanTitle}`}
      className="group flex flex-col gap-2.5 cursor-pointer select-none text-left"
    >
      {/* 16:9 Thumbnail Frame */}
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-zinc-950 border border-white/10 group-hover:border-[#00E5FF]/60 shadow-md group-hover:shadow-[0_0_25px_rgba(0,229,255,0.25)] transition-all duration-300 transform group-hover:-translate-y-1">
        {/* High-res Poster / Thumbnail */}
        {displayImage ? (
          <img
            src={displayImage}
            alt={cleanTitle}
            loading="lazy"
            decoding="async"
            onLoad={() => setImgLoaded(true)}
            className={`w-full h-full object-cover object-center transition-all duration-500 group-hover:scale-105 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            } ${isPreviewActive && videoLoaded ? 'opacity-0' : 'opacity-100'}`}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-zinc-900 via-neutral-900 to-black flex items-center justify-center">
            <Film className="w-8 h-8 text-white/20" />
          </div>
        )}

        {/* 600ms Intent Video Preview (Mounted strictly when intent verified) */}
        {isPreviewActive && streamUrl && (
          <video
            ref={videoRef}
            src={streamUrl}
            autoPlay
            muted
            playsInline
            crossOrigin="anonymous"
            onLoadedData={() => setVideoLoaded(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              videoLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Duration / HD Badge */}
        <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1.5">
          <span className="px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-[11px] font-mono font-medium text-white border border-white/10 shadow">
            HD
          </span>
        </div>

        {/* Play Pulse Overlay on Hover */}
        <div className="absolute inset-0 flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <div className="w-12 h-12 rounded-full bg-[#00E5FF]/90 text-black flex items-center justify-center shadow-[0_0_20px_rgba(0,229,255,0.8)] transform scale-90 group-hover:scale-100 transition-transform">
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </div>
        </div>
      </div>

      {/* Video Metadata */}
      <div className="flex flex-col gap-1 px-0.5">
        <h3 className="text-sm font-bold text-white group-hover:text-[#00E5FF] transition-colors line-clamp-2 leading-snug">
          {cleanTitle}
        </h3>

        <div className="flex items-center gap-2 text-xs text-zinc-400 font-mono">
          {item.category && (
            <span className="uppercase text-[11px] text-[#00E5FF]/80 truncate">
              {item.category}
            </span>
          )}
          {item.date && (
            <>
              <span className="text-zinc-600">•</span>
              <span className="flex items-center gap-1 text-[11px]">
                <Calendar className="w-3 h-3 text-zinc-500" />
                {new Date(item.date).toLocaleDateString(undefined, {
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const DynamicVideoGrid: React.FC<DynamicVideoGridProps> = ({
  videos,
  onPlayVideo,
  title = 'Featured Videos',
  className = '',
  limit,
}) => {
  if (!videos || videos.length === 0) return null;

  const displayVideos = limit ? videos.slice(0, limit) : videos;

  return (
    <section className={`w-full flex flex-col gap-4 select-none ${className}`}>
      {/* Section Header */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#00E5FF]/10 border border-[#00E5FF]/30 text-[#00E5FF]">
            <Film className="w-4 h-4" />
          </div>
          <h2 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>{title}</span>
            <span className="text-xs font-mono text-zinc-500 font-normal">({videos.length})</span>
          </h2>
        </div>
      </div>

      {/* Responsive Multi-Column Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {displayVideos.map((video) => (
          <VideoCardItem
            key={video.id || video.url}
            item={video}
            allVideos={videos}
            onPlay={onPlayVideo}
          />
        ))}
      </div>
    </section>
  );
};

export default DynamicVideoGrid;
