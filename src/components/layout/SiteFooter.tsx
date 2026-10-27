import React from 'react';
import { ArrowUp, Sparkles } from 'lucide-react';

export const SiteFooter: React.FC = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="w-full bg-[#050608] border-t border-white/10 px-4 sm:px-8 py-8 mt-20">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#00E5FF]" />
          <span className="text-xs font-mono font-bold tracking-wider text-zinc-300">
            SARWARCYOU MEDIA VAULT
          </span>
          <span className="text-zinc-600 text-xs">•</span>
          <span className="text-zinc-500 text-xs font-mono">
            Direct Cloudflare Edge CDN
          </span>
        </div>

        <button
          type="button"
          onClick={scrollToTop}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/10 transition-colors cursor-pointer text-xs font-mono"
        >
          <span>Back to top</span>
          <ArrowUp className="w-3.5 h-3.5 text-[#00E5FF]" />
        </button>
      </div>
    </footer>
  );
};
