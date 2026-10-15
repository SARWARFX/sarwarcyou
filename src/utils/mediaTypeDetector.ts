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
 * Strictly encodes video stream URLs so spaces and special characters like [, ], (, ), and &
 * do not break HTTP Range requests, while preserving the raw direct download/resolve endpoint:
 * https://huggingface.co/datasets/{USER}/{REPO}/resolve/main/{FILE_PATH}
 */
export function encodeStreamUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let safe = rawUrl.replace(/^http:\/\//i, 'https://');

  // Verify and enforce Hugging Face direct resolve endpoint format (/resolve/main/)
  if (safe.includes('huggingface.co/datasets/')) {
    if (safe.includes('/raw/main/')) {
      safe = safe.replace('/raw/main/', '/resolve/main/');
    } else if (safe.includes('/tree/main/')) {
      safe = safe.replace('/tree/main/', '/resolve/main/');
    }
  }

  // Handle Hugging Face /resolve/main/
  if (safe.includes('/resolve/main/')) {
    const parts = safe.split('/resolve/main/');
    const base = parts[0];
    const pathPart = parts.slice(1).join('/resolve/main/');
    const cleanPath = pathPart
      .split('/')
      .map((segment) =>
        encodeURIComponent(decodeURIComponent(segment))
          .replace(/\(/g, '%28')
          .replace(/\)/g, '%29')
      )
      .join('/');
    return `${base}/resolve/main/${cleanPath}`;
  }

  // If already standard full URL with protocol
  if (safe.includes('://')) {
    try {
      const parsed = new URL(safe);
      const cleanPath = parsed.pathname
        .split('/')
        .map((segment) =>
          encodeURIComponent(decodeURIComponent(segment))
            .replace(/\(/g, '%28')
            .replace(/\)/g, '%29')
        )
        .join('/');
      return `${parsed.origin}${cleanPath}${parsed.search}${parsed.hash}`;
    } catch {
      // fallback
    }
  }

  // Fallback / relative file path: encode each segment
  return safe
    .split('/')
    .map((segment) =>
      encodeURIComponent(decodeURIComponent(segment))
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29')
    )
    .join('/');
}

/**
 * Encodes an entire URL, specifically protecting path segments in Hugging Face CDN URLs
 * from containing illegal characters such as [, ], (, ), spaces, and #.
 */
export const safeEncodeUrl = encodeStreamUrl;

/**
 * Patterns matching internal asset directories, thumbnail folders, and pipeline artifacts.
 */
export const EXCLUDED_ALBUM_PATTERNS: RegExp[] = [
  /thumb/i,
  /thumbnails?/i,
  /temp_thumbnails?/i,
  /\.cache/i,
  /\.github/i,
  /optimized_batch_output/i,
];

/**
 * Checks whether an album name, folder slug, or directory path matches any excluded album patterns.
 */
export function isExcludedAlbum(folderPathOrName?: string | null): boolean {
  if (!folderPathOrName) return false;
  let clean = folderPathOrName.trim();
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // leave as is
  }
  clean = clean.replace(/\\/g, '/');
  return EXCLUDED_ALBUM_PATTERNS.some((regex) => regex.test(clean));
}

/**
 * Patterns matching pre-rendered thumbnail image files.
 */
export const THUMBNAIL_FILE_PATTERNS: RegExp[] = [
  /[-_]thumb(?:nail)?\.(?:jpg|jpeg|png|webp|avif)$/i,
  /thumb(?:nail)?s?[-_]\d+\.(?:jpg|jpeg|png|webp|avif)$/i,
  /[-_]preview(?:[-_]\d+)?\.(?:jpg|jpeg|png|webp|avif)$/i,
  /^thumb(?:nail)?s?[-_]/i,
];

/**
 * Checks whether an image path or URL is an internal thumbnail or preview asset
 * rather than a standalone gallery photograph.
 */
export function isThumbnailFile(urlOrPath?: string | null): boolean {
  if (!urlOrPath) return false;
  let clean = urlOrPath.split('?')[0].split('#')[0];
  try {
    clean = decodeURIComponent(clean);
  } catch {
    // leave as is
  }
  clean = clean.replace(/\\/g, '/');

  // Any file inside an excluded thumbnail or artifact folder
  if (EXCLUDED_ALBUM_PATTERNS.some((regex) => regex.test(clean))) {
    return true;
  }

  const fileName = clean.split('/').pop() || clean;
  if (THUMBNAIL_FILE_PATTERNS.some((regex) => regex.test(fileName))) {
    return true;
  }

  const lowerName = fileName.toLowerCase();
  return (
    lowerName.includes('_thumb.') ||
    lowerName.includes('-thumb.') ||
    lowerName.includes('.thumb.') ||
    lowerName.includes('_thumbnail.') ||
    lowerName.includes('-thumbnail.') ||
    lowerName.includes('preview_') ||
    lowerName.includes('_preview.')
  );
}

