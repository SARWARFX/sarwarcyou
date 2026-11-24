import type { StageMediaItem } from '../types';

/**
 * Multi-Engine Resilient Web Image Search Service
 * Primary: High-speed Cloudflare Worker DuckDuckGo Image Search & Caching Engine
 * Fallback: Flickr Public Web Photos + Wikimedia Commons Global Archive
 * Strict zero-text policy for photographic media cards.
 */

const CLOUDFLARE_SEARCH_WORKERS = [
  'https://search.sarwar.cyou',
  'https://searchbox.msnfx9.workers.dev',
];

async function fetchFromDdgWorker(query: string, signal?: AbortSignal): Promise<StageMediaItem[]> {
  for (const workerBase of CLOUDFLARE_SEARCH_WORKERS) {
    try {
      const endpoint = `${workerBase}/search?q=${encodeURIComponent(query)}&v=30d`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(endpoint, {
        signal: signal || controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (!res.ok) continue;

      const data = await res.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      if (results.length === 0) continue;

      return results.map((item: any, idx: number) => {
        const fullImage = item.image || item.thumbnail;
        const thumbImage = item.thumbnail || item.image;
        return {
          id: `web-ddg-${idx}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          title: '', // Strict zero-text policy
          name: '',
          url: fullImage,
          thumbnail: thumbImage,
          poster: thumbImage,
          posterUrl: thumbImage,
          category: 'Web Search',
          type: 'image' as const,
          mediaType: 'photo' as const,
        };
      });
    } catch {
      // Try next or fall through to public fallback
    }
  }
  return [];
}

async function fetchFromFlickr(query: string, signal?: AbortSignal): Promise<StageMediaItem[]> {
  try {
    const tags = encodeURIComponent(query.replace(/\s+/g, ','));
    const url = `https://api.flickr.com/services/feeds/photos_public.gne?tags=${tags}&format=json&nojsoncallback=1`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data.items) ? data.items : [];

    return items
      .filter((item: { media?: { m?: string } }) => item.media?.m)
      .map((item: { media: { m: string }; link?: string }, idx: number) => {
        const thumb = item.media.m;
        const highRes = thumb.replace(/_m\.(jpg|jpeg|png)$/i, '_b.$1');
        return {
          id: `web-flickr-${idx}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          title: '',
          name: '',
          url: highRes,
          thumbnail: thumb,
          poster: thumb,
          posterUrl: thumb,
          category: 'Web Search',
          type: 'image' as const,
          mediaType: 'photo' as const,
        };
      });
  } catch {
    return [];
  }
}

async function fetchFromWikimedia(query: string, signal?: AbortSignal): Promise<StageMediaItem[]> {
  try {
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      query
    )}&gsrnamespace=6&gsrlimit=30&prop=imageinfo&iiprop=url|size|mime&format=json&origin=*`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const pages = data?.query?.pages ? Object.values(data.query.pages) : [];

    return pages
      .filter((p: any) => {
        const info = p.imageinfo?.[0];
        return info && typeof info.mime === 'string' && info.mime.startsWith('image/') && !info.mime.includes('svg');
      })
      .map((p: any, idx: number) => {
        const info = p.imageinfo[0];
        const imgUrl = info.url;
        return {
          id: `web-wm-${p.pageid || idx}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          title: '',
          name: '',
          url: imgUrl,
          thumbnail: imgUrl,
          poster: imgUrl,
          posterUrl: imgUrl,
          category: 'Web Search',
          type: 'image' as const,
          mediaType: 'photo' as const,
        };
      });
  } catch {
    return [];
  }
}

async function fetchFromWikipedia(query: string, signal?: AbortSignal): Promise<StageMediaItem[]> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      query
    )}&gsrlimit=15&prop=pageimages&pithumbsize=1280&format=json&origin=*`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const pages = data?.query?.pages ? Object.values(data.query.pages) : [];

    return pages
      .filter((p: any) => p.thumbnail?.source && !p.thumbnail.source.endsWith('.svg'))
      .map((p: any, idx: number) => {
        const imgUrl = p.thumbnail.source;
        return {
          id: `web-wiki-${p.pageid || idx}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          title: '',
          name: '',
          url: imgUrl,
          thumbnail: imgUrl,
          poster: imgUrl,
          posterUrl: imgUrl,
          category: 'Web Search',
          type: 'image' as const,
          mediaType: 'photo' as const,
        };
      });
  } catch {
    return [];
  }
}

export async function searchWebImages(query: string, signal?: AbortSignal): Promise<StageMediaItem[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  // 1. Primary: Query the high-performance DuckDuckGo Cloudflare Worker
  const ddgResults = await fetchFromDdgWorker(cleanQuery, signal);
  if (ddgResults.length > 0) {
    return ddgResults;
  }

  // 2. Resilient Fallback: Wikipedia High-Res Portraits + Flickr + Wikimedia Commons
  const [wikiRes, flickrRes, wmRes] = await Promise.allSettled([
    fetchFromWikipedia(cleanQuery, signal),
    fetchFromFlickr(cleanQuery, signal),
    fetchFromWikimedia(cleanQuery, signal),
  ]);
  const wikiItems = wikiRes.status === 'fulfilled' ? wikiRes.value : [];
  const flickrItems = flickrRes.status === 'fulfilled' ? flickrRes.value : [];
  const wmItems = wmRes.status === 'fulfilled' ? wmRes.value : [];

  const interleaved: StageMediaItem[] = [];
  const maxLen = Math.max(wikiItems.length, flickrItems.length, wmItems.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < wikiItems.length) interleaved.push(wikiItems[i]);
    if (i < flickrItems.length) interleaved.push(flickrItems[i]);
    if (i < wmItems.length) interleaved.push(wmItems[i]);
  }

  return interleaved;
}
