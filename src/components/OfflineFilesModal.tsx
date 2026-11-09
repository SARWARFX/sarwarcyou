import React, { useState, useMemo } from 'react';
import { X, Play, Image as ImageIcon, Video as VideoIcon, HardDrive, Eye } from 'lucide-react';
import type { OfflineFileItem, OfflineSummary } from '../services/offlineFilesManager';
import { offlineItemToStageMedia } from '../services/offlineFilesManager';
import type { StageMediaItem } from '../types';
import { hapticMedium } from '../utils/hapticsManager';

export interface OfflineFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: OfflineSummary;
  onOpenPhoto?: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
  onOpenVideo?: (item: StageMediaItem) => void;
}

export const OfflineFilesModal: React.FC<OfflineFilesModalProps> = ({
  isOpen,
  onClose,
  summary,
  onOpenPhoto,
  onOpenVideo,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'PHOTOS' | 'VIDEOS'>('ALL');
  const [previewMedia, setPreviewMedia] = useState<OfflineFileItem | null>(null);

  const filteredFiles = useMemo(() => {
    if (filter === 'PHOTOS') {
      return summary.files.filter((f) => f.type === 'photo');
    }
    if (filter === 'VIDEOS') {
      return summary.files.filter((f) => f.type === 'video');
    }
    return summary.files;
  }, [summary.files, filter]);

  if (!isOpen) return null;

  const handleItemClick = (item: OfflineFileItem) => {
    hapticMedium();
    const stageItem = offlineItemToStageMedia(item);

    if (item.type === 'video') {
      if (onOpenVideo) {
        onClose();
        onOpenVideo(stageItem);
      } else {
        setPreviewMedia(item);
      }
    } else {
      if (onOpenPhoto) {
        const photoPlaylist = filteredFiles
          .filter((f) => f.type === 'photo')
          .map(offlineItemToStageMedia);
        const photoIndex = photoPlaylist.findIndex((p) => p.id === stageItem.id);
        onClose();
        onOpenPhoto(stageItem, photoPlaylist, photoIndex >= 0 ? photoIndex : 0);
      } else {
        setPreviewMedia(item);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#0c0d12] border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/[0.08] bg-[#12131a]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-neutral-300">
              <HardDrive className="w-5 h-5 text-neutral-300" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-serif font-bold tracking-wider text-[#f4f4f5] uppercase">
                Available Offline Files
              </h2>
              <p className="text-[11px] text-neutral-400 font-mono tracking-wide">
                {summary.count} {summary.count === 1 ? 'FILE' : 'FILES'} CACHED ON DEVICE · {summary.formattedTotalSize}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              hapticMedium();
              onClose();
            }}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Chips Bar */}
        <div className="flex items-center gap-2 px-5 sm:px-6 py-3 border-b border-white/[0.06] bg-[#0c0d12] overflow-x-auto">
          <button
            type="button"
            onClick={() => setFilter('ALL')}
            className={`px-3 py-1 rounded-md text-xs font-mono tracking-wider transition-all cursor-pointer ${
              filter === 'ALL'
                ? 'bg-white text-neutral-950 font-bold'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            ALL ({summary.count})
          </button>
          <button
            type="button"
            onClick={() => setFilter('PHOTOS')}
            className={`px-3 py-1 rounded-md text-xs font-mono tracking-wider transition-all cursor-pointer ${
              filter === 'PHOTOS'
                ? 'bg-white text-neutral-950 font-bold'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            PHOTOS ({summary.photosCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter('VIDEOS')}
            className={`px-3 py-1 rounded-md text-xs font-mono tracking-wider transition-all cursor-pointer ${
              filter === 'VIDEOS'
                ? 'bg-white text-neutral-950 font-bold'
                : 'text-neutral-400 hover:text-white hover:bg-white/5'
            }`}
          >
            VIDEOS ({summary.videosCount})
          </button>
        </div>

        {/* Body Content: Grid of Offline Files */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-scrollbar">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center justify-center">
              <HardDrive className="w-10 h-10 text-neutral-600 mb-3" />
              <p className="text-sm font-medium text-neutral-300">No offline files found in this category.</p>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                Files cache automatically in the background while browsing in the app for offline viewing.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  onClick={() => handleItemClick(file)}
                  className="group relative bg-[#13141c] border border-white/[0.08] hover:border-white/30 rounded-xl overflow-hidden flex flex-col cursor-pointer transition-all hover:scale-[1.02] shadow-lg"
                >
                  {/* Media Thumbnail */}
                  <div className="relative aspect-[3/4] bg-[#090a0f] overflow-hidden flex items-center justify-center">
                    {file.type === 'photo' ? (
                      <img
                        src={file.localUri}
                        alt={file.title}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        onError={(e) => {
                          (e.currentTarget as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900/80">
                        <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center text-white mb-2 group-hover:bg-white group-hover:text-black transition-colors">
                          <Play className="w-5 h-5 ml-0.5" />
                        </div>
                        <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
                          Offline Video
                        </span>
                      </div>
                    )}

                    {/* Type Badge & Size Badge */}
                    <div className="absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] font-mono text-neutral-300">
                      {file.type === 'photo' ? (
                        <ImageIcon className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <VideoIcon className="w-3 h-3 text-cyan-400" />
                      )}
                      <span>{file.formattedSize}</span>
                    </div>

                    {/* Hover View Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <div className="p-2 rounded-full bg-white/20 backdrop-blur-md text-white">
                        {file.type === 'photo' ? <Eye className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                      </div>
                    </div>
                  </div>

                  {/* Title & Metadata */}
                  <div className="p-2.5 flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-neutral-200 line-clamp-1 group-hover:text-white transition-colors">
                      {file.title}
                    </span>
                    <span className="text-[10px] text-neutral-500 font-mono truncate">
                      {file.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* In-Modal Direct Preview Overlay (if standalone) */}
        {previewMedia && (
          <div className="fixed inset-0 z-60 bg-black/95 flex flex-col items-center justify-center p-4">
            <button
              type="button"
              onClick={() => setPreviewMedia(null)}
              className="absolute top-5 right-5 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
            >
              <X className="w-6 h-6" />
            </button>
            {previewMedia.type === 'video' ? (
              <video
                src={previewMedia.localUri}
                controls
                autoPlay
                className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
              />
            ) : (
              <img
                src={previewMedia.localUri}
                alt={previewMedia.title}
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
              />
            )}
            <div className="text-center mt-3 text-sm text-neutral-300 font-medium">
              {previewMedia.title} ({previewMedia.formattedSize})
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
