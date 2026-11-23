/**
 * CLOUDFLARE WORKER: DUCKDUCKGO IMAGE SEARCH ENGINE & PROXY
 * Features:
 * 1. DuckDuckGo Image API Scraper (vqd token extractor + JSON search)
 * 2. Cloudflare Edge Caching (caches.default for 7 DAYS to prevent DDG rate limits/blocks)
 * 3. Image Hotlink Proxy (/proxy?url=...) to safely bypass hotlink-blocked images
 * 4. Universal CORS (*) - Domain immune (works on any current or future domain)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, User-Agent',
  'Access-Control-Max-Age': '604800', // 7 Days
};

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// 7 Days in seconds = 7 * 24 * 60 * 60 = 604,800 seconds
const SEVEN_DAYS_SECONDS = 604800;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // 2. Image Proxy Route: /proxy?url=...
    // Allows loading images whose hosts block hotlinking or lack CORS
    if (url.pathname === '/proxy') {
      const targetUrl = url.searchParams.get('url');
      if (!targetUrl) {
        return new Response('Missing url parameter', { status: 400, headers: CORS_HEADERS });
      }

      const cache = caches.default;
      const cacheKey = new Request(url.toString(), request);
      let cachedImg = await cache.match(cacheKey);
      if (cachedImg) return cachedImg;

      try {
        const imgResp = await fetch(targetUrl, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
          },
        });

        if (!imgResp.ok) {
          return new Response('Failed to fetch image', { status: imgResp.status, headers: CORS_HEADERS });
        }

        const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
        const response = new Response(imgResp.body, {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': contentType,
            'Cache-Control': `public, max-age=${SEVEN_DAYS_SECONDS}, s-maxage=${SEVEN_DAYS_SECONDS}`,
          },
        });

        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        return response;
      } catch (err) {
        return new Response('Proxy error: ' + err.message, { status: 500, headers: CORS_HEADERS });
      }
    }

    // 3. Search Route: /search?q=...
    const query = url.searchParams.get('q') || url.searchParams.get('query');
    if (!query || !query.trim()) {
      return new Response(
        JSON.stringify({
          status: 'ok',
          message: 'DuckDuckGo Image Search Worker is running. Use /search?q=<keyword>',
          results: [],
        }),
        {
          status: 200,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }

    const cleanQuery = query.trim().toLowerCase();

    // 4. Check Cloudflare Edge Cache (7-Day Zero-Hit Protection)
    // If someone already searched this term within 7 days, return from Cloudflare's Edge Cache in < 20ms
    // without making any request to DuckDuckGo!
    const cache = caches.default;
    const cacheKey = new Request(`${url.origin}/search?q=${encodeURIComponent(cleanQuery)}`, request);
    const cachedResponse = await cache.match(cacheKey);

    if (cachedResponse) {
      const resHeaders = new Headers(cachedResponse.headers);
      resHeaders.set('X-Cache', 'HIT');
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        headers: resHeaders,
      });
    }

    // 5. Query DuckDuckGo
    try {
      // Step A: Extract DuckDuckGo VQD verification token
      const initUrl = `https://duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}`;
      const initResp = await fetch(initUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      });

      const html = await initResp.text();
      const vqdMatch =
        html.match(/vqd=([0-9-]+)/) ||
        html.match(/vqd=['"]([0-9-]+)['"]/) ||
        html.match(/vqd:\s*"([^"]+)"/);

      if (!vqdMatch || !vqdMatch[1]) {
        return new Response(
          JSON.stringify({
            error: 'Failed to obtain search token from DuckDuckGo',
            results: [],
          }),
          {
            status: 502,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          }
        );
      }

      const vqd = vqdMatch[1];

      // Step B: Fetch image search results using VQD token
      const searchApiUrl = `https://duckduckgo.com/i.js?l=us-en&o=json&q=${encodeURIComponent(
        cleanQuery
      )}&vqd=${vqd}&f=,,,;&p=1`;

      const searchResp = await fetch(searchApiUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/json',
          'Referer': 'https://duckduckgo.com/',
        },
      });

      if (!searchResp.ok) {
        return new Response(
          JSON.stringify({
            error: `DuckDuckGo Search API returned ${searchResp.status}`,
            results: [],
          }),
          {
            status: searchResp.status,
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
          }
        );
      }

      const searchData = await searchResp.json();
      const rawResults = Array.isArray(searchData?.results) ? searchData.results : [];

      // Filter and format results
      const results = rawResults
        .filter((r) => r.image && typeof r.image === 'string' && r.image.startsWith('http'))
        .slice(0, 36)
        .map((r) => ({
          title: r.title || '',
          image: r.image,
          thumbnail: r.thumbnail || r.image,
          source: r.url || '',
          width: r.width,
          height: r.height,
        }));

      const jsonPayload = JSON.stringify({
        status: 'ok',
        query: cleanQuery,
        count: results.length,
        results,
      });

      // 7-Day Edge and Browser Cache Headers
      const finalResponse = new Response(jsonPayload, {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'Cache-Control': `public, max-age=${SEVEN_DAYS_SECONDS}, s-maxage=${SEVEN_DAYS_SECONDS}`,
          'X-Cache': 'MISS',
        },
      });

      // Save to Cloudflare Edge Cache in background for 7 days
      ctx.waitUntil(cache.put(cacheKey, finalResponse.clone()));

      return finalResponse;
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: 'Search Worker Exception: ' + err.message,
          results: [],
        }),
        {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        }
      );
    }
  },
};
