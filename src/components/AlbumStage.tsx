import React from 'react';
import { DriftimeEditorialStage, type DriftimeVariant } from './DriftimeEditorialStage';
import type { AlbumData, StageMediaItem } from '../types';

export interface AlbumStageProps {
  album: AlbumData;
  isActive: boolean;
  onSelectItem: (item: StageMediaItem) => void;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  batchIndex: number;
  isVisible?: boolean;
  isLoading?: boolean;
}

export const AlbumStage: React.FC<AlbumStageProps> = (props) => {
  const { album } = props;

  // Unified Driftime Editorial Layout Rhythms for all 12 albums:
  let variant: DriftimeVariant = 'filmstrip';

  switch (album.index) {
    case 0: // Album 1: Favorites / Bandhobis
      variant = 'filmstrip';
      break;
    case 1: // Album 2: Works
      variant = 'staggered';
      break;
    case 2: // Album 3: Portfolio / Street
      variant = 'diptych';
      break;
    case 3: // Album 4: Portraits / Editorial
      variant = 'staggered';
      break;
    case 4: // Album 5: Classic
      variant = 'filmstrip';
      break;
    case 5: // Album 6: Favorite Videos
      variant = 'cinematic';
      break;
    case 6: // Album 7: H2026 Videos
      variant = 'cinematic';
      break;
    case 7: // Album 8: H2025 Videos
      variant = 'cinematic';
      break;
    case 8: // Album 9: Others Videos
      variant = 'cinematic';
      break;
    case 9: // Album 10: Shorts & Reels
      variant = 'shorts';
      break;
    case 10: // Album 11: H2027 Photos
    case 11: // Album 12: H2027 Videos
      variant = 'coming-soon';
      break;
    default:
      variant = 'filmstrip';
  }

  return <DriftimeEditorialStage {...props} variant={variant} />;
};
