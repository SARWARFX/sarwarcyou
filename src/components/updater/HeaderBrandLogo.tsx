import React, { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles, Download, CheckCircle2, AlertCircle, Loader2, X, ArrowUpRight } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { checkAppUpdate, installAppUpdate, type UpdateCheckResult } from '../../utils/updater';
import { hapticMedium } from '../../utils/hapticsManager';

export interface HeaderBrandLogoProps {
  className?: string;
  trackingClass?: string;
  variant?: 'monolith' | 'cspr' | 'minimal';
}

type ToastState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'upToDate'; version: string }
  | { status: 'error'; message: string };

export const HeaderBrandLogo: React.FC<HeaderBrandLogoProps> = ({
  className = '',
  trackingClass = 'tracking-[0.25em]',
  variant = 'monolith',
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [toast, setToast] = useState<ToastState>({ status: 'idle' });
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((newToast: ToastState, autoDismissMs?: number) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(newToast);
    if (autoDismissMs) {
      toastTimerRef.current = setTimeout(() => {
        setToast({ status: 'idle' });
      }, autoDismissMs);
    }
  }, []);

  const handleLogoClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Web platform guard: APK updater strictly restricted to native Android
    if (!Capacitor.isNativePlatform()) {
      console.log('[Updater] Update check bypassed: running on web browser.');
      hapticMedium();
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    if (isChecking) return;

    hapticMedium();
    setIsChecking(true);
    showToast({ status: 'checking' });

    try {
      const result = await checkAppUpdate();
      setIsChecking(false);

      if (result && result.hasUpdate) {
        showToast({ status: 'idle' });
        setUpdateResult(result);
        setIsModalOpen(true);
      } else if (result) {
        showToast({ status: 'upToDate', version: result.currentVersion }, 2800);
      }
    } catch (err: any) {
      setIsChecking(false);
      showToast({ status: 'error', message: 'Could not connect to update server' }, 3200);
    }
  }, [isChecking, showToast]);

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
      {/* Interactive Logo Trigger */}
      <button
        type="button"
        onClick={handleLogoClick}
        title={Capacitor.isNativePlatform() ? "SARWARCYOU - Tap to check for updates" : "SARWARCYOU"}
        aria-label={Capacitor.isNativePlatform() ? "Check for updates" : "SARWARCYOU"}
        className={`inline-flex items-center gap-2 group cursor-pointer select-none bg-transparent border-0 p-0 active:scale-95 transition-transform duration-150 focus:outline-none ${className}`}
      >
        <span
          className={`font-['Roboto_Condensed'] font-black ${trackingClass} text-sm uppercase text-white/95 group-hover:text-white transition-all flex items-center gap-1.5 ${
            isChecking ? 'animate-pulse text-[#38bdf8] drop-shadow-[0_0_12px_rgba(56,189,248,0.8)]' : ''
          }`}
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

        {/* Subtle Online Status / Update Available Pip */}
        <span
          className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
            isChecking
              ? 'bg-[#38bdf8] scale-150 shadow-[0_0_8px_#38bdf8]'
              : 'bg-emerald-400 group-hover:scale-125 group-hover:shadow-[0_0_8px_#34d399]'
          }`}
        />
      </button>

      {/* Floating Cyber Toast Feedback (rendered via portal to body) */}
      {typeof document !== 'undefined' &&
        toast.status !== 'idle' &&
        createPortal(
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[99999] pointer-events-none animate-slide-down">
            <div className="pointer-events-auto flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/85 backdrop-blur-xl border border-white/15 text-white shadow-[0_10px_30px_rgba(0,0,0,0.85)] text-xs font-mono tracking-wider">
              {toast.status === 'checking' && (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#38bdf8]" />
                  <span>Checking for updates...</span>
                </>
              )}
              {toast.status === 'upToDate' && (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>You are running the latest version ({toast.version})</span>
                </>
              )}
              {toast.status === 'error' && (
                <>
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>{toast.message}</span>
                </>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* Sleek Cyber Update Available Modal Overlay (Strictly Native Android only) */}
      {typeof document !== 'undefined' &&
        Capacitor.isNativePlatform() &&
        isModalOpen &&
        updateResult &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
            onClick={handleCloseModal}
          >
            <div
              className="relative w-full max-w-sm rounded-2xl bg-[#030712] border border-[#38bdf8]/40 p-6 shadow-[0_0_50px_rgba(56,189,248,0.25)] flex flex-col items-center text-center select-none overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Background Cyber Glow */}
              <div className="absolute -top-12 -right-12 w-32 h-32 bg-[#38bdf8]/15 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-[#0284c7]/15 rounded-full blur-2xl pointer-events-none" />

              {/* Close Button */}
              <button
                type="button"
                onClick={handleCloseModal}
                className="absolute top-4 right-4 p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header Icon & Title */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0284c7]/30 to-[#38bdf8]/20 border border-[#38bdf8]/40 flex items-center justify-center mb-4 shadow-[0_0_15px_rgba(56,189,248,0.3)]">
                <Sparkles className="w-6 h-6 text-[#38bdf8] animate-pulse" />
              </div>

              <h2 className="text-base font-black font-['Roboto_Condensed'] tracking-[0.2em] text-white uppercase mb-1">
                UPDATE AVAILABLE
              </h2>
              <p className="text-xs text-neutral-300 font-sans leading-relaxed mb-4">
                A new version (<span className="text-[#38bdf8] font-mono font-bold">{updateResult.latestVersion}</span>) is ready for installation.
              </p>

              {/* Version Comparison Pill */}
              <div className="w-full py-2.5 px-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-around text-xs font-mono mb-5">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-widest">CURRENT</span>
                  <span className="text-neutral-300 font-bold">{updateResult.currentVersion}</span>
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#38bdf8]" />
                <div className="flex flex-col items-center">
                  <span className="text-[10px] text-[#38bdf8]/70 uppercase tracking-widest">LATEST</span>
                  <span className="text-[#38bdf8] font-bold">{updateResult.latestVersion}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleInstall}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#0284c7] to-[#38bdf8] text-neutral-950 font-['Roboto_Condensed'] font-black tracking-widest text-xs uppercase shadow-[0_0_20px_rgba(56,189,248,0.5)] hover:shadow-[0_0_30px_rgba(56,189,248,0.8)] active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>[ INSTALL UPDATE ]</span>
                </button>

                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-full py-2.5 px-4 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-neutral-300 font-['Roboto_Condensed'] font-bold tracking-widest text-xs uppercase active:scale-95 transition-all cursor-pointer border border-white/10"
                >
                  [ LATER ]
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
