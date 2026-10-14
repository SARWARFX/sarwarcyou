/**
 * clientVideoThumbnails.ts
 * High-performance client-side video thumbnail extractor with IndexedDB persistent caching,
 * in-memory L1 cache, concurrency-limited worker queue, and Splash Screen gatekeeper support.
 */

import { useState, useEffect } from 'react';
import { ensureHttps, getMediaUrl } from './imageUrlResolver';

const DB_NAME = 'sarwarcyou_thumbnails_v2';
const DB_VERSION = 1;
const STORE_NAME = 'thumbnails';
const MAX_CONCURRENT_EXTRACTIONS = 3;

interface CachedRecord {
  url: string;
  dataUrl: string;
  timestamp: number;
}

// In-Memory L1 Cache for instant synchronous hits
const memoryCache = new Map<string, string>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

/**
 * Initializes and returns the IndexedDB database instance.
 */
function getDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'url' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

/**
 * Normalizes URL by removing fragment identifiers and guaranteeing HTTPS.
 */
export function normalizeVideoUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  const secure = ensureHttps(getMediaUrl(rawUrl));
  return secure.split('#')[0].trim();
}

/**
 * Synchronous L1 cache lookup. Returns data URL immediately if available in memory.
 */
export function getCachedThumbnailSync(rawUrl: string): string | null {
  const cleanUrl = normalizeVideoUrl(rawUrl);
  if (!cleanUrl) return null;
  return memoryCache.get(cleanUrl) || null;
}

/**
 * Reads thumbnail from IndexedDB.
 */
async function readFromIndexedDB(cleanUrl: string): Promise<string | null> {
  const db = await getDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(cleanUrl);
      req.onsuccess = () => {
        const record = req.result as CachedRecord | undefined;
        if (record && record.dataUrl) {
          memoryCache.set(cleanUrl, record.dataUrl);
          resolve(record.dataUrl);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Saves generated thumbnail data URL into IndexedDB.
 */
async function saveToIndexedDB(cleanUrl: string, dataUrl: string): Promise<void> {
  memoryCache.set(cleanUrl, dataUrl);
  const db = await getDB();
  if (!db) return;

  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put({
      url: cleanUrl,
      dataUrl,
      timestamp: Date.now(),
    });
  } catch {
    // Ignore storage quota or access errors
  }
}

// ================= CONCURRENCY-LIMITED QUEUE =================

interface QueueTask {
  cleanUrl: string;
  isShort: boolean;
  priority: boolean;
  resolve: (dataUrl: string | null) => void;
}

const queue: QueueTask[] = [];
let activeWorkers = 0;
const subscribers = new Map<string, Array<(dataUrl: string | null) => void>>();
const inProgressUrls = new Set<string>();

/**
 * Processes the next task in the queue.
 */
function processQueue() {
  if (activeWorkers >= MAX_CONCURRENT_EXTRACTIONS || queue.length === 0) {
    return;
  }

  const task = queue.shift();
  if (!task) return;

  activeWorkers++;
  extractFrameFromVideo(task.cleanUrl, task.isShort)
    .then((result) => {
      task.resolve(result);
    })
    .catch(() => {
      task.resolve(null);
    })
    .finally(() => {
      activeWorkers--;
      processQueue();
    });
}

/**
 * Performs actual off-screen video decoding and canvas capture.
 */
function extractFrameFromVideo(cleanUrl: string, isShort: boolean): Promise<string | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    let resolved = false;
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const cleanup = () => {
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
      try {
        video.src = '';
        video.load();
      } catch {
        // ignore
      }
    };

    const done = (result: string | null) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeoutTimer);
      cleanup();
      inProgressUrls.delete(cleanUrl);

      // Notify all subscribers
      const waiting = subscribers.get(cleanUrl) || [];
      subscribers.delete(cleanUrl);
      for (const cb of waiting) {
        cb(result);
      }

      resolve(result);
    };

    // 3500ms safety timeout per extraction
    const timeoutTimer = setTimeout(() => {
      done(null);
    }, 3500);

    const captureFrame = () => {
      try {
        const canvas = document.createElement('canvas');
        if (isShort) {
          canvas.width = 270;
          canvas.height = 480;
        } else {
          canvas.width = 480;
          canvas.height = 270;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          let dataUrl = '';
          try {
            dataUrl = canvas.toDataURL('image/webp', 0.7);
          } catch {
            dataUrl = canvas.toDataURL('image/jpeg', 0.75);
          }

          if (dataUrl && dataUrl.length > 200) {
            saveToIndexedDB(cleanUrl, dataUrl);
            done(dataUrl);
            return;
          }
        }
      } catch {
        // Canvas tainted or decoding issue
      }
      done(null);
    };

    const onReadyToSeek = () => {
      try {
        // Fast offscreen frame capture at timestamp 1.0s or midpoint
        const targetTime = video.duration && video.duration < 1 ? video.duration * 0.5 : 1.0;
        video.currentTime = targetTime;
      } catch {
        captureFrame();
      }
    };

    video.onloadedmetadata = onReadyToSeek;
    video.onloadeddata = () => {
      if (!video.currentTime || video.currentTime < 0.1) {
        onReadyToSeek();
      }
    };

    video.onseeked = () => {
      captureFrame();
    };

    video.onerror = () => {
      done(null);
    };

    try {
      // Append #t=1.0 media fragment with edge CDN base
      video.src = `${getMediaUrl(cleanUrl)}#t=1.0`;
    } catch {
      done(null);
    }
  });
}

