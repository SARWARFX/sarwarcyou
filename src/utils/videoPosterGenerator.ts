/**
 * videoPosterGenerator.ts
 * Utility for native and off-screen canvas poster extraction for video streams.
 * Includes media fragment appending (#t=0.5), stream pre-warming, and resilient error handling.
 */

const posterCache = new Map<string, string>();
const prewarmedUrls = new Set<string>();

/**
 * Returns any cached poster data URL or null.
 */
export function getCachedVideoPoster(videoUrl: string): string | null {
  if (!videoUrl) return null;
  return posterCache.get(videoUrl) || null;
}

/**
 * Appends a time fragment to direct video stream URLs so browsers decode
 * and display the poster frame at t seconds (default 0.5s) without downloading the full video.
 */
export function formatVideoPosterUrl(url: string, timeSec = 0.5): string {
  if (!url) return '';
  const cleanUrl = url.split('#')[0];
  return `${cleanUrl}#t=${timeSec}`;
}

/**
 * Attempts to extract an off-screen canvas poster snapshot from a video URL.
 * Safely falls back to null if CORS or media decoding fails.
 */
export async function extractVideoThumbnail(
  videoUrl: string,
  seekTime = 0.5
): Promise<string | null> {
  if (!videoUrl || typeof document === 'undefined') return null;

  const cached = posterCache.get(videoUrl);
  if (cached) return cached;

  return new Promise((resolve) => {
    try {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      let resolved = false;
      const cleanup = () => {
        video.onloadeddata = null;
        video.onseeked = null;
        video.onerror = null;
        video.src = '';
      };

      const fallbackTimer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve(null);
        }
      }, 3000);

      video.onloadeddata = () => {
        try {
          video.currentTime = Math.min(seekTime, (video.duration || 1) - 0.1);
        } catch {
          if (!resolved) {
            resolved = true;
            clearTimeout(fallbackTimer);
            cleanup();
            resolve(null);
          }
        }
      };

      video.onseeked = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(fallbackTimer);
        try {
          const canvas = document.createElement('canvas');
          const width = video.videoWidth || 640;
          const height = video.videoHeight || 360;
          canvas.width = Math.min(width, 720);
          canvas.height = Math.round((canvas.width / width) * height);

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            posterCache.set(videoUrl, dataUrl);
            cleanup();
            resolve(dataUrl);
            return;
          }
        } catch {
          // Canvas tainted or CORS restriction
        }
        cleanup();
        resolve(null);
      };

      video.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(fallbackTimer);
          cleanup();
          resolve(null);
        }
      };

      video.src = videoUrl;
    } catch {
      resolve(null);
    }
  });
}

/**
 * Pre-warms video stream connection on hover or touch before user click.
 * Sets preconnect origin and primes decoder metadata.
 */
export function prewarmVideoStream(videoUrl: string): void {
  if (!videoUrl || typeof document === 'undefined' || prewarmedUrls.has(videoUrl)) return;
  prewarmedUrls.add(videoUrl);

  try {
    // 1. Preconnect link tag
    try {
      const origin = new URL(videoUrl).origin;
      if (!document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) {
        const link = document.createElement('link');
        link.rel = 'preconnect';
        link.href = origin;
        link.crossOrigin = 'anonymous';
        document.head.appendChild(link);
      }
    } catch {
      // ignore URL parsing
    }

    // 2. Prime stream metadata in background
    extractVideoThumbnail(videoUrl, 0.5).catch(() => {});
  } catch {
    // ignore
  }
}
