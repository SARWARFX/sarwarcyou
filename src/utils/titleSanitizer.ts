/**
 * Sanitizes raw filenames and media paths into clean, human-readable titles.
 * Strips file extensions, technical tags (1080p, 720p, final, etc.), folder prefixes,
 * machine-generated camera/screen recording prefixes, and formats spacing and capitalization.
 */
export function sanitizeMediaTitle(rawTitle: string | undefined, category?: string): string {
  if (!rawTitle) {
    return category ? `${category} Clip` : 'Cinematic Clip';
  }

  // 1. Extract base filename if path is provided
  let title = rawTitle.split('/').pop() || rawTitle;

  // 2. Strip file extensions
  title = title.replace(/\.(mp4|mov|webm|mkv|avi|flv|wmv|jpg|jpeg|png|webp|gif|heic|bmp|tiff)$/i, '');

  // 3. Strip machine-generated camera/screen recorder prefixes
  title = title.replace(/\b(screen_recording|screen\s*recording|smartselect|videocapture|screenshot|screen_recorder)\b/gi, '');

  // 4. Strip timestamp & date patterns like 20260323-035012 or 20260323_035012 or 20260323
  title = title.replace(/\b\d{8}[-_]\d{6}\b/g, '');
  title = title.replace(/\b\d{8}\b/g, '');

  // 5. Strip technical tags & resolution/codec tags
  title = title.replace(/\b(1080p|720p|480p|360p|2160p|4k|8k|hd|fhd|uhd)\b/gi, '');
  title = title.replace(/\b(h264|x264|h265|x265|hevc|av1|aac|mp3|remux|bluray|webrip)\b/gi, '');
  title = title.replace(/\b(final|version\s*\d+|v\d+|draft|edit\s*\d+|render|raw)\b/gi, '');

  // 6. Split camelCase or letters glued to numbers (e.g. "asha8" -> "Asha 8", "Akhi1" -> "Akhi 1")
  title = title.replace(/([a-zA-Z])(\d+)/g, '$1 $2');
  title = title.replace(/(\d+)([a-zA-Z])/g, '$1 $2');

  // 7. Replace underscores, dashes, dots with spaces
  title = title.replace(/[-_.]+/g, ' ');

  // 8. Collapse whitespace and trim
  title = title.replace(/\s+/g, ' ').trim();

  // 9. If empty, single char, or only digits remaining, fallback gracefully to category or default
  if (!title || title.length <= 1 || /^\d+$/.test(title)) {
    if (category) {
      const cleanCat = category.replace(/[-_]+/g, ' ').trim();
      return cleanCat;
    }
    return 'Cinematic Clip';
  }

  // 10. Capitalize words cleanly
  return title
    .split(' ')
    .filter(Boolean)
    .map((word) => {
      if (word.length > 1 && word === word.toUpperCase() && word.length <= 3) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export default sanitizeMediaTitle;
