import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Download, X, ArrowUpRight } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { checkAppUpdate, installAppUpdate, type UpdateCheckResult } from '../../utils/updater';
import { hapticMedium } from '../../utils/hapticsManager';

export interface HeaderBrandLogoProps {
  className?: string;
  trackingClass?: string;
  variant?: 'monolith' | 'cspr' | 'minimal';
  onTrigger?: () => void;
}

export const HeaderBrandLogo: React.FC<HeaderBrandLogoProps> = ({
  className = '',
  trackingClass = 'tracking-[0.25em]',
  variant = 'monolith',
  onTrigger,
}) => {
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleLogoClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    hapticMedium();

    // 1. Toggle Concealed Terminal Drawer (Option A)
    if (onTrigger) {
      onTrigger();
    }

    // 2. Silent background update check: Strictly on compiled native Android APK
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await checkAppUpdate();
        if (result && result.hasUpdate) {
          setUpdateResult(result);
          setIsModalOpen(true);
        }
      } catch (err) {
        console.warn('[Updater] Silent check skipped:', err);
      }
    }
  }, [onTrigger]);

  const handleInstall = useCallback(() => {
    if (!updateResult) return;
    hapticMedium();
    installAppUpdate(updateResult.apkUrl);
    setIsModalOpen(false);
  }, [updateResult]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  return (
    <>
      {/* Zero-Clue Brand Header Logo Trigger */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleLogoClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleLogoClick(e as any);
          }
        }}
        aria-label="SARWARCYOU"
        className={`inline-flex items-center select-none bg-transparent border-0 p-0 cursor-default focus:outline-none ${className}`}
      >
        <span
          className={`font-['Roboto_Condensed'] font-black ${trackingClass} text-sm uppercase text-white/95 flex items-center`}
        >
          {variant === 'cspr' ? (
            <>
              SARWAR<span className="text-[#38bdf8]">.CYOU</span>
            </>
          ) : (
            <>
              SARWAR<span className="text-[#00f0ff]">CYOU</span>
            </>
          )}
        </span>
      </div>

      {/* APK Update Available Modal (Native Android Only) */}
      {typeof document !== 'undefined' &&
        isModalOpen &&
        updateResult &&
        Capacitor.isNativePlatform() &&
        createPortal(
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-sm rounded-2xl bg-[#090d16] border border-[#38bdf8]/40 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.95)] flex flex-col gap-4">
              {/* Close Button */}
              <button
                type="button"
                onClick={handleCloseModal}
                className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Title & Version Meta */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#38bdf8]/15 border border-[#38bdf8]/40 flex items-center justify-center text-[#38bdf8] shadow-[0_0_20px_rgba(56,189,248,0.35)]">
                  <Download className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h3 className="font-['Roboto_Condensed'] text-base font-bold tracking-wider text-white uppercase">
                    UPDATE AVAILABLE
                  </h3>
                  <p className="text-[11px] font-mono text-[#38bdf8]">
                    {updateResult.currentVersion} → {updateResult.latestVersion}
                  </p>
                </div>
              </div>

              {/* Release Notes */}
              <div className="bg-black/40 rounded-xl p-3 border border-white/5 text-xs text-slate-300 font-sans max-h-36 overflow-y-auto space-scrollbar">
                <div className="text-[10px] font-mono uppercase text-slate-400 mb-1">RELEASE NOTES:</div>
                <p className="whitespace-pre-line leading-relaxed">
                  {updateResult.releaseNotes || 'Security enhancements, cinematic performance boosts, and latest stability fixes.'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Later
                </button>
                <button
                  type="button"
                  onClick={handleInstall}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-neutral-950 bg-gradient-to-r from-[#0284c7] to-[#38bdf8] hover:from-[#38bdf8] hover:to-[#0284c7] transition-all shadow-[0_0_20px_rgba(56,189,248,0.5)] flex items-center justify-center gap-1.5"
                >
                  <span>INSTALL NOW</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default HeaderBrandLogo;
