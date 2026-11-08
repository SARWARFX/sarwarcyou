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
  // Track open/collapsed state of each major folder
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>(() => ({
    CLIPS: false,
    SHORTS: false,
    PHOTOGRAPHY: false,
    REALTUBE: false,
  }));

  // Auto-expand folder if selectedAlbum is selected externally; keep collapsed when idle
  useEffect(() => {
    if (selectedAlbum) {
      setOpenAccordions((prev) => ({
        ...prev,
        [selectedAlbum]: true,
      }));
    } else {
      setOpenAccordions({
        CLIPS: false,
        SHORTS: false,
        PHOTOGRAPHY: false,
        REALTUBE: false,
      });
    }
  }, [selectedAlbum]);

  const toggleAccordion = (folderKey: string) => {
    const isCurrentlyOpen = Boolean(openAccordions[folderKey]);
    if (isCurrentlyOpen) {
      setOpenAccordions((prev) => ({
        ...prev,
        [folderKey]: false,
      }));
      onSelectIdle();
    } else {
      setOpenAccordions((prev) => ({
        ...prev,
        [folderKey]: true,
      }));
      // Auto-select first subfolder when folder is opened
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
    <aside
      onClick={(e) => e.stopPropagation()}
      aria-label="Major Folders Navigation"
      className={`w-[240px] md:w-[260px] h-screen flex flex-col justify-center pl-8 md:pl-12 gap-7 bg-transparent border-none shrink-0 select-none z-20 overflow-y-auto no-scrollbar ${className}`}
    >
      {MAJOR_FOLDERS.map((folder) => {
        const isAccordionOpen = Boolean(openAccordions[folder.key]);
        const isFolderActive = selectedAlbum === folder.key;
        const rootNode = rootMap.get(folder.rawName);
        const subfolderNodes = rootNode ? Array.from(rootNode.subfolders.values()) : [];

        return (
          <div key={folder.key} className="flex flex-col">
            {/* Major Folder Link */}
            <button
              type="button"
              onClick={() => toggleAccordion(folder.key)}
              className={`font-['Google_Sans'] font-bold text-lg md:text-xl tracking-[0.22em] uppercase transition-all duration-300 cursor-pointer text-left outline-none bg-transparent border-0 flex items-center gap-2.5 ${
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
                  <div className="flex flex-col space-y-1.5 border-l border-white/10 ml-1 pl-3.5 pt-2.5 pb-1">
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
    </aside>
  );
};

export default SidebarAccordionNav;
