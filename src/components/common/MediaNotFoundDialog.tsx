import React from 'react';
import { hapticLight, hapticMedium } from '../../utils/hapticsManager';

export interface MediaNotFoundDialogProps {
  isOpen: boolean;
  attemptedPath: string;
  suggestedTab?: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY' | 'BANDHOBI' | 'TRAILER' | 'HOME' | 'TELEMETRY';
  onClose: () => void;
  onNavigateTab: (tab: 'SHORTS' | 'CLIPS' | 'PHOTOGRAPHY' | 'BANDHOBI' | 'TRAILER' | 'HOME' | 'TELEMETRY') => void;
}

/**
 * 404 Route Not Found Dialog
 * - Centered at the middle of the website
 * - 20px Backdrop Blur
 * - 100% Rectangular Geometry (0px border-radius, zero outlines)
 * - Deep Obsidian Color Scheme
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
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-[20px] transition-opacity duration-200 cursor-pointer select-none"
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-[#090c12] p-8 shadow-[0_24px_60px_rgba(0,0,0,0.95)] cursor-default text-white flex flex-col gap-4"
        style={{ borderRadius: 0, outline: 'none', border: 'none' }}
      >
        <h3 className="text-lg font-bold tracking-tight text-[#38bdf8] uppercase font-mono">
          // ITEM NOT FOUND
        </h3>

        <p className="text-xs text-neutral-300 font-sans leading-relaxed">
          The requested media item does not exist in the vault or the route has been removed.
        </p>

        <div className="bg-[#030406] p-2.5 text-[11px] font-mono text-neutral-300 break-all select-text">
          {attemptedPath}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3">
          {suggestedTab && suggestedTab !== 'TRAILER' && suggestedTab !== 'HOME' && suggestedTab !== 'TELEMETRY' && (
            <button
              type="button"
              onClick={() => {
                hapticMedium();
                onNavigateTab(suggestedTab);
              }}
              className="py-2 px-4 bg-transparent text-neutral-300 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors cursor-pointer"
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              Browse {suggestedTab === 'CLIPS' ? 'Video Clips' : suggestedTab === 'PHOTOGRAPHY' ? 'Photographs' : suggestedTab}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              hapticLight();
              onNavigateTab('HOME');
            }}
            className="py-2 px-4 bg-[#38bdf8] text-black font-mono font-bold text-xs uppercase tracking-wider hover:bg-white transition-colors cursor-pointer"
            style={{ borderRadius: 0, outline: 'none', border: 'none' }}
          >
            Return Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default MediaNotFoundDialog;
