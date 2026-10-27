import React, { useState } from 'react';
import {
  Share2,
  ExternalLink,
  Folder,
  Calendar,
  Check,
} from 'lucide-react';
import type { MediaItem, Album } from '../../models/media';
import { VideoPlayer } from '../player/VideoPlayer';
import { PlayerQueueSidebar } from '../player/PlayerQueueSidebar';

export interface WatchViewProps {
  item: MediaItem;
  album?: Album;
  queue: MediaItem[];
  onSelectMedia: (item: MediaItem) => void;
  onNavigateAlbum: (albumId: string) => void;
}

export const WatchView: React.FC<WatchViewProps> = ({
  item,
  album,
  queue,
  onSelectMedia,
  onNavigateAlbum,
}) => {
  const [copied, setCopied] = useState(false);

  // Auto-advance to next video when current video ends
  const handleVideoEnded = () => {
    const currentIndex = queue.findIndex((q) => q.id === item.id);
    if (currentIndex !== -1 && currentIndex < queue.length - 1) {
      onSelectMedia(queue[currentIndex + 1]);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Ignore clipboard error
    }
  };

  const formattedDate = item.date
    ? new Date(item.date).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Main Stream Area */}
        <div className="flex-1 w-full space-y-4 min-w-0">
          {/* Dedicated Video Player */}
          <VideoPlayer
            item={item}
            autoPlay
            onEnded={handleVideoEnded}
            className="w-full"
          />

          {/* Video Metadata & Controls */}
          <div className="bg-[#0b0c12] border border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <h1 className="text-lg sm:text-2xl font-black font-sans text-white tracking-wide uppercase break-words">
                  {item.title}
                </h1>

                <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-zinc-400">
                  {item.albumTitle && (
                    <button
                      type="button"
                      onClick={() => onNavigateAlbum(item.albumId)}
                      className="text-[#00E5FF] hover:underline flex items-center gap-1.5 cursor-pointer"
                    >
                      <Folder className="w-3.5 h-3.5" />
                      <span>{item.albumTitle}</span>
                    </button>
                  )}
                  {formattedDate && (
                    <span className="flex items-center gap-1 text-zinc-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formattedDate}</span>
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 uppercase text-[10px] font-bold">
                    {item.variant}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleShare}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-mono text-zinc-300 hover:text-white transition cursor-pointer active:scale-95"
                  title="Copy link"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-emerald-400 font-bold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      <span>Share</span>
                    </>
                  )}
                </button>

                <a
                  href={item.mediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-mono text-zinc-300 hover:text-white transition cursor-pointer"
                  title="Open Raw Stream"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">Stream Link</span>
                </a>
              </div>
            </div>

            {/* Path info */}
            <div className="pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span className="truncate max-w-md">Path: {item.path}</span>
              <span className="text-zinc-400">Cloudflare Edge CDN Cached</span>
            </div>
          </div>
        </div>

        {/* Playlist Queue Sidebar */}
        {queue.length > 0 && (
          <PlayerQueueSidebar
            queue={queue}
            currentItemId={item.id}
            albumTitle={album ? album.title : item.albumTitle}
            onSelectItem={onSelectMedia}
            className="w-full lg:w-96 flex-shrink-0"
          />
        )}
      </div>
    </div>
  );
};