/**
 * Requests video thumbnail:
 * 1. Checks memory cache
 * 2. Checks IndexedDB
 * 3. Enqueues off-screen extraction
 */
export async function requestVideoThumbnail(
  rawUrl: string,
  isShort = false,
  highPriority = false
): Promise<string | null> {
  const cleanUrl = normalizeVideoUrl(rawUrl);
  if (!cleanUrl) return null;

  // 1. Check L1 memory
  const mem = memoryCache.get(cleanUrl);
  if (mem) return mem;

  // 2. Check IndexedDB
  const stored = await readFromIndexedDB(cleanUrl);
  if (stored) return stored;

  // 3. If already in-flight, subscribe to completion
  if (inProgressUrls.has(cleanUrl)) {
    return new Promise((resolve) => {
      const list = subscribers.get(cleanUrl) || [];
      list.push(resolve);
      subscribers.set(cleanUrl, list);
    });
  }

  inProgressUrls.add(cleanUrl);

  // 4. Enqueue extraction task
  return new Promise((resolve) => {
    const task: QueueTask = {
      cleanUrl,
      isShort,
      priority: highPriority,
      resolve,
    };

    if (highPriority) {
      queue.unshift(task);
    } else {
      queue.push(task);
    }

    processQueue();
  });
}

/**
 * React Hook for binding video thumbnails in card components.
 * Returns { thumbnail, isLoading }.
 */
export function useVideoThumbnail(
  videoUrl: string | undefined,
  isShort = false
): { thumbnail: string | null; isLoading: boolean } {
  const cleanUrl = videoUrl ? normalizeVideoUrl(videoUrl) : '';
  const [prevUrl, setPrevUrl] = useState(cleanUrl);
  const [thumbnail, setThumbnail] = useState<string | null>(() => {
    return cleanUrl ? getCachedThumbnailSync(cleanUrl) : null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(!thumbnail && !!cleanUrl);

  if (prevUrl !== cleanUrl) {
    setPrevUrl(cleanUrl);
    const sync = cleanUrl ? getCachedThumbnailSync(cleanUrl) : null;
    setThumbnail(sync);
    setIsLoading(!sync && !!cleanUrl);
  }

  useEffect(() => {
    if (!cleanUrl) return;

    // If already in memory cache, nothing further to fetch
    const mem = getCachedThumbnailSync(cleanUrl);
    if (mem) return;

    let isMounted = true;

    requestVideoThumbnail(cleanUrl, isShort)
      .then((dataUrl) => {
        if (isMounted) {
          setThumbnail(dataUrl);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [cleanUrl, isShort]);

  return { thumbnail, isLoading };
}

/**
 * Splash Screen Gatekeeper:
 * Preloads thumbnails for the initial viewport video items.
 * Resolves once the initial batch is ready, or triggers a safety timeout (max 2.8s)
 * so users are never permanently blocked.
 */
export async function preloadInitialThumbnails(
  videoUrls: string[],
  count = 6,
  timeoutMs = 2800
): Promise<void> {
  const targets = videoUrls
    .map(normalizeVideoUrl)
    .filter(Boolean)
    .slice(0, count);

  if (targets.length === 0) return;

  const preloadPromise = Promise.all(
    targets.map((url) => requestVideoThumbnail(url, false, true))
  );

  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(resolve, timeoutMs);
  });

  await Promise.race([preloadPromise, timeoutPromise]);
}
