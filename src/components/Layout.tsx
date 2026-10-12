import React, { useState } from 'react';
import { Play, Search, RefreshCw } from 'lucide-react';
import { useMediaData } from '../useMediaData';


export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { syncMedia } = useMediaData();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    await syncMedia();
    setIsSyncing(false);
  };

  return (
    <div className="min-h-screen bg-[#09090B] text-[#EDEDED] flex flex-col relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#0066FF] rounded-full blur-[150px] opacity-10 pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#00D2FF] rounded-full blur-[150px] opacity-10 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-b-0 border-x-0 border-t-0 rounded-none shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3 group cursor-pointer">
            <div className="relative">
              <div className="absolute inset-0 bg-[#0066FF] blur-md opacity-50 rounded-full group-hover:opacity-100 transition-opacity" />
              <Play className="w-8 h-8 text-[#00D2FF] relative z-10 fill-[#0066FF]" />
            </div>
            <span className="text-xl font-bold tracking-widest text-glow font-space">
              SARWARCYOU
            </span>
          </div>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-medium tracking-wide">
            <a href="#featured" className="hover:text-white transition-colors">Featured</a>
            <a href="#albums" className="hover:text-white transition-colors">Albums</a>
            <a href="#shorts" className="hover:text-white transition-colors">Shorts</a>
            <a href="#vault" className="hover:text-white transition-colors">Vault</a>
          </nav>

          <button className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <Search className="w-5 h-5 text-gray-400 hover:text-white" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow z-10">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-20 py-8 z-10 relative">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between">
          <p className="text-gray-500 text-sm">
            © {2025} SARWARCYOU. All rights reserved.
          </p>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="mt-4 md:mt-0 flex items-center space-x-2 text-sm text-gray-400 hover:text-[#00D2FF] transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>Sync Media</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
