import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { StageMediaItem } from '../types';
import { isPhotoExtension } from '../utils/mediaTypeDetector';
import { getMediaUrl } from '../utils/imageUrlResolver';
import { FALLBACK_HF_CATALOG } from '../data/fallbackData';

export interface AmbientWallpaperProps {
  items?: StageMediaItem[];
  isPaused?: boolean;
}

interface SlotState {
  currentUrl: string;
  incomingUrl: string | null;
  incomingReady: boolean;
}

/**
 * Extracts a unique, verified pool of image URLs strictly scoped to "Images/Images 2025".
 * Includes defensive fallback to all "Images/" items if no 2025 items match.
 */
function extractImageUrls(items?: StageMediaItem[]): string[] {
  const seen = new Set<string>();

  const isImageItem = (item: StageMediaItem | { type?: string; name?: string; path?: string; url?: string; mediaType?: string }): boolean => {
    if (item.type === 'image' || (item as any).mediaType === 'photo') return true;
    const name = item.name || '';
    const path = item.path || '';
    const url = item.url || '';
    return (
      /\.(jpe?g|png|webp|avif)$/i.test(name) ||
      isPhotoExtension(path) ||
      isPhotoExtension(url)
    );
  };

  const isImages2025 = (item: StageMediaItem | { path?: string; url?: string; name?: string; folder?: string; parentAlbum?: string; category?: string }): boolean => {
    const fullPath = (
      item.path ||
      (item as any).folder ||
      item.url ||
      (item as any).parentAlbum ||
      (item as any).category ||
      ''
    ).toLowerCase();
    return (
      fullPath.includes('images 2025') ||
      fullPath.includes('images%202025') ||
      fullPath.includes('images/images 2025') ||
      fullPath.includes('images/h2025') ||
      fullPath.includes('/h2025/') ||
      fullPath.includes('h2025 photos') ||
      fullPath.includes('h2025')
    );
  };

  const toResolvedUrl = (rawUrl?: string | null): string | null => {
    if (!rawUrl) return null;
    const resolved = getMediaUrl(rawUrl);
    if (!resolved || resolved.includes('ustream_thumb')) return null;
    return resolved;
  };

  const allCandidateItems: Array<StageMediaItem | { path: string; url: string; name?: string; type?: string }> = [];

  if (items && items.length > 0) {
    for (const item of items) {
      allCandidateItems.push(item);
    }
  }

  // Also include FALLBACK_HF_CATALOG images as candidate sources
  if (FALLBACK_HF_CATALOG?.images) {
    for (const img of FALLBACK_HF_CATALOG.images) {
      allCandidateItems.push(img);
    }
  }

  // 1. Primary Filter: Strictly Images/Images 2025
  const scoped2025Urls: string[] = [];
  for (const item of allCandidateItems) {
    if (isImageItem(item) && isImages2025(item)) {
      const url = toResolvedUrl(item.url || item.path);
      if (url && !seen.has(url)) {
        seen.add(url);
        scoped2025Urls.push(url);
      }
    }
  }

  if (scoped2025Urls.length > 0) {
    return scoped2025Urls;
  }

  // 2. Defensive Fallback: If 0 items matched Images 2025, warn and fall back to all images under Images/
  console.warn('[AmbientWallpaper] No images found matching Images 2025; falling back to all catalog images under Images/');
  const fallbackUrls: string[] = [];
  for (const item of allCandidateItems) {
    if (isImageItem(item)) {
      const p = (item.path || item.url || item.name || '').toLowerCase();
      if (p.includes('/images/') || p.startsWith('images/') || isPhotoExtension(p)) {
        const url = toResolvedUrl(item.url || item.path);
        if (url && !seen.has(url)) {
          seen.add(url);
          fallbackUrls.push(url);
        }
      }
    }
  }

  return fallbackUrls;
}

function getRandomItem<T>(arr: T[], exclude: T[] = []): T | null {
  if (arr.length === 0) return null;
  const candidates = arr.filter((x) => !exclude.includes(x));
  const pool = candidates.length > 0 ? candidates : arr;
  const index = Math.floor(Math.random() * pool.length);
  return pool[index] ?? null;
}

