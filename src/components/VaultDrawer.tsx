import React, { useEffect, useState, useMemo } from 'react';
import { hapticMedium } from '../utils/hapticsManager';
import type { DirectoryNode } from './DeepSpaceTreeExplorer';
import fallbackJson from '../data/mediaFallback.json';
import { getRolling7DayUsage, trackActivityEvent } from '../utils/usageTelemetry';

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
  const [telemetry, setTelemetry] = useState(() => getRolling7DayUsage());

  useEffect(() => {
    if (!isOpen) return;
    setTelemetry(getRolling7DayUsage());
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
    trackActivityEvent(1);
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

        {/* Live Client-Side Usage Telemetry (7-Day Rolling) */}
        <div className="drawer-footer-cluster mt-auto pt-4 border-t border-white/[0.08] flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span className="font-sans font-medium text-neutral-300">Activity Telemetry</span>
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-mono">
              {telemetry.todayTotal} {telemetry.todayTotal === 1 ? 'EVENT TODAY' : 'EVENTS TODAY'}
            </span>
          </div>

          {/* Real Proportional Bar Chart with Calendar Date Labels */}
          <div className="flex items-end gap-1.5 h-10">
            {telemetry.days.map((day, idx) => {
              const isToday = idx === telemetry.days.length - 1;
              const heightPercent = telemetry.maxVal > 0
                ? Math.max(Math.round((day.count / telemetry.maxVal) * 100), day.count > 0 ? 16 : 8)
                : 8;

              const dateNumber = day.label === 'TODAY'
                ? 'TODAY'
                : day.label === 'YEST'
                ? 'YEST'
                : day.label.split(' ')[1] || day.label;

              return (
                <div key={day.date} className="flex-1 flex flex-col items-center h-full justify-end gap-1">
                  <div
                    className={`bar-col w-full ${isToday ? 'active-bar' : ''}`}
                    style={{ height: `${heightPercent}%` }}
                    title={`${day.label}: ${day.count} recorded events`}
                  />
                  <span
                    className={`text-[8px] font-mono leading-none tracking-tighter ${
                      isToday ? 'text-white font-bold' : 'text-neutral-500'
                    }`}
                  >
                    {dateNumber}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[10px] text-neutral-500 tracking-wider font-sans pt-1 border-t border-white/[0.04]">
            <span className="text-neutral-400 font-medium">RECORDED ACTIVITY</span>
            <span>ROLLING 7D</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default VaultDrawer;
