import React, { useEffect, useState, useMemo } from 'react';
import { hapticMedium } from '../utils/hapticsManager';
import type { DirectoryNode } from './DeepSpaceTreeExplorer';
import fallbackJson from '../data/mediaFallback.json';

export interface VaultDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: (
    folderId: 'clips' | 'shorts' | 'photography' | 'realtube',
    subfolderName?: string
  ) => void;
  rootMap?: Map<string, DirectoryNode>;
}

interface DrawerSubfolder {
  id: string;
  name: string;
  itemCount?: number;
}

interface CategoryConfig {
  id: 'clips' | 'shorts' | 'photography' | 'realtube';
  name: string;
  rawName: string;
}

const CATEGORIES: CategoryConfig[] = [
  { id: 'clips', name: 'CLIPS', rawName: 'Clips' },
  { id: 'shorts', name: 'SHORTS', rawName: 'Shorts' },
  { id: 'photography', name: 'PHOTOGRAPHY', rawName: 'Images' },
  { id: 'realtube', name: 'REALTUBE', rawName: 'REALTube' },
];

function extractFallbackSubfolders(rawName: string): DrawerSubfolder[] {
  const catalog = fallbackJson as any;

  if (rawName === 'Clips') {
    const list = new Map<string, number>();
    (catalog.clips || []).forEach((c: any) => {
      const parts = (c.path || '').split('/');
      if (parts.length > 2) {
        const name = parts[1].trim();
        list.set(name, (list.get(name) || 0) + 1);
      }
    });
    return Array.from(list.entries()).map(([name, count]) => ({
      id: name,
      name,
      itemCount: count,
    }));
  }

  if (rawName === 'Images') {
    const list = new Map<string, number>();
    (catalog.images || []).forEach((c: any) => {
      const parts = (c.path || '').split('/');
      if (parts.length > 2) {
        const name = parts[1].trim();
        list.set(name, (list.get(name) || 0) + 1);
      }
    });
    return Array.from(list.entries()).map(([name, count]) => ({
      id: name,
      name,
      itemCount: count,
    }));
  }

  if (rawName === 'Shorts') {
    const list = new Map<string, number>();
    (catalog.shorts || []).forEach((c: any) => {
      const parts = (c.path || '').split('/');
      if (parts.length > 2) {
        const name = parts[1].trim();
        list.set(name, (list.get(name) || 0) + 1);
      }
    });
    if (list.size === 0) list.set('Shorts Classic', (catalog.shorts || []).length);
    return Array.from(list.entries()).map(([name, count]) => ({
      id: name,
      name,
      itemCount: count,
    }));
  }

  if (rawName === 'REALTube') {
    return [
      { id: 'REALTube Shorts', name: 'REALTube Shorts', itemCount: 12 },
      { id: 'Archive Feeds', name: 'Archive Feeds', itemCount: 6 },
    ];
  }

  return [];
}

export const VaultDrawer: React.FC<VaultDrawerProps> = ({
  isOpen,
  onClose,
  onSelectFolder,
  rootMap,
}) => {
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Dynamically resolve actual subfolders from live rootMap or the media manifest
  const categoriesWithSubfolders = useMemo(() => {
    return CATEGORIES.map((cat) => {
      const rootNode = rootMap?.get(cat.rawName);
      let subfolders: DrawerSubfolder[] = [];

      if (rootNode && rootNode.subfolders.size > 0) {
        subfolders = Array.from(rootNode.subfolders.values()).map((sub) => ({
          id: sub.name,
          name: sub.name.trim(),
          itemCount: sub.files.length,
        }));
      } else {
        subfolders = extractFallbackSubfolders(cat.rawName);
      }

      return {
        ...cat,
        subfolders,
      };
    });
  }, [rootMap]);

  const navigateToSubfolder = (
    folderId: 'clips' | 'shorts' | 'photography' | 'realtube',
    subfolderName: string
  ) => {
    hapticMedium();
    onClose();
    onSelectFolder(folderId, subfolderName);
  };

  return (
    <>
      {/* Blurred Backdrop Overlay Mask */}
      <div
        className={`vault-overlay-mask ${isOpen ? 'active' : ''}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      {/* Sliding Minimalist Side Panel */}
      <aside
        className={`vault-drawer-left ${isOpen ? 'open' : ''}`}
        aria-label="Media Archive Navigation"
      >
        {/* Minimalist Publication Header */}
        <div className="drawer-header flex items-center justify-between pb-4 mb-4 border-b border-white/[0.08]">
          <span className="font-serif text-sm font-bold tracking-wider text-[#f4f4f5] uppercase">
            MEDIA ARCHIVE
          </span>
          <span className="text-[10px] uppercase tracking-widest text-neutral-500 font-sans">
            COLLECTIONS
          </span>
        </div>

        {/* Dynamic Accordion Directory Tree */}
        <div className="folder-accordion-menu space-scrollbar">
          {categoriesWithSubfolders.map((folder) => {
            const isExpanded = expandedFolder === folder.id;
            return (
              <div
                key={folder.id}
                className={`accordion-group ${isExpanded ? 'active' : ''}`}
              >
                <button
                  type="button"
                  className={`folder-btn ${isExpanded ? 'expanded' : ''}`}
                  onClick={() => {
                    hapticMedium();
                    setExpandedFolder(isExpanded ? null : folder.id);
                  }}
                >
                  <span className="folder-label">
                    <span className={`folder-caret ${isExpanded ? 'open' : ''}`}>▸</span>
                    <span>{folder.name}</span>
                  </span>
                  <span className="folder-badge">
                    {folder.subfolders.length} {folder.subfolders.length === 1 ? 'ALBUM' : 'ALBUMS'}
                  </span>
                </button>

                {isExpanded && (
                  <div className="subfolder-tray">
                    {folder.subfolders.length === 0 ? (
                      <div className="text-xs text-neutral-500 py-2 px-3 italic">
                        No albums listed
                      </div>
                    ) : (
                      folder.subfolders.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          className="subfolder-btn"
                          onClick={() => navigateToSubfolder(folder.id, sub.name)}
                        >
                          <span className="sub-title">{sub.name}</span>
                          {typeof sub.itemCount === 'number' && (
                            <span className="sub-tag">{sub.itemCount}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Minimalist Activity Overview (No Sci-Fi / Cyberpunk Gimmicks) */}
        <div className="drawer-footer-cluster mt-auto pt-4 border-t border-white/[0.08] flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-sans font-medium text-neutral-300">Activity Overview</span>
            <span className="text-[10px] text-neutral-500 uppercase tracking-wider">7 Days</span>
          </div>

          {/* Minimalist Bar Chart */}
          <div className="minimal-bars flex items-end gap-1.5 h-8">
            <div className="bar-col" style={{ height: '70%' }} title="Today" />
            <div className="bar-col" style={{ height: '45%' }} title="Yesterday" />
            <div className="bar-col" style={{ height: '30%' }} title="Nov 07" />
            <div className="bar-col active-bar" style={{ height: '85%' }} title="Nov 06" />
            <div className="bar-col" style={{ height: '55%' }} title="Nov 05" />
            <div className="bar-col" style={{ height: '65%' }} title="Nov 04" />
            <div className="bar-col" style={{ height: '80%' }} title="Nov 03" />
          </div>

          <div className="flex items-center justify-between text-[10px] text-neutral-500 tracking-wider font-sans">
            <span className="text-neutral-400 font-medium">RECENT SYNC</span>
            <span>VERIFIED ARCHIVE</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default VaultDrawer;
