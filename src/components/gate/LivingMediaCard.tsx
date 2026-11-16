import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { StageMediaItem } from '../../types';
import { getVideoStreamUrl, getMediaUrl } from '../../utils/imageUrlResolver';
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
 * Tactical Cyberpunk Media Card
 * Inspired by portfolio photo frame:
 * - Corner L-brackets on top-left (#00f0ff) and bottom-right (#00f0ff / #ff2bd6)
 * - Inner photo box with border border-[#00f0ff]/35, deep space obsidian background
 * - 6px scanline texture overlay
 * - Live animated scanning laser line
 * - Scale on hover with zero rounded corners (pure square)
 * - Zero-text design
 */
export const LivingMediaCard: React.FC<LivingMediaCardProps> = ({
  item,
  aspectRatio,
  onClick,
  delayIdx = 0,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isThumbnailLoaded, setIsThumbnailLoaded] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const isPhoto =
    item.type === 'image' || isPhotoExtension(item.path || item.url || item.name || '');

  const isVideo = !isPhoto;

  const imageSrc =
    (item as any).thumbnail ||
    (isVideo ? resolveStaticVideoThumbnail(item) : '') ||
    item.poster ||
    getMediaUrl(item.url || '');

  const videoStreamUrl = isVideo ? getVideoStreamUrl(item.url || item.path || '') : '';

  const handleMouseEnter = useCallback(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        setIsHovered(true);
      }, 200);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsHovered(false);
    setIsVideoReady(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const aspectClass =
    aspectRatio === '9/16'
      ? 'aspect-[9/16]'
      : aspectRatio === '16/9'
      ? 'aspect-video'
      : 'aspect-[3/4]';

  return (
    <div
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ animationDelay: `${Math.min(delayIdx, 15) * 25}ms` }}
      className={`relative p-2.5 sm:p-3.5 group cursor-pointer ${aspectClass} select-none rounded-none transition-all duration-300 hover:scale-[1.025] hover:z-30`}
    >
      {/* 1. Tactical Top-Left White L-Bracket */}
      <div className="absolute top-0 left-0 w-6 sm:w-8 h-6 sm:h-8 border-t-2 border-l-2 border-white pointer-events-none z-20 group-hover:shadow-[0_0_14px_#ffffff] transition-all" />

      {/* 2. Tactical Bottom-Right White L-Bracket */}
      <div className="absolute bottom-0 right-0 w-6 sm:w-8 h-6 sm:h-8 border-b-2 border-r-2 border-white pointer-events-none z-20 group-hover:shadow-[0_0_14px_#ffffff] transition-all" />

      {/* 3. Inner Cyber Photo Box */}
      <div className="relative w-full h-full overflow-hidden border border-white/30 bg-[#05070c] shadow-[0_0_35px_rgba(255,255,255,0.06),inset_0_0_25px_rgba(255,255,255,0.02)] group-hover:border-white group-hover:shadow-[0_0_45px_rgba(255,255,255,0.2)] rounded-none">
        {/* Scanline Grid Texture Overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-15 opacity-30 bg-[linear-gradient(transparent_50%,rgba(255,255,255,0.04)_50%)] bg-[length:100%_6px]"
          aria-hidden="true"
        />

        {/* Live Animated Scanning Laser Line - Shows ONLY while thumbnail is loading */}
        {!isThumbnailLoaded && (
          <div className="animate-cyber-scan pointer-events-none opacity-80" />
        )}

        {/* Static High-Res Poster Thumbnail */}
        <img
          src={imageSrc}
          alt={item.title || item.name}
          loading="lazy"
          onLoad={() => setIsThumbnailLoaded(true)}
          onError={() => setIsThumbnailLoaded(true)}
          className={`w-full h-full object-cover filter saturate-[0.92] contrast-[1.05] transition-transform duration-500 group-hover:scale-[1.035] ${
            isVideoReady ? 'opacity-0' : 'opacity-100'
          }`}
        />

        {/* Living Video Micro-Loop Preview (Desktop sustained hover) */}
        {isVideo && isHovered && videoStreamUrl && (
          <video
            ref={videoRef}
            src={videoStreamUrl}
            muted
            loop
            autoPlay
            playsInline
            onCanPlay={() => setIsVideoReady(true)}
            className={`absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-300 pointer-events-none ${
              isVideoReady ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
      </div>
    </div>
  );
};

export default LivingMediaCard;