export const AmbientWallpaper: React.FC<AmbientWallpaperProps> = ({
  items,
  isPaused = false,
}) => {
  const imagePool = useMemo(() => extractImageUrls(items), [items]);

  // Initial random distinct images for each slot
  const initialUrls = useMemo(() => {
    if (imagePool.length === 0) return { slot0: '', slot1: '' };
    const first = getRandomItem(imagePool) || '';
    const second = getRandomItem(imagePool, [first]) || first;
    return { slot0: first, slot1: second };
  }, [imagePool]);

  const [slot0, setSlot0] = useState<SlotState>(() => ({
    currentUrl: initialUrls.slot0,
    incomingUrl: null,
    incomingReady: false,
  }));

  const [slot1, setSlot1] = useState<SlotState>(() => ({
    currentUrl: initialUrls.slot1,
    incomingUrl: null,
    incomingReady: false,
  }));

  // Synchronize initial URLs once imagePool is populated on cold boot
  useEffect(() => {
    if (!slot0.currentUrl && initialUrls.slot0) {
      setSlot0((prev) => ({ ...prev, currentUrl: initialUrls.slot0 }));
    }
    if (!slot1.currentUrl && initialUrls.slot1) {
      setSlot1((prev) => ({ ...prev, currentUrl: initialUrls.slot1 }));
    }
  }, [initialUrls, slot0.currentUrl, slot1.currentUrl]);

  const activeTransitionTimer0 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTransitionTimer1 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickCountRef = useRef(0);

  // Crossfade trigger for a specific slot
  const cycleSlot = useCallback(
    (slotIndex: 0 | 1) => {
      if (imagePool.length === 0) return;

      if (slotIndex === 0) {
        setSlot0((prev) => {
          // If already transitioning, skip until finished
          if (prev.incomingUrl) return prev;
          const nextUrl = getRandomItem(imagePool, [prev.currentUrl, slot1.currentUrl]);
          if (!nextUrl || nextUrl === prev.currentUrl) return prev;
          return { ...prev, incomingUrl: nextUrl, incomingReady: false };
        });
      } else {
        setSlot1((prev) => {
          // If already transitioning, skip until finished
          if (prev.incomingUrl) return prev;
          const nextUrl = getRandomItem(imagePool, [prev.currentUrl, slot0.currentUrl]);
          if (!nextUrl || nextUrl === prev.currentUrl) return prev;
          return { ...prev, incomingUrl: nextUrl, incomingReady: false };
        });
      }
    },
    [imagePool, slot0.currentUrl, slot1.currentUrl]
  );

  // Staggered 10-second cycling: ticks every 5 seconds, alternating between Slot 1 and Slot 0
  // Each slot cycles once every 10 seconds, offset by 5 seconds
  useEffect(() => {
    if (isPaused || imagePool.length === 0) return;

    const intervalId = setInterval(() => {
      const tick = tickCountRef.current++;
      // Alternate slots: odd ticks cycle Slot 1 (desktop right), even ticks cycle Slot 0 (left/mobile)
      if (tick % 2 === 0) {
        cycleSlot(1);
      } else {
        cycleSlot(0);
      }
    }, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [isPaused, imagePool.length, cycleSlot]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (activeTransitionTimer0.current) clearTimeout(activeTransitionTimer0.current);
      if (activeTransitionTimer1.current) clearTimeout(activeTransitionTimer1.current);
    };
  }, []);

  return (
    <>
      {/* 1. Dynamic Zero-Gap Multi-Slot Ambient Background Engine (Raw, Full Brightness, Zero Scrims) */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none -z-20 overflow-hidden grid grid-cols-1 md:grid-cols-2 w-full h-full select-none"
      >
        {/* Slot 0: Primary pane (Full viewport on mobile, Left 50% on desktop) */}
        <div className="relative w-full h-full overflow-hidden">
          {slot0.currentUrl && (
            <img
              src={slot0.currentUrl}
              alt=""
              loading="eager"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
              style={{ filter: 'none' }}
            />
          )}
          {slot0.incomingUrl && (
            <img
              src={slot0.incomingUrl}
              alt=""
              loading="eager"
              decoding="async"
              onLoad={() => {
                setSlot0((prev) => ({ ...prev, incomingReady: true }));
                if (activeTransitionTimer0.current) clearTimeout(activeTransitionTimer0.current);
                activeTransitionTimer0.current = setTimeout(() => {
                  setSlot0((prev) => ({
                    currentUrl: prev.incomingUrl || prev.currentUrl,
                    incomingUrl: null,
                    incomingReady: false,
                  }));
                }, 1000);
              }}
              onError={() => {
                setSlot0((prev) => ({ ...prev, incomingUrl: null, incomingReady: false }));
              }}
              className={`absolute inset-0 w-full h-full object-cover select-none pointer-events-none transition-opacity duration-1000 ease-in-out ${
                slot0.incomingReady ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ filter: 'none' }}
            />
          )}
        </div>

        {/* Slot 1: Secondary pane (Right 50% on desktop, Hidden on mobile) */}
        <div className="relative w-full h-full overflow-hidden hidden md:block">
          {slot1.currentUrl && (
            <img
              src={slot1.currentUrl}
              alt=""
              loading="eager"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
              style={{ filter: 'none' }}
            />
          )}
          {slot1.incomingUrl && (
            <img
              src={slot1.incomingUrl}
              alt=""
              loading="eager"
              decoding="async"
              onLoad={() => {
                setSlot1((prev) => ({ ...prev, incomingReady: true }));
                if (activeTransitionTimer1.current) clearTimeout(activeTransitionTimer1.current);
                activeTransitionTimer1.current = setTimeout(() => {
                  setSlot1((prev) => ({
                    currentUrl: prev.incomingUrl || prev.currentUrl,
                    incomingUrl: null,
                    incomingReady: false,
                  }));
                }, 1000);
              }}
              onError={() => {
                setSlot1((prev) => ({ ...prev, incomingUrl: null, incomingReady: false }));
              }}
              className={`absolute inset-0 w-full h-full object-cover select-none pointer-events-none transition-opacity duration-1000 ease-in-out ${
                slot1.incomingReady ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ filter: 'none' }}
            />
          )}
        </div>
      </div>
    </>
  );
};

export default AmbientWallpaper;
