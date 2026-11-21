import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { StageMediaItem } from '../../types';
import { getMediaUrl, getVideoStreamUrl, getDirectHfVideoUrl } from '../../utils/imageUrlResolver';
import { resolveStaticVideoThumbnail } from '../../utils/thumbnailResolver';
import { isPhotoExtension } from '../../utils/mediaTypeDetector';

export interface LivingMediaCardProps {
  item: StageMediaItem;
  aspectRatio: '9/16' | '16/9' | '3/4';
  subfolderLabel?: string;
  onClick: () => void;
  delayIdx?: number;
  featuredBadge?: string;
}

/**
 * Pure Distraction-Free Media Card:
 * - Zero outlines, zero borders, zero rounded corners
 * - Direct instant display: thumbnails are pre-buffered by the tab/page loading gate
 * - Micro video hover preview (10% to 35% continuous loop)
 */
export const LivingMediaCard: React.FC<LivingMediaCardProps> = ({
  item,
  aspectRatio,
  onClick,
}) => {
  const [isPreviewActive, setIsPreviewActive] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const hoverTimerRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const isPhoto =
    item.type === 'image' || isPhotoExtension(item.path || item.url || item.name || '');

  const isVideo = !isPhoto;

  const imageSrc =
    (item as any).thumbnail ||
    (isVideo ? resolveStaticVideoThumbnail(item) : '') ||
    item.poster ||
    getMediaUrl(item.url || '');

  const videoSrc = isVideo
    ? getVideoStreamUrl(item) || getDirectHfVideoUrl(item)
    : null;

  const aspectClass =
    aspectRatio === '9/16'
      ? 'aspect-[9/16]'
      : aspectRatio === '16/9'
      ? 'aspect-video'
      : 'aspect-[3/4]';

  // Clean up hover timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const handleMouseEnter = useCallback(() => {
    if (!isVideo || !videoSrc) return;
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      setIsPreviewActive(true);
    }, 150);
  }, [isVideo, videoSrc]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsPreviewActive(false);
    setPreviewProgress(0);
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      } catch {}
    }
  }, []);

  const handleLoadedMetadata = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    v.muted = true;
    v.defaultMuted = true;
    const dur = v.duration;
    if (dur && !isNaN(dur) && dur > 0) {
      v.currentTime = dur * 0.1;
    }
    v.play().catch(() => {});
  }, []);

  const handleCanPlay = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    v.muted = true;
    v.defaultMuted = true;
    v.play().catch(() => {});
  }, []);

  const handleTimeUpdate = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const v = e.currentTarget;
    const dur = v.duration;
    if (!dur || isNaN(dur) || dur <= 0) return;

    const start = dur * 0.1;
    const end = dur * 0.35;

    if (v.currentTime >= end || v.currentTime < start) {
      v.currentTime = start;
    }

    const sliceLength = end - start;
    if (sliceLength > 0) {
      const pct = Math.min(100, Math.max(0, ((v.currentTime - start) / sliceLength) * 100));
      setPreviewProgress(pct);
    }
  }, []);

  return (
    <div
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        borderRadius: 0,
        outline: 'none',
        border: 'none',
      }}
      className={`relative group cursor-pointer ${aspectClass} select-none bg-[#080b12] overflow-hidden transition-transform duration-300 hover:scale-[1.04] hover:z-20 w-full`}
    >
      {/* Main Image: Bufferless instant display */}
      <img
        src={imageSrc}
        alt=""
        loading="eager"
        className="w-full h-full object-cover filter saturate-[0.95] contrast-[1.05]"
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      />

      {/* Micro Video Hover Preview Layer (Option B: 10% to 35% continuous loop) */}
      {isPreviewActive && videoSrc && (
        <video
          ref={videoRef}
          src={videoSrc}
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={handleLoadedMetadata}
          onCanPlay={handleCanPlay}
          onTimeUpdate={handleTimeUpdate}
          className="absolute inset-0 w-full h-full object-cover z-10 pointer-events-none transition-opacity duration-200"
          style={{ borderRadius: 0, outline: 'none', border: 'none' }}
        />
      )}

      {/* Tactical Thin Micro Progress Track */}
      {isPreviewActive && isVideo && (
        <div
          className="absolute bottom-0 inset-x-0 h-[2px] bg-white/20 z-20 pointer-events-none overflow-hidden"
          style={{ borderRadius: 0, outline: 'none', border: 'none' }}
        >
          <div
            className="h-full bg-[#38bdf8] shadow-[0_0_8px_#38bdf8] transition-all duration-75 ease-linear"
            style={{ width: `${previewProgress}%`, borderRadius: 0 }}
          />
        </div>
      )}

      {/* Subtle Cyber Preview Telemetry Chip */}
      {isPreviewActive && isVideo && (
        <div
          className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/85 border border-[#38bdf8]/40 shadow-[0_0_8px_rgba(0,0,0,0.8)] z-20 pointer-events-none flex items-center gap-1.5"
          style={{ borderRadius: 0, outline: 'none', border: 'none' }}
        >
          <span className="w-1.5 h-1.5 bg-[#38bdf8] shadow-[0_0_6px_#38bdf8] animate-pulse inline-block" />
          <span className="text-[9px] font-mono font-bold tracking-wider text-[#38bdf8] uppercase">
            PREVIEW
          </span>
        </div>
      )}
    </div>
  );
};

export default LivingMediaCard;
