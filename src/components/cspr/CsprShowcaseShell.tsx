import React, { useState, useEffect } from 'react';
import type { StageMediaItem } from '../../types';
import { CsprNavigationRail, type CsprTab } from './CsprNavigationRail';
import { CuratedHomeShowcase } from './CuratedHomeShowcase';
import { SubfolderArchiveView } from './SubfolderArchiveView';
import { MIDNIGHT_OBSIDIAN_THEME } from '../gate/themeManager';
import { CinematicBackdropCanvas } from '../gate/CinematicBackdropCanvas';

export interface CsprShowcaseShellProps {
  items: StageMediaItem[];
  onOpenPhoto: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo: (item: StageMediaItem, playlist: StageMediaItem[]) => void;
  onOpenShort: (item: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => void;
  initialAlbum?: string;
  isModalOpen?: boolean;
}

export const CsprShowcaseShell: React.FC<CsprShowcaseShellProps> = ({
  items,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
  initialAlbum,
  isModalOpen = false,
}) => {
  const [activeTab, setActiveTab] = useState<CsprTab>('HOME');

  // Handle initial album routing if deep-linked to a specific category
  useEffect(() => {
    if (!initialAlbum) return;
    const lower = initialAlbum.toLowerCase();
    if (lower.includes('realtube')) {
      setActiveTab('REALTUBE');
    } else if (lower.includes('short')) {
      setActiveTab('SHORTS');
    } else if (lower.includes('image') || lower.includes('photo')) {
      setActiveTab('PHOTOGRAPHY');
    } else if (lower.includes('clip')) {
      setActiveTab('CLIPS');
    }
  }, [initialAlbum]);

  return (
    <div
      className="relative w-full h-[100dvh] overflow-hidden select-none text-white font-['Roboto',sans-serif] bg-[#03060a]"
      style={{
        isolation: 'isolate',
        background: 'radial-gradient(circle at 50% 30%, rgba(8, 20, 38, 0.5) 0%, #020408 85%)',
        backgroundColor: '#03060a',
      }}
    >
      {/* 1. Permanent Midnight Obsidian Canvas with Drifting Cyan-White Shimmer */}
      <CinematicBackdropCanvas theme={MIDNIGHT_OBSIDIAN_THEME} isPaused={isModalOpen} />

      {/* 2. Top Header Bar */}
      <header className="fixed top-0 left-0 right-0 z-30 h-14 md:h-16 bg-black/60 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-4 sm:px-6 md:px-10 shadow-lg">
        {/* Left: SARWAR.CYOU Signature Logo (Click returns to Home) */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setActiveTab('HOME')}
          className="flex items-center gap-3 cursor-pointer select-none group"
        >
          <span className="font-['Google Sans'] font-bold text-sm sm:text-base tracking-[0.22em] text-white uppercase group-hover:text-neutral-200 transition-colors drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            SARWAR.CYOU
          </span>
          <span className="text-[10px] sm:text-xs font-mono tracking-widest text-neutral-400 uppercase hidden sm:inline">
            {activeTab === 'HOME' ? '// CURATED SHOWCASE' : `// ARCHIVE: ${activeTab}`}
          </span>
        </div>

        {/* Right: Quick Home Return or Status Stamp */}
        <div className="flex items-center gap-3">
          {activeTab !== 'HOME' ? (
            <button
              type="button"
              onClick={() => setActiveTab('HOME')}
              className="text-xs font-['Roboto',sans-serif] tracking-wider uppercase px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95 flex items-center gap-1.5 border border-white/10 cursor-pointer"
            >
              <span>←</span>
              <span>HOME SHOWCASE</span>
            </button>
          ) : (
            <span className="text-[11px] font-mono tracking-wider text-neutral-500 uppercase hidden md:inline">
              ONLINE // DIRECT SHOWCASE
            </span>
          )}
        </div>
      </header>

      {/* 3. CSPR Navigation Rail (Desktop Border-Attached Rail + Mobile Bottom Bar) */}
      <CsprNavigationRail activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* 4. Main Scrollable Content Area */}
      <main className="w-full h-full overflow-y-auto space-scrollbar pt-18 md:pt-20 pb-24 md:pb-12 md:pl-20 md:pr-6">
        <div className="max-w-[1720px] mx-auto">
          {activeTab === 'HOME' ? (
            <CuratedHomeShowcase
              items={items}
              onOpenPhoto={onOpenPhoto}
              onOpenVideo={onOpenVideo}
              onOpenShort={onOpenShort}
            />
          ) : (
            <SubfolderArchiveView
              category={activeTab}
              items={items}
              onOpenPhoto={onOpenPhoto}
              onOpenVideo={onOpenVideo}
              onOpenShort={onOpenShort}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default CsprShowcaseShell;
