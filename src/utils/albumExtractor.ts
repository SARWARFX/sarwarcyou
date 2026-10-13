import type { ApiResponseData, HfMediaCatalog, HfMediaItem, AlbumData, StageMediaItem } from '../types';
import { FALLBACK_HF_CATALOG, FALLBACK_MEDIA_DATA } from '../data/fallbackData';
import { getDirectImageUrl, ensureHttps } from './imageUrlResolver';

function isHfCatalog(data: unknown): data is HfMediaCatalog {
  return (
    !!data &&
    typeof data === 'object' &&
    ('images' in data || 'clips' in data || 'shorts' in data)
  );
}

export function extractTwelveAlbums(
  data: HfMediaCatalog | ApiResponseData | null | undefined
): AlbumData[] {
  const effectiveData = data || FALLBACK_HF_CATALOG;

  // If Hugging Face catalog schema:
  if (isHfCatalog(effectiveData)) {
    const catalog = effectiveData;

    const getSubfolder = (path: string) => {
      const parts = path.split('/');
      return (parts[1] || '').trim().toLowerCase();
    };

    const mapHfItems = (
      items: HfMediaItem[],
      categoryName: string,
      type: 'image' | 'video'
    ): StageMediaItem[] => {
      return items.map((item, idx) => {
        const safeUrl = encodeURI(ensureHttps(item.url));
        return {
          id: item.path || `${categoryName}-${idx}`,
          title: item.name.replace(/\.[^/.]+$/, '').replace(/[-_]+/g, ' ').trim() || `${categoryName} ${idx + 1}`,
          url: safeUrl,
          thumbnail: type === 'image' ? safeUrl : getDirectImageUrl({ id: item.path, url: item.url, type }, idx),
          category: categoryName,
          type,
        };
      });
    };

    const bandhobisFiles = mapHfItems(
      catalog.images.filter((x) => getSubfolder(x.path) === 'bandhobis'),
      'Bandhobis',
      'image'
    );
    const worksFiles = mapHfItems(
      catalog.images.filter((x) => getSubfolder(x.path).includes('work')),
      'Works',
      'image'
    );
    const h2026PhotoFiles = mapHfItems(
      catalog.images.filter((x) => getSubfolder(x.path) === 'h2026'),
      'H2026 Photos',
      'image'
    );
    const h2025PhotoFiles = mapHfItems(
      catalog.images.filter((x) => getSubfolder(x.path) === 'h2025'),
      'H2025 Photos',
      'image'
    );
    const classicFiles = mapHfItems(
      catalog.images.filter((x) => getSubfolder(x.path).includes('classic')),
      'Classic',
      'image'
    );
    const favoriteVideoFiles = mapHfItems(
      catalog.clips.filter((x) => getSubfolder(x.path).includes('favorite')),
      'Favorite Videos',
      'video'
    );
    const h2026VideoFiles = mapHfItems(
      catalog.clips.filter((x) => getSubfolder(x.path) === 'h2026'),
      'H2026 Videos',
      'video'
    );
    const h2025VideoFiles = mapHfItems(
      catalog.clips.filter((x) => getSubfolder(x.path) === 'h2025'),
      'H2025 Videos',
      'video'
    );
    const othersVideoFiles = mapHfItems(
      catalog.clips.filter((x) => getSubfolder(x.path).includes('other')),
      'Others Videos',
      'video'
    );
    const shortsFiles = mapHfItems(
      catalog.shorts || [],
      'Shorts & Reels',
      'video'
    );
    const h2027PhotoFiles = mapHfItems(
      catalog.images.filter((x) => getSubfolder(x.path) === 'h2027'),
      'H2027 Photos',
      'image'
    );
    const h2027VideoFiles = mapHfItems(
      catalog.clips.filter((x) => getSubfolder(x.path) === 'h2027'),
      'H2027 Videos',
      'video'
    );

    const baseAlbums: AlbumData[] = [
      {
        id: 'album-bandhobis',
        index: 0,
        name: 'Bandhobis',
        type: 'image',
        itemCount: bandhobisFiles.length,
        items: bandhobisFiles,
        layoutType: 'weichie-curved',
        subtitle: 'Weichie 3D Curved Marquee',
      },
      {
        id: 'album-works',
        index: 1,
        name: 'Works',
        type: 'image',
        itemCount: worksFiles.length,
        items: worksFiles,
        layoutType: 'heroic-masonry',
        subtitle: 'Heroic Editorial Masonry',
      },
      {
        id: 'album-h2026-photos',
        index: 2,
        name: 'H2026 Photos',
        type: 'image',
        itemCount: h2026PhotoFiles.length,
        items: h2026PhotoFiles,
        layoutType: 'bento-grid',
        subtitle: 'Asymmetric Bento Architecture',
      },
      {
        id: 'album-h2025-photos',
        index: 3,
        name: 'H2025 Photos',
        type: 'image',
        itemCount: h2025PhotoFiles.length,
        items: h2025PhotoFiles,
        layoutType: 'scattered-canvas',
        subtitle: 'Interactive Drifting Canvas',
      },
      {
        id: 'album-classic',
        index: 4,
        name: 'Classic',
        type: 'image',
        itemCount: classicFiles.length,
        items: classicFiles,
        layoutType: 'grid-wall',
        subtitle: '3D Perspective Matrix',
      },
      {
        id: 'album-favorite-videos',
        index: 5,
        name: 'Favorite Videos',
        type: 'video',
        itemCount: favoriteVideoFiles.length,
        items: favoriteVideoFiles,
        layoutType: 'theater-cylinder',
        subtitle: 'Cinematic Cylinder Theater',
      },
      {
        id: 'album-h2026-videos',
        index: 6,
        name: 'H2026 Videos',
        type: 'video',
        itemCount: h2026VideoFiles.length,
        items: h2026VideoFiles,
        layoutType: 'spiral-helix',
        subtitle: 'Double Helix Orbit',
      },
      {
        id: 'album-h2025-videos',
        index: 7,
        name: 'H2025 Videos',
        type: 'video',
        itemCount: h2025VideoFiles.length,
        items: h2025VideoFiles,
        layoutType: 'perspective-tunnel',
        subtitle: 'Holographic Corridor',
      },
      {
        id: 'album-others-videos',
        index: 8,
        name: 'Others Videos',
        type: 'video',
        itemCount: othersVideoFiles.length,
        items: othersVideoFiles,
        layoutType: 'curved-billboard',
        subtitle: 'Panoramic Amphitheater',
      },
      {
        id: 'album-shorts',
        index: 9,
        name: 'Shorts & Reels',
        type: 'video',
        itemCount: shortsFiles.length,
        items: shortsFiles,
        layoutType: 'vertical-waterfall',
        subtitle: 'Tiered Waterfall Deck',
      },
      {
        id: 'album-h2027-photos',
        index: 10,
        name: 'H2027 Photos',
        type: 'image',
        itemCount: h2027PhotoFiles.length,
        items: h2027PhotoFiles,
        layoutType: 'coming-soon-photos',
        subtitle: 'Future Archive // Encrypted',
      },
      {
        id: 'album-h2027-videos',
        index: 11,
        name: 'H2027 Videos',
        type: 'video',
        itemCount: h2027VideoFiles.length,
        items: h2027VideoFiles,
        layoutType: 'coming-soon-videos',
        subtitle: 'Future Vault // In Queue',
      },
    ];

    // Dynamic Discovery for any newly added custom folders in Images/ or Clips/:
    const isStandardImageFolder = (sub: string) =>
      sub === 'bandhobis' ||
      sub.includes('work') ||
      sub === 'h2026' ||
      sub === 'h2025' ||
      sub.includes('classic') ||
      sub === 'h2027';

    const isStandardClipFolder = (sub: string) =>
      sub.includes('favorite') ||
      sub === 'h2026' ||
      sub === 'h2025' ||
      sub.includes('other') ||
      sub === 'h2027';

    const extraImageFolders = new Map<string, HfMediaItem[]>();
    for (const img of catalog.images) {
      const sub = getSubfolder(img.path);
      if (sub && !isStandardImageFolder(sub)) {
        const list = extraImageFolders.get(sub) || [];
        list.push(img);
        extraImageFolders.set(sub, list);
      }
    }

    const extraClipFolders = new Map<string, HfMediaItem[]>();
    for (const clip of catalog.clips) {
      const sub = getSubfolder(clip.path);
      if (sub && !isStandardClipFolder(sub)) {
        const list = extraClipFolders.get(sub) || [];
        list.push(clip);
        extraClipFolders.set(sub, list);
      }
    }

    let nextIndex = baseAlbums.length;

    extraImageFolders.forEach((files, folderKey) => {
      const title = folderKey
        .split(/[-_]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const mapped = mapHfItems(files, title, 'image');
      baseAlbums.push({
        id: `album-${folderKey}`,
        index: nextIndex++,
        name: title,
        type: 'image',
        itemCount: mapped.length,
        items: mapped,
        layoutType: 'heroic-masonry',
        subtitle: 'Editorial Gallery',
      });
    });

    extraClipFolders.forEach((files, folderKey) => {
      const title = folderKey
        .split(/[-_]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const mapped = mapHfItems(files, title, 'video');
      baseAlbums.push({
        id: `album-${folderKey}`,
        index: nextIndex++,
        name: title,
        type: 'video',
        itemCount: mapped.length,
        items: mapped,
        layoutType: 'theater-cylinder',
        subtitle: 'Cinematic Theater',
      });
    });

    return baseAlbums;
  }

  // Fallback to legacy Google Drive data structure if ever supplied:
  const source: ApiResponseData = (data as unknown as ApiResponseData) || FALLBACK_MEDIA_DATA;

  const mapFiles = (
    files: Array<{ id: string; name: string; url: string; thumbnail: string; type?: string }> | undefined,
    categoryName: string,
    defaultType: 'image' | 'video'
  ): StageMediaItem[] => {
    if (!files) return [];
    return files.map((f, idx) => ({
      id: f.id,
      title: f.name,
      url: ensureHttps(f.url),
      thumbnail: getDirectImageUrl({ id: f.id, url: f.url, thumbnail: f.thumbnail }, idx),
      category: categoryName,
      type: (f.type as 'image' | 'video') || defaultType,
    }));
  };

  const bandhobisFolder = source.leftImageFolder;
  const bandhobisFiles = mapFiles(bandhobisFolder?.files, 'Bandhobis', 'image');

  const centerFolders = source.centerImageFolders || [];
  const worksFolder = centerFolders.find((f) => f.name.toLowerCase().includes('work'));
  const h2026PhotoFolder = centerFolders.find((f) => f.name === 'H2026');
  const h2025PhotoFolder = centerFolders.find((f) => f.name === 'H2025');
  const classicFolder = centerFolders.find((f) => f.name.toLowerCase().includes('classic'));
  const h2027PhotoFolder = centerFolders.find((f) => f.name === 'H2027');

  const videoFolders = source.videoFolders || [];
  const favoriteVideosFolder = videoFolders.find((f) => f.name.toLowerCase().includes('favorite'));
  const h2026VideoFolder = videoFolders.find((f) => f.name === 'H2026');
  const h2025VideoFolder = videoFolders.find((f) => f.name === 'H2025');
  const othersVideoFolder = videoFolders.find((f) => f.name.toLowerCase().includes('other'));
  const h2027VideoFolder = videoFolders.find((f) => f.name === 'H2027');

  const shortsFolder = source.shortsFolder;

  return [
    {
      id: 'album-bandhobis',
      index: 0,
      name: 'Bandhobis',
      type: 'image',
      itemCount: bandhobisFiles.length,
      items: bandhobisFiles,
      layoutType: 'weichie-curved',
      subtitle: 'Weichie 3D Curved Marquee',
    },
    {
      id: 'album-works',
      index: 1,
      name: worksFolder?.name || 'Works',
      type: 'image',
      itemCount: worksFolder?.files?.length || 0,
      items: mapFiles(worksFolder?.files, 'Works', 'image'),
      layoutType: 'heroic-masonry',
      subtitle: 'Heroic Editorial Masonry',
    },
    {
      id: 'album-h2026-photos',
      index: 2,
      name: 'H2026 Photos',
      type: 'image',
      itemCount: h2026PhotoFolder?.files?.length || 0,
      items: mapFiles(h2026PhotoFolder?.files, 'H2026 Photos', 'image'),
      layoutType: 'bento-grid',
      subtitle: 'Asymmetric Bento Architecture',
    },
    {
      id: 'album-h2025-photos',
      index: 3,
      name: 'H2025 Photos',
      type: 'image',
      itemCount: h2025PhotoFolder?.files?.length || 0,
      items: mapFiles(h2025PhotoFolder?.files, 'H2025 Photos', 'image'),
      layoutType: 'scattered-canvas',
      subtitle: 'Interactive Drifting Canvas',
    },
    {
      id: 'album-classic',
      index: 4,
      name: classicFolder?.name || 'Classic',
      type: 'image',
      itemCount: classicFolder?.files?.length || 0,
      items: mapFiles(classicFolder?.files, 'Classic', 'image'),
      layoutType: 'grid-wall',
      subtitle: '3D Perspective Matrix',
    },
    {
      id: 'album-favorite-videos',
      index: 5,
      name: favoriteVideosFolder?.name || 'Favorite Videos',
      type: 'video',
      itemCount: favoriteVideosFolder?.files?.length || 0,
      items: mapFiles(favoriteVideosFolder?.files, 'Favorite Videos', 'video'),
      layoutType: 'theater-cylinder',
      subtitle: 'Cinematic Cylinder Theater',
    },
    {
      id: 'album-h2026-videos',
      index: 6,
      name: 'H2026 Videos',
      type: 'video',
      itemCount: h2026VideoFolder?.files?.length || 0,
      items: mapFiles(h2026VideoFolder?.files, 'H2026 Videos', 'video'),
      layoutType: 'spiral-helix',
      subtitle: 'Double Helix Orbit',
    },
    {
      id: 'album-h2025-videos',
      index: 7,
      name: 'H2025 Videos',
      type: 'video',
      itemCount: h2025VideoFolder?.files?.length || 0,
      items: mapFiles(h2025VideoFolder?.files, 'H2025 Videos', 'video'),
      layoutType: 'perspective-tunnel',
      subtitle: 'Holographic Corridor',
    },
    {
      id: 'album-others-videos',
      index: 8,
      name: othersVideoFolder?.name || 'Others Videos',
      type: 'video',
      itemCount: othersVideoFolder?.files?.length || 0,
      items: mapFiles(othersVideoFolder?.files, 'Others Videos', 'video'),
      layoutType: 'curved-billboard',
      subtitle: 'Panoramic Amphitheater',
    },
    {
      id: 'album-shorts',
      index: 9,
      name: shortsFolder?.name || 'Shorts & Reels',
      type: 'video',
      itemCount: shortsFolder?.files?.length || 0,
      items: mapFiles(shortsFolder?.files, 'Shorts & Reels', 'video'),
      layoutType: 'vertical-waterfall',
      subtitle: 'Tiered Waterfall Deck',
    },
    {
      id: 'album-h2027-photos',
      index: 10,
      name: 'H2027 Photos',
      type: 'image',
      itemCount: h2027PhotoFolder?.files?.length || 0,
      items: mapFiles(h2027PhotoFolder?.files, 'H2027 Photos', 'image'),
      layoutType: 'coming-soon-photos',
      subtitle: 'Future Archive // Encrypted',
    },
    {
      id: 'album-h2027-videos',
      index: 11,
      name: 'H2027 Videos',
      type: 'video',
      itemCount: h2027VideoFolder?.files?.length || 0,
      items: mapFiles(h2027VideoFolder?.files, 'H2027 Videos', 'video'),
      layoutType: 'coming-soon-videos',
      subtitle: 'Future Vault // In Queue',
    },
  ];
}
