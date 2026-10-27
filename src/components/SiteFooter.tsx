import React from 'react';
import { Mail, HelpCircle } from 'lucide-react';

interface SiteFooterProps {
  onBackToTop?: () => void;
  className?: string;
}

const CURRENT_YEAR = new Date().getFullYear();

export const SiteFooter: React.FC<SiteFooterProps> = ({
  className = '',
}) => {
  return (
    <footer
      role="contentinfo"
      aria-label="Contact Information"
      className={`w-full max-w-7xl mx-auto px-4 sm:px-8 py-10 select-none ${className}`}
      style={{ borderTop: '1px solid var(--footer-border)' }}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6">
        {/* Plain text website name without play button */}
        <span
          className="text-base sm:text-lg font-black tracking-widest uppercase font-sans"
          style={{ color: 'var(--text-primary)' }}
        >
          SARWARCYOU
        </span>

        {/* Essential email / contact notification text */}
        <div
          className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-mono"
          style={{ color: 'var(--text-secondary)' }}
        >
          <div className="flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 opacity-60" />
            <span>Contact:</span>
            <a
              href="mailto:contact@sarwar.cyou"
              className="underline hover:opacity-100"
              style={{ color: 'var(--text-primary)' }}
            >
              contact@sarwar.cyou
            </a>
          </div>
          <div className="flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 opacity-60" />
            <span>Support:</span>
            <a
              href="mailto:support@sarwar.cyou"
              className="underline hover:opacity-100"
              style={{ color: 'var(--text-primary)' }}
            >
              support@sarwar.cyou
            </a>
          </div>
        </div>
      </div>

      <div
        className="pt-4 text-[11px] font-mono"
        style={{
          borderTop: '1px solid var(--footer-border)',
          color: 'var(--footer-text)',
        }}
      >
        © {CURRENT_YEAR} SARWARCYOU • sarwar.cyou
      </div>
    </footer>
  );
};

export default SiteFooter;