/**
 * Checks whether a path or URL belongs to a hidden or system directory (e.g., .thumbnails, .git, .cache, .github)
 * or has any path segment starting with a dot or matching excluded album patterns.
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

  // Exclude thumbnail and artifact directories
  if (isExcludedAlbum(clean)) {
    return true;
  }

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

  // Check all path segments: any segment starting with a dot or matching excluded album is hidden/system
  const segments = clean.split('/');
  return segments.some((segment) => {
    const s = segment.trim();
    return s.startsWith('.') || isExcludedAlbum(s);
  });
}

/**
 * Checks whether a folder name or album ID represents a hidden/system directory or excluded album.
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

  if (isExcludedAlbum(clean)) {
    return true;
  }

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

export interface ParsedMediaPath {
  parentAlbum: string;
  innerFolder?: string;
  mediaType: 'clip' | 'short' | 'photo';
  isNested: boolean;
}

/**
 * Universal recursive media path parser for Hugging Face stream vault.
 * Correctly classifies files by extension and inner folder type regardless of nesting:
 * - .mp4 inside any "Shorts/" folder -> 'short'
 * - .mp4 inside any "Video Clips/" or "Clips/" folder -> 'clip'
 * - Photo files (.jpg, .jpeg, .png, etc.) -> 'photo'
 * - Preserves the parent album name intact (e.g., Album: "Bandhobis")
 */
export function parseMediaPath(rawPath: string): ParsedMediaPath {
  if (!rawPath) {
    return { parentAlbum: 'Featured', mediaType: 'photo', isNested: false };
  }

  const clean = rawPath.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const segments = clean.split('/');
  const filename = segments[segments.length - 1] || clean;

  const isVideo = isVideoExtension(filename);
  const isPhoto = isPhotoExtension(filename);

  // Check if path or any segment indicates a short
  const hasShortsSegment = segments.some((s) => /^shorts?$/i.test(s.trim())) || clean.toLowerCase().includes('/shorts/');

  let mediaType: 'clip' | 'short' | 'photo' = 'photo';
  if (isVideo) {
    if (hasShortsSegment) {
      mediaType = 'short';
    } else {
      mediaType = 'clip';
    }
  } else if (isPhoto) {
    mediaType = 'photo';
  }

  let parentAlbum = 'Featured';
  let innerFolder: string | undefined;
  let isNested = false;

  const root = (segments[0] || '').toLowerCase().trim();

  if (root === 'shorts') {
    parentAlbum = 'Shorts & Reels';
    mediaType = 'short';
    if (segments.length >= 3) {
      innerFolder = segments.slice(1, -1).join(' / ');
      isNested = true;
    }
  } else if (root === 'clips') {
    if (segments.length >= 3) {
      parentAlbum = segments[1];
      innerFolder = segments.slice(2, -1).join(' / ') || undefined;
      isNested = segments.length > 3;
    } else if (segments.length === 2) {
      parentAlbum = segments[1];
    }
    if (!hasShortsSegment) {
      mediaType = 'clip';
    }
  } else if (root === 'images') {
    if (segments.length >= 4) {
      // e.g. Images/Bandhobis/Video Clips/asha8.mp4
      // or Images/Bandhobis/Shorts/Screen_Recording...mp4
      // or Images/Bandhobis/Images/Asha1.jpg
      parentAlbum = segments[1];
      innerFolder = segments.slice(2, -1).join(' / ');
      isNested = true;
    } else if (segments.length === 3) {
      // e.g. Images/works/photo.jpg or Images/Bandhobis/photo.jpg
      parentAlbum = segments[1];
    } else if (segments.length === 2) {
      parentAlbum = 'Featured Photography';
    }
  } else {
    // Non-standard root folder
    if (segments.length >= 3) {
      parentAlbum = segments[0];
      innerFolder = segments.slice(1, -1).join(' / ');
      isNested = true;
    } else if (segments.length >= 2) {
      parentAlbum = segments[0];
    }
  }

  return { parentAlbum, innerFolder, mediaType, isNested };
}

