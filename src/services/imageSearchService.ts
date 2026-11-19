import type { StageMediaItem } from '../types';

/**
 * Fast, resilient web image search service with zero API keys and zero visitor quota limits.
 * Uses native CORS-open public search pipelines (Flickr Public Web Photos + Wikimedia Commons Global Archive)
 * to return high-resolution imagery directly to the client browser.
 */
export async function searchWebImages(query: string, signal?: AbortSignal): Promise<StageMediaItem[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const flickrPromise = (async (): Promise<StageMediaItem[]> => {
    try {
      const tags = encodeURIComponent(cleanQuery.replace(/\s+/g, ','));
      const url = `https://api.flickr.com/services/feeds/photos_public.gne?tags=${tags}&format=json&nojsoncallback=1`;
      const res = await fetch(url, { signal });
      if (!res.ok) return [];
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];

      return items
        .filter((item: { media?: { m?: string } }) => item.media?.m)
        .map((item: { media: { m: string }; link?: string }, idx: number) => {
          const thumb = item.media.m;
          // Upgrade Flickr thumbnail (_m: 240px) to high-res (_b: 1024px)
          const highRes = thumb.replace(/_m\.(jpg|jpeg|png)$/i, '_b.$1');
          return {
            id: `web-flickr-${idx}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            title: '', // Strict zero-text policy
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
  })();

  const wikimediaPromise = (async (): Promise<StageMediaItem[]> => {
    try {
      const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
        cleanQuery
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
            title: '', // Strict zero-text policy
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
  })();

  const [flickrRes, wmRes] = await Promise.allSettled([flickrPromise, wikimediaPromise]);
  const flickrItems = flickrRes.status === 'fulfilled' ? flickrRes.value : [];
  const wmItems = wmRes.status === 'fulfilled' ? wmRes.value : [];

  // Interleave results for balanced variety
  const interleaved: StageMediaItem[] = [];
  const maxLen = Math.max(flickrItems.length, wmItems.length);
  for (let i = 0; i < maxLen; i++) {
    if (i < flickrItems.length) interleaved.push(flickrItems[i]);
    if (i < wmItems.length) interleaved.push(wmItems[i]);
  }

  return interleaved;
}
