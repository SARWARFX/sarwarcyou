import React from 'react';
import { AlertCircle, ArrowRight, Home, Compass } from 'lucide-react';
import { hapticLight, hapticMedium } from '../../utils/hapticsManager';

export interface MediaNotFoundDialogProps {
  isOpen: boolean;
  attemptedPath: string;
  suggestedTab?: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY' | 'TRAILER';
  onClose: () => void;
  onNavigateTab: (tab: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY' | 'TRAILER') => void;
}

export const MediaNotFoundDialog: React.FC<MediaNotFoundDialogProps> = ({
  isOpen,
  attemptedPath,
  suggestedTab = 'TRAILER',
  onClose,
  onNavigateTab,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-backdrop-fade cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl bg-[#090b10] border border-white/15 p-6 shadow-[0_25px_60px_rgba(0,0,0,0.95)] overflow-hidden cursor-default animate-picasa-open"
      >
        {/* Subtle Ambient Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 rounded-full bg-[#ccff00]/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 rounded-full bg-red-500/10 blur-3xl pointer-events-none" />

        {/* Header Icon with Neon Pulse */}
        <div className="flex items-center gap-3.5 mb-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
            <AlertCircle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-mono font-bold tracking-wider uppercase text-white">
              LINK DOES NOT EXIST
            </h3>
            <p className="text-[11px] font-mono text-neutral-400 tracking-wide uppercase">
              ARCHIVE NOTIFICATION // 404
            </p>
          </div>
        </div>

        {/* Message */}
        <p className="text-sm text-neutral-300 leading-relaxed mb-4">
          The requested media link <code className="px-2 py-0.5 rounded bg-white/10 text-[#ccff00] font-mono text-xs">{attemptedPath}</code> does not exist, has expired, or was removed from this vault.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 mt-6 pt-4 border-t border-white/10">
          {suggestedTab && suggestedTab !== 'TRAILER' && (
            <button
              type="button"
              onClick={() => {
                hapticMedium();
                onNavigateTab(suggestedTab);
                onClose();
              }}
              className="flex-1 py-2.5 px-4 rounded-lg bg-[#ccff00] text-black font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_18px_rgba(204,255,0,0.3)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              <span>BROWSE {suggestedTab}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-auto sm:ml-0" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              hapticLight();
              onNavigateTab('TRAILER');
              onClose();
            }}
            className="flex-1 py-2.5 px-4 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-200 hover:text-white border border-white/15 font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <Home className="w-4 h-4" />
            <span>RETURN HOME</span>
          </button>
        </div>
      </div>
    </div>
  );
};
