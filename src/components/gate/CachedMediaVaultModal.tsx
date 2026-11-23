import React, { useState, useMemo } from 'react';
import type { StageMediaItem } from '../../types';
import { getMediaUrl } from '../../utils/imageUrlResolver';
import { isPhotoExtension, isVideoExtension } from '../../utils/mediaTypeDetector';
import {
  getCachedMediaRecords,
  clearAllWebsiteData,
  getTotalCachedStorageSize,
} from '../../utils/cachedMediaManager';

export interface CachedMediaVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPhoto: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenShort: (item: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => void;
  onOpenVideo: (item: StageMediaItem, playlist: StageMediaItem[]) => void;
}

export const CachedMediaVaultModal: React.FC<CachedMediaVaultModalProps> = ({
  isOpen,
  onClose,
  onOpenPhoto,
  onOpenShort,
  onOpenVideo,
}) => {
  const [activeTab, setActiveTab] = useState<'photos' | 'shorts' | 'videos'>('photos');
  const [isClearing, setIsClearing] = useState(false);
  const [clearMessage, setClearMessage] = useState<string | null>(null);

  const records = useMemo(() => {
    return getCachedMediaRecords();
  }, [isOpen, isClearing]);

  const totalSize = useMemo(() => {
    return getTotalCachedStorageSize();
  }, [records]);

  // Separate records into three categories
  const { photos, shorts, videos } = useMemo(() => {
    const p: typeof records = [];
    const s: typeof records = [];
    const v: typeof records = [];

    records.forEach((r) => {
      const item = r.item;
      const isShort =
        item.mediaType === 'short' ||
        (item.path || item.url || '').toLowerCase().includes('/shorts/');
      const isVid =
        !isShort &&
        (item.type === 'video' ||
          item.mediaType === 'clip' ||
          isVideoExtension(item.path || item.url || item.name || ''));

      if (isShort) s.push(r);
      else if (isVid) v.push(r);
      else p.push(r);
    });

    return { photos: p, shorts: s, videos: v };
  }, [records]);

  const activeList =
    activeTab === 'photos' ? photos : activeTab === 'shorts' ? shorts : videos;

  const handleClearCache = async () => {
    setIsClearing(true);
    await clearAllWebsiteData();
    setIsClearing(false);
    setClearMessage('All website cache and browser data cleared.');
    setTimeout(() => {
      setClearMessage(null);
    }, 4000);
  };

  const handleLaunchItem = (item: StageMediaItem, idx: number) => {
    const isPhoto =
      item.type === 'image' ||
      isPhotoExtension(item.path || item.url || item.name || '');
    const isShort =
      item.mediaType === 'short' ||
      (item.path || item.url || '').toLowerCase().includes('/shorts/');
    const isVid =
      !isShort &&
      (item.type === 'video' ||
        item.mediaType === 'clip' ||
        isVideoExtension(item.path || item.url || item.name || ''));

    const playlist = activeList.map((r) => r.item);

    onClose();
    if (isPhoto) {
      onOpenPhoto(item, playlist, idx);
    } else if (isShort) {
      onOpenShort(item, playlist, idx, 'Cached');
    } else if (isVid) {
      onOpenVideo(item, playlist);
    } else {
      onOpenPhoto(item, playlist, idx);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-[#04060c]/95 backdrop-blur-2xl flex flex-col justify-between overflow-hidden select-none"
      style={{ borderRadius: 0, outline: 'none' }}
    >
      {/* Top Header */}
      <div className="w-full bg-[#070b14] border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 bg-cyan-400 shadow-[0_0_12px_#38bdf8]"></span>
          <div>
            <h2 className="font-mono text-xs sm:text-sm font-bold text-white tracking-widest uppercase">
              // CACHED MEDIA VAULT
            </h2>
            <p className="text-[11px] font-mono text-neutral-400">
              {records.length} Items Cached &bull; {totalSize} Stored &bull; 7-Day Rolling Expiration
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* CLEAR CACHE BUTTON */}
          <button
            onClick={handleClearCache}
            disabled={isClearing || records.length === 0}
            className="px-3 sm:px-4 py-1.5 bg-red-950/50 border border-red-500/50 hover:bg-red-500 hover:text-white text-red-300 font-mono text-xs font-bold tracking-wider uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            title="Wipe all website cache from browser storage"
          >
            <span>🗑</span>
            <span>CLEAR CACHE</span>
          </button>

          {/* CLOSE BUTTON */}
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-black/60 border border-white/20 hover:border-white text-white font-mono text-xs font-bold tracking-wider uppercase transition-all"
          >
            ✕ CLOSE
          </button>
        </div>
      </div>

      {/* Clear Status Message Banner */}
      {clearMessage && (
        <div className="w-full bg-emerald-950/80 border-b border-emerald-500/40 px-4 py-2 text-center font-mono text-xs text-emerald-300">
          ✓ {clearMessage} (Browser currently holds 0 bytes of cache)
        </div>
      )}

      {/* Category Tabs: PHOTOS, SHORTS, VIDEOS */}
      <div className="bg-[#05080f] border-b border-white/10 px-4 sm:px-8 flex items-center gap-2 font-mono text-xs shrink-0">
        <button
          onClick={() => setActiveTab('photos')}
          className={`px-4 sm:px-6 py-2.5 font-bold uppercase transition-all ${
            activeTab === 'photos'
              ? 'border-b-2 border-cyan-400 text-cyan-400 bg-cyan-950/20'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          📷 PHOTOS ({photos.length})
        </button>
        <button
          onClick={() => setActiveTab('shorts')}
          className={`px-4 sm:px-6 py-2.5 font-bold uppercase transition-all ${
            activeTab === 'shorts'
              ? 'border-b-2 border-cyan-400 text-cyan-400 bg-cyan-950/20'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          ⚡ SHORTS ({shorts.length})
        </button>
        <button
          onClick={() => setActiveTab('videos')}
          className={`px-4 sm:px-6 py-2.5 font-bold uppercase transition-all ${
            activeTab === 'videos'
              ? 'border-b-2 border-cyan-400 text-cyan-400 bg-cyan-950/20'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          🎬 VIDEOS ({videos.length})
        </button>

        <div className="ml-auto hidden md:flex items-center gap-3 text-[11px] text-neutral-400">
          <span>ALL CACHED ASSETS RUN 100% BUFFERLESS OFFLINE</span>
        </div>
      </div>

      {/* Media Items Grid */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-8 scrollbar-none">
        {activeList.length === 0 ? (
          <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 border border-white/5 bg-[#060910]">
            <span className="w-8 h-8 bg-cyan-950 border border-cyan-500/40 text-cyan-400 flex items-center justify-center font-mono text-sm mb-3">
              0
            </span>
            <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider mb-1">
              // NO CACHED {activeTab.toUpperCase()} IN BROWSER
            </h3>
            <p className="font-mono text-xs text-neutral-400 max-w-md">
              Open media in the {activeTab === 'photos' ? 'Photographs' : activeTab === 'shorts' ? 'Shorts' : 'Video Clips'} section to automatically cache it here for offline access.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {activeList.map((rec, idx) => {
              const item = rec.item;
              const imageSrc =
                item.thumbnail ||
                item.poster ||
                getMediaUrl(item.url || item.path || '');

              const daysRemaining = Math.max(
                1,
                Math.ceil((rec.expiresAt - Date.now()) / (24 * 60 * 60 * 1000))
              );

              return (
                <div
                  key={`${item.id || item.url}-${idx}`}
                  onClick={() => handleLaunchItem(item, idx)}
                  className="bg-[#080d17] border border-white/10 hover:border-cyan-400 flex flex-col overflow-hidden transition-all duration-200 cursor-pointer group"
                  style={{ borderRadius: 0 }}
                >
                  <div className="aspect-[9/14] w-full relative overflow-hidden bg-black">
                    <img
                      src={imageSrc}
                      alt={item.name || ''}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 filter saturate-[0.96]"
                    />
                    <span className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/85 border border-emerald-500 text-emerald-400 font-mono text-[9px] font-bold">
                      ● OFFLINE
                    </span>
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/85 font-mono text-[9px] text-cyan-300 border border-white/10">
                      {rec.fileSizeFormatted}
                    </span>
                  </div>

                  <div className="p-2.5 flex flex-col justify-between flex-1 bg-[#060a12]">
                    <span className="font-mono text-xs font-bold text-white truncate" title={item.name || ''}>
                      {item.title || item.name || 'Cached Media'}
                    </span>
                    <div className="flex items-center justify-between text-[10px] font-mono text-neutral-400 mt-2 pt-2 border-t border-white/5">
                      <span className="text-cyan-400">{daysRemaining}d TTL</span>
                      <span className="text-white font-bold group-hover:text-cyan-400 transition-colors">
                        OPEN &rarr;
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Notice */}
      <div className="w-full bg-[#070b14] border-t border-white/10 px-4 sm:px-8 py-2.5 flex items-center justify-between font-mono text-[11px] text-neutral-400 shrink-0">
        <span>CLEARED BROWSER CACHE WILL HOLD ZERO DATA UNLESS CACHED AGAIN</span>
        <button
          onClick={handleClearCache}
          disabled={isClearing || records.length === 0}
          className="text-red-400 hover:underline disabled:opacity-40"
        >
          PURGE ALL CACHE
        </button>
      </div>
    </div>
  );
};
