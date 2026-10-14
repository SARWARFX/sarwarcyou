/* oxlint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ensureHttps } from '../utils/imageUrlResolver';

/**
 * Global in-memory image cache and failure tracker.
 * Retains HTMLImageElement references so decoded image bitmaps stay
 * instantly accessible from memory with 0ms latency.
 */
const globalImageMemory = new Map<string, HTMLImageElement>();
const globalPreloadedUrls = new Set<string>();
const globalFailedUrls = new Set<string>();

/**
 * Preloads an array of image URLs immediately into browser memory.
 */
export function preloadImageFrames(urls: string[]): void {
  if (typeof window === 'undefined') return;
  for (const raw of urls) {
    if (!raw) continue;
    const safe = ensureHttps(raw);
    if (globalPreloadedUrls.has(safe) || globalFailedUrls.has(safe)) continue;

    const img = new Image();
    img.src = safe;
    img.onload = () => {
      globalPreloadedUrls.add(safe);
      globalPreloadedUrls.add(raw);
      globalImageMemory.set(safe, img);
      globalImageMemory.set(raw, img);
    };
    img.onerror = () => {
      globalFailedUrls.add(safe);
      globalFailedUrls.add(raw);
    };
  }
}

export function isFramePreloaded(url: string): boolean {
  const safe = ensureHttps(url);
  return globalPreloadedUrls.has(safe) || globalImageMemory.has(safe);
}

export function isFrameFailed(url: string): boolean {
  const safe = ensureHttps(url);
  return globalFailedUrls.has(safe);
}

export function markFrameFailed(url: string): void {
  const safe = ensureHttps(url);
  globalFailedUrls.add(safe);
  globalFailedUrls.add(url);
}

export interface UseThumbnailScrubberOptions {
  thumbnails?: string[];
  defaultThumbnail?: string | null;
  isHovered: boolean;
  manualIndex?: number | null;
  intervalMs?: number;
  enabled?: boolean;
}

export interface UseThumbnailScrubberResult {
  activeThumbnail: string | null;
  activeFrameIndex: number;
  isScrubbing: boolean;
  totalFrames: number;
  validThumbnails: string[];
  handleFrameError: (failedUrl?: string | null) => void;
  preloadFrames: (extraUrls?: string[]) => void;
}

/**
 * High-performance React hook for video thumbnail hover scrubbing.
 * Features:
 * - Instant eager preloading on hover
 * - Throttled frame calculation support
 * - Double-buffered / zero-blanking frame latching
 * - Resilient 404 / missing frame skip and fallback to last valid frame
 */
export function useThumbnailScrubber({
  thumbnails = [],
  defaultThumbnail = null,
  isHovered,
  manualIndex = null,
  intervalMs = 380,
  enabled = true,
}: UseThumbnailScrubberOptions): UseThumbnailScrubberResult {
  const [localFailedUrls, setLocalFailedUrls] = useState<Set<string>>(() => new Set());
  const localFailedUrlsRef = useRef<Set<string>>(localFailedUrls);
  localFailedUrlsRef.current = localFailedUrls;

  // Filter out any known failed URLs
  const validThumbnails = useMemo(() => {
    return thumbnails.filter((url) => {
      if (!url) return false;
      const safe = ensureHttps(url);
      return !localFailedUrls.has(url) && !localFailedUrls.has(safe) && !globalFailedUrls.has(safe);
    });
  }, [thumbnails, localFailedUrls]);

  const totalFrames = validThumbnails.length;
  const initialFrame = validThumbnails[0] || defaultThumbnail || null;

  // Track last successfully rendered / valid frame URL
  const lastValidFrameRef = useRef<string | null>(initialFrame);
  if (initialFrame && !lastValidFrameRef.current) {
    lastValidFrameRef.current = initialFrame;
  }

  const [activeFrameIndex, setActiveFrameIndex] = useState(0);

  // Eager preloading helper
  const preloadFrames = useCallback((extraUrls?: string[]) => {
    const targets = extraUrls || validThumbnails;
    if (targets.length === 0) return;
    preloadImageFrames(targets);
  }, [validThumbnails]);

  // Preload all companion frames immediately on hover
  useEffect(() => {
    if (isHovered && totalFrames > 1 && enabled) {
      preloadFrames();
    }
  }, [isHovered, totalFrames, enabled, preloadFrames]);

  // Sync manualIndex from mouseMove if provided
  useEffect(() => {
    if (manualIndex !== null && manualIndex !== undefined && totalFrames > 0) {
      const clamped = Math.max(0, Math.min(totalFrames - 1, manualIndex));
      setActiveFrameIndex(clamped);
    }
  }, [manualIndex, totalFrames]);

  // Auto-rotation loop when hovered and no manual scrub active
  useEffect(() => {
    if (!isHovered || totalFrames <= 1 || !enabled || manualIndex !== null) {
      if (!isHovered) {
        setActiveFrameIndex(0);
      }
      return;
    }

    const timer = setInterval(() => {
      setActiveFrameIndex((prev) => (prev + 1) % totalFrames);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isHovered, totalFrames, intervalMs, enabled, manualIndex]);

  // 404 / Missing Frame Handler
  const handleFrameError = useCallback((failedUrl?: string | null) => {
    if (!failedUrl) return;
    const safe = ensureHttps(failedUrl);
    markFrameFailed(failedUrl);
    markFrameFailed(safe);

    setLocalFailedUrls((prev) => {
      const next = new Set(prev);
      next.add(failedUrl);
      next.add(safe);
      return next;
    });

    // Reset frame index to safe bounds
    setActiveFrameIndex((cur) => Math.max(0, cur - 1));
  }, []);

  const isScrubbing = isHovered && totalFrames > 1 && enabled;

  // Latch onto targeted frame, or fall back to last valid frame without collapsing
  const candidateThumbnail = isScrubbing ? validThumbnails[activeFrameIndex] : initialFrame;
  const activeThumbnail = candidateThumbnail || lastValidFrameRef.current || defaultThumbnail || null;

  if (activeThumbnail) {
    lastValidFrameRef.current = activeThumbnail;
  }

  return {
    activeThumbnail,
    activeFrameIndex: isScrubbing ? activeFrameIndex : 0,
    isScrubbing,
    totalFrames,
    validThumbnails,
    handleFrameError,
    preloadFrames,
  };
}
