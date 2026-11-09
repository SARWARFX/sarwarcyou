import React, { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export const AppIntroSplash: React.FC = () => {
  const [visible, setVisible] = useState<boolean>(() => {
    if (!Capacitor.isNativePlatform()) return false;
    return true;
  });
  const [fading, setFading] = useState<boolean>(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const fadeTimer = setTimeout(() => {
      setFading(true);
    }, 1500);

    const removeTimer = setTimeout(() => {
      setVisible(false);
    }, 1900);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] bg-[#020408] flex flex-col items-center justify-center select-none pointer-events-none transition-opacity duration-400 ease-out ${
        fading ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
      }`}
      style={{
        fontFamily: "'Roboto Condensed', sans-serif",
      }}
    >
      <div className="relative flex flex-col items-center justify-center gap-6 animate-fade-in">
        {/* Glowing cyan-blue halo behind play glyph */}
        <div className="absolute w-36 h-36 rounded-full bg-gradient-to-tr from-[#0080ff]/30 to-[#00f0ff]/40 blur-2xl animate-pulse" />

        {/* Blue Play Button Emblem matching website favicon */}
        <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center drop-shadow-[0_0_35px_rgba(0,240,255,0.65)]">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" className="w-full h-full">
            <defs>
              <linearGradient id="introCyanBluePlay" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00f0ff" />
                <stop offset="100%" stopColor="#0080ff" />
              </linearGradient>
            </defs>
            <path
              d="M18 10.5C18 7.8 21 6.1 23.3 7.5L53.7 29C55.8 30.2 55.8 33.8 53.7 35L23.3 56.5C21 57.9 18 56.2 18 53.5V10.5Z"
              fill="url(#introCyanBluePlay)"
            />
          </svg>
        </div>

        {/* Brand Typography */}
        <div className="flex flex-col items-center gap-1.5 text-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-[0.25em] text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] uppercase">
            SARWAR<span className="text-[#00f0ff]">CYOU</span>
          </h1>
          <div className="h-0.5 w-16 bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent" />
        </div>
      </div>
    </div>
  );
};
