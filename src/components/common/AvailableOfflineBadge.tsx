import React from 'react';
import { Capacitor } from '@capacitor/core';
import { CheckCircle2 } from 'lucide-react';
import { useOfflineStatus } from '../../services/videoOfflineManager';
import type { StageMediaItem } from '../../types';

interface AvailableOfflineBadgeProps {
  item: StageMediaItem;
  className?: string;
}

export const AvailableOfflineBadge: React.FC<AvailableOfflineBadgeProps> = ({ item, className = '' }) => {
  const isOffline = useOfflineStatus(item);

  if (!Capacitor.isNativePlatform() || !isOffline) return null;

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-['Roboto_Condensed'] font-semibold tracking-wide backdrop-blur-md shadow-sm ${className}`}
      title="Saved for offline playback"
    >
      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
      <span>Available Offline</span>
    </div>
  );
};
