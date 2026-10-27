/**
 * routes.ts
 * Type-safe route definitions for SARWARCYOU
 */

export type AppRoute =
  | { name: 'home' }
  | { name: 'album'; albumId: string }
  | { name: 'watch'; mediaId: string; albumId?: string }
  | { name: 'photo'; mediaId: string; albumId?: string };

export function parseHashRoute(hash: string): AppRoute {
  const clean = hash.replace(/^#\/?/, '').trim();
  if (!clean) return { name: 'home' };

  const [path, queryStr] = clean.split('?');
  const params = new URLSearchParams(queryStr || '');
  const albumParam = params.get('album') || undefined;

  const parts = path.split('/').map(decodeURIComponent);

  if (parts[0] === 'album' && parts[1]) {
    return { name: 'album', albumId: parts.slice(1).join('/') };
  }

  if (parts[0] === 'watch' && parts[1]) {
    return { name: 'watch', mediaId: parts.slice(1).join('/'), albumId: albumParam };
  }

  if (parts[0] === 'photo' && parts[1]) {
    return { name: 'photo', mediaId: parts.slice(1).join('/'), albumId: albumParam };
  }

  return { name: 'home' };
}

export function buildRouteHash(route: AppRoute): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'album':
      return `#/album/${encodeURIComponent(route.albumId)}`;
    case 'watch': {
      const q = route.albumId ? `?album=${encodeURIComponent(route.albumId)}` : '';
      return `#/watch/${encodeURIComponent(route.mediaId)}${q}`;
    }
    case 'photo': {
      const q = route.albumId ? `?album=${encodeURIComponent(route.albumId)}` : '';
      return `#/photo/${encodeURIComponent(route.mediaId)}${q}`;
    }
  }
}
