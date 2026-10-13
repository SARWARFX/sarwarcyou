export const FALLBACK_PORTRAIT_URLS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=1000&q=80',
  'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=1000&q=80',
];

export function ensureHttps(url?: string): string {
  if (!url) return '';
  return url.replace(/^http:\/\//i, 'https://');
}

export function extractDriveFileId(id?: string, url?: string, thumbnail?: string): string | null {
  if (id && id.length >= 15 && !id.includes('/') && !id.includes('.')) {
    return id;
  }
  const target = thumbnail || url || '';
  const match = target.match(/\/d\/([a-zA-Z0-9_-]+)/) ||
                target.match(/[?&]id=([a-zA-Z0-9_-]+)/) ||
                target.match(/googleusercontent\.com\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export function getDirectImageUrl(
  item: { id?: string; url?: string; thumbnail?: string; type?: string },
  index = 0
): string {
  const target = item.thumbnail || item.url || '';
  if (target.includes('huggingface.co')) {
    if (target.toLowerCase().endsWith('.mp4') || item.type === 'video') {
      return FALLBACK_PORTRAIT_URLS[index % FALLBACK_PORTRAIT_URLS.length];
    }
    return encodeURI(ensureHttps(target));
  }

  const fileId = extractDriveFileId(item.id, item.url, item.thumbnail);
  if (fileId) {
    // High-res raw image stream that returns Access-Control-Allow-Origin: *
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  const rawThumb = ensureHttps(item.thumbnail || item.url || '');
  if (rawThumb.startsWith('https://') || rawThumb.startsWith('http://')) {
    // Clean up any /u/0/ or =w1000 suffixes and guarantee HTTPS
    return ensureHttps(rawThumb).replace(/\/u\/\d+\/d\//, '/d/').replace(/=w\d+/, '');
  }

  // Return high-res Unsplash portrait fallback
  return FALLBACK_PORTRAIT_URLS[index % FALLBACK_PORTRAIT_URLS.length];
}

export function getBackupDriveUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

export function getUnsplashFallback(index = 0): string {
  return FALLBACK_PORTRAIT_URLS[index % FALLBACK_PORTRAIT_URLS.length];
}
