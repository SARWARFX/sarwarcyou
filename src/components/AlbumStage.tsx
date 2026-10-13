import React from 'react';
import { Album3BentoStage } from './Album3BentoStage';
import { Album4CanvasStage } from './Album4CanvasStage';
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
}

export const AlbumStage: React.FC<AlbumStageProps> = (props) => {
  const { album } = props;

  // Album 3: Asymmetric Bento Grid
  if (album.index === 2 || album.layoutType === 'bento-grid') {
    return <Album3BentoStage {...props} />;
  }

  // Album 4: Interactive Drifting Artboard Canvas
  if (album.index === 3 || album.layoutType === 'scattered-canvas') {
    return <Album4CanvasStage {...props} />;
  }

  // Unified Driftime Editorial Layout Rhythms for all other albums:
  let variant: DriftimeVariant = 'filmstrip';

  switch (album.index) {
    case 0: // Album 1: Bandhobis
      variant = 'filmstrip';
      break;
    case 1: // Album 2: Works
      variant = 'staggered';
      break;
    case 4: // Album 5: Classic
      variant = 'diptych';
      break;
    case 5: // Album 6: Favorite Videos
      variant = 'cinematic';
      break;
    case 6: // Album 7: H2026 Videos
      variant = 'staggered';
      break;
    case 7: // Album 8: H2025 Videos
      variant = 'filmstrip';
      break;
    case 8: // Album 9: Others Videos
      variant = 'diptych';
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
