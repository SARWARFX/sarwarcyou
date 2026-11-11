/**
 * Cloudflare Worker: Media Cache Proxy for media.sarwar.cyou/proxy
 * 
 * Route: media.sarwar.cyou/proxy*
 * Purpose: Caches Meta (Instagram / Facebook) & external editorial photos permanently
 * at Cloudflare's Edge, solving 403 token expirations with zero Hugging Face storage bloat.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing ?url= parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Check Cloudflare Edge Cache first
    const cache = caches.default;
    const cacheKey = new Request(url.toString(), request);
    let response = await cache.match(cacheKey);

    if (response) {
      const cachedHeaders = new Headers(response.headers);
      cachedHeaders.set('X-Edge-Cache-Status', 'HIT');
      return new Response(response.body, {
        status: response.status,
        headers: cachedHeaders,
      });
    }

    // Fetch from origin with standard browser headers
    try {
      const originResponse = await fetch(targetUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        },
      });

      if (!originResponse.ok) {
        return new Response(
          JSON.stringify({ error: `Origin returned status ${originResponse.status}` }),
          { status: originResponse.status, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Set 1-Year Edge Immutable Cache headers
      const newHeaders = new Headers(originResponse.headers);
      newHeaders.set('Access-Control-Allow-Origin', '*');
      newHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');
      newHeaders.set('CDN-Cache-Control', 'public, max-age=31536000, immutable');
      newHeaders.set('X-Edge-Cache-Status', 'MISS');

      response = new Response(originResponse.body, {
        status: originResponse.status,
        headers: newHeaders,
      });

      // Save to Cloudflare edge cache asynchronously
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (err) {
      return new Response(JSON.stringify({ error: `Gateway error: ${err.message}` }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
