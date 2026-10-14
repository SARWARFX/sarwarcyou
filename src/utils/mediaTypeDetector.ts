/**
 * mediaTypeDetector.ts
 * Strict media type classification and URL path encoding utilities.
 * 
 * 1. File Type Detection:
 *    - Videos: .mp4, .mov, .mkv, .webm, .avi
 *    - Photos: .jpg, .jpeg, .png, .webp, .gif, .avif (and .bmp, .tiff, .heic, .svg)
 *    Strictly determines type by file extension. Does NOT rely on folder names or default fallbacks.
 * 
 * 2. Robust URL & Path Encoding:
 *    Safely encodes brackets [, ], parentheses (, ), spaces, hashes #, ampersands &, and pluses +
 *    in path segments without double-encoding already percent-encoded strings.
 */

export const VIDEO_EXTENSIONS = /\.(mp4|mov|mkv|webm|avi)(\?|#|$)/i;
export const PHOTO_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif|avif|bmp|tiff|heic|svg)(\?|#|$)/i;

/**
 * Checks if a URL or filename strictly ends with a video extension.
 */
export function isVideoExtension(urlOrPath?: string | null): boolean {
  if (!urlOrPath) return false;
  const clean = urlOrPath.split('?')[0].split('#')[0].toLowerCase().trim();
  return (
    clean.endsWith('.mp4') ||
    clean.endsWith('.mov') ||
    clean.endsWith('.mkv') ||
    clean.endsWith('.webm') ||
    clean.endsWith('.avi') ||
    VIDEO_EXTENSIONS.test(urlOrPath)
  );
}

/**
 * Checks if a URL or filename strictly ends with a photo/image extension.
 */
export function isPhotoExtension(urlOrPath?: string | null): boolean {
  if (!urlOrPath) return false;
  const clean = urlOrPath.split('?')[0].split('#')[0].toLowerCase().trim();
  return (
    clean.endsWith('.jpg') ||
    clean.endsWith('.jpeg') ||
    clean.endsWith('.png') ||
    clean.endsWith('.webp') ||
    clean.endsWith('.gif') ||
    clean.endsWith('.avif') ||
    clean.endsWith('.bmp') ||
    clean.endsWith('.tiff') ||
    clean.endsWith('.heic') ||
    clean.endsWith('.svg') ||
    PHOTO_EXTENSIONS.test(urlOrPath)
  );
}

/**
 * Determines media type strictly by file extension:
 * - If file extension is a video format (.mp4, .mov, .mkv, .webm, .avi) -> 'video'
 * - If file extension is a photo format (.jpg, .jpeg, .png, .webp, .gif, .avif) -> 'image'
 * - Does NOT fall back to 'image' for videos in image folders.
 */
export function determineMediaType(
  urlOrPath?: string | null,
  declaredType?: string
): 'video' | 'image' {
  if (!urlOrPath) {
    return declaredType === 'video' ? 'video' : 'image';
  }
  if (isVideoExtension(urlOrPath)) {
    return 'video';
  }
  if (isPhotoExtension(urlOrPath)) {
    return 'image';
  }
  // Secondary check on declared type if extension is absent
  return declaredType === 'video' ? 'video' : 'image';
}

/**
 * Encodes a single path segment safely:
 * - Decodes first to prevent double-encoding (%20 -> %2520)
 * - Encodes via encodeURIComponent (handling [, ], spaces, #, &, +, ?)
 * - Encodes parentheses ( and ) to %28 and %29 to prevent CDN/parser breakage
 */
export function safeEncodePathSegment(segment: string): string {
  if (!segment) return '';
  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    // leave as is
  }
  return encodeURIComponent(decoded)
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

/**
 * Encodes a relative Hugging Face path, segment by segment.
 */
export function safeEncodeHfPath(path: string): string {
  if (!path) return '';
  const clean = path.replace(/^\/+/, '');
  return clean
    .split('/')
    .map(safeEncodePathSegment)
    .join('/');
}

/**
 * Encodes an entire URL, specifically protecting path segments in Hugging Face CDN URLs
 * from containing illegal characters such as [, ], (, ), spaces, and #.
 */
export function safeEncodeUrl(url: string): string {
  if (!url) return '';
  const safe = url.replace(/^http:\/\//i, 'https://');

  if (safe.includes('/resolve/main/')) {
    const parts = safe.split('/resolve/main/');
    const base = parts[0];
    const rest = parts.slice(1).join('/resolve/main/');
    const [pathPart, queryOrHash] = rest.split(/(?=[?#])/);
    const encodedPath = safeEncodeHfPath(pathPart || '');
    return `${base}/resolve/main/${encodedPath}${queryOrHash || ''}`;
  }

  // If already standard http/https URL, try URI encode
  try {
    return encodeURI(decodeURI(safe));
  } catch {
    return safe;
  }
}

/**
 * Checks whether a path or URL belongs to a hidden or system directory (e.g., .thumbnails, .git, .cache, .github)
 * or has any path segment starting with a dot.
 */
export function isHiddenOrSystemPath(pathOrUrl?: string | null): boolean {
  if (!pathOrUrl) return false;
  let clean = pathOrUrl.split('?')[0].split('#')[0];
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // leave as is
  }

  // Normalize slashes
  clean = clean.replace(/\\/g, '/');

  // Strip Hugging Face resolve base or protocol domain if present
  if (clean.includes('/resolve/main/')) {
    clean = clean.split('/resolve/main/')[1] || clean;
  } else if (clean.includes('://')) {
    try {
      const parsed = new URL(clean);
      clean = parsed.pathname;
    } catch {
      // fallback
    }
  }

  // Normalize leading and trailing slashes
  clean = clean.replace(/^\/+|\/+$/g, '').trim();

  // Explicit check for .thumbnails
  const lower = clean.toLowerCase();
  if (
    lower === '.thumbnails' ||
    lower.startsWith('.thumbnails/') ||
    lower.includes('/.thumbnails/') ||
    lower.endsWith('/.thumbnails')
  ) {
    return true;
  }

  // Check all path segments: any segment starting with a dot or equal to .thumbnails is hidden/system
  const segments = clean.split('/');
  return segments.some((segment) => {
    const s = segment.trim();
    return s.startsWith('.') || s.toLowerCase() === '.thumbnails';
  });
}

/**
 * Checks whether a folder name or album ID represents a hidden/system directory.
 */
export function isHiddenOrSystemFolder(folderOrName?: string | null): boolean {
  if (!folderOrName) return false;
  let clean = folderOrName.trim();
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // leave as is
  }
  clean = clean.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
  const lower = clean.toLowerCase();

  if (
    lower.startsWith('.') ||
    lower.startsWith('album-.') ||
    lower === '.thumbnails' ||
    lower.includes('.thumbnails') ||
    lower === '.git' ||
    lower === '.cache' ||
    lower === '.github' ||
    lower === '.vscode'
  ) {
    return true;
  }

  return isHiddenOrSystemPath(clean);
}
