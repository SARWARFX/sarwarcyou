export interface TrailerImage {
  id: string;
  name: string;
  url: string;
  thumbnail: string;
  folderName: string;
}

export interface MediaFile {
  id: string;
  name: string;
  type: 'video' | 'image';
  thumbnail: string;
  url: string;
  date?: number;
}

export interface VideoFolder {
  id: string;
  name: string;
  type: string;
  count: number;
  files: MediaFile[];
}

export interface ShortsFolder {
  id: string;
  name: string;
  count: number;
  files: MediaFile[];
}

export interface ImageFolder {
  id: string;
  name: string;
  count: number;
  files: MediaFile[];
}

export interface HfMediaItem {
  name: string;
  path: string;
  url: string;
  thumbnails?: string[];
}

export interface HfMediaCatalog {
  clips: HfMediaItem[];
  shorts: HfMediaItem[];
  images: HfMediaItem[];
}

export interface ApiResponseData {
  trailerImages: TrailerImage[];
  videoFolders: VideoFolder[];
  shortsFolder: ShortsFolder;
  leftImageFolder: ImageFolder;
  centerImageFolders: ImageFolder[];
}

export interface ApiResponse {
  status: 'success' | 'error';
  cached: boolean;
  data: ApiResponseData;
}

export interface StageMediaItem {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  category: string;
  type: 'video' | 'image';
  posterUrl?: string;
  thumbnails?: string[];
}

export interface MediaFolderEntry {
  id: string;
  name: string;
  type: 'image' | 'video';
  count: number;
  items: StageMediaItem[];
}

export type AlbumLayoutType =
  | 'weichie-curved'
  | 'heroic-masonry'
  | 'bento-grid'
  | 'scattered-canvas'
  | 'shallow-arc'
  | 'depth-cascade'
  | 'ribbon-slider'
  | 'showcase-hero'
  | 'grid-wall'
  | 'theater-cylinder'
  | 'spiral-helix'
  | 'perspective-tunnel'
  | 'curved-billboard'
  | 'vertical-waterfall'
  | 'coming-soon-photos'
  | 'coming-soon-videos';

export interface AlbumData {
  id: string;
  index: number; // 0 to 11
  name: string;
  type: 'image' | 'video';
  itemCount: number;
  items: StageMediaItem[];
  layoutType: AlbumLayoutType;
  subtitle?: string;
}

