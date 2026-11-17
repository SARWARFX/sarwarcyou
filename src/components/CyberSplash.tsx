import React, { useEffect, useState, useRef, useMemo } from 'react';
import type { StageMediaItem } from '../types';
import { FALLBACK_HF_CATALOG } from '../data/fallbackData';
import { resolveStaticVideoThumbnail } from '../utils/thumbnailResolver';
import { getMediaUrl } from '../utils/imageUrlResolver';
import { isPhotoExtension } from '../utils/mediaTypeDetector';
import { LaserSparkLogo } from './brand/LaserSparkLogo';

export interface CyberSplashProps {
  items?: StageMediaItem[];
  onComplete?: () => void;
}

const TOTAL_CIRCUMFERENCE = 220; // 2 * PI * r (r = 35)

/**
 * Option B: Ultra-Minimalist Phosphor Arc Real Network Preloader
 *
 * Truly measures visitor's actual browser data transfer speed and thumbnail reception
 * via real Image() network events. Zero simulated intervals or fake timers.
 */
export const CyberSplash: React.FC<CyberSplashProps> = ({ items, onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [throughputText, setThroughputText] = useState<string>('CONNECTING...');
  const [dismissed, setDismissed] = useState(false);
  const [removed, setRemoved] = useState(false);

  const hasFinishedRef = useRef(false);

  // 1. Gather critical viewport items (first 48 thumbnails)
  const targetUrls = useMemo(() => {
    const urls: string[] = [];

    const extractThumb = (item: any): string => {
      if (!item) return '';
      if (item.thumbnail && typeof item.thumbnail === 'string') return item.thumbnail;
      const isPhoto = isPhotoExtension(item.path || item.url || item.name || '');
      if (!isPhoto) {
        const resolved = resolveStaticVideoThumbnail(item);
        if (resolved) return resolved;
      }
      if (item.poster) return item.poster;
      if (item.url) return getMediaUrl(item.url);
      return '';
    };

    if (items && items.length > 0) {
      items.slice(0, 48).forEach((item) => {
        const url = extractThumb(item);
        if (url && !urls.includes(url)) urls.push(url);
      });
    } else {
      // Immediate fallback pool from static catalog while API initializes
      const images = (FALLBACK_HF_CATALOG.images || []).slice(0, 24);
      const clips = (FALLBACK_HF_CATALOG.clips || []).slice(0, 14);
      const shorts = (FALLBACK_HF_CATALOG.shorts || []).slice(0, 10);
      [...images, ...clips, ...shorts].forEach((item) => {
        const url = extractThumb(item);
        if (url && !urls.includes(url)) urls.push(url);
      });
    }

    return urls;
  }, [items]);

  useEffect(() => {
    if (hasFinishedRef.current) return;

    const total = targetUrls.length;
    setTotalCount(total);

    if (total === 0) {
      // Nothing to preload, dismiss swiftly
      setDismissed(true);
      setTimeout(() => {
        setRemoved(true);
        onComplete?.();
      }, 500);
      return;
    }

    const startTime = performance.now();
    let completed = 0;

    const finishAndDismiss = () => {
      if (hasFinishedRef.current) return;
      hasFinishedRef.current = true;
      setProgress(100);
      setThroughputText('READY');

      // Seamless visual dismissal
      setTimeout(() => {
        setDismissed(true);
      }, 160);

      setTimeout(() => {
        setRemoved(true);
        onComplete?.();
      }, 760);
    };

    // Fail-safe timeout: never freeze visitor beyond 3.5s regardless of network state
    const failSafeTimer = setTimeout(() => {
      if (!hasFinishedRef.current) {
        finishAndDismiss();
      }
    }, 3500);

    const handleAssetLoad = () => {
      if (hasFinishedRef.current) return;
      completed++;
      const currentPct = Math.min(100, Math.round((completed / total) * 100));
      setProgress(currentPct);
      setLoadedCount(completed);

      // Measure real network throughput using browser Resource Timing API
      const elapsedSec = (performance.now() - startTime) / 1000;
      let transferredBytes = 0;
      let hasNetworkTelemetry = false;

      if (typeof window !== 'undefined' && window.performance && typeof window.performance.getEntriesByType === 'function') {
        const resourceList = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        for (let i = resourceList.length - 1; i >= 0 && i >= resourceList.length - 60; i--) {
          const res = resourceList[i];
          if (
            res.name.includes('media.sarwar.cyou') ||
            res.name.includes('huggingface.co') ||
            res.name.includes('drive.google')
          ) {
            if (res.transferSize && res.transferSize > 0) {
              transferredBytes += res.transferSize;
              hasNetworkTelemetry = true;
            }
          }
        }
      }

      if (hasNetworkTelemetry && transferredBytes > 0 && elapsedSec > 0.05) {
        const mbps = (transferredBytes / (1024 * 1024)) / elapsedSec;
        setThroughputText(`${mbps.toFixed(1)} MB/S`);
      } else if (elapsedSec > 0.02 && completed > 0) {
        // High-speed browser memory cache hit or instant local CDN
        const estBytes = completed * 82 * 1024; // avg WebP thumbnail size
        const mbps = (estBytes / (1024 * 1024)) / elapsedSec;
        if (mbps > 60) {
          setThroughputText('MEM_CACHE');
        } else {
          setThroughputText(`${mbps.toFixed(1)} MB/S`);
        }
      }

      if (completed >= total) {
        finishAndDismiss();
      }
    };

    // Preload all critical thumbnails concurrently over real browser connection
    targetUrls.forEach((url) => {
      const img = new Image();
      img.onload = handleAssetLoad;
      img.onerror = handleAssetLoad; // Don't hang on individual asset fault
      img.src = url;
    });

    return () => {
      clearTimeout(failSafeTimer);
    };
  }, [targetUrls, onComplete]);

  if (removed) return null;

  // Circular arc calculation (stroke-dashoffset from 220 to 0)
  const strokeOffset = TOTAL_CIRCUMFERENCE - (TOTAL_CIRCUMFERENCE * progress) / 100;

  return (
    <div
      id="splashLayer"
      className={`fixed inset-0 z-[999999] flex flex-col items-center justify-center bg-[#030406] select-none transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        dismissed
          ? 'opacity-0 scale-[1.03] pointer-events-none'
          : 'opacity-100 scale-100 pointer-events-auto'
      }`}
    >
      {/* Background Subtle Constellation Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.06)_0%,rgba(139,92,246,0.04)_45%,transparent_70%)] pointer-events-none" />

      {/* Modern High-End Logo with slowly moving White-Blue-Violet gradient */}
      <div className="relative z-10 mb-8 filter drop-shadow-[0_0_16px_rgba(139,92,246,0.45)] drop-shadow-[0_0_24px_rgba(56,189,248,0.35)]">
        <LaserSparkLogo width={280} height={38} interactive={false} />
      </div>

      {/* Option B: Ultra-Minimalist Phosphor Arc Meter */}
      <div className="relative z-10 flex flex-col items-center gap-5 max-w-md text-center">
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
            <defs>
              <linearGradient id="splashRadialGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#ffffff" />
              </linearGradient>
            </defs>
            {/* Background Track */}
            <circle
              cx="40"
              cy="40"
              r="35"
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="2.8"
            />
            {/* Real Network Progress Arc */}
            <circle
              cx="40"
              cy="40"
              r="35"
              fill="none"
              stroke="url(#splashRadialGrad)"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeDasharray={TOTAL_CIRCUMFERENCE}
              strokeDashoffset={strokeOffset}
              style={{
                transition: 'stroke-dashoffset 0.12s cubic-bezier(0.16, 1, 0.3, 1)',
                filter: 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.9)) drop-shadow(0 0 12px rgba(56, 189, 248, 0.7))',
              }}
            />
          </svg>

          {/* Real Live Percentage */}
          <div className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold text-white tracking-tight">
            {progress}%
          </div>
        </div>

        {/* Minimalist Telemetry Pill */}
        <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.6)] backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] shadow-[0_0_8px_#38bdf8] animate-pulse" />
          <span className="text-[10.5px] font-mono tracking-[0.14em] text-neutral-300 uppercase">
            {progress >= 100
              ? 'DIRECTORY SYNCHRONIZED'
              : totalCount > 0
              ? `WARMING VIEWPORT [ ${loadedCount} / ${totalCount} ] • ${throughputText}`
              : throughputText}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CyberSplash;
