import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { StageMediaItem } from '../../types';
import { FALLBACK_HF_CATALOG } from '../../data/fallbackData';
import { resolveStaticVideoThumbnail } from '../../utils/thumbnailResolver';
import { isPhotoExtension, isVideoExtension } from '../../utils/mediaTypeDetector';

export interface BackgroundThumbnailCacheToastProps {
  items?: StageMediaItem[];
  enabled?: boolean;
}

/**
 * Background Thumbnail Cache Engine with Bottom-Right Notification
 * - Runs silently after visitor lands on the homepage
 * - Pre-caches all video clips, shorts, and photo thumbnails concurrently via new Image()
 * - Displays a sleek, minimalist notification on the bottom-right corner (zero overlap with left subfolders)
 * - Zero rounded corners (0px), zero outline strokes
 * - Fades away smoothly once caching is complete
 */
export const BackgroundThumbnailCacheToast: React.FC<BackgroundThumbnailCacheToastProps> = ({
  items,
  enabled = true,
}) => {
  const [status, setStatus] = useState<'idle' | 'caching' | 'complete' | 'hidden'>('idle');
  const [loadedCount, setLoadedCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const hasStartedRef = useRef(false);

  // Extract only video clips and shorts thumbnails to cache in background (skipping photographs/images)
  const targetUrls = useMemo(() => {
    const urls: string[] = [];
    const seen = new Set<string>();

    const extractThumb = (item: any): string => {
      if (!item) return '';
      if (item.thumbnail && typeof item.thumbnail === 'string' && !isVideoExtension(item.thumbnail)) {
        return item.thumbnail;
      }
      const resolved = resolveStaticVideoThumbnail(item);
      if (resolved && !isVideoExtension(resolved)) {
        return resolved;
      }
      if (item.poster && !isVideoExtension(item.poster)) {
        return item.poster;
      }
      return '';
    };

    const addUrl = (item: any) => {
      const url = extractThumb(item);
      if (url && !seen.has(url)) {
        seen.add(url);
        urls.push(url);
      }
    };

    if (items && items.length > 0) {
      // Filter strictly for video clips and shorts; photographs are omitted to keep network and cache light
      const videosAndShorts = items.filter((it) => !isPhotoExtension(it.path || it.url || it.name || ''));
      videosAndShorts.forEach(addUrl);
    } else {
      const shorts = FALLBACK_HF_CATALOG.shorts || [];
      const clips = FALLBACK_HF_CATALOG.clips || [];
      // Only cache video clips and shorts
      shorts.forEach(addUrl);
      clips.forEach(addUrl);
    }

    return urls;
  }, [items]);

  useEffect(() => {
    if (!enabled || hasStartedRef.current || targetUrls.length === 0) return;
    hasStartedRef.current = true;

    // Small delay so user settles into the homepage before the toast slides in
    const startTimer = setTimeout(() => {
      const total = targetUrls.length;
      setTotalCount(total);
      setStatus('caching');

      let completed = 0;
      let currentIndex = 0;
      const CONCURRENCY = 8; // Concurrently fetch 8 thumbnails at a time to prevent network stalls

      const loadNext = () => {
        if (currentIndex >= total) return;
        const url = targetUrls[currentIndex++];
        const img = new Image();

        const onFinish = () => {
          completed++;
          setLoadedCount(completed);
          if (completed >= total) {
            setStatus('complete');
            // Disappear smoothly after 2.5 seconds
            setTimeout(() => {
              setStatus('hidden');
            }, 2500);
          } else {
            loadNext();
          }
        };

        img.onload = onFinish;
        img.onerror = onFinish;
        img.src = url;
      };

      // Seed initial worker pool
      const initialPoolSize = Math.min(CONCURRENCY, total);
      for (let i = 0; i < initialPoolSize; i++) {
        loadNext();
      }
    }, 600);

    return () => clearTimeout(startTimer);
  }, [enabled, targetUrls]);

  if (status === 'idle' || status === 'hidden') return null;

  return (
    <div
      className={`fixed bottom-5 right-5 sm:bottom-7 sm:right-7 z-40 select-none bg-[#07090e]/95 border border-[#38bdf8]/30 px-3.5 sm:px-4 py-2 sm:py-2.5 flex items-center gap-3 shadow-[0_4px_24px_rgba(0,0,0,0.8)] backdrop-blur-md transition-all duration-400 ${
        status === 'complete' ? 'border-[#22c55e]/40' : ''
      }`}
      style={{
        borderRadius: 0,
        outline: 'none',
        fontFamily: "'Science Gothic', sans-serif",
      }}
    >
      {/* Radar Pulse Indicator */}
      <div
        className={`w-2 h-2 shrink-0 ${
          status === 'complete'
            ? 'bg-[#22c55e] shadow-[0_0_8px_#22c55e]'
            : 'bg-[#38bdf8] shadow-[0_0_8px_#38bdf8] animate-pulse'
        }`}
        style={{ borderRadius: 0 }}
      />

      {/* Caching Status Text */}
      <div className="text-[10px] sm:text-[11px] font-bold tracking-[0.12em] uppercase text-[#cbd5e1] whitespace-nowrap">
        {status === 'complete' ? (
          <>
            <span className="text-[#22c55e]">CACHE //</span> {totalCount} ASSETS INDEXED
          </>
        ) : (
          <>
            <span className="text-[#38bdf8]">CACHE ENGINE //</span> INDEXING THUMBNAILS ({loadedCount}/{totalCount})
          </>
        )}
      </div>
    </div>
  );
};

export default BackgroundThumbnailCacheToast;
