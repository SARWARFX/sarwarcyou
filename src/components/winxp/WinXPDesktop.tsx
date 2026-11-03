import React, { useState } from 'react';
import type { StageMediaItem } from '../../types';
import { XPTaskbar } from './XPTaskbar';
import { MyComputerWindow } from './MyComputerWindow';
import { ScreensaverXP } from './ScreensaverXP';
import {
  Monitor,
  Trash2,
  Camera,
  Film,
  Layers,
} from 'lucide-react';

interface WinXPDesktopProps {
  items: StageMediaItem[];
  isModalOpen: boolean;
  onOpenPhoto: (photo: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo: (video: StageMediaItem, playlist: StageMediaItem[]) => void;
  onOpenShort: (short: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => void;
}

export const WinXPDesktop: React.FC<WinXPDesktopProps> = ({
  items,
  isModalOpen,
  onOpenPhoto,
  onOpenVideo,
  onOpenShort,
}) => {
  // Window manager state for "My Computer"
  const [isMyComputerOpen, setIsMyComputerOpen] = useState(true);
  const [isMyComputerMinimized, setIsMyComputerMinimized] = useState(false);
  const [isMyComputerMaximized, setIsMyComputerMaximized] = useState(false);
  const [initialDrive, setInitialDrive] = useState<'C:' | 'D:' | 'E:' | 'F:' | undefined>(undefined);

  // Selected desktop icon
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);

  const handleOpenMyComputer = (drive?: 'C:' | 'D:' | 'E:' | 'F:') => {
    setInitialDrive(drive);
    setIsMyComputerOpen(true);
    setIsMyComputerMinimized(false);
  };

  const windowTabs = isMyComputerOpen
    ? [
        {
          id: 'my-computer',
          title: 'My Computer',
          icon: <Monitor className="w-3.5 h-3.5 text-white" />,
          isMinimized: isMyComputerMinimized,
          isActive: !isMyComputerMinimized,
        },
      ]
    : [];

  const handleToggleWindow = (id: string) => {
    if (id === 'my-computer') {
      setIsMyComputerMinimized(!isMyComputerMinimized);
    }
  };

  return (
    <div
      className="fixed inset-0 w-full h-full overflow-hidden select-none"
      style={{
        fontFamily: 'Tahoma, Arial, sans-serif',
      }}
      onClick={() => setSelectedIcon(null)}
    >
      {/* ------------------------------------------------------------- */}
      {/* Authentic Windows XP Bliss Wallpaper */}
      {/* ------------------------------------------------------------- */}
      <img
        src="/assets/bliss.jpg"
        alt="Windows XP Bliss"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none -z-10"
      />

      {/* ------------------------------------------------------------- */}
      {/* Desktop Icons Grid (Left Edge) */}
      {/* ------------------------------------------------------------- */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-5 items-start">
        {/* My Computer */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            setSelectedIcon('my-computer');
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handleOpenMyComputer();
          }}
          className={`flex flex-col items-center w-20 p-1.5 rounded cursor-pointer transition-colors ${
            selectedIcon === 'my-computer'
              ? 'bg-[#0a246a]/60 border border-[#b6d3f2]/40'
              : 'hover:bg-white/10'
          }`}
        >
          <div className="w-10 h-10 rounded bg-[#1e4eb8] border border-white/60 flex items-center justify-center text-white shadow-md">
            <Monitor className="w-6 h-6 text-white" />
          </div>
          <span
            className="text-white text-xs mt-1 text-center font-medium drop-shadow leading-tight"
            style={{
              textShadow:
                '1px 1px 1px #000, -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000',
            }}
          >
            My Computer
          </span>
        </div>

        {/* Photography (F:) Drive Shortcut */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            setSelectedIcon('drive-f');
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handleOpenMyComputer('F:');
          }}
          className={`flex flex-col items-center w-20 p-1.5 rounded cursor-pointer transition-colors ${
            selectedIcon === 'drive-f'
              ? 'bg-[#0a246a]/60 border border-[#b6d3f2]/40'
              : 'hover:bg-white/10'
          }`}
        >
          <div className="w-10 h-10 rounded bg-amber-600 border border-white/60 flex items-center justify-center text-white shadow-md">
            <Camera className="w-6 h-6 text-white" />
          </div>
          <span
            className="text-white text-xs mt-1 text-center font-medium drop-shadow leading-tight"
            style={{
              textShadow:
                '1px 1px 1px #000, -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000',
            }}
          >
            Photography (F:)
          </span>
        </div>

        {/* Video Clips (D:) Shortcut */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            setSelectedIcon('drive-d');
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handleOpenMyComputer('D:');
          }}
          className={`flex flex-col items-center w-20 p-1.5 rounded cursor-pointer transition-colors ${
            selectedIcon === 'drive-d'
              ? 'bg-[#0a246a]/60 border border-[#b6d3f2]/40'
              : 'hover:bg-white/10'
          }`}
        >
          <div className="w-10 h-10 rounded bg-purple-600 border border-white/60 flex items-center justify-center text-white shadow-md">
            <Film className="w-6 h-6 text-white" />
          </div>
          <span
            className="text-white text-xs mt-1 text-center font-medium drop-shadow leading-tight"
            style={{
              textShadow:
                '1px 1px 1px #000, -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000',
            }}
          >
            Video Clips (D:)
          </span>
        </div>

