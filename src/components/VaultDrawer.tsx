import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { HardDrive, Loader2, CheckCircle2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { hapticMedium } from '../utils/hapticsManager';
import type { DirectoryNode } from './DeepSpaceTreeExplorer';
import fallbackJson from '../data/mediaFallback.json';
import { getRolling7DayUsage, trackActivityEvent } from '../utils/usageTelemetry';
import {
  getKeepScreenOnState,
  toggleKeepScreenOn,
  subscribeKeepScreenOn,
} from '../utils/keepAwakeManager';
import { useOfflineFilesSummary } from '../services/offlineFilesManager';
import { OfflineFilesModal } from './OfflineFilesModal';
import {
  checkAppUpdate,
  AppInstaller,
  formatBytes,
  type UpdateCheckResult,
} from '../utils/updater';
import type { StageMediaItem } from '../types';

export interface VaultDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: (
    folderId: 'clips' | 'shorts' | 'photography' | 'realtube',
    subfolderName?: string
  ) => void;
  rootMap?: Map<string, DirectoryNode>;
  onOpenPhoto?: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo?: (item: StageMediaItem) => void;
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
  onOpenPhoto,
  onOpenVideo,
}) => {
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState(() => getRolling7DayUsage());
  const [keepScreenOn, setKeepScreenOn] = useState<boolean>(() => getKeepScreenOnState());
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);

  // Live offline storage files summary
  const { summary: offlineSummary, refresh: refreshOfflineSummary } = useOfflineFilesSummary();

  // In-app updater state
  const [updateState, setUpdateState] = useState<{
    status: 'idle' | 'checking' | 'available' | 'latest' | 'error' | 'downloading';
    result: UpdateCheckResult | null;
    errorText?: string;
    progressPercent: number;
    bytesText: string;
  }>({
    status: 'idle',
    result: null,
    progressPercent: 0,
    bytesText: '',
  });

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

  // Perform update check
  const runUpdateCheck = useCallback(async () => {
    setUpdateState((prev) => ({ ...prev, status: 'checking', errorText: undefined }));
    try {
      const res = await checkAppUpdate();
      if (res && res.hasUpdate) {
        setUpdateState({
          status: 'available',
          result: res,
          progressPercent: 0,
          bytesText: '',
        });
      } else if (res) {
        setUpdateState({
          status: 'latest',
          result: res,
          progressPercent: 0,
          bytesText: '',
        });
      } else {
        setUpdateState((prev) => ({ ...prev, status: 'idle' }));
      }
    } catch (err: any) {
      setUpdateState((prev) => ({
        ...prev,
        status: 'error',
        errorText: err?.message || 'Check failed',
      }));
    }
  }, []);

  // When drawer opens: refresh telemetry, offline storage count, and silently check for app updates
  useEffect(() => {
    if (!isOpen) return;

    setTelemetry(getRolling7DayUsage());
    refreshOfflineSummary();
    runUpdateCheck();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, refreshOfflineSummary, runUpdateCheck]);

  // Handle in-app APK download & installation
  const handleStartUpdate = async () => {
    if (!updateState.result?.apkUrl) return;
    hapticMedium();

    if (!Capacitor.isNativePlatform()) {
      window.open(updateState.result.apkUrl, '_blank');
      return;
    }

    setUpdateState((prev) => ({
      ...prev,
      status: 'downloading',
      progressPercent: 0,
      bytesText: 'Starting download...',
    }));

    try {
      try {
        await AppInstaller.addListener(
          'downloadProgress',
          (data: { percent: number; bytesReceived: number; totalBytes: number }) => {
            setUpdateState((prev) => ({
              ...prev,
              progressPercent: data.percent || 0,
              bytesText:
                data.totalBytes > 0
                  ? `${formatBytes(data.bytesReceived)} / ${formatBytes(data.totalBytes)}`
                  : formatBytes(data.bytesReceived),
            }));
          }
        );

        await AppInstaller.addListener('downloadComplete', () => {
          setUpdateState((prev) => ({
            ...prev,
            status: 'latest',
            progressPercent: 100,
            bytesText: 'Launching installer...',
          }));
        });

        await AppInstaller.addListener('downloadFailed', (err: { error: string }) => {
          setUpdateState((prev) => ({
            ...prev,
            status: 'error',
            errorText: err.error || 'Download failed',
          }));
        });
      } catch (_) {}

      await AppInstaller.downloadAndInstall({ url: updateState.result.apkUrl });
    } catch (err) {
      console.warn('[VaultDrawer] AppInstaller download failed, opening fallback URL:', err);
      window.open(updateState.result.apkUrl, '_system');
    }
  };

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

        {/* Drawer Footer Cluster: Controls & Telemetry */}
        <div className="drawer-footer-cluster mt-auto pt-3 border-t border-white/[0.08] flex flex-col gap-2.5">
          {/* Keep Screen On Toggle Bar */}
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
                keepScreenOn ? 'bg-white' : 'bg-neutral-800/90'
              }`}
              title={keepScreenOn ? 'Keep screen on: Enabled' : 'Keep screen on: Disabled'}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full shadow-md transition duration-200 ease-in-out ${
                  keepScreenOn
                    ? 'translate-x-4 bg-neutral-950'
                    : 'translate-x-0 bg-neutral-400'
                }`}
              />
            </button>
          </div>

          <div className="border-t border-white/[0.06]" />

          {/* Available Offline Files (File Count) */}
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              setIsOfflineModalOpen(true);
            }}
            className="flex items-center justify-between py-1 px-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group text-left"
            title="Click to view files available offline"
          >
            <div className="flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white transition-colors" />
              <span className="text-xs font-sans font-medium text-neutral-200 tracking-wide group-hover:text-white transition-colors">
                Available Offline Files
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-neutral-300 border border-white/10 font-bold group-hover:bg-white group-hover:text-black transition-colors">
                {offlineSummary.count}
              </span>
            </div>
          </button>

          {/* Check for App Update Notification (Under Available Offline Files & Right Above Graph) */}
          <div className="flex flex-col gap-1.5 px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            {updateState.status === 'checking' && (
              <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-mono py-0.5">
                <Loader2 className="w-3 h-3 animate-spin text-neutral-300" />
                <span>Checking for app updates...</span>
              </div>
            )}

            {updateState.status === 'available' && updateState.result && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Update Available</span>
                    </div>
                    <span className="text-[10px] text-neutral-400 font-mono">
                      {updateState.result.latestVersion} (Current: {updateState.result.currentVersion})
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartUpdate}
                    className="px-2.5 py-1 rounded bg-white text-neutral-950 hover:bg-neutral-200 text-[10px] font-mono font-bold tracking-wider uppercase transition-colors shrink-0 cursor-pointer shadow-sm"
                  >
                    Update
                  </button>
                </div>
              </div>
            )}

            {updateState.status === 'downloading' && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono text-neutral-300">
                  <span>Downloading update...</span>
                  <span>{updateState.progressPercent}%</span>
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-150"
                    style={{ width: `${updateState.progressPercent}%` }}
                  />
                </div>
                {updateState.bytesText && (
                  <span className="text-[9px] font-mono text-neutral-400 text-right">
                    {updateState.bytesText}
                  </span>
                )}
              </div>
            )}

            {updateState.status === 'latest' && updateState.result && (
              <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                <div className="flex items-center gap-1.5 text-neutral-400">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Up to date ({updateState.result.currentVersion})</span>
                </div>
                <button
                  type="button"
                  onClick={() => runUpdateCheck()}
                  className="text-[10px] text-neutral-500 hover:text-neutral-300 hover:underline cursor-pointer"
                  title="Check for update again"
                >
                  Check
                </button>
              </div>
            )}

            {(updateState.status === 'idle' || updateState.status === 'error') && (
              <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                <span>App Updates</span>
                <button
                  type="button"
                  onClick={() => runUpdateCheck()}
                  className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-neutral-300 text-[10px] font-mono transition-colors cursor-pointer"
                >
                  Check for App Update
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-white/[0.06]" />

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
              const heightPercent = (telemetry.maxVal > 0 && day.count > 0)
                ? Math.max(Math.round((day.count / telemetry.maxVal) * 100), 14)
                : 0;

              const dateNumber = day.label === 'TODAY'
                ? 'TODAY'
                : day.label === 'YEST'
                ? 'YEST'
                : day.label.split(' ')[1] || day.label;

              return (
                <div key={day.date} className="flex-1 flex flex-col items-center h-full justify-end gap-1">
                  <div
                    className={`bar-col w-full ${isToday ? 'active-bar' : ''}`}
                    style={{
                      height: day.count > 0 ? `${heightPercent}%` : '2px',
                      opacity: day.count > 0 ? 1 : 0.25,
                    }}
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

      {/* Available Offline Files Browser Modal */}
      <OfflineFilesModal
        isOpen={isOfflineModalOpen}
        onClose={() => setIsOfflineModalOpen(false)}
        summary={offlineSummary}
        onOpenPhoto={onOpenPhoto}
        onOpenVideo={onOpenVideo}
      />
    </>
  );
};

export default VaultDrawer;
