import React, { useState, useEffect } from 'react';
import type { StageMediaItem } from '../types';
import { getMediaUrl } from '../utils/imageUrlResolver';

export interface VaultImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  item?: StageMediaItem | null;
  fallbackSrc?: string;
}

export const VaultImage: React.FC<VaultImageProps> = ({
  item,
  src,
  fallbackSrc,
  alt = 'Vault photo',
  className = '',
  onError,
  ...restProps
}) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>(() => {
    return typeof src === 'string' && src ? src : getMediaUrl(item?.url || item?.path);
  });

  useEffect(() => {
    const remote = typeof src === 'string' && src ? src : getMediaUrl(item?.url || item?.path);
    setResolvedSrc(remote);
  }, [item, src]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    if (fallbackSrc && resolvedSrc !== fallbackSrc) {
      setResolvedSrc(fallbackSrc);
    }
    onError?.(e);
  };

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className}
      onError={handleError}
      {...restProps}
    />
  );
};

export default VaultImage;
