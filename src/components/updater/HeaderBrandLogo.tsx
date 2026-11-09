import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Download, X, ArrowUpRight, Loader2, AlertCircle, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import {
  checkAppUpdate,
  AppInstaller,
  formatBytes,
  type UpdateCheckResult,
} from '../../utils/updater';
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

  // In-app download & installer states
  const [isDownloading, setIsDownloading] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [bytesText, setBytesText] = useState('');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [installLaunched, setInstallLaunched] = useState(false);

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

  // Listen to native download progress events
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !isModalOpen) return;

    let subProgress: any = null;
    let subComplete: any = null;
    let subFailed: any = null;

    const setupListeners = async () => {
      try {
        subProgress = await AppInstaller.addListener(
          'downloadProgress',
          (data: { percent: number; bytesReceived: number; totalBytes: number }) => {
            setProgressPercent(data.percent || 0);
            if (data.totalBytes > 0) {
              setBytesText(`${formatBytes(data.bytesReceived)} / ${formatBytes(data.totalBytes)}`);
            } else if (data.bytesReceived > 0) {
              setBytesText(formatBytes(data.bytesReceived));
            }
          }
        );

        subComplete = await AppInstaller.addListener('downloadComplete', () => {
          setIsDownloading(false);
          setProgressPercent(100);
          setInstallLaunched(true);
        });

        subFailed = await AppInstaller.addListener('downloadFailed', (err: { error: string }) => {
          setIsDownloading(false);
          setDownloadError(err.error || 'Download failed');
        });
      } catch (err) {
        console.warn('[Updater] Could not bind native download listeners:', err);
      }
    };

    setupListeners();

    return () => {
      if (subProgress && subProgress.remove) subProgress.remove();
      if (subComplete && subComplete.remove) subComplete.remove();
      if (subFailed && subFailed.remove) subFailed.remove();
    };
  }, [isModalOpen]);

  const startInAppDownload = useCallback(async (apkUrl: string) => {
    setIsDownloading(true);
    setProgressPercent(0);
    setBytesText('Connecting...');
    setDownloadError(null);
    setInstallLaunched(false);

    try {
      await AppInstaller.downloadAndInstall({
        url: apkUrl,
        fileName: 'SARWARCYOU-latest.apk',
      });
    } catch (err: any) {
      console.warn('[Updater] Native download error:', err);
      setIsDownloading(false);
      setDownloadError(err?.message || 'Download failed. Please try again.');
    }
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!updateResult) return;
    hapticMedium();

    // Check unknown app installation permission on Android 8.0+
    try {
      const perm = await AppInstaller.canRequestPackageInstalls();
      if (perm && perm.value === false) {
        setNeedsPermission(true);
        return;
      }
    } catch (err) {
      console.warn('[Updater] canRequestPackageInstalls check error:', err);
    }

    startInAppDownload(updateResult.apkUrl);
  }, [updateResult, startInAppDownload]);

  const handleGrantPermission = useCallback(async () => {
    hapticMedium();
    try {
      await AppInstaller.openInstallSettings();
      setNeedsPermission(false);
    } catch (err) {
      console.warn('[Updater] openInstallSettings error:', err);
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    if (isDownloading) {
      const confirmClose = window.confirm('A download is in progress. Are you sure you want to exit?');
      if (!confirmClose) return;
    }
    setIsModalOpen(false);
    setIsDownloading(false);
    setDownloadError(null);
    setNeedsPermission(false);
    setInstallLaunched(false);
  }, [isDownloading]);

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
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
            <div className="relative w-full max-w-sm rounded-2xl bg-[#090d16] border border-[#38bdf8]/40 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.95)] flex flex-col gap-4">
              {/* Close Button */}
              {!isDownloading && (
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Title & Version Meta */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#38bdf8]/15 border border-[#38bdf8]/40 flex items-center justify-center text-[#38bdf8] shadow-[0_0_20px_rgba(56,189,248,0.35)] shrink-0">
                  {isDownloading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : installLaunched ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  ) : needsPermission ? (
                    <ShieldAlert className="w-5 h-5 text-amber-400" />
                  ) : (
                    <Download className="w-5 h-5 animate-bounce" />
                  )}
                </div>
                <div>
                  <h3 className="font-['Roboto_Condensed'] text-base font-bold tracking-wider text-white uppercase">
                    {isDownloading
                      ? 'DOWNLOADING UPDATE'
                      : installLaunched
                      ? 'INSTALLER LAUNCHED'
                      : needsPermission
                      ? 'PERMISSION REQUIRED'
                      : 'UPDATE AVAILABLE'}
                  </h3>
                  <p className="text-[11px] font-mono text-[#38bdf8]">
                    {updateResult.currentVersion} → {updateResult.latestVersion}
                  </p>
                </div>
              </div>

              {/* MAIN CONTENT AREA */}
              {needsPermission ? (
                /* Permission Prompt */
                <div className="bg-amber-500/10 rounded-xl p-3.5 border border-amber-500/30 flex flex-col gap-2 text-xs text-amber-200">
                  <div className="font-bold flex items-center gap-1.5 text-amber-300">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>Allow Unknown Apps</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-200/90">
                    Android requires one-time permission to allow SARWARCYOU to install updates directly without opening a browser.
                  </p>
                  <button
                    type="button"
                    onClick={handleGrantPermission}
                    className="mt-1 w-full py-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md"
                  >
                    Open Settings & Allow
                  </button>
                </div>
              ) : isDownloading ? (
                /* In-App Download Progress View */
                <div className="bg-black/40 rounded-xl p-4 border border-white/5 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300">Progress</span>
                    <span className="text-[#38bdf8] font-bold">{progressPercent}%</span>
                  </div>

                  {/* Animated Progress Bar */}
                  <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden p-0.5">
                    <div
                      className="bg-gradient-to-r from-[#0284c7] via-[#38bdf8] to-[#7dd3fc] h-full rounded-full transition-all duration-150 shadow-[0_0_10px_#38bdf8]"
                      style={{ width: `${Math.max(progressPercent, 4)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>{bytesText || 'Downloading...'}</span>
                    <span className="text-[#38bdf8]/80 animate-pulse">DIRECT STREAM</span>
                  </div>
                </div>
              ) : installLaunched ? (
                /* Post-Download / Installation Prompt Opened */
                <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/30 flex flex-col gap-2 text-xs text-emerald-200 text-center">
                  <p className="font-semibold text-emerald-300">
                    Package download complete!
                  </p>
                  <p className="text-[11px] text-emerald-200/80">
                    Android has opened the native package installer prompt. Confirm the installation dialog to update the application.
                  </p>
                </div>
              ) : (
                /* Release Notes View */
                <div className="bg-black/40 rounded-xl p-3 border border-white/5 text-xs text-slate-300 font-sans max-h-36 overflow-y-auto space-scrollbar">
                  <div className="text-[10px] font-mono uppercase text-slate-400 mb-1">RELEASE NOTES:</div>
                  <p className="whitespace-pre-line leading-relaxed">
                    {updateResult.releaseNotes || 'Security enhancements, broadsheet editorial layout, and latest stability fixes.'}
                  </p>
                </div>
              )}

              {/* Download Error Display */}
              {downloadError && (
                <div className="bg-rose-500/15 rounded-xl p-2.5 border border-rose-500/30 flex items-start gap-2 text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold">Update Failed</span>
                    <span className="text-[11px] text-rose-300/80 leading-snug">{downloadError}</span>
                  </div>
                </div>
              )}

              {/* ACTION BUTTONS */}
              {!isDownloading && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    {installLaunched ? 'Close' : 'Later'}
                  </button>

                  {!installLaunched && (
                    <button
                      type="button"
                      onClick={handleInstallClick}
                      className="flex-1 py-2 rounded-xl text-xs font-bold text-neutral-950 bg-gradient-to-r from-[#0284c7] to-[#38bdf8] hover:from-[#38bdf8] hover:to-[#0284c7] transition-all shadow-[0_0_20px_rgba(56,189,248,0.5)] flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>{downloadError ? 'RETRY' : 'INSTALL NOW'}</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default HeaderBrandLogo;
