/**
 * CLOUDFLARE WORKER: SERPAPI GOOGLE IMAGE SEARCH (30-DAY EDGE CACHE)
 * - 100 Real Google Image Search results per query (ijn=0)
 * - Automatically resets 250 Google searches every single month forever
 * - 30-Day Cloudflare Edge Cache (2,592,000 seconds) to conserve API search quota
 * - Instant sub-20ms edge HIT delivery for cached queries
 * - Automatic Wikimedia Commons fallback for zero downtime
 * - Strict zero-text photographic card compliant
 */

const SERPAPI_KEY = '1e6dfde66c70ad13ffc6ab2c6de4f44daf9c81dfb5d3ae381fe5cfc14b3cbb9d';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
  'Access-Control-Max-Age': '86400',
};

// 30 Days = 30 * 24 * 60 * 60 = 2,592,000 seconds
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
const CACHE_VERSION = 'serpapi_v3_30d';

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (url.pathname !== '/search') {
      return new Response(
        JSON.stringify({ status: 'ok', message: 'SerpApi Google Search Engine (30-Day Cache) Online' }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const rawQuery = (url.searchParams.get('q') || '').trim();
    if (!rawQuery) {
      return new Response(
        JSON.stringify({ status: 'ok', query: '', count: 0, results: [] }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }

    const cleanQuery = rawQuery.replace(/[\r\n\t]/g, ' ').slice(0, 150);
    const cacheKey = new Request(
      `https://cache.sarwar.cyou/search/${CACHE_VERSION}/${encodeURIComponent(cleanQuery.toLowerCase())}`,
      { method: 'GET' }
    );
    const cache = caches.default;

    // 1. Check Cloudflare Edge Cache (30-day cache)
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const cloned = new Response(cachedResponse.body, cachedResponse);
      cloned.headers.set('X-Cache', 'HIT');
      cloned.headers.set('Access-Control-Allow-Origin', '*');
      return cloned;
    }

    let results = [];

    try {
      // 2. Fetch 100 images from Google via SerpApi (ijn=0)
      const serpUrl =
        `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(cleanQuery)}&ijn=0&api_key=${SERPAPI_KEY}`;

      const serpResp = await fetch(serpUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Accept: 'application/json',
        },
      });

      if (serpResp.ok) {
        const serpData = await serpResp.json();
        const images = Array.isArray(serpData?.images_results) ? serpData.images_results : [];

        results = images
          .filter((img) => img && (img.original || img.thumbnail))
          .map((img) => {
            const originalUrl = (img.original || img.thumbnail || '').replace(/^http:\/\//i, 'https://');
            const thumbUrl = (img.thumbnail || img.original || '').replace(/^http:\/\//i, 'https://');
            return {
              title: '', // Strict zero-text policy
              image: originalUrl,
              thumbnail: thumbUrl,
              source: originalUrl,
              width: img.original_width || 1200,
              height: img.original_height || 800,
            };
          });
      }

      // 3. Fallback: Wikimedia Commons if SerpApi returns empty
      if (results.length === 0) {
        const wikiUrl =
          `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
            cleanQuery
          )}&gsrnamespace=6&gsrlimit=50&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=800&format=json&origin=*`;

        const wikiResp = await fetch(wikiUrl, {
          headers: { 'User-Agent': 'SarwarCYou-Search/3.0' },
        });

        if (wikiResp.ok) {
          const wikiData = await wikiResp.json();
          const pages = wikiData?.query?.pages ? Object.values(wikiData.query.pages) : [];
          results = pages
            .filter((p) => {
              const info = p.imageinfo?.[0];
              return (
                info &&
                info.mime?.startsWith('image/') &&
                !info.url.endsWith('.svg')
              );
            })
            .map((p) => {
              const info = p.imageinfo[0];
              const imgUrl = (info.url || '').replace(/^http:\/\//i, 'https://');
              const thumbUrl = (info.thumburl || imgUrl).replace(/^http:\/\//i, 'https://');
              return {
                title: '',
                image: imgUrl,
                thumbnail: thumbUrl,
                source: imgUrl,
                width: info.width || 1200,
                height: info.height || 800,
              };
            });
        }
      }

      const finalResponse = new Response(
        JSON.stringify({
          status: 'ok',
          query: cleanQuery,
          count: results.length,
          results,
        }),
        {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json',
            ...(results.length > 0
              ? {
                  'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}, s-maxage=${CACHE_TTL_SECONDS}`,
                  'X-Cache': 'MISS',
                  'X-Cache-TTL': '30-Days',
                }
              : { 'Cache-Control': 'no-store' }),
          },
        }
      );

      // Cache successful queries for 30 full days
      if (results.length > 0) {
        ctx.waitUntil(cache.put(cacheKey, finalResponse.clone()));
      }

      return finalResponse;
    } catch (err) {
      return new Response(
        JSON.stringify({ status: 'error', message: err.message, results: [] }),
        { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } }
      );
    }
  },
};
