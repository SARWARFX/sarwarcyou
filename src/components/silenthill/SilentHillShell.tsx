import React, { useState } from 'react';
import type { StageMediaItem } from '../../types';
import { SilentHillCanvas } from './SilentHillCanvas';
import { SpecterCompass, type CardinalDirection } from './SpecterCompass';
import { SilentHillCatalogView } from './SilentHillCatalogView';

interface SilentHillShellProps {
  items: StageMediaItem[];
  isModalOpen: boolean;
  onOpenPhoto: (photo: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo: (video: StageMediaItem, playlist: StageMediaItem[]) => void;
  onOpenShort: (short: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => void;
}

export const SilentHillShell: React.FC<SilentHillShellProps> = ({
  items,
  isModalOpen,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
}) => {
  const [activeSection, setActiveSection] = useState<CardinalDirection | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleSelectSection = (dir: CardinalDirection) => {
    setIsTransitioning(true);
    // Smooth fog rush transition effect
    setTimeout(() => {
      setActiveSection(dir);
      setIsTransitioning(false);
    }, 280);
  };

  const handleBackToFog = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setActiveSection(null);
      setIsTransitioning(false);
    }, 250);
  };

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden select-none bg-[#090a0d] text-neutral-100"
      style={{ fontFamily: '"Times New Roman", Times, Georgia, serif' }}
    >
      {/* ------------------------------------------------------------- */}
      {/* 1. Atmospheric Canvas & Falling Ash Particles */}
      {/* ------------------------------------------------------------- */}
      <SilentHillCanvas intensity={activeSection ? 'dense' : 'normal'} />

      {/* Fog rush transition veil */}
      <div
        className={`fixed inset-0 pointer-events-none z-40 bg-gradient-to-b from-[#090a0d] via-[#12151a] to-[#08090b] transition-opacity duration-300 ease-in-out ${
          isTransitioning ? 'opacity-80' : 'opacity-0'
        }`}
      />

      {/* ------------------------------------------------------------- */}
      {/* 2. Main Navigation Shell */}
      {/* ------------------------------------------------------------- */}
      {activeSection === null ? (
        <SpecterCompass
          onSelectSection={handleSelectSection}
          isNavDisabled={isModalOpen || isTransitioning}
        />
      ) : (
        <SilentHillCatalogView
          section={activeSection}
          items={items}
          onBackToFog={handleBackToFog}
          onOpenPhoto={onOpenPhoto}
          onOpenVideo={onOpenVideo}
          onOpenShort={onOpenShort}
        />
      )}
    </div>
  );
};
