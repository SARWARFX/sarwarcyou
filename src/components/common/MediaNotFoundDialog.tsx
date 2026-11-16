import React from 'react';
import { AlertCircle, ArrowRight, Home, Compass } from 'lucide-react';
import { hapticLight, hapticMedium } from '../../utils/hapticsManager';

export interface MediaNotFoundDialogProps {
  isOpen: boolean;
  attemptedPath: string;
  suggestedTab?: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY' | 'BANDHOBI' | 'TRAILER';
  onClose: () => void;
  onNavigateTab: (tab: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY' | 'BANDHOBI' | 'TRAILER') => void;
}

/**
 * 404 Cyber Not Found Error Screen
 * - 100% Square Geometry (zero rounded corners)
 * - Corner L-brackets (Cyan #00f0ff top-left, Pink #ff2bd6 bottom-right)
 * - White & Electric Cyan color palette
 * - Zero backdrop blur to keep background crisp
 */
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
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/75 transition-opacity duration-200 cursor-pointer select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-none bg-[rgba(6,10,18,0.98)] border border-[rgba(0,245,255,0.4)] p-6 shadow-[0_0_50px_rgba(0,245,255,0.2),inset_0_0_25px_rgba(0,245,255,0.05)] cursor-default animate-hacker-dock-deploy"
      >
        {/* Top-Left Cyan L-Bracket */}
        <div className="cyber-dock-corner-tl" />

        {/* Bottom-Right Pink L-Bracket */}
        <div className="cyber-dock-corner-br" />

        {/* 1-shot laser beam sweep */}
        <div className="absolute left-0 right-0 bg-[#00f0ff] shadow-[0_0_12px_#00f0ff] pointer-events-none z-40 animate-hacker-beam-sweep" />

        {/* Header Icon with Neon Pulse */}
        <div className="flex items-center gap-3.5 mb-4 border-b border-white/10 pb-4">
          <div className="w-11 h-11 rounded-none bg-[rgba(255,43,214,0.12)] border border-[#ff2bd6] flex items-center justify-center text-[#ff2bd6] shadow-[0_0_15px_rgba(255,43,214,0.3)]">
            <AlertCircle className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-['Orbitron',sans-serif] font-black tracking-wider uppercase text-white">
              LINK DOES NOT EXIST
            </h3>
            <p className="text-[10px] font-mono text-[#00f0ff] tracking-widest uppercase">
              ARCHIVE NOTIFICATION // ERROR 404
            </p>
          </div>
        </div>

        {/* Message */}
        <p className="text-xs sm:text-sm text-neutral-300 font-mono leading-relaxed mb-6">
          The requested media link{' '}
          <code className="px-2 py-0.5 rounded-none bg-white/10 text-[#00f0ff] font-mono text-xs border border-[rgba(0,245,255,0.3)]">
            {attemptedPath}
          </code>{' '}
          does not exist, has expired, or was removed from this vault.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-2">
          {suggestedTab && suggestedTab !== 'TRAILER' && (
            <button
              type="button"
              onClick={() => {
                hapticMedium();
                onNavigateTab(suggestedTab);
                onClose();
              }}
              className="flex-1 py-2.5 px-4 rounded-none bg-[#00f0ff] text-[#030712] font-['Orbitron',sans-serif] font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_18px_rgba(0,240,255,0.4)] hover:bg-white active:scale-95 transition-all cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              <span>&gt; BROWSE {suggestedTab}</span>
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
            className="flex-1 py-2.5 px-4 rounded-none bg-white/5 hover:bg-white/10 text-neutral-200 hover:text-white border border-white/20 font-['Orbitron',sans-serif] font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95 hover:border-[#00f0ff]"
          >
            <Home className="w-4 h-4" />
            <span>&gt; RETURN HOME</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MediaNotFoundDialog;
