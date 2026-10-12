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
}

export interface MediaFolderEntry {
  id: string;
  name: string;
  type: 'image' | 'video';
  count: number;
  items: StageMediaItem[];
}