        {/* Short Clips (E:) Shortcut */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            setSelectedIcon('drive-e');
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            handleOpenMyComputer('E:');
          }}
          className={`flex flex-col items-center w-20 p-1.5 rounded cursor-pointer transition-colors ${
            selectedIcon === 'drive-e'
              ? 'bg-[#0a246a]/60 border border-[#b6d3f2]/40'
              : 'hover:bg-white/10'
          }`}
        >
          <div className="w-10 h-10 rounded bg-emerald-600 border border-white/60 flex items-center justify-center text-white shadow-md">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <span
            className="text-white text-xs mt-1 text-center font-medium drop-shadow leading-tight"
            style={{
              textShadow:
                '1px 1px 1px #000, -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000',
            }}
          >
            Short Clips (E:)
          </span>
        </div>

        {/* Recycle Bin */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            setSelectedIcon('recycle-bin');
          }}
          className={`flex flex-col items-center w-20 p-1.5 rounded cursor-pointer transition-colors ${
            selectedIcon === 'recycle-bin'
              ? 'bg-[#0a246a]/60 border border-[#b6d3f2]/40'
              : 'hover:bg-white/10'
          }`}
        >
          <div className="w-10 h-10 rounded bg-neutral-400 border border-white/60 flex items-center justify-center text-neutral-800 shadow-md">
            <Trash2 className="w-6 h-6 text-neutral-700" />
          </div>
          <span
            className="text-white text-xs mt-1 text-center font-medium drop-shadow leading-tight"
            style={{
              textShadow:
                '1px 1px 1px #000, -1px -1px 1px #000, 1px -1px 1px #000, -1px 1px 1px #000',
            }}
          >
            Recycle Bin
          </span>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* "My Computer" Drive Explorer Window */}
      {/* ------------------------------------------------------------- */}
      <MyComputerWindow
        isOpen={isMyComputerOpen}
        isMinimized={isMyComputerMinimized}
        isMaximized={isMyComputerMaximized}
        items={items}
        initialDrive={initialDrive}
        onClose={() => setIsMyComputerOpen(false)}
        onMinimize={() => setIsMyComputerMinimized(true)}
        onToggleMaximize={() => setIsMyComputerMaximized(!isMyComputerMaximized)}
        onOpenPhoto={onOpenPhoto}
        onOpenVideo={onOpenVideo}
        onOpenShort={onOpenShort}
      />

      {/* ------------------------------------------------------------- */}
      {/* Authentic Windows XP Luna Taskbar & Start Menu */}
      {/* ------------------------------------------------------------- */}
      <XPTaskbar
        windows={windowTabs}
        onToggleWindow={handleToggleWindow}
        onOpenMyComputer={handleOpenMyComputer}
      />

      {/* ------------------------------------------------------------- */}
      {/* 30-Second Inactivity 3D Bouncing Logo Screensaver */}
      {/* ------------------------------------------------------------- */}
      <ScreensaverXP isSuppressed={isModalOpen} />
    </div>
  );
};
