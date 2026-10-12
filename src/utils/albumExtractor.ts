import type { ApiResponseData, AlbumData, StageMediaItem } from '../types';
import { FALLBACK_MEDIA_DATA } from '../data/fallbackData';
import { getDirectImageUrl } from './imageUrlResolver';

export function extractTwelveAlbums(data: ApiResponseData | null | undefined): AlbumData[] {
  const source = data || FALLBACK_MEDIA_DATA;

  // Helper to map files with direct raw image stream URLs
  const mapFiles = (
    files: Array<{ id: string; name: string; url: string; thumbnail: string; type?: string }> | undefined,
    categoryName: string,
    defaultType: 'image' | 'video'
  ): StageMediaItem[] => {
    if (!files) return [];
    return files.map((f, idx) => ({
      id: f.id,
      title: f.name,
      url: f.url,
      thumbnail: getDirectImageUrl({ id: f.id, url: f.url, thumbnail: f.thumbnail }, idx),
      category: categoryName,
      type: (f.type as 'image' | 'video') || defaultType,
    }));
  };

  // 1. Bandhobis (Photos)
  const bandhobisFolder = source.leftImageFolder;
  const bandhobisFiles = mapFiles(bandhobisFolder?.files, 'Bandhobis', 'image');

  // Center image folders
  const centerFolders = source.centerImageFolders || [];
  const worksFolder = centerFolders.find((f) => f.name.toLowerCase().includes('work'));
  const h2026PhotoFolder = centerFolders.find((f) => f.name === 'H2026');
  const h2025PhotoFolder = centerFolders.find((f) => f.name === 'H2025');
  const classicFolder = centerFolders.find((f) => f.name.toLowerCase().includes('classic'));
  const h2027PhotoFolder = centerFolders.find((f) => f.name === 'H2027');

  // Video folders
  const videoFolders = source.videoFolders || [];
  const favoriteVideosFolder = videoFolders.find((f) => f.name.toLowerCase().includes('favorite'));
  const h2026VideoFolder = videoFolders.find((f) => f.name === 'H2026');
  const h2025VideoFolder = videoFolders.find((f) => f.name === 'H2025');
  const othersVideoFolder = videoFolders.find((f) => f.name.toLowerCase().includes('other'));
  const h2027VideoFolder = videoFolders.find((f) => f.name === 'H2027');

  // Shorts folder
  const shortsFolder = source.shortsFolder;

  return [
    // Album 1: Bandhobis
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
    // Album 2: Works
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
    // Album 3: H2026 Photos
    {
      id: 'album-h2026-photos',
      index: 2,
      name: 'H2026 Photos',
      type: 'image',
      itemCount: h2026PhotoFolder?.files?.length || 0,
      items: mapFiles(h2026PhotoFolder?.files, 'H2026 Photos', 'image'),
      layoutType: 'ribbon-slider',
      subtitle: 'Horizontal Ribbon Gallery',
    },
    // Album 4: H2025 Photos
    {
      id: 'album-h2025-photos',
      index: 3,
      name: 'H2025 Photos',
      type: 'image',
      itemCount: h2025PhotoFolder?.files?.length || 0,
      items: mapFiles(h2025PhotoFolder?.files, 'H2025 Photos', 'image'),
      layoutType: 'showcase-hero',
      subtitle: 'Showcase Hero Stage',
    },
    // Album 5: Classic
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
    // Album 6: Favorite Videos
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
    // Album 7: H2026 Videos
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
    // Album 8: H2025 Videos
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
    // Album 9: Others Videos
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
    // Album 10: Shorts & Reels
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
    // Album 11: H2027 Photos (Empty Folder #1 -> COMING SOON)
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
    // Album 12: H2027 Videos (Empty Folder #2 -> COMING SOON)
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
