/**
 * downloadMedia.ts
 * Robust client-side download helper for Hugging Face CDN media.
 * Sanitises filenames and uses Blob streaming with fallback to anchor link.
 */

/**
 * Sanitise a raw filename or URL path into a clean, filesystem-safe name.
 * Decodes URI-encoded characters, strips query strings, and replaces
 * sequences of unsafe characters with underscores.
 */
export function sanitiseFilename(raw: string): string {
  // Take only the last path segment
  let name = raw.split('/').pop() || raw;
  // Remove query string
  name = name.split('?')[0];
  // Decode percent-encoded chars (e.g. %20 -> space, %5B -> [)
  try {
    name = decodeURIComponent(name);
  } catch {
    /* leave as-is */
  }
  // Replace any residual %20 with spaces
  name = name.replace(/%20/g, ' ');
  // Strip characters forbidden in Windows/Unix filenames: / \ : * ? " < > |
  name = name.replace(/[/\\:*?"<>|]+/g, ' ');
  // Collapse multiple spaces and trim
  name = name.replace(/\s+/g, ' ').trim();
  return name || 'media_file';
}

/**
 * Infer MIME type and file extension from a URL path.
 */
function inferMime(url: string): { mime: string; ext: string } {
  const lower = url.split('?')[0].toLowerCase();
  if (lower.endsWith('.mp4'))  return { mime: 'video/mp4',  ext: 'mp4' };
  if (lower.endsWith('.webm')) return { mime: 'video/webm', ext: 'webm' };
  if (lower.endsWith('.mov'))  return { mime: 'video/quicktime', ext: 'mov' };
  if (lower.endsWith('.mkv'))  return { mime: 'video/x-matroska', ext: 'mkv' };
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return { mime: 'image/jpeg', ext: 'jpg' };
  if (lower.endsWith('.png'))  return { mime: 'image/png', ext: 'png' };
  if (lower.endsWith('.webp')) return { mime: 'image/webp', ext: 'webp' };
  if (lower.endsWith('.gif'))  return { mime: 'image/gif', ext: 'gif' };
  if (lower.endsWith('.svg'))  return { mime: 'image/svg+xml', ext: 'svg' };
  if (lower.endsWith('.heic')) return { mime: 'image/heic', ext: 'heic' };
  if (lower.endsWith('.avif')) return { mime: 'image/avif', ext: 'avif' };
  if (lower.endsWith('.bmp'))  return { mime: 'image/bmp', ext: 'bmp' };
  if (lower.endsWith('.tiff') || lower.endsWith('.tif')) return { mime: 'image/tiff', ext: 'tiff' };
  return { mime: 'application/octet-stream', ext: '' };
}

/**
 * Ensure a filename has the correct extension based on MIME type.
 */
function ensureExtension(name: string, ext: string): string {
  if (!ext) return name;
  const lower = name.toLowerCase();
  if (lower.endsWith(`.${ext}`)) return name;
  // Remove any existing extension if different
  const lastDot = name.lastIndexOf('.');
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  return `${base}.${ext}`;
}

/**
 * Primary: fetch the file as a Blob and trigger a browser download via an
 * object URL. Falls back to a plain <a download> anchor if the fetch fails
 * (e.g. CORS restrictions or large file streaming issues).
 *
 * @param url      The direct CDN URL of the media file (must be https://)
 * @param rawName  Optional custom base name; derived from URL if omitted.
 */
export async function downloadMedia(url: string, rawName?: string): Promise<void> {
  const safeUrl = url.replace(/^http:\/\//i, 'https://');
  const { mime, ext } = inferMime(safeUrl);
  const baseName = rawName ? sanitiseFilename(rawName) : sanitiseFilename(safeUrl);
  const filename = ensureExtension(baseName, ext);

  try {
    // Attempt Blob-based download (works same-origin or CORS-enabled CDN)
    const res = await fetch(safeUrl, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(
      new Blob([blob], { type: mime || blob.type || 'application/octet-stream' })
    );
    triggerDownload(objUrl, filename);
    // Revoke after a short delay to allow the browser to read it
    setTimeout(() => URL.revokeObjectURL(objUrl), 30_000);
  } catch {
    // Fallback: set download attribute and let browser handle streaming
    triggerDownload(safeUrl, filename);
  }
}

function triggerDownload(href: string, filename: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
