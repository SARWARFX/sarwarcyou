import React, { useState, useEffect } from 'react';

export const COMPLIANCE_STORAGE_KEY = 'public_access_disclaimer_accepted';

export interface ComplianceSplashScreenProps {
  onDismiss?: () => void;
}

export const ComplianceSplashScreen: React.FC<ComplianceSplashScreenProps> = ({ onDismiss }) => {
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(COMPLIANCE_STORAGE_KEY) !== 'true';
    } catch {
      return false;
    }
  });

  const [isFadingOut, setIsFadingOut] = useState(false);

  const handleEnterArchive = () => {
    try {
      localStorage.setItem(COMPLIANCE_STORAGE_KEY, 'true');
    } catch {
      // ignore potential storage quota or privacy mode errors
    }
    setIsFadingOut(true);
    setTimeout(() => {
      setIsOpen(false);
      onDismiss?.();
    }, 350);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
        e.preventDefault();
        handleEnterArchive();
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
      aria-label="Public Domain and Open Access Notice"
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center p-6 sm:p-10 select-none bg-[#08090c] text-neutral-100 transition-opacity duration-350 ease-out ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      style={{ fontFamily: '"Times New Roman", Times, Georgia, serif' }}
    >
      <div className="max-w-2xl w-full flex flex-col items-center text-center border border-neutral-800 bg-[#0c0d12]/95 p-8 sm:p-14 shadow-2xl">
        <h1 className="text-base sm:text-lg md:text-xl font-normal tracking-[0.2em] uppercase text-neutral-200 border-b border-neutral-800 pb-4 mb-6 w-full text-center">
          PUBLIC DOMAIN & OPEN ACCESS NOTICE
        </h1>

        <p className="text-sm sm:text-base leading-relaxed text-neutral-400 font-normal mb-8 max-w-xl text-center">
          All media, images, and video materials indexed on this platform are aggregated strictly from publicly accessible online repositories and open databases. This site does not host, broadcast, or distribute proprietary, restricted, or private personal data. All cataloged materials are indexed solely from publicly available sources on the internet.
        </p>

        <button
          type="button"
          onClick={handleEnterArchive}
          className="px-8 py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-600 hover:border-neutral-300 text-neutral-200 hover:text-white text-xs sm:text-sm tracking-[0.25em] uppercase transition-all duration-200 cursor-pointer active:scale-95"
        >
          [ ENTER ARCHIVE ]
        </button>
      </div>
    </div>
  );
};

export default ComplianceSplashScreen;
