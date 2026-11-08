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
  onSelectIdle: () => void;
  className?: string;
}

export const SidebarAccordionNav: React.FC<SidebarAccordionNavProps> = ({
  rootMap,
  selectedAlbum,
  selectedSubfolder,
  onSelectSubfolder,
  onSelectIdle,
  className = '',
}) => {
  // Strict Exclusive Single-Folder Open State (only 1 folder can be open at a time)
  const [openFolder, setOpenFolder] = useState<string | null>(selectedAlbum || null);

  // Auto-expand folder when selectedAlbum changes externally; keep in sync
  useEffect(() => {
    if (selectedAlbum) {
      setOpenFolder(selectedAlbum);
    } else {
      setOpenFolder(null);
    }
  }, [selectedAlbum]);

  const handleFolderClick = (folderKey: string) => {
    if (openFolder === folderKey) {
      setOpenFolder(null);
      onSelectIdle();
    } else {
      // Immediately collapse any other folder and open only this one
      setOpenFolder(folderKey);
      const rootNode = rootMap.get(MAJOR_FOLDERS.find((f) => f.key === folderKey)?.rawName || '');
      const subfolderNodes = rootNode ? Array.from(rootNode.subfolders.values()) : [];
      if (subfolderNodes.length > 0) {
        onSelectSubfolder(folderKey, subfolderNodes[0].name);
      } else {
        onSelectSubfolder(folderKey, '');
      }
    }
  };

  return (
    <nav
      aria-label="Major Folders Navigation"
      className={`flex flex-col justify-center gap-6 md:gap-7 select-none mb-24 pb-4 ${className}`}
    >
      {MAJOR_FOLDERS.map((folder) => {
        // Enforce strict exclusive check: only openFolder === folderKey is expanded
        const isAccordionOpen = openFolder === folder.key;
        const isFolderActive = selectedAlbum === folder.key;
        const rootNode = rootMap.get(folder.rawName);
        const subfolderNodes = rootNode ? Array.from(rootNode.subfolders.values()) : [];

        return (
          <div key={folder.key} className="flex flex-col">
            {/* Major Folder Link */}
            <button
              type="button"
              onClick={() => handleFolderClick(folder.key)}
              className={`font-['Google_Sans'] font-bold text-xl tracking-[0.24em] uppercase transition-all duration-300 cursor-pointer text-left outline-none bg-transparent border-0 flex items-center gap-2.5 ${
                isFolderActive
                  ? 'text-white'
                  : 'text-slate-500 hover:text-white'
              }`}
            >
              {isFolderActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] shadow-[0_0_10px_#38bdf8] flex-shrink-0 animate-pulse" />
              )}
              <span>{folder.label}</span>
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
                  <div className="flex flex-col space-y-2 border-l border-white/10 ml-1 pl-3.5 pt-2.5 pb-1">
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
                          className={`font-['Google_Sans'] text-xs sm:text-[13px] tracking-wider uppercase transform transition-all duration-300 ease-out py-1 text-left w-full cursor-pointer outline-none bg-transparent border-0 ${
                            isAccordionOpen
                              ? 'translate-x-0 opacity-100'
                              : '-translate-x-2.5 opacity-0'
                          } ${
                            isSubSelected
                              ? 'text-[#38bdf8] font-bold drop-shadow-[0_0_8px_rgba(56,189,248,0.6)] translate-x-1.5'
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
