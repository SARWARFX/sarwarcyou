import React from 'react';

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
 * - Pure Glassmorphic Hologram
 * - 100% Rectangular Geometry (0px border-radius, zero outlines)
 */
export const MediaNotFoundDialog: React.FC<MediaNotFoundDialogProps> = ({
  isOpen,
  attemptedPath,
  suggestedTab: _suggestedTab = 'TRAILER',
  onClose,
  onNavigateTab: _onNavigateTab,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[10px] transition-opacity duration-200 cursor-pointer select-none pointer-events-auto"
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md p-6 sm:p-7 shadow-[0_30px_80px_rgba(0,0,0,0.75)] cursor-default text-white flex flex-col gap-4 animate-scale-in"
        style={{
          borderRadius: 0,
          outline: 'none',
          border: 'none',
          background: 'rgba(10, 14, 23, 0.58)',
          backdropFilter: 'blur(32px) saturate(190%)',
          WebkitBackdropFilter: 'blur(32px) saturate(190%)',
          boxShadow: '0 30px 80px rgba(0, 0, 0, 0.75), 0 0 1px rgba(255, 255, 255, 0.2) inset',
        }}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-bold tracking-tight text-[#38bdf8] uppercase font-mono flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#38bdf8] inline-block shrink-0 shadow-[0_0_8px_rgba(56,189,248,0.6)]" />
            // ITEM NOT FOUND
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-base font-mono p-0"
            style={{ borderRadius: 0, outline: 'none', border: 'none', background: 'transparent' }}
            title="Close Dialog"
          >
            ✕
          </button>
        </div>

        <p className="text-xs sm:text-sm text-neutral-300 font-sans leading-relaxed">
          The requested media item does not exist in the vault or the route has been removed.
        </p>

        <div className="bg-black/50 p-2.5 text-[11px] font-mono text-neutral-400 break-all select-text">
          {attemptedPath}
        </div>

        <div className="bg-[#030508]/45 p-2.5 text-[11px] font-mono text-neutral-400 flex items-center justify-between">
          <span className="text-[#38bdf8] font-bold">ERROR // 404 ROUTE</span>
          <span className="text-neutral-500">MEDIA MISSING</span>
        </div>
      </div>
    </div>
  );
};

export default MediaNotFoundDialog;
