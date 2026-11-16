import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play } from 'lucide-react';
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

export const LivingMediaCard: React.FC<LivingMediaCardProps> = ({
  item,
  aspectRatio,
  onClick,
  delayIdx = 0,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
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
    // Only trigger video preview on desktop/devices with pointer:fine
    if (typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches) {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      // 240ms hover delay prevents accidental trigger during rapid cursor sweeps
      hoverTimerRef.current = setTimeout(() => {
        setIsHovered(true);
      }, 240);
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
      className={`animate-card-enter group relative rounded-none overflow-hidden bg-[#090d16] border-0 cursor-pointer ${aspectClass} transition-all duration-300 ease-out hover:scale-[1.08] hover:z-30 hover:shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_30px_rgba(0, 240, 255,0.4)] active:scale-[0.98] select-none`}
    >
      {/* Static High-Res Poster Thumbnail */}
      <img
        src={imageSrc}
        alt={item.title || item.name}
        loading="lazy"
        className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 ${
          isVideoReady ? 'opacity-0' : 'opacity-100'
        }`}
      />

      {/* Living Video Micro-Loop Preview (Desktop/Tablet on sustained hover) */}
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

      {/* Cyber Corner Reticles on Hover */}
      <div className="absolute top-1.5 left-1.5 w-2.5 h-2.5 border-t-2 border-l-2 border-[#00f0ff] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20" />
      <div className="absolute top-1.5 right-1.5 w-2.5 h-2.5 border-t-2 border-r-2 border-[#00f0ff] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20" />
      <div className="absolute bottom-1.5 left-1.5 w-2.5 h-2.5 border-b-2 border-l-2 border-[#00f0ff] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20" />
      <div className="absolute bottom-1.5 right-1.5 w-2.5 h-2.5 border-b-2 border-r-2 border-[#00f0ff] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20" />

      {/* Center Play Button Overlay on Hover */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
        <div className="w-11 h-11 rounded-full bg-[#00d2ff] text-black flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
          <Play className="w-5 h-5 fill-current ml-0.5" />
        </div>
      </div>
    </div>
  );
};

export default LivingMediaCard;
