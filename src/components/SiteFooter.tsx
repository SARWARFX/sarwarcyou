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
      className={`hidden md:block w-full max-w-7xl mx-auto px-4 sm:px-8 py-8 select-none ${className}`}
      style={{ borderTop: '1px solid var(--footer-border)' }}
    >
      <div
        className="flex flex-row items-center justify-center flex-wrap gap-x-6 gap-y-2 text-xs font-mono"
        style={{ color: 'var(--text-secondary)' }}
      >
        <div className="flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5 opacity-60" />
          <span>Contact:</span>
          <a
            href="mailto:contact@sarwar.cyou"
            className="underline hover:opacity-100 transition-opacity"
            style={{ color: 'var(--text-primary)' }}
          >
            contact@sarwar.cyou
          </a>
        </div>
        <span className="text-zinc-500 opacity-40">•</span>
        <div className="flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 opacity-60" />
          <span>Support:</span>
          <a
            href="mailto:support@sarwar.cyou"
            className="underline hover:opacity-100 transition-opacity"
            style={{ color: 'var(--text-primary)' }}
          >
            support@sarwar.cyou
          </a>
        </div>
        <span className="text-zinc-500 opacity-40">•</span>
        <div className="text-[11px]" style={{ color: 'var(--footer-text)' }}>
          © {CURRENT_YEAR} sarwar.cyou
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
