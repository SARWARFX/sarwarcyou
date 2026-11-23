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
 * - 0px border radius, zero outlines, glass translucent backdrop.
 * - Confirms cache clearing for the active subfolder page.
 * - Features "Also delete other media caches" checkbox.
 * - GUARANTEES graphs and telemetry analytics data are NEVER deleted.
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
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none animate-holo-backdrop-in"
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      <div
        className="w-full max-w-[420px] bg-[#0a0d14]/90 backdrop-blur-xl p-5 sm:p-6 text-left shadow-2xl relative transition-all"
        style={{
          borderRadius: 0,
          outline: 'none',
          border: 'none',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* Top Header Strip: Tag & Close Button */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-2 h-2 bg-[#ef4444]"
              style={{
                borderRadius: 0,
                boxShadow: '0 0 8px #ef4444',
              }}
            />
            <span
              className="font-firjar text-[11px] sm:text-xs text-[#ef4444] tracking-wider uppercase font-bold"
              style={{ fontFamily: "'Firjar', 'Science Gothic', sans-serif !important" }}
            >
              // CLEAR CACHE
            </span>
          </div>

          <button
            onClick={() => {
              hapticMedium();
              onClose();
            }}
            aria-label="Close dialog"
            className="text-[#64748b] hover:text-white transition-colors cursor-pointer text-base leading-none p-1 bg-transparent border-none outline-none"
            style={{ borderRadius: 0 }}
          >
            ✕
          </button>
        </div>

        {/* Message / Details */}
        <div className="py-2">
          <p className="text-white text-sm font-medium leading-relaxed">
            {isSpecificPage ? (
              <>
                Are you sure you want to clear cached media for{' '}
                <span className="text-[#ef4444] font-bold">{currentPageName}</span>?
              </>
            ) : (
              'Are you sure you want to clear all cached media across pages?'
            )}
          </p>
          <p className="text-[#64748b] text-[11.5px] mt-2 font-mono leading-relaxed">
            Graphs telemetry and 24-hour analytics data will never be deleted.
          </p>
        </div>

        {/* Checkbox: "Also delete other media caches" */}
        {isSpecificPage && (
          <div
            onClick={() => {
              hapticMedium();
              setAlsoDeleteOther(!alsoDeleteOther);
            }}
            className="flex items-center gap-3 py-3 cursor-pointer select-none group"
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
        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            onClick={() => {
              hapticMedium();
              onClose();
            }}
            disabled={isClearing}
            className="font-firjar px-4 py-2 text-xs uppercase font-medium text-[#94a3b8] hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer border-0 outline-none"
            style={{ borderRadius: 0, fontFamily: "'Firjar', 'Science Gothic', sans-serif !important" }}
          >
            CANCEL
          </button>
          <button
            onClick={handleConfirmClick}
            disabled={isClearing}
            className="font-firjar px-5 py-2 text-xs uppercase font-bold text-white bg-[#ef4444] hover:bg-[#dc2626] transition-colors cursor-pointer border-0 outline-none flex items-center gap-2"
            style={{ borderRadius: 0, fontFamily: "'Firjar', 'Science Gothic', sans-serif !important" }}
          >
            {isClearing ? 'CLEARING...' : 'CLEAR CACHE'}
          </button>
        </div>
      </div>
    </div>
  );
};
