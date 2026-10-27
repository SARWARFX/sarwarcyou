import React from 'react';
import { ArrowLeft, Search, Sparkles } from 'lucide-react';
import type { AppRoute } from '../../router/routes';

export interface TopNavbarProps {
  currentRoute: AppRoute;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onNavigateHome: () => void;
  onGoBack: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  currentRoute,
  searchQuery,
  onSearchChange,
  onNavigateHome,
  onGoBack,
}) => {
  const isHome = currentRoute.name === 'home';

  return (
    <header className="sticky top-0 z-40 w-full bg-[#07080c]/90 backdrop-blur-2xl border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4 transition-all duration-300">
      {/* Left: Branding & Back Navigation */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {!isHome && (
          <button
            type="button"
            onClick={onGoBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-zinc-300 hover:text-white border border-white/15 transition-all cursor-pointer text-xs font-mono font-medium active:scale-95 flex-shrink-0"
            title="Go back"
          >
            <ArrowLeft className="w-4 h-4 text-[#00E5FF]" />
            <span className="hidden xs:inline">Back</span>
          </button>
        )}

        <button
          type="button"
          onClick={onNavigateHome}
          className="flex items-center gap-2 cursor-pointer select-none group text-left"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#00E5FF]/20 to-cyan-500/10 border border-[#00E5FF]/40 flex items-center justify-center text-[#00E5FF] shadow-[0_0_15px_rgba(0,229,255,0.25)] group-hover:scale-105 transition-transform">
            <Sparkles className="w-4 h-4 fill-current" />
          </div>
          <div>
            <span className="text-sm sm:text-base font-black tracking-wider text-white uppercase font-sans group-hover:text-[#00E5FF] transition-colors">
              SARWAR<span className="text-[#00E5FF]">CYOU</span>
            </span>
            <span className="hidden sm:block text-[9px] font-mono tracking-widest text-zinc-500 uppercase -mt-0.5">
              Vault Stream
            </span>
          </div>
        </button>
      </div>

      {/* Center: Search input */}
      <div className="flex-1 max-w-md mx-2 sm:mx-6">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search media, albums, or keywords..."
            className="w-full bg-white/[0.05] hover:bg-white/[0.08] focus:bg-white/10 text-white placeholder-zinc-500 text-xs sm:text-sm pl-10 pr-4 py-2 rounded-full border border-white/10 focus:border-[#00E5FF]/50 focus:outline-none focus:ring-1 focus:ring-[#00E5FF]/30 transition-all font-sans"
          />
        </div>
      </div>

      {/* Right: Status Pill */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-zinc-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>EDGE CDN</span>
        </div>
      </div>
    </header>
  );
};
