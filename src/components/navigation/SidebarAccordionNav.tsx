import React, { useState, useEffect, useRef } from 'react';
import type { DirectoryNode } from '../DeepSpaceTreeExplorer';
import { hapticSelection } from '../../utils/hapticsManager';

export interface MajorFolderDef {
  key: string;
  rawName: string;
  label: string;
}

export const MAJOR_FOLDERS: MajorFolderDef[] = [
  { key: 'CLIPS', rawName: 'Clips', label: 'CLIPS' },
  { key: 'SHORTS', rawName: 'Shorts', label: 'SHORTS' },
  { key: 'PHOTOGRAPHY', rawName: 'Images', label: 'PHOTOGRAPHY' },
  { key: 'REALTUBE', rawName: 'REALTube', label: 'REALTUBE' },
];

export interface SidebarAccordionNavProps {
  rootMap: Map<string, DirectoryNode>;
  selectedAlbum: string | null;
  selectedSubfolder: string | null;
  onSelectSubfolder: (albumKey: string, subfolderName: string) => void;
  onSelectIdle?: () => void;
  openFolder?: string | null;
  onToggleFolder?: (folderKey: string) => void;
  variant?: 'desktop' | 'mobile';
  className?: string;
  style?: React.CSSProperties;
}

export const SidebarAccordionNav: React.FC<SidebarAccordionNavProps> = ({
  rootMap,
  selectedAlbum,
  selectedSubfolder,
  onSelectSubfolder,
  onSelectIdle: _onSelectIdle,
  openFolder,
  onToggleFolder,
  variant = 'mobile',
  className = '',
  style,
}) => {
  // Strict Exclusive Single-Folder Open State (controlled or internal)
  const [internalOpenFolder, setInternalOpenFolder] = useState<string | null>(selectedAlbum || null);
  const currentOpenFolder = openFolder !== undefined ? openFolder : internalOpenFolder;

  // Auto-expand folder only when selectedAlbum externally transitions
  const prevAlbumRef = useRef(selectedAlbum);
  useEffect(() => {
    if (selectedAlbum && selectedAlbum !== prevAlbumRef.current) {
      prevAlbumRef.current = selectedAlbum;
      if (onToggleFolder) {
        onToggleFolder(selectedAlbum);
      } else {
        setInternalOpenFolder(selectedAlbum);
      }
    }
  }, [selectedAlbum, onToggleFolder]);

  const handleFolderClick = (folderKey: string) => {
    hapticSelection();
    // Only toggle the accordion expansion state in place (never auto-loads or auto-redirects)
    if (onToggleFolder) {
      onToggleFolder(folderKey);
    } else {
      setInternalOpenFolder((prev) => (prev === folderKey ? null : folderKey));
    }
  };

  const isDesktop = variant === 'desktop';

  return (
    <nav
      aria-label="Major Folders Navigation"
      className={
        isDesktop
          ? `absolute left-0 pl-10 lg:pl-12 z-30 flex flex-col gap-[26px] select-none pointer-events-auto ${className}`
          : `absolute left-0 pl-8 z-30 flex flex-col gap-6 select-none pointer-events-auto ${className}`
      }
      style={{
        top: isDesktop ? 'calc(50vh - 111px)' : 'calc(50dvh - 100px)',
        ...style,
      }}
    >
      {MAJOR_FOLDERS.map((folder) => {
        const isAccordionOpen = currentOpenFolder === folder.key;
        const isFolderActive = selectedAlbum === folder.key && selectedSubfolder !== null;
        const rootNode = rootMap.get(folder.rawName);
        const subfolderNodes = rootNode ? Array.from(rootNode.subfolders.values()) : [];

        return (
          <div key={folder.key} className="flex flex-col w-full relative z-30">
            {/* Major Folder Link */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleFolderClick(folder.key);
              }}
              className={`pointer-events-auto relative z-40 select-none ${
                isDesktop
                  ? `font-['Google_Sans'] text-lg lg:text-xl font-bold tracking-[0.24em] uppercase transition-colors cursor-pointer flex items-center gap-3 text-left outline-none bg-transparent border-0 truncate ${
                      isAccordionOpen || isFolderActive
                        ? 'text-white'
                        : 'text-[#3b4252] hover:text-white'
                    }`
                  : `font-['Google_Sans'] text-2xl font-bold tracking-[0.22em] uppercase transition-colors cursor-pointer flex items-center gap-3.5 text-left outline-none bg-transparent border-0 truncate ${
                      isAccordionOpen || isFolderActive
                        ? 'text-white'
                        : 'text-slate-400 hover:text-white'
                    }`
              }`}
            >
              {isFolderActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0" />
              )}
              <span className="truncate">{folder.label}</span>
            </button>

            {/* Subfolder list with smooth max-height accordion expansion */}
            <div
              className={`transition-all duration-300 ease-out overflow-hidden ${
                isAccordionOpen
                  ? 'max-h-60 opacity-100 mt-1.5'
                  : 'max-h-0 opacity-0 pointer-events-none'
              }`}
            >
              {subfolderNodes.length > 0 && (
                <div
                  className={
                    isDesktop
                      ? 'flex flex-col space-y-2 border-l border-white/10 ml-1 pl-3.5 pt-1 pb-1'
                      : 'flex flex-col space-y-1.5 border-l border-white/10 ml-1 pl-2 pt-1 pb-1'
                  }
                >
                  {subfolderNodes.map((subNode, idx) => {
                    const isSubSelected =
                      selectedAlbum === folder.key && selectedSubfolder === subNode.name;

                    return (
                      <button
                        key={subNode.name}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          hapticSelection();
                          onSelectSubfolder(folder.key, subNode.name);
                        }}
                        style={{
                          transitionDelay: isAccordionOpen ? `${idx * 40}ms` : '0ms',
                        }}
                        className={
                          isDesktop
                            ? `pointer-events-auto relative z-40 select-none font-['Google_Sans'] text-xs tracking-wider uppercase transform transition-all duration-200 ease-out py-1 text-left w-full cursor-pointer outline-none bg-transparent border-0 truncate ${
                                isAccordionOpen
                                  ? 'translate-x-0 opacity-100'
                                  : '-translate-x-2.5 opacity-0 pointer-events-none'
                              } ${
                                isSubSelected
                                  ? 'text-white font-bold translate-x-1'
                                  : 'text-zinc-400 hover:text-white hover:translate-x-1'
                              }`
                            : `pointer-events-auto relative z-40 select-none font-['Google_Sans'] text-sm font-semibold tracking-[0.16em] uppercase py-1 pl-4 text-left transition-colors cursor-pointer outline-none bg-transparent border-0 truncate ${
                                isAccordionOpen
                                  ? 'opacity-100'
                                  : 'opacity-0 pointer-events-none'
                              } ${
                                isSubSelected
                                  ? 'text-white font-bold'
                                  : 'text-zinc-400 hover:text-white'
                              }`
                        }
                      >
                        {subNode.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </nav>
  );
};

export default SidebarAccordionNav;
