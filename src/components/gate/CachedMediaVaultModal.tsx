import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { StageMediaItem } from '../../types';
import { getMediaUrl } from '../../utils/imageUrlResolver';
import { isVideoExtension } from '../../utils/mediaTypeDetector';
import { hapticMedium } from '../../utils/hapticsManager';
import {
  getCachedMediaRecords,
  clearAllWebsiteData,
} from '../../utils/cachedMediaManager';

export interface CachedMediaVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPhoto: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenShort: (item: StageMediaItem, shorts: StageMediaItem[], index: number, folderName?: string) => void;
  onOpenVideo: (item: StageMediaItem, playlist: StageMediaItem[]) => void;
}

/**
 * Clean & Minimalist Cached Media Window
 * - Opens dynamically just like the 24-hour diurnal detail graph.
 * - Dynamic small window sizing for any screen (mobile/tablet/desktop).
 * - Click outside or Esc key smoothly closes the window.
 * - Text-free media cards matching the site's signature visual aesthetic.
 * - Features a clean 'CLEAR CACHE' action that purges all browser storage.
 */
export const CachedMediaVaultModal: React.FC<CachedMediaVaultModalProps> = ({
  isOpen,
  onClose,
  onOpenPhoto,
  onOpenShort,
  onOpenVideo,
}) => {
  const [activeTab, setActiveTab] = useState<'photos' | 'shorts' | 'clips'>('photos');
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [isClearing, setIsClearing] = useState<boolean>(false);

  const handleClose = useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    hapticMedium();
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 240);
  }, [isClosing, onClose]);

  // Esc key closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  const records = useMemo(() => {
    if (!isOpen) return [];
    return getCachedMediaRecords();
  }, [isOpen, isClearing]);

  // Split into three categories: Photographs, Shorts, Video Clips
  const { photos, shorts, clips } = useMemo(() => {
    const p: typeof records = [];
    const s: typeof records = [];
    const c: typeof records = [];

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
      else if (isVid) c.push(r);
      else p.push(r);
    });

    return { photos: p, shorts: s, clips: c };
  }, [records]);

  const activeRecords =
    activeTab === 'photos' ? photos : activeTab === 'shorts' ? shorts : clips;

  const handleClearCache = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsClearing(true);
    await clearAllWebsiteData();
    setIsClearing(false);
  };

  const handleLaunchItem = (item: StageMediaItem, idx: number) => {
    const isShort =
      item.mediaType === 'short' ||
      (item.path || item.url || '').toLowerCase().includes('/shorts/');
    const isVid =
      !isShort &&
      (item.type === 'video' ||
        item.mediaType === 'clip' ||
        isVideoExtension(item.path || item.url || item.name || ''));

    const playlist = activeRecords.map((r) => r.item);

    handleClose();
    if (isShort) {
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
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
      className={`fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none cursor-pointer overflow-hidden ${
        isClosing ? 'animate-holo-backdrop-out' : 'animate-holo-backdrop-in'
      }`}
      style={{
        borderRadius: 0,
        outline: 'none',
        border: 'none',
        WebkitBackdropFilter: 'blur(16px)',
        backdropFilter: 'blur(16px)',
      }}
      title="Click outside to close"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-2xl max-h-[85dvh] bg-[#06080e]/95 backdrop-blur-2xl border border-white/[0.12] shadow-[0_24px_80px_rgba(0,0,0,0.85)] flex flex-col p-4 sm:p-6 relative overflow-hidden cursor-default ${
          isClosing ? 'animate-holo-beam-close' : 'animate-holo-beam-open'
        }`}
        style={{
          borderRadius: 0,
          outline: 'none',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          fontFamily: "'Science Gothic', sans-serif",
        }}
      >
        {/* Sleek Minimalist Header */}
        <div className="flex items-center justify-between w-full mb-3 shrink-0">
          <span
            className="text-[11px] sm:text-xs md:text-sm font-bold tracking-[0.16em] uppercase text-[#38bdf8]"
            style={{
              textShadow: '0 0 10px rgba(56, 189, 248, 0.6)',
            }}
          >
            // CACHED MEDIA
          </span>

          <button
            onClick={handleClearCache}
            disabled={records.length === 0 || isClearing}
            className="text-[10px] sm:text-[11.5px] font-bold tracking-wider uppercase text-[#ef4444] hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0 outline-none disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ textShadow: '0 0 8px rgba(239, 68, 68, 0.4)' }}
          >
            CLEAR CACHE
          </button>
        </div>

        {/* Minimalist Subfolder-Style Category Switcher */}
        <div className="flex items-center gap-4 sm:gap-6 border-b border-white/[0.08] pb-2.5 mb-3 shrink-0 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('photos')}
            className={`text-[11px] sm:text-[12px] tracking-wide transition-colors cursor-pointer p-0 bg-transparent border-0 outline-none whitespace-nowrap ${
              activeTab === 'photos'
                ? 'text-white font-bold'
                : 'text-[#64748b] font-medium hover:text-white'
            }`}
          >
            Photographs ({photos.length})
          </button>
          <button
            onClick={() => setActiveTab('shorts')}
            className={`text-[11px] sm:text-[12px] tracking-wide transition-colors cursor-pointer p-0 bg-transparent border-0 outline-none whitespace-nowrap ${
              activeTab === 'shorts'
                ? 'text-white font-bold'
                : 'text-[#64748b] font-medium hover:text-white'
            }`}
          >
            Shorts ({shorts.length})
          </button>
          <button
            onClick={() => setActiveTab('clips')}
            className={`text-[11px] sm:text-[12px] tracking-wide transition-colors cursor-pointer p-0 bg-transparent border-0 outline-none whitespace-nowrap ${
              activeTab === 'clips'
                ? 'text-white font-bold'
                : 'text-[#64748b] font-medium hover:text-white'
            }`}
          >
            Video Clips ({clips.length})
          </button>
        </div>

        {/* Media Grid: Text-Free Cards */}
        <div className="flex-1 overflow-y-auto no-scrollbar py-1">
          {activeRecords.length === 0 ? (
            <div className="w-full h-40 flex items-center justify-center text-center text-[#64748b] text-xs font-mono tracking-widest uppercase">
              // NO MEDIA CACHED
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3">
              {activeRecords.map((rec, idx) => {
                const item = rec.item;
                const imageSrc =
                  item.thumbnail ||
                  item.poster ||
                  getMediaUrl(item.url || item.path || '');

                return (
                  <div
                    key={`${item.id || item.url || item.name}-${idx}`}
                    onClick={() => handleLaunchItem(item, idx)}
                    className="aspect-[9/16] bg-[#080b12] flex-shrink-0 cursor-pointer overflow-hidden transition-transform duration-200 hover:scale-[1.04] relative select-none"
                    style={{
                      borderRadius: 0,
                      outline: 'none',
                      border: 'none',
                    }}
                  >
                    <img
                      src={imageSrc}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover block filter saturate-[0.98] contrast-[1.03]"
                      style={{ borderRadius: 0 }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
