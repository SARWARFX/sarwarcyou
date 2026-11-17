import React, { useState } from 'react';
import type { StageMediaItem } from '../../types';
import { getMediaUrl } from '../../utils/imageUrlResolver';
import { resolveStaticVideoThumbnail } from '../../utils/thumbnailResolver';
import { isPhotoExtension } from '../../utils/mediaTypeDetector';

export interface LivingMediaCardProps {
  item: StageMediaItem;
  aspectRatio: '9/16' | '16/9' | '3/4';
  subfolderLabel?: string;
  onClick: () => void;
  delayIdx?: number;
  featuredBadge?: string;
}

/**
 * Pure Distraction-Free Media Card
 * - Zero outlines, zero borders, zero L-brackets
 * - Zero text (no file names, no badges)
 * - Simply enlarges a little bit when mouse-hovered
 * - 100% rectangular geometry (0px border-radius)
 */
export const LivingMediaCard: React.FC<LivingMediaCardProps> = ({
  item,
  aspectRatio,
  onClick,
  delayIdx = 0,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  const isPhoto =
    item.type === 'image' || isPhotoExtension(item.path || item.url || item.name || '');

  const isVideo = !isPhoto;

  const imageSrc =
    (item as any).thumbnail ||
    (isVideo ? resolveStaticVideoThumbnail(item) : '') ||
    item.poster ||
    getMediaUrl(item.url || '');

  const aspectClass =
    aspectRatio === '9/16'
      ? 'aspect-[9/16]'
      : aspectRatio === '16/9'
      ? 'aspect-video'
      : 'aspect-[3/4]';

  return (
    <div
      onClick={onClick}
      style={{
        animationDelay: `${Math.min(delayIdx, 24) * 30}ms`,
        borderRadius: 0,
        outline: 'none',
        border: 'none',
      }}
      className={`relative group cursor-pointer ${aspectClass} select-none bg-[#080b12] overflow-hidden animate-card-enter transition-transform duration-300 hover:scale-[1.04] hover:z-20 w-full`}
    >
      <img
        src={imageSrc}
        alt=""
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setIsLoaded(true)}
        className={`w-full h-full object-cover filter saturate-[0.95] contrast-[1.05] transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      />
    </div>
  );
};

export default LivingMediaCard;
