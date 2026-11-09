import React from 'react';
import { Loader2 } from 'lucide-react';
import { usePhotoSyncStatus } from '../services/photoSyncManager';

export interface SyncStatusIndicatorProps {
  className?: string;
}

/**
 * Discrete, non-blocking background photo pre-sync progress indicator.
 * Displays progress percentage while caching in the background and fades out upon 100% completion.
 */
export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ className = '' }) => {
  const { isSyncing, progress, completedCount, totalCount } = usePhotoSyncStatus();

  if (!isSyncing) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 font-['Roboto_Condensed'] font-sans text-xs tracking-wider shadow-[0_0_12px_rgba(56,189,248,0.25)] select-none pointer-events-none transition-all duration-300 animate-fade-in ${className}`}
    >
      <Loader2 className="w-3 h-3 animate-spin text-cyan-400 shrink-0" />
      <span className="whitespace-nowrap">Syncing vault photos: {progress}%</span>
      {totalCount > 0 && (
        <span className="text-[10px] text-cyan-400/60 font-mono hidden sm:inline">
          ({completedCount}/{totalCount})
        </span>
      )}
    </div>
  );
};

export default SyncStatusIndicator;
