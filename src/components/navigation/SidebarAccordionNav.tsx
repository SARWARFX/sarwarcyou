import React, { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
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
  // Track open/collapsed state of each major folder - all 4 collapsed by default on initial page load
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
      // When a visitor clicks an open major folder to collapse it:
      // Reset activeFolder and activeSubfolder to null, returning seamlessly to the Home Overview stage.
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
    }
  };

  const handleBrandClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setOpenAccordions({
      CLIPS: false,
      SHORTS: false,
      PHOTOGRAPHY: false,
      REALTUBE: false,
    });
    onSelectIdle();
  };

  return (
    <aside
      onClick={(e) => e.stopPropagation()}
      aria-label="Portal Categories"
      className={`select-none flex flex-col justify-start bg-transparent border-0 ${className}`}
    >
      {/* Brand Anchor: Clicking resets to Home Overview */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleBrandClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleBrandClick(e);
          }
        }}
        className="font-['Google_Sans'] font-bold text-sm sm:text-base tracking-[0.22em] uppercase text-white hover:text-[#38bdf8] cursor-pointer transition-colors flex items-center gap-2 group outline-none select-none mb-6"
      >
        <span>SARWAR.CYOU</span>
      </div>

      {/* Major Folders with Inline Accordion Dropdowns */}
      <nav aria-label="Portal Categories" className="flex flex-col space-y-3">
        {MAJOR_FOLDERS.map((folder) => {
          const isAccordionOpen = Boolean(openAccordions[folder.key]);
          const isFolderActive = selectedAlbum === folder.key && selectedSubfolder !== null;

          // Resolve subfolders under this major folder from rootMap
          const rootNode = rootMap.get(folder.rawName);
          const subfolderNodes = rootNode
            ? Array.from(rootNode.subfolders.values())
            : [];

          return (
            <div key={folder.key} className="flex flex-col w-full">
              {/* Major Folder Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAccordion(folder.key);
                }}
                className={`font-['Google_Sans'] font-bold text-base sm:text-lg tracking-[0.2em] uppercase transition-colors flex items-center justify-between w-full py-2 cursor-pointer outline-none bg-transparent border-0 text-left ${
                  isFolderActive
                    ? 'text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {isFolderActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] shadow-[0_0_10px_#38bdf8] flex-shrink-0" />
                  )}
                  <span>{folder.label}</span>
                </div>

                <ChevronRight
                  className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${
                    isAccordionOpen ? 'rotate-90 text-white' : 'rotate-0'
                  }`}
                />
              </button>

              {/* Inline Subfolder Dropdown Panel */}
              <div
                className={`transition-all duration-300 ease-out flex flex-col space-y-1 pl-4 ${
                  isAccordionOpen
                    ? 'max-h-64 opacity-100 py-1.5 overflow-y-auto no-scrollbar'
                    : 'max-h-0 opacity-0 overflow-hidden py-0'
                }`}
              >
                {subfolderNodes.map((subNode) => {
                  const isSubSelected =
                    selectedAlbum === folder.key && selectedSubfolder === subNode.name;

                  return (
                    <button
                      key={subNode.name}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSubfolder(folder.key, subNode.name);
                      }}
                      className={`font-['Google_Sans'] text-xs sm:text-sm tracking-wider uppercase transition-all py-1.5 text-left w-full cursor-pointer outline-none bg-transparent border-0 ${
                        isSubSelected
                          ? 'text-[#38bdf8] font-bold drop-shadow-[0_0_8px_rgba(56,189,248,0.6)] translate-x-1'
                          : 'text-slate-400 hover:text-white hover:translate-x-1'
                      }`}
                    >
                      {subNode.name}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
};

export default SidebarAccordionNav;
