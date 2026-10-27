/**
 * urlResolver.ts
 * High-performance URL building and sanitization for Cloudflare Edge proxy (media.sarwar.cyou).
 * Prevents double-encoding bugs, normalizes directory case, and handles edge streaming.
 */

export const MEDIA_CDN_BASE = 'https://media.sarwar.cyou';

/**
 * Encodes path segments safely: converts spaces to %20 and special characters to URL-safe codes
 * while strictly avoiding double-encoding (%2520).
 */
export function encodeMediaPathSegments(path: string): string {
  if (!path) return '';
  return path
    .split('/')
    .map((segment) => {
      try {
        return encodeURIComponent(decodeURIComponent(segment))
          .replace(/\(/g, '%28')
          .replace(/\)/g, '%29');
      } catch {
        return encodeURIComponent(segment);
      }
    })
    .join('/');
}

/**
 * Universal media URL builder: routes repository files through Cloudflare Edge proxy
 * at https://media.sarwar.cyou with exact casing and encoding.
 */
export function getMediaUrl(relativePath?: string | null): string {
  if (!relativePath) return '';
  let path = relativePath.trim();

  // If blob or data URI, return as-is
  if (path.startsWith('blob:') || path.startsWith('data:')) {
    return path;
  }

  // If local static branding assets
  if (
    path === '/SARWARCYOU.svg' ||
    path === 'SARWARCYOU.svg' ||
    path.startsWith('/brand-logo') ||
    path.startsWith('/favicon')
  ) {
    return path.startsWith('/') ? path : `/${path}`;
  }

  // External non-Hugging Face host (e.g. Google Drive)
  if (/^https?:\/\//i.test(path) && !path.includes('huggingface.co') && !path.includes('media.sarwar.cyou')) {
    return path;
  }

  // Strip Hugging Face dataset prefix if present
  path = path.replace(/^https?:\/\/huggingface\.co\/datasets\/[^/]+\/[^/]+\/(?:resolve|raw|tree)\/main\//i, '');
  // Strip media.sarwar.cyou base URL if already prefixed
  path = path.replace(/^https?:\/\/media\.sarwar\.cyou\//i, '');

  let cleanPath = path.replace(/^\/+/, '');
  if (!cleanPath) return '';

  // Case normalization: repository directory is Thumbnails (capital T)
  if (cleanPath.toLowerCase().startsWith('thumbnails/')) {
    cleanPath = 'Thumbnails/' + cleanPath.slice('thumbnails/'.length);
  }

  const encoded = encodeMediaPathSegments(cleanPath);
  return `${MEDIA_CDN_BASE}/${encoded}`;
}

/**
 * Fallback SVG Data URI when remote thumbnail is unavailable or 404s.
 * Clean modern dark-theme badge.
 */
export const FALLBACK_THUMBNAIL_SVG =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360" fill="none">
      <rect width="640" height="360" fill="#0d0e14"/>
      <circle cx="320" cy="180" r="42" fill="#181a24" stroke="#00E5FF" stroke-width="2" stroke-opacity="0.4"/>
      <polygon points="314,166 332,180 314,194" fill="#00E5FF" fill-opacity="0.85"/>
      <text x="320" y="246" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="11" font-weight="700" fill="#71717a" text-anchor="middle" letter-spacing="2">SARWARCYOU MEDIA</text>
    </svg>`
  );
