/**
 * Strict TypeScript Data Models for SARWARCYOU Media Streaming Architecture
 */

export type MediaType = 'video' | 'image';
export type MediaVariant = 'standard' | 'short' | 'photo'; // 16:9 Clips | 9:16 Shorts | Masonry Photos
export type AlbumType = 'video' | 'image' | 'composite';
export type SortOrder = 'newest' | 'oldest' | 'name-asc';

export interface MediaItem {
  id: string;               // Stable unique identifier (e.g. "Video Clips/Favorite Video Clips/720P_4000K_135659932")
  path: string;             // Exact relative repository path
  title: string;            // Cleaned display title without extension or technical metadata
  type: MediaType;          // 'video' | 'image'
  variant: MediaVariant;    // 'standard' | 'short' | 'photo'
  mediaUrl: string;         // Canonical Cloudflare Edge streaming URL (https://media.sarwar.cyou/...)
  thumbnailUrl: string;     // Verified thumb_1.jpg URL or empty string for placeholder
  thumbnails: string[];     // Verified 5-frame URLs for hover scrubbing (empty array if none)
  albumId: string;          // Parent folder route slug (e.g. "favorite-video-clips")
  albumTitle: string;       // Formatted parent album title (e.g. "Favorite Video Clips")
  parentFolder: string;     // Raw folder path (e.g. "Video Clips/Favorite Video Clips")
  date: number;             // Extracted timestamp or commit date (for newest-first chronological sorting)
  fileSize?: number;
}

export interface Album {
  id: string;               // URL-safe route slug (e.g. "favorite-video-clips")
  folderPath: string;       // Repository folder path (e.g. "Video Clips/Favorite Video Clips")
  title: string;            // Formatted display name
  type: AlbumType;          // 'video' | 'image' | 'composite'
  variant: MediaVariant;    // Dominant variant
  items: MediaItem[];       // Items strictly sorted
  coverThumbnailUrl: string;// Latest item's thumbnail
  itemCount: number;
  typeCounts: {
    photos: number;
    clips: number;
    shorts: number;
  };
}

export interface CatalogState {
  items: MediaItem[];
  albums: Album[];
  latestReleases: MediaItem[];
  shorts: MediaItem[];
  timestamp: number;
}
