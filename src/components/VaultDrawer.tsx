import React, { useEffect, useState, useMemo } from 'react';
import { hapticMedium } from '../utils/hapticsManager';
import type { DirectoryNode } from './DeepSpaceTreeExplorer';
import fallbackJson from '../data/mediaFallback.json';
import { getRolling7DayUsage } from '../utils/usageTelemetry';
import {
  getKeepScreenOnState,
  toggleKeepScreenOn,
  subscribeKeepScreenOn,
} from '../utils/keepAwakeManager';
import type { StageMediaItem } from '../types';

export interface VaultDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: (
    folderId: 'clips' | 'shorts' | 'photography' | 'realtube' | 'youtube',
    subfolderName?: string
  ) => void;
  onSelectHome?: () => void;
  rootMap?: Map<string, DirectoryNode>;
  onOpenPhoto?: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo?: (item: StageMediaItem) => void;
}

interface DrawerSubfolder {
  id: string;
  name: string;
  itemCount?: number;
  tag?: string;
}

interface CategoryConfig {
  id: 'clips' | 'shorts' | 'photography' | 'realtube';
  name: string;
  rawName: string;
  tag?: string;
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
  onSelectHome,
  rootMap,
}) => {
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState(() => getRolling7DayUsage());
  const [keepScreenOn, setKeepScreenOn] = useState<boolean>(() => getKeepScreenOnState());

  useEffect(() => {
    return subscribeKeepScreenOn((active) => {
      setKeepScreenOn(active);
    });
  }, []);

  const handleToggleKeepScreenOn = async () => {
    hapticMedium();
    const nextVal = await toggleKeepScreenOn();
    setKeepScreenOn(nextVal);
  };

  // When drawer opens: refresh telemetry
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

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Pure Monochrome Apple-Style Drawer Panel */}
      <aside
        role="dialog"
        aria-label="Media Vault Navigation"
        className={`fixed top-0 left-0 bottom-0 z-50 w-80 max-w-[85vw] bg-neutral-950 border-r border-white/10 flex flex-col p-5 shadow-2xl transition-transform duration-300 ease-out select-none ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Masthead */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex flex-col">
            <span className="text-base font-black tracking-wider text-white">SARWAR<span className="text-[#ccff00]">.CYOU</span></span>
            <span className="text-[10px] text-[#ccff00]/80 uppercase tracking-widest font-mono">
              BIENNALE ARCHIVE // 2026
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Close drawer"
            aria-label="Close drawer"
          >
            <span className="text-sm font-mono">✕</span>
          </button>
        </div>

        {/* Directory Listing */}
        <div className="flex-1 overflow-y-auto py-3 space-y-1">
          {/* CELEBRITY ARCHIVE (MAIN PORTAL ENTRY) */}
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              if (onSelectHome) {
                onSelectHome();
              }
              onClose();
            }}
            className="w-full flex items-center justify-between py-3.5 px-3 rounded-lg text-left hover:bg-white/5 transition-colors cursor-pointer group"
          >
            <span className="text-xs font-sans uppercase tracking-[0.2em] font-medium text-white/90 group-hover:text-white transition-colors">
              CELEBRITY ARCHIVE
            </span>
            <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono group-hover:text-white/70 transition-colors">
              MAIN PORTAL
            </span>
          </button>

          <div className="border-t border-white/[0.06] my-2" />

          {/* 4 Core Media Categories */}
          {categoriesWithSubfolders.map((cat) => {
            const isExpanded = expandedFolder === cat.id;

            return (
              <div key={cat.id} className="flex flex-col">
                <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-white/5 transition-colors group">
                  <button
                    type="button"
                    onClick={() => {
                      hapticMedium();
                      onSelectFolder(cat.id);
                      onClose();
                    }}
                    className="flex-1 text-left flex items-center justify-between pr-2 cursor-pointer"
                  >
                    <span className="text-xs font-sans tracking-widest uppercase font-medium text-neutral-300 group-hover:text-white transition-colors">
                      {cat.name}
                    </span>
                    {cat.tag && (
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/10 text-neutral-400">
                        {cat.tag}
                      </span>
                    )}
                  </button>

                  {cat.subfolders.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        hapticMedium();
                        setExpandedFolder(isExpanded ? null : cat.id);
                      }}
                      className="p-1 rounded hover:bg-white/10 text-neutral-400 hover:text-white transition-colors cursor-pointer"
                      title={isExpanded ? 'Collapse subfolders' : 'Expand subfolders'}
                    >
                      <span className="text-xs font-mono">{isExpanded ? '−' : '+'}</span>
                    </button>
                  )}
                </div>

                {/* Subfolder list */}
                {isExpanded && (
                  <div className="ml-4 pl-3 border-l border-white/10 py-1 space-y-1">
                    {cat.subfolders.length === 0 ? (
                      <span className="text-[11px] font-mono text-neutral-400 px-2 py-1 block">
                        No subfolders
                      </span>
                    ) : (
                      cat.subfolders.map((sub) => (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => {
                            hapticMedium();
                            onSelectFolder(cat.id, sub.name);
                            onClose();
                          }}
                          className="w-full text-left py-1.5 px-2.5 rounded hover:bg-white/5 text-[11px] font-sans text-neutral-400 hover:text-white flex items-center justify-between transition-colors cursor-pointer group"
                        >
                          <span className="truncate pr-2">{sub.name}</span>
                          {sub.itemCount !== undefined && (
                            <span className="text-[10px] font-mono text-neutral-400 group-hover:text-neutral-300 shrink-0">
                              {sub.itemCount}
                            </span>
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

        {/* Drawer Footer Cluster: Keep Screen On & Telemetry */}
        <div className="drawer-footer-cluster mt-auto pt-3 border-t border-white/[0.08] flex flex-col gap-2.5">
          {/* Keep Screen On Toggle Bar (Web WakeLock) */}
          <div className="flex items-center justify-between py-0.5 px-0.5">
            <div className="flex flex-col">
              <span className="text-xs font-sans font-medium text-neutral-200 tracking-wide">
                Keep Screen On
              </span>
              <span className="text-[10px] text-neutral-400 font-mono tracking-wider">
                {keepScreenOn ? 'ALWAYS AWAKE' : 'SYSTEM SLEEP'}
              </span>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={keepScreenOn}
              onClick={handleToggleKeepScreenOn}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full p-0.5 border border-white/10 transition-colors duration-200 ease-in-out focus:outline-none ${
                keepScreenOn ? 'bg-[#ccff00] shadow-[0_0_10px_rgba(204,255,0,0.4)]' : 'bg-neutral-800/90'
              }`}
              title={keepScreenOn ? 'Keep screen on: Enabled' : 'Keep screen on: Disabled'}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full shadow-md transition duration-200 ease-in-out ${
                  keepScreenOn
                    ? 'translate-x-4 bg-black'
                    : 'translate-x-0 bg-neutral-400'
                }`}
              />
            </button>
          </div>

          <div className="border-t border-white/[0.06]" />

          {/* Activity Telemetry Widget */}
          <div className="flex flex-col gap-2 pt-1">
            <span className="text-xs font-mono text-neutral-300 font-medium">
              {telemetry.todayFormatted}
            </span>

            {/* 7 Activity Bars */}
            <div className="flex items-end gap-1.5 h-9">
              {telemetry.days.map((day, idx) => {
                const isToday = idx === telemetry.days.length - 1;
                const heightPercent =
                  telemetry.maxMinutes > 0 && day.minutes > 0
                    ? Math.max(Math.round((day.minutes / telemetry.maxMinutes) * 100), 14)
                    : 0;

                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center h-full justify-end gap-1">
                    <div
                      className={`bar-col w-full ${isToday ? 'active-bar' : ''}`}
                      style={{
                        height: day.minutes > 0 ? `${heightPercent}%` : '2px',
                        opacity: day.minutes > 0 ? 1 : 0.25,
                      }}
                      title={`${day.label}: ${day.formattedMinutes}`}
                    />
                    <span
                      className={`text-[8px] font-mono leading-none tracking-tighter ${
                        isToday ? 'text-white font-bold' : 'text-neutral-500'
                      }`}
                    >
                      {day.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default VaultDrawer;
