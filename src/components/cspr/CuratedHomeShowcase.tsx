import React, { useMemo } from 'react';
import type { StageMediaItem } from '../../types';
import { isPhotoExtension } from '../../utils/mediaTypeDetector';
import { HorizontalMediaShelf } from './HorizontalMediaShelf';

export interface CuratedHomeShowcaseProps {
  items: StageMediaItem[];
  onOpenPhoto: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo: (item: StageMediaItem, playlist: StageMediaItem[]) => void;
  onOpenShort: (item: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => void;
}

export const CuratedHomeShowcase: React.FC<CuratedHomeShowcaseProps> = ({
  items,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
}) => {
  // --------------------------------------------------------------------------
  // STRICT EXCLUSION: Zero media from RealTube ('R') folder is on the home page
  // --------------------------------------------------------------------------
  const homeEligiblePool = useMemo(() => {
    return items.filter((item) => {
      const raw = (item.path || item.parentAlbum || item.category || item.url || '').toLowerCase();
      return !raw.includes('realtube');
    });
  }, [items]);

  // Helper classifiers
  const isShortItem = (item: StageMediaItem): boolean => {
    const raw = (item.path || item.parentAlbum || item.category || item.url || '').toLowerCase();
    return item.mediaType === 'short' || raw.includes('short');
  };

  const isPhotoItem = (item: StageMediaItem): boolean => {
    return (
      item.type === 'image' ||
      item.mediaType === 'photo' ||
      isPhotoExtension(item.url || item.name || item.path || '')
    );
  };

  const isClipItem = (item: StageMediaItem): boolean => {
    return !isShortItem(item) && !isPhotoItem(item);
  };

  // 1. Favorite Video Clips from 'clips' folder (16:9 widescreen cards)
  const favoriteClips = useMemo(() => {
    const clips = homeEligiblePool.filter(isClipItem);
    const favs = clips.filter((it) => {
      const raw = (it.path || it.parentAlbum || it.category || '').toLowerCase();
      return raw.includes('favorite') || raw.includes('fav');
    });
    // If favs empty, take top curated clips
    return (favs.length > 0 ? favs : clips).slice(0, 24);
  }, [homeEligiblePool]);

  // 2. Latest Shorts from 'shorts/2027' folder (9:16 vertical cards)
  const latestShorts2027 = useMemo(() => {
    const shorts = homeEligiblePool.filter(isShortItem);
    const s2027 = shorts.filter((it) => {
      const raw = (it.path || it.parentAlbum || it.category || '').toLowerCase();
      return raw.includes('2027') || raw.includes('h2027');
    });
    return (s2027.length > 0 ? s2027 : shorts).slice(0, 24);
  }, [homeEligiblePool]);

  // 3. Favorite Images from 'photography' folder (4:5 portrait cards)
  const favoriteImages = useMemo(() => {
    const photos = homeEligiblePool.filter(isPhotoItem);
    const favs = photos.filter((it) => {
      const raw = (it.path || it.parentAlbum || it.category || '').toLowerCase();
      return (
        raw.includes('favorite') ||
        raw.includes('bandhobis') ||
        raw.includes('classic') ||
        raw.includes('works')
      );
    });
    return (favs.length > 0 ? favs : photos).slice(0, 24);
  }, [homeEligiblePool]);

  // 4. Images 2027 from 'photography/2027' folder (4:5 portrait cards)
  const images2027 = useMemo(() => {
    const photos = homeEligiblePool.filter(isPhotoItem);
    const p2027 = photos.filter((it) => {
      const raw = (it.path || it.parentAlbum || it.category || '').toLowerCase();
      return raw.includes('2027') || raw.includes('h2027');
    });
    // If specific 2027 subfolder not yet indexed, surface latest collection (H2026/H2025)
    return (p2027.length > 0 ? p2027 : photos.slice(0, 24));
  }, [homeEligiblePool]);

  // 5. Additional Selects from 'clips' folder (16:9 widescreen cards)
  const additionalSelectsClips = useMemo(() => {
    const clips = homeEligiblePool.filter(isClipItem);
    const favIds = new Set(favoriteClips.map((c) => c.id || c.url));
    const remainder = clips.filter((c) => !favIds.has(c.id || c.url));
    return (remainder.length > 0 ? remainder : clips.slice(24)).slice(0, 24);
  }, [homeEligiblePool, favoriteClips]);

  return (
    <div className="w-full flex flex-col space-y-6 md:space-y-8 animate-fade-in pb-16">
      {/* Desktop Workspace Container for CyberTools Suite */}
      <div className="desktop-workspace-container">
        <iframe
          id="tools-workspace-frame"
          src="https://apps.sarwarfx.cfd"
          title="CyberTools Fleet"
          loading="lazy"
          allow="clipboard-read; clipboard-write; fullscreen"
          className="w-full h-full border-0 rounded-2xl"
        />
      </div>

      {/* Media Cards Stream (Visible on Mobile / Hidden on Desktop Viewports) */}
      <div className="cards-stream-container media-cards-grid w-full flex flex-col space-y-6 md:space-y-8">
        {/* 1. Favorite Video Clips (16:9) */}
        {favoriteClips.length > 0 && (
          <HorizontalMediaShelf
            title="Favorite Video Clips"
            subtitle="CLIPS / FAVORITE"
            badge={`${favoriteClips.length} CLIPS`}
            items={favoriteClips}
            aspectRatio="video"
            onOpenItem={(item) => onOpenVideo(item, favoriteClips)}
          />
        )}

        {/* 2. Latest Shorts 2027 (9:16) */}
        {latestShorts2027.length > 0 && (
          <HorizontalMediaShelf
            title="Latest Shorts"
            subtitle="SHORTS / 2027"
            badge={`${latestShorts2027.length} REELS`}
            items={latestShorts2027}
            aspectRatio="vertical"
            onOpenItem={(item, list, idx) => onOpenShort(item, list, idx, 'Latest Shorts 2027')}
          />
        )}

        {/* 3. Favorite Images (4:5) */}
        {favoriteImages.length > 0 && (
          <HorizontalMediaShelf
            title="Favorite Images"
            subtitle="PHOTOGRAPHY / SELECTS"
            badge={`${favoriteImages.length} STILLS`}
            items={favoriteImages}
            aspectRatio="portrait"
            onOpenItem={(item, list, idx) => onOpenPhoto(item, list, idx)}
          />
        )}

        {/* 4. Images 2027 (4:5) */}
        {images2027.length > 0 && (
          <HorizontalMediaShelf
            title="Images 2027"
            subtitle="PHOTOGRAPHY / 2027"
            badge={`${images2027.length} STILLS`}
            items={images2027}
            aspectRatio="portrait"
            onOpenItem={(item, list, idx) => onOpenPhoto(item, list, idx)}
          />
        )}

        {/* 5. Additional Selects (16:9) */}
        {additionalSelectsClips.length > 0 && (
          <HorizontalMediaShelf
            title="Additional Selects"
            subtitle="CLIPS / ARCHIVE"
            badge={`${additionalSelectsClips.length} CLIPS`}
            items={additionalSelectsClips}
            aspectRatio="video"
            onOpenItem={(item) => onOpenVideo(item, additionalSelectsClips)}
          />
        )}
      </div>
    </div>
  );
};
