import React from 'react';
import type { AlbumData, StageMediaItem } from '../types';
import { DynamicMediaCarousel } from './DynamicMediaCarousel';

export interface TopFeedStageProps {
  album: AlbumData;
  isActive: boolean;
  onSelectItem: (item: StageMediaItem, posterUrl?: string) => void;
  recentItems?: StageMediaItem[];
  onClearHistory?: () => void;
  isLoading?: boolean;
}

export const TopFeedStage: React.FC<TopFeedStageProps> = ({
  album,
  onSelectItem,
  recentItems = [],
  onClearHistory,
  isLoading = false,
}) => {
  const hasHistory = recentItems.length > 0;

  return (
    <div className="relative w-full h-full flex flex-col justify-center px-4 sm:px-8 md:px-12 pt-20 pb-8 sm:pb-12 overflow-y-auto no-scrollbar select-none">
      {/* Ambient background glow backdrop */}
      <div className="absolute inset-0 bg-gradient-radial from-zinc-900/40 via-black to-black pointer-events-none -z-10" />

      <div className="w-full max-w-7xl mx-auto flex flex-col justify-center gap-7 sm:gap-10 my-auto">
        {/* 1. RECENTLY OPENED (Zero-state: completely hidden when empty) */}
        {hasHistory && (
          <DynamicMediaCarousel
            title="Recently Opened"
            subtitle="Resume viewing from where you left off"
            countBadge={recentItems.length}
            items={recentItems}
            onSelectItem={onSelectItem}
            onClearHistory={onClearHistory}
            icon="recent"
          />
        )}

        {/* 2. LATEST RELEASES (Top 30 Files) */}
        <DynamicMediaCarousel
          title="Latest Releases"
          subtitle="Top 30 newest cloud media releases"
          countBadge={album.items.length || 30}
          items={album.items}
          onSelectItem={onSelectItem}
          icon="releases"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};
