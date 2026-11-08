import React, { useState, useEffect } from 'react';
import type { DirectoryNode } from '../DeepSpaceTreeExplorer';

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
  className?: string;
}

export const SidebarAccordionNav: React.FC<SidebarAccordionNavProps> = ({
  rootMap,
  selectedAlbum,
  selectedSubfolder,
  onSelectSubfolder,
  onSelectIdle: _onSelectIdle,
  className = '',
}) => {
  // Strict Exclusive Single-Folder Open State
  const [openFolder, setOpenFolder] = useState<string | null>(selectedAlbum || null);

  // Auto-expand folder when selectedAlbum changes externally; keep in sync
  useEffect(() => {
    if (selectedAlbum) {
      setOpenFolder(selectedAlbum);
    }
  }, [selectedAlbum]);

  const handleFolderClick = (folderKey: string) => {
    // Only toggle the accordion expansion state in place
    setOpenFolder((prev) => (prev === folderKey ? null : folderKey));
  };

  return (
    <nav
      aria-label="Major Folders Navigation"
      className={`flex flex-col justify-center gap-4 xs:gap-5 sm:gap-6 md:gap-7 select-none my-auto w-full ${className}`}
    >
      {MAJOR_FOLDERS.map((folder) => {
        const isAccordionOpen = openFolder === folder.key;
        const isFolderActive = selectedAlbum === folder.key && selectedSubfolder !== null;
        const rootNode = rootMap.get(folder.rawName);
        const subfolderNodes = rootNode ? Array.from(rootNode.subfolders.values()) : [];

        return (
          <div key={folder.key} className="flex flex-col w-full">
            {/* Major Folder Link */}
            <button
              type="button"
              onClick={() => handleFolderClick(folder.key)}
              className={`font-['Google_Sans'] font-bold text-xs xs:text-sm sm:text-base md:text-xl tracking-[0.16em] sm:tracking-[0.24em] uppercase transition-all duration-300 cursor-pointer text-left outline-none bg-transparent border-0 flex items-center gap-1.5 sm:gap-2.5 truncate w-full ${
                isAccordionOpen || isFolderActive
                  ? 'text-white'
                  : 'text-slate-500 hover:text-white'
              }`}
            >
              {isFolderActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] shadow-[0_0_10px_#38bdf8] flex-shrink-0 animate-pulse" />
              )}
              <span className="truncate">{folder.label}</span>
            </button>

            {/* Subfolder list with smooth accordion expansion and staggered cascade */}
            <div
              className={`grid transition-[grid-template-rows,opacity] duration-350 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                isAccordionOpen
                  ? 'grid-rows-[1fr] opacity-100'
                  : 'grid-rows-[0fr] opacity-0 pointer-events-none'
              }`}
            >
              <div className="overflow-hidden">
                {subfolderNodes.length > 0 && (
                  <div className="flex flex-col space-y-1 sm:space-y-2 border-l border-white/10 ml-0.5 sm:ml-1 pl-2 sm:pl-3.5 pt-1.5 pb-1">
                    {subfolderNodes.map((subNode, idx) => {
                      const isSubSelected =
                        selectedAlbum === folder.key && selectedSubfolder === subNode.name;

                      return (
                        <button
                          key={subNode.name}
                          type="button"
                          onClick={() => onSelectSubfolder(folder.key, subNode.name)}
                          style={{
                            transitionDelay: isAccordionOpen ? `${idx * 40}ms` : '0ms',
                          }}
                          className={`font-['Google_Sans'] text-[10px] xs:text-[11px] sm:text-xs md:text-[13px] tracking-wider uppercase transform transition-all duration-300 ease-out py-0.5 sm:py-1 text-left w-full cursor-pointer outline-none bg-transparent border-0 truncate ${
                            isAccordionOpen
                              ? 'translate-x-0 opacity-100'
                              : '-translate-x-2 opacity-0'
                          } ${
                            isSubSelected
                              ? 'text-[#38bdf8] font-bold drop-shadow-[0_0_8px_rgba(56,189,248,0.6)] translate-x-1 sm:translate-x-1.5'
                              : 'text-slate-400 hover:text-white hover:translate-x-1'
                          }`}
                        >
                          {subNode.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
};

export default SidebarAccordionNav;
