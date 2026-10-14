import React from 'react';
import { DriftimeEditorialStage, type DriftimeVariant } from './DriftimeEditorialStage';
import { TopFeedStage } from './TopFeedStage';
import type { AlbumData, StageMediaItem } from '../types';

export interface AlbumStageProps {
  album: AlbumData;
  isActive: boolean;
  onSelectItem: (item: StageMediaItem, posterUrl?: string) => void;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  batchIndex: number;
  isVisible?: boolean;
  isLoading?: boolean;
  recentItems?: StageMediaItem[];
  onClearHistory?: () => void;
}

export const AlbumStage: React.FC<AlbumStageProps> = (props) => {
  const { album, isActive, onSelectItem, recentItems, onClearHistory } = props;

  // Dedicated Top-of-Feed Stage for Latest Releases & Recently Opened Carousels
  if (album.id === 'album-latest-releases') {
    return (
      <TopFeedStage
        album={album}
        isActive={isActive}
        onSelectItem={onSelectItem}
        recentItems={recentItems}
        onClearHistory={onClearHistory}
      />
    );
  }

  // Dynamic Driftime Editorial Layout Rhythms for interleaved albums:
  let variant: DriftimeVariant = 'filmstrip';

  if (album.itemCount === 0 || album.layoutType?.startsWith('coming-soon')) {
    variant = 'coming-soon';
  } else if (
    album.id.includes('short') ||
    album.name.toLowerCase().includes('short') ||
    album.name.toLowerCase().includes('reel') ||
    album.layoutType === 'vertical-waterfall'
  ) {
    variant = 'shorts';
  } else if (album.type === 'video') {
    variant = 'cinematic';
  } else {
    // Curated photography rhythms
    if (album.id.includes('bandhobis')) {
      variant = 'filmstrip';
    } else if (album.id.includes('work')) {
      variant = 'staggered';
    } else if (album.id.includes('h2026')) {
      variant = 'diptych';
    } else if (album.id.includes('h2025')) {
      variant = 'staggered';
    } else {
      variant = 'filmstrip';
    }
  }

  return <DriftimeEditorialStage {...props} variant={variant} />;
};
