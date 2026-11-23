import React, { useState, useEffect } from 'react';
import { hapticMedium } from '../../utils/hapticsManager';
import { isIos, hasDeferredPrompt, promptPwaInstall } from '../../utils/pwaInstallManager';

export interface AddToHomeScreenDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddToHomeScreenDialog: React.FC<AddToHomeScreenDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const [canPrompt, setCanPrompt] = useState(false);
  const [iosDevice, setIosDevice] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCanPrompt(hasDeferredPrompt());
      setIosDevice(isIos());
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

  const handleInstallClick = async () => {
    hapticMedium();
    const result = await promptPwaInstall();
    if (result === 'accepted' || result === 'dismissed' || result === 'unavailable') {
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          hapticMedium();
          onClose();
        }
      }}
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[12px] select-none pointer-events-auto transition-opacity duration-200"
      style={{ borderRadius: 0, outline: 'none', border: 'none' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md p-6 sm:p-7 shadow-[0_30px_80px_rgba(0,0,0,0.75)] cursor-default text-white flex flex-col gap-5 animate-scale-in"
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
        {/* Top Header: Badge & Close Button */}
        <div className="flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-bold font-mono tracking-tight text-[#38bdf8] uppercase flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 bg-[#38bdf8] shrink-0"
              style={{
                borderRadius: 0,
                boxShadow: '0 0 8px #38bdf8',
              }}
            />
            // ADD TO HOME SCREEN
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
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Brand Icon & Heading */}
        <div className="flex items-center gap-4">
          <img
            src="/icon-192.png"
            alt="Sarwar C You Emblem"
            className="w-12 h-12 shrink-0 object-contain border border-white/10 p-1 bg-black/40 shadow-[0_0_15px_rgba(56,189,248,0.25)]"
            style={{ borderRadius: 0 }}
          />
          <div className="flex flex-col">
            <span className="text-base sm:text-lg font-bold font-mono text-white tracking-wide">
              Sarwar C You
            </span>
            <span className="text-xs text-white/60 font-mono tracking-normal">
              High-Tech Media Vault &amp; Photographic Experience
            </span>
          </div>
        </div>

        {/* Content Body */}
        {iosDevice ? (
          <div className="flex flex-col gap-3 font-mono text-xs sm:text-[13px] text-white/80 bg-white/[0.03] p-4 border border-white/5">
            <p className="text-white/90 font-medium">
              Install on your iPhone or iPad for an address-bar-free standalone experience:
            </p>
            <div className="flex flex-col gap-2.5 pt-1 text-white/70">
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 flex items-center justify-center bg-[#38bdf8]/15 text-[#38bdf8] text-xs font-bold shrink-0">1</span>
                <span>Tap the <strong className="text-white">Share</strong> button <span className="text-[#38bdf8] text-sm">⎋</span> in Safari's bottom toolbar.</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 flex items-center justify-center bg-[#38bdf8]/15 text-[#38bdf8] text-xs font-bold shrink-0">2</span>
                <span>Scroll down and tap <strong className="text-white">"Add to Home Screen"</strong> <span className="text-[#38bdf8] text-sm">⊞</span>.</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 flex items-center justify-center bg-[#38bdf8]/15 text-[#38bdf8] text-xs font-bold shrink-0">3</span>
                <span>Tap <strong className="text-white">Add</strong> in the top-right corner to finish.</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 font-mono text-xs sm:text-[13px] text-white/75 leading-relaxed">
            <p>
              Install Sarwar C You directly to your home screen or desktop.
            </p>
            <ul className="list-disc list-inside text-white/60 space-y-1 pt-1">
              <li>Full-screen cinematic view with zero browser address bars</li>
              <li>Instant 0ms launch right from your device apps</li>
              <li>Faster navigation and smooth offline performance</li>
            </ul>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {iosDevice ? (
            <button
              type="button"
              onClick={() => {
                hapticMedium();
                onClose();
              }}
              className="px-5 py-2 text-xs sm:text-sm font-bold font-mono tracking-wider text-black bg-[#38bdf8] hover:bg-[#7dd3fc] transition-colors cursor-pointer uppercase"
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              GOT IT
            </button>
          ) : canPrompt ? (
            <>
              <button
                type="button"
                onClick={() => {
                  hapticMedium();
                  onClose();
                }}
                className="px-4 py-2 text-xs sm:text-sm font-bold font-mono tracking-wider text-white/60 hover:text-white transition-colors cursor-pointer uppercase bg-transparent"
                style={{ borderRadius: 0, outline: 'none', border: 'none' }}
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleInstallClick}
                className="px-5 py-2 text-xs sm:text-sm font-bold font-mono tracking-wider text-white bg-[#ef4444] hover:bg-[#dc2626] transition-colors cursor-pointer uppercase shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                style={{ borderRadius: 0, outline: 'none', border: 'none' }}
              >
                INSTALL APP
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                hapticMedium();
                onClose();
              }}
              className="px-5 py-2 text-xs sm:text-sm font-bold font-mono tracking-wider text-white bg-white/10 hover:bg-white/20 transition-colors cursor-pointer uppercase"
              style={{ borderRadius: 0, outline: 'none', border: 'none' }}
            >
              CLOSE
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
