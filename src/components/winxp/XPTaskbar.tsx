import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  Wifi,
  HardDrive,
  Film,
  Camera,
  Layers,
  Folder,
  Monitor,
  Power,
  LogOut,
  ChevronRight,
} from 'lucide-react';

interface WindowTab {
  id: string;
  title: string;
  icon?: React.ReactNode;
  isMinimized: boolean;
  isActive: boolean;
}

interface XPTaskbarProps {
  windows: WindowTab[];
  onToggleWindow: (id: string) => void;
  onOpenMyComputer: (initialDrive?: 'C:' | 'D:' | 'E:' | 'F:') => void;
  onOpenMediaModal?: (type: 'clip' | 'short' | 'photo') => void;
}

export const XPTaskbar: React.FC<XPTaskbarProps> = ({
  windows,
  onToggleWindow,
  onOpenMyComputer,
}) => {
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');
  const startMenuRef = useRef<HTMLDivElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  // Update live clock every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Close start menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        startMenuRef.current &&
        !startMenuRef.current.contains(e.target as Node) &&
        startButtonRef.current &&
        !startButtonRef.current.contains(e.target as Node)
      ) {
        setIsStartOpen(false);
      }
    };

    if (isStartOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isStartOpen]);

  return (
    <>
      {/* ------------------------------------------------------------- */}
      {/* Windows XP Authentic Luna Two-Column Start Menu */}
      {/* ------------------------------------------------------------- */}
      {isStartOpen && (
        <div
          ref={startMenuRef}
          className="fixed bottom-[30px] left-0 z-[9990] w-96 rounded-t-lg shadow-[0_10px_35px_rgba(0,0,0,0.65)] overflow-hidden border-2 border-[#0055ea] flex flex-col select-none"
          style={{
            fontFamily: 'Tahoma, Arial, sans-serif',
            background: '#ffffff',
          }}
        >
          {/* Blue Gradient Header with User Banner */}
          <div
            className="flex items-center gap-3 px-3 py-2.5 text-white shadow-inner"
            style={{
              background: 'linear-gradient(to right, #0055ea 0%, #2989d8 50%, #207cca 100%)',
              borderBottom: '2px solid #ff9b00',
            }}
          >
            <div className="w-10 h-10 rounded-md border-2 border-white shadow bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-lg">
              S
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-wide drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                Sarwar C You
              </span>
              <span className="text-[11px] text-blue-100">Windows XP Luna Edition</span>
            </div>
          </div>

          {/* Two Columns Body */}
          <div className="flex flex-row min-h-[340px] text-xs">
            {/* Left Column: White background, primary media vaults */}
            <div className="w-1/2 bg-white p-2 flex flex-col justify-between border-r border-[#96bded]">
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsStartOpen(false);
                    onOpenMyComputer('C:');
                  }}
                  className="w-full flex items-center gap-2.5 p-1.5 rounded hover:bg-[#2f71cd] hover:text-white transition-colors text-left group"
                >
                  <div className="w-7 h-7 rounded bg-blue-100 flex items-center justify-center text-blue-700 group-hover:bg-white group-hover:text-blue-700">
                    <Film className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-neutral-800 group-hover:text-white">REALTube</div>
                    <div className="text-[10px] text-neutral-500 group-hover:text-blue-100">Local Disk (C:)</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsStartOpen(false);
                    onOpenMyComputer('D:');
                  }}
                  className="w-full flex items-center gap-2.5 p-1.5 rounded hover:bg-[#2f71cd] hover:text-white transition-colors text-left group"
                >
                  <div className="w-7 h-7 rounded bg-purple-100 flex items-center justify-center text-purple-700 group-hover:bg-white group-hover:text-purple-700">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-neutral-800 group-hover:text-white">Video Clips</div>
                    <div className="text-[10px] text-neutral-500 group-hover:text-blue-100">Video Clips (D:)</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsStartOpen(false);
                    onOpenMyComputer('E:');
                  }}
                  className="w-full flex items-center gap-2.5 p-1.5 rounded hover:bg-[#2f71cd] hover:text-white transition-colors text-left group"
                >
                  <div className="w-7 h-7 rounded bg-emerald-100 flex items-center justify-center text-emerald-700 group-hover:bg-white group-hover:text-emerald-700">
                    <Film className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-neutral-800 group-hover:text-white">Short Clips</div>
                    <div className="text-[10px] text-neutral-500 group-hover:text-blue-100">Short Clips (E:)</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsStartOpen(false);
                    onOpenMyComputer('F:');
                  }}
                  className="w-full flex items-center gap-2.5 p-1.5 rounded hover:bg-[#2f71cd] hover:text-white transition-colors text-left group"
                >
                  <div className="w-7 h-7 rounded bg-amber-100 flex items-center justify-center text-amber-700 group-hover:bg-white group-hover:text-amber-700">
                    <Camera className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-neutral-800 group-hover:text-white">Photography</div>
                    <div className="text-[10px] text-neutral-500 group-hover:text-blue-100">Photos (F:)</div>
                  </div>
                </button>
              </div>

              {/* All Programs Separator */}
              <div className="pt-2 border-t border-neutral-200 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsStartOpen(false);
                    onOpenMyComputer();
                  }}
                  className="w-full flex items-center justify-between p-1.5 rounded hover:bg-[#2f71cd] hover:text-white transition-colors font-bold text-neutral-800 group"
                >
                  <span>All Programs</span>
                  <ChevronRight className="w-4 h-4 text-emerald-600 group-hover:text-white" />
                </button>
              </div>
            </div>

            {/* Right Column: Soft blue-gray system destinations */}
            <div className="w-1/2 bg-[#d3e5fa] p-2 flex flex-col justify-between text-[#0c327d]">
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsStartOpen(false);
                    onOpenMyComputer();
                  }}
                  className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-[#2f71cd] hover:text-white transition-colors text-left font-bold"
                >
                  <Monitor className="w-4 h-4 text-[#0055ea]" />
                  <span>My Computer</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsStartOpen(false);
                    onOpenMyComputer('F:');
                  }}
                  className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-[#2f71cd] hover:text-white transition-colors text-left font-bold"
                >
                  <Folder className="w-4 h-4 text-amber-600" />
                  <span>My Pictures</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsStartOpen(false);
                    onOpenMyComputer('D:');
                  }}
                  className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-[#2f71cd] hover:text-white transition-colors text-left font-bold"
                >
                  <Folder className="w-4 h-4 text-blue-600" />
                  <span>My Videos</span>
                </button>

                <div className="my-1 border-t border-[#b6d3f2]" />

                <button
                  type="button"
                  onClick={() => {
                    setIsStartOpen(false);
                    onOpenMyComputer();
                  }}
                  className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-[#2f71cd] hover:text-white transition-colors text-left"
                >
                  <HardDrive className="w-4 h-4 text-neutral-600" />
                  <span>Drives & Disks</span>
                </button>
              </div>
            </div>
          </div>

          {/* Luna Bottom Bar with Log Off / Turn Off */}
          <div
            className="flex items-center justify-end gap-3 px-3 py-2 bg-gradient-to-r from-[#0055ea] to-[#428eff] text-white text-xs border-t border-[#1237aa]"
          >
            <button
              type="button"
              onClick={() => setIsStartOpen(false)}
              className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/20 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5 text-amber-300" />
              <span>Log Off</span>
            </button>
            <button
              type="button"
              onClick={() => setIsStartOpen(false)}
              className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/20 transition-colors"
            >
              <Power className="w-3.5 h-3.5 text-red-400" />
              <span>Turn Off</span>
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Bottom Luna Taskbar */}
      {/* ------------------------------------------------------------- */}
      <footer
        className="fixed bottom-0 left-0 right-0 h-[30px] z-[9980] flex items-center justify-between select-none shadow-[0_-2px_10px_rgba(0,0,0,0.5)] border-t border-[#428eff]"
        style={{
          background: 'linear-gradient(to bottom, #245edb 0%, #3f8cf3 9%, #245edb 18%, #245edb 92%, #1237aa 100%)',
          fontFamily: 'Tahoma, Arial, sans-serif',
        }}
      >
        {/* Left: Start Button + Open Windows Tabs */}
        <div className="flex items-center h-full gap-1 pl-0">
          {/* Authentic Green Curved XP Start Button */}
          <button
            ref={startButtonRef}
            type="button"
            onClick={() => setIsStartOpen(!isStartOpen)}
            className={`h-full flex items-center gap-1.5 px-3 rounded-r-xl transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.4)] ${
              isStartOpen
                ? 'bg-gradient-to-b from-[#256c24] via-[#31862f] to-[#1c551b] translate-y-[1px]'
                : 'bg-gradient-to-b from-[#388737] via-[#48a946] to-[#2b722a] hover:brightness-110'
            }`}
            style={{
              borderTop: '1px solid #71b870',
              borderRight: '1px solid #1c551b',
              borderBottom: '1px solid #1c551b',
            }}
          >
            {/* Windows XP 4-Color Wave Flag */}
            <svg viewBox="0 0 88 88" className="w-4 h-4 filter drop-shadow">
              <path d="M 10,12 C 22,7 34,16 42,12 C 43,26 43,40 43,40 C 33,44 21,35 10,40 Z" fill="#e73827" />
              <path d="M 45,12 C 54,8 67,16 78,11 C 78,25 78,39 78,39 C 67,43 55,36 45,40 Z" fill="#74b52c" />
              <path d="M 10,43 C 22,38 34,47 42,43 C 43,57 43,71 43,71 C 33,75 21,66 10,71 Z" fill="#0099e5" />
              <path d="M 45,43 C 54,39 67,48 78,43 C 78,57 78,71 78,71 C 67,75 55,67 45,71 Z" fill="#ffb700" />
            </svg>
            <span
              className="text-white font-bold italic text-sm tracking-wide"
              style={{ textShadow: '1px 1px 2px #0e3f0d' }}
            >
              start
            </span>
          </button>

          {/* Window Task Tabs */}
          <div className="flex items-center h-full gap-1 ml-1 overflow-x-auto no-scrollbar">
            {windows.map((win) => (
              <button
                key={win.id}
                type="button"
                onClick={() => onToggleWindow(win.id)}
                className={`h-[24px] max-w-[160px] min-w-[120px] px-2 flex items-center gap-1.5 rounded text-xs truncate transition-all ${
                  win.isActive && !win.isMinimized
                    ? 'bg-gradient-to-b from-[#1b4db7] via-[#225fd8] to-[#1643a5] text-white border border-[#0d2e7a] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)] font-bold'
                    : 'bg-gradient-to-b from-[#3c87f3] via-[#2766dc] to-[#1e54bc] text-white/90 hover:brightness-110 border border-[#1d4bb3]'
                }`}
              >
                {win.icon || <Monitor className="w-3.5 h-3.5 flex-shrink-0" />}
                <span className="truncate">{win.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Notification Area / System Tray */}
        <div
          className="h-full flex items-center gap-2 px-3 border-l border-[#0c327d]"
          style={{
            background: 'linear-gradient(to bottom, #0c80df 0%, #176fce 10%, #0d5bb6 90%, #094791 100%)',
          }}
        >
          <div className="flex items-center gap-1.5 text-white/80">
            <span title="Internet Connected"><Wifi className="w-3.5 h-3.5" /></span>
            <span title="Volume: 100%"><Volume2 className="w-3.5 h-3.5" /></span>
          </div>
          <span
            className="text-white text-xs font-sans tracking-tight pl-1 select-none"
            style={{ textShadow: '0 1px 1px rgba(0,0,0,0.5)' }}
          >
            {currentTime}
          </span>
        </div>
      </footer>
    </>
  );
};
