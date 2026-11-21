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

const CIRCUMFERENCE = 150.8; // 2 * Math.PI * 24

/**
 * Pure Distraction-Free Media Card with Circular Percentage Loader
 * - Zero outlines, zero borders, zero rounded corners
 * - Zero entrance animation (replaces slide/drop with circular percentage loader)
 * - Circular SVG progress dial traces 0% to 100% with live numeric readout
 * - Upon reaching 100%, content reveals immediately without entrance animation
 * - Micro video hover preview (10% to 35% continuous loop)
 */
export const LivingMediaCard: React.FC<LivingMediaCardProps> = ({
  item,
  aspectRatio,
  onClick,
}) => {
  const [loadProgress, setLoadProgress] = useState(0);
  const [isReady, setIsReady] = useState(false);
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

  // Circular Loader Progress & Image Readiness Gate
  useEffect(() => {
    setIsReady(false);
    setLoadProgress(0);

    let progress = 0;
    let timer: number | null = null;
    let isCancelled = false;

    // Steady telemetry progression up to 92%
    timer = window.setInterval(() => {
      progress += Math.floor(Math.random() * 12) + 8;
      if (progress > 92) {
        progress = 92;
        if (timer) clearInterval(timer);
      }
      if (!isCancelled) setLoadProgress(progress);
    }, 45);

    const img = new Image();
    const handleLoaded = () => {
      if (timer) clearInterval(timer);
      if (isCancelled) return;
      setLoadProgress(100);
      setTimeout(() => {
        if (!isCancelled) {
          setIsReady(true);
        }
      }, 120);
    };

    img.onload = handleLoaded;
    img.onerror = handleLoaded;
    img.src = imageSrc;

    // Safety fallback
    const safetyTimer = window.setTimeout(() => {
      if (!isCancelled && !img.complete) {
        handleLoaded();
      }
    }, 3000);

    return () => {
      isCancelled = true;
      if (timer) clearInterval(timer);
      clearTimeout(safetyTimer);
    };
  }, [imageSrc]);

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
      {/* Circular Loading Graphic with Percentage: Replaces Entrance Animations */}
      {!isReady && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#070a12] select-none pointer-events-none">
          <div className="relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16">
            <svg
              className="w-full h-full -rotate-90"
              viewBox="0 0 64 64"
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              <circle
                cx="32"
                cy="32"
                r="24"
                className="stroke-white/10 fill-transparent"
                strokeWidth="2.5"
              />
              <circle
                cx="32"
                cy="32"
                r="24"
                className="stroke-[#38bdf8] fill-transparent transition-[stroke-dashoffset] duration-75 ease-linear"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={CIRCUMFERENCE - (loadProgress / 100) * CIRCUMFERENCE}
                style={{ filter: 'drop-shadow(0 0 5px rgba(56,189,248,0.8))' }}
              />
            </svg>
            <span
              className="absolute font-mono text-[10px] sm:text-[11px] font-bold text-white tracking-tighter"
              style={{ textShadow: '0 0 6px rgba(56,189,248,0.7)' }}
            >
              {loadProgress}%
            </span>
          </div>
        </div>
      )}

      {/* Main Image: Reveals immediately at 100% readiness with zero entrance animation */}
      <img
        src={imageSrc}
        alt=""
        loading="lazy"
        className={`w-full h-full object-cover filter saturate-[0.95] contrast-[1.05] ${
          isReady ? 'opacity-100' : 'opacity-0'
        }`}
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
