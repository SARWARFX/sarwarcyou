/**
 * High-performance offscreen video frame capture & thumbnail generator.
 * Converts video frames at t=1.0s into lightweight JPEG data URLs,
 * aggressively cleans up temporary video decoders, and caches results.
 */

const thumbnailCache = new Map<string, string>();
const pendingPromises = new Map<string, Promise<string | null>>();

// Maximum concurrent offscreen video decoders to protect mobile GPU RAM
const MAX_CONCURRENT = 2;
let activeCount = 0;
const queue: (() => void)[] = [];

function runNext() {
  if (activeCount < MAX_CONCURRENT && queue.length > 0) {
    activeCount++;
    const next = queue.shift();
    if (next) next();
  }
}

/**
 * Returns cached thumbnail URL if already captured.
 */
export function getCachedVideoThumbnail(url: string): string | null {
  if (!url) return null;
  return thumbnailCache.get(url) || null;
}

/**
 * Captures a video frame at 1.0s onto an HTML5 canvas and returns a JPEG data URL.
 * Automatically cleans up the video decoder immediately after capture.
 */
export function generateVideoThumbnail(
  videoUrl: string,
  aspectRatio: '16/9' | '9/16' = '16/9'
): Promise<string | null> {
  if (!videoUrl || typeof window === 'undefined') {
    return Promise.resolve(null);
  }

  // Return existing cache immediately
  if (thumbnailCache.has(videoUrl)) {
    return Promise.resolve(thumbnailCache.get(videoUrl)!);
  }

  // Deduplicate in-flight requests for the same URL
  if (pendingPromises.has(videoUrl)) {
    return pendingPromises.get(videoUrl)!;
  }

  const promise = new Promise<string | null>((resolve) => {
    const execute = () => {
      let resolved = false;
      const timeoutId = window.setTimeout(() => {
        cleanup(null);
      }, 4000);

      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      const cleanup = (result: string | null) => {
        if (resolved) return;
        resolved = true;
        window.clearTimeout(timeoutId);

        try {
          video.pause();
          video.removeAttribute('src');
          video.src = '';
          video.load();
          video.remove();
        } catch {
          // Ignore cleanup errors
        }

        activeCount--;
        pendingPromises.delete(videoUrl);
        runNext();

        if (result) {
          thumbnailCache.set(videoUrl, result);
        }
        resolve(result);
      };

      const captureFrame = () => {
        try {
          const width = aspectRatio === '9/16' ? 180 : 320;
          const height = aspectRatio === '9/16' ? 320 : 180;
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            cleanup(null);
            return;
          }

          // Draw the video frame onto canvas
          ctx.drawImage(video, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
          cleanup(dataUrl);
        } catch {
          // Canvas may be tainted if CORS header missing on third-party host
          cleanup(null);
        }
      };

      video.addEventListener('seeked', () => {
        captureFrame();
      }, { once: true });

      video.addEventListener('loadeddata', () => {
        // If readyState is sufficient, seek to 1.0s (or clamp to duration)
        const targetTime = video.duration && video.duration > 1 ? 1.0 : 0.1;
        try {
          video.currentTime = targetTime;
        } catch {
          captureFrame();
        }
      }, { once: true });

      video.addEventListener('error', () => {
        cleanup(null);
      }, { once: true });

      // Start loading with media fragment hint
      try {
        video.src = videoUrl.includes('#') ? videoUrl : `${videoUrl}#t=1.0`;
        video.load();
      } catch {
        cleanup(null);
      }
    };

    queue.push(execute);
    runNext();
  });

  pendingPromises.set(videoUrl, promise);
  return promise;
}
