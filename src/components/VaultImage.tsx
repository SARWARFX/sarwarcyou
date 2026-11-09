import React, { useState, useEffect } from 'react';
import type { StageMediaItem } from '../types';
import { getLocalCachedPhotoUrl } from '../services/photoSyncManager';
import { getMediaUrl } from '../utils/imageUrlResolver';

export interface VaultImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  item?: StageMediaItem | null;
  fallbackSrc?: string;
}

/**
 * Local-First Vault Image Component.
 * Checks for a local cached copy in Directory.Data/photos/ first.
 * If cached, renders via Capacitor.convertFileSrc(...) for 0-latency offline rendering.
 * Otherwise, seamlessly renders the remote CDN URL.
 */
export const VaultImage: React.FC<VaultImageProps> = ({
  item,
  src,
  fallbackSrc,
  alt = 'Vault photo',
  className = '',
  onError,
  ...restProps
}) => {
  const target = item || src || '';
  const [resolvedSrc, setResolvedSrc] = useState<string>(() => {
    return (
      getLocalCachedPhotoUrl(target) ||
      (typeof src === 'string' && src ? src : getMediaUrl(item?.url || item?.path))
    );
  });

  useEffect(() => {
    const local = getLocalCachedPhotoUrl(target);
    if (local) {
      setResolvedSrc(local);
    } else {
      const remote = typeof src === 'string' && src ? src : getMediaUrl(item?.url || item?.path);
      setResolvedSrc(remote);
    }
  }, [item, src, target]);

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
