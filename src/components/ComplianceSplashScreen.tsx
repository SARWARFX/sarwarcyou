import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export const COMPLIANCE_STORAGE_KEY = 'public_notice_acknowledged_v3';

export interface ComplianceSplashScreenProps {
  onDismiss?: () => void;
}

export const ComplianceSplashScreen: React.FC<ComplianceSplashScreenProps> = ({ onDismiss }) => {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return sessionStorage.getItem(COMPLIANCE_STORAGE_KEY) !== 'true';
    } catch {
      return false;
    }
  });

  const [isFadingOut, setIsFadingOut] = useState(false);

  const handleDismiss = () => {
    try {
      sessionStorage.setItem(COMPLIANCE_STORAGE_KEY, 'true');
    } catch {
      // ignore potential storage quota or privacy mode errors
    }
    setIsFadingOut(true);
    setTimeout(() => {
      setIsOpen(false);
      onDismiss?.();
    }, 280);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        if (e.cancelable) e.preventDefault();
        handleDismiss();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Public Content Notification"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleDismiss();
        }
      }}
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 select-none bg-black/60 backdrop-blur-md transition-opacity duration-300 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100 pointer-events-auto'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md sm:max-w-lg bg-[#04070c]/90 sm:bg-[#04070c]/85 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_40px_rgba(56,189,248,0.12)] p-6 sm:p-8 relative flex flex-col items-center text-center animate-fade-in"
      >
        {/* Close Button Top-Right */}
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-white/50 hover:text-white p-1 rounded-full hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
          title="Dismiss Notice (Esc)"
          aria-label="Close Notice"
        >
          <X className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Pulsing Ethereal Indicator */}
        <div className="w-2.5 h-2.5 rounded-full bg-[#38bdf8] shadow-[0_0_12px_#38bdf8] animate-pulse mb-3.5" />

        {/* Notice Title */}
        <h2 className="text-[11px] sm:text-xs font-['Google Sans'] font-medium tracking-[0.24em] uppercase text-white pb-2.5 mb-3 border-b border-white/10 w-full text-center drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
          PUBLIC DOMAIN & OPEN ACCESS NOTICE
        </h2>

        {/* Notice Body */}
        <p className="text-xs sm:text-sm md:text-[13px] leading-relaxed text-slate-300 font-['Google Sans'] font-normal my-3 max-w-sm sm:max-w-md text-center">
          All content featured across this platform has been collected exclusively from publicly available sources on the internet. No private video, image, or shorts has been published or hosted on this site.
        </p>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleDismiss}
          className="mt-4 font-['Google Sans'] font-medium text-xs md:text-sm tracking-[0.28em] uppercase text-slate-400 hover:text-white transition-all duration-300 hover:drop-shadow-[0_0_16px_rgba(255,255,255,0.7)] cursor-pointer bg-transparent border-none outline-none py-2 px-4"
        >
          ENTER ARCHIVE
        </button>
      </div>
    </div>
  );
};

export default ComplianceSplashScreen;
