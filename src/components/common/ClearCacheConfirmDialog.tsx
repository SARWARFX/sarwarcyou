import React, { useState, useEffect } from 'react';
import { hapticMedium } from '../../utils/hapticsManager';

export interface ClearCacheConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentPageName: string;
  onConfirm: (deleteAll: boolean) => Promise<void> | void;
}

/**
 * Universal Outline-Free Glass Clear Cache Confirmation Dialog:
 * - 0px border radius, zero outlines, standard translucent glass backdrop.
 * - Perfectly uniform with all site notifications (BatteryStatus, NetworkStatus, MediaNotFound).
 * - Confirms cache clearing for the active subfolder page.
 * - Features "Also delete other media caches" checkbox.
 * - GUARANTEES graphs and telemetry analytics data are NOT affected.
 */
export const ClearCacheConfirmDialog: React.FC<ClearCacheConfirmDialogProps> = ({
  isOpen,
  onClose,
  currentPageName,
  onConfirm,
}) => {
  const [alsoDeleteOther, setAlsoDeleteOther] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Reset checkbox when dialog opens
  useEffect(() => {
    if (isOpen) {
      setAlsoDeleteOther(false);
      setIsClearing(false);
    }
  }, [isOpen]);

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        hapticMedium();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isSpecificPage =
    currentPageName === 'Photographs' ||
    currentPageName === 'Shorts' ||
    currentPageName === 'Video Clips';

  const handleConfirmClick = async () => {
    hapticMedium();
    setIsClearing(true);
    const deleteAll = alsoDeleteOther || !isSpecificPage;
    await onConfirm(deleteAll);
    setIsClearing(false);
    onClose();
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          hapticMedium();
          onClose();
        }
      }}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/45 backdrop-blur-[10px] select-none pointer-events-auto transition-opacity duration-200"
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
        {/* Top Header Strip: Tag & Close Button */}
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-bold font-mono tracking-tight text-[#ef4444] uppercase flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 bg-[#ef4444] shrink-0"
              style={{
                borderRadius: 0,
                boxShadow: '0 0 8px #ef4444',
              }}
            />
            // CLEAR CACHE
          </h3>

          <button
            type="button"
            onClick={() => {
              hapticMedium();
              onClose();
            }}
            aria-label="Close dialog"
            className="w-7 h-7 flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-base font-mono p-0"
            style={{ borderRadius: 0, outline: 'none', border: 'none', background: 'transparent' }}
            title="Close Notification"
          >
            ✕
          </button>
        </div>

        {/* Message / Details */}
        <div className="flex flex-col gap-2">
          <p className="text-xs sm:text-sm text-neutral-200 font-sans leading-relaxed">
            {isSpecificPage ? (
              <>
                Are you sure you want to clear cached media for{' '}
                <span className="text-[#ef4444] font-bold">{currentPageName}</span>?
              </>
            ) : (
              'Are you sure you want to clear all cached media across pages?'
            )}
          </p>
          <p className="text-neutral-400 text-[11.5px] font-mono leading-relaxed">
            Graph telemetry and 24-hour analytics data will not be affected.
          </p>
        </div>

        {/* Checkbox: "Also delete other media caches" */}
        {isSpecificPage && (
          <div
            onClick={() => {
              hapticMedium();
              setAlsoDeleteOther(!alsoDeleteOther);
            }}
            className="flex items-center gap-3 py-1 cursor-pointer select-none group"
          >
            <div
              className={`w-4 h-4 flex items-center justify-center transition-colors ${
                alsoDeleteOther ? 'bg-[#ef4444] text-white' : 'bg-white/10 hover:bg-white/20'
              }`}
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              {alsoDeleteOther && (
                <svg
                  className="w-3 h-3 fill-current"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <span
              className={`text-xs transition-colors ${
                alsoDeleteOther ? 'text-white font-medium' : 'text-[#94a3b8] group-hover:text-white'
              }`}
            >
              Also delete other media caches
            </span>
          </div>
        )}

        {/* Bottom Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              hapticMedium();
              onClose();
            }}
            disabled={isClearing}
            className="px-4 py-2 text-xs uppercase font-medium text-[#94a3b8] hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border-0 outline-none"
            style={{ borderRadius: 0 }}
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={isClearing}
            className="px-5 py-2 text-xs uppercase font-bold text-white bg-[#ef4444] hover:bg-[#dc2626] transition-colors cursor-pointer border-0 outline-none flex items-center gap-2"
            style={{ borderRadius: 0 }}
          >
            {isClearing ? 'CLEARING...' : 'CLEAR CACHE'}
          </button>
        </div>
      </div>
    </div>
  );
};
