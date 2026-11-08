import React, { useState } from 'react';
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
  // Track which major folders have their accordion open
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>(() => ({
    PHOTOGRAPHY: true, // open photography by default
    CLIPS: false,
    SHORTS: false,
    REALTUBE: false,
  }));

  const toggleAccordion = (folderKey: string) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [folderKey]: !prev[folderKey],
    }));
  };

  return (
    <aside
      onClick={(e) => e.stopPropagation()}
      className={`w-[260px] sm:w-[280px] h-screen fixed top-0 left-0 z-30 flex flex-col justify-between p-6 sm:p-8 border-r border-white/6 bg-[#03060a]/90 backdrop-blur-2xl select-none overflow-y-auto space-scrollbar ${className}`}
    >
      {/* Top Header / Brand Anchor */}
      <div className="flex flex-col gap-8">
        <div
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onSelectIdle();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              onSelectIdle();
            }
          }}
          className="font-['Google_Sans'] font-bold text-sm tracking-[0.22em] uppercase text-white hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.6)] cursor-pointer transition-all flex items-center gap-2 group outline-none"
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
                {/* Major Folder Toggle Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAccordion(folder.key);
                  }}
                  className={`font-['Google_Sans'] font-bold text-base tracking-[0.2em] uppercase transition-colors flex items-center justify-between w-full py-2 cursor-pointer outline-none bg-transparent border-0 text-left ${
                    isFolderActive
                      ? 'text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {isFolderActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] shadow-[0_0_10px_#38bdf8] flex-shrink-0" />
                    )}
                    <span>{folder.label}</span>
                  </div>

                  <ChevronRight
                    className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${
                      isAccordionOpen ? 'rotate-90 text-white' : 'rotate-0'
                    }`}
                  />
                </button>

                {/* Inline Subfolder Dropdown Panel */}
                <div
                  className={`transition-all duration-300 ease-out border-l border-white/10 ml-1 pl-4 flex flex-col space-y-1 ${
                    isAccordionOpen
                      ? 'max-h-64 opacity-100 py-1.5 overflow-y-auto space-scrollbar'
                      : 'max-h-0 opacity-0 overflow-hidden py-0'
                  }`}
                >
                  {subfolderNodes.length > 0 ? (
                    subfolderNodes.map((subNode) => {
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
                          className={`font-['Google_Sans'] text-xs tracking-wider uppercase transition-all py-1.5 text-left w-full flex justify-between items-center cursor-pointer outline-none bg-transparent border-0 ${
                            isSubSelected
                              ? 'text-[#38bdf8] font-bold drop-shadow-[0_0_8px_rgba(56,189,248,0.5)] translate-x-1'
                              : 'text-slate-400 hover:text-white hover:translate-x-1'
                          }`}
                        >
                          <span className="truncate pr-2">{subNode.name}</span>
                          {subNode.files.length > 0 && (
                            <span className="font-mono text-[10px] text-slate-500">
                              {subNode.files.length}
                            </span>
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <span className="font-mono text-[10px] text-slate-600 py-1">
                      NO SUBFOLDERS
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Bottom Button: [ OVERVIEW // IDLE ] */}
      <div className="pt-6 border-t border-white/8 mt-6">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectIdle();
          }}
          className={`w-full font-['Google_Sans'] text-xs tracking-[0.2em] uppercase transition-colors cursor-pointer py-2 px-3 rounded-lg text-center outline-none border bg-transparent ${
            selectedSubfolder === null
              ? 'text-white border-white/20 bg-white/5 font-bold shadow-sm'
              : 'text-slate-500 hover:text-white border-transparent hover:border-white/10'
          }`}
        >
          [ OVERVIEW // IDLE ]
        </button>
      </div>
    </aside>
  );
};

export default SidebarAccordionNav;
