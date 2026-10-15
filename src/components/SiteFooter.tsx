import React from 'react';
import { Mail, ShieldCheck, Sparkles, HelpCircle } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

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
      aria-label="Publisher and Contact Information"
      className={`w-full max-w-7xl mx-auto px-5 sm:px-8 md:px-12 py-16 sm:py-20 select-none font-['Rajdhani',sans-serif] ${className}`}
    >
      {/* Top Brand Divider & Wordmark */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-12">
        <div className="flex items-center gap-3">
          <BrandLogo size="md" />
          <span className="text-[11px] font-mono tracking-widest text-zinc-500 uppercase">
            / MEDIA VAULT
          </span>
        </div>
      </div>

      {/* 3-Column Minimalist Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 text-sm">
        {/* Section 1: Technical Support */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-zinc-300 font-semibold tracking-wider text-base uppercase">
            <HelpCircle className="w-4 h-4 text-zinc-400" />
            <h3>Technical Support</h3>
          </div>
          <p className="text-zinc-400 font-normal leading-relaxed text-sm sm:text-base">
            Experiencing playback or browsing issues? Contact our desk at{' '}
            <a
              href="mailto:support@sarwar.cyou"
              className="footer-mailto-link font-medium"
            >
              support@sarwar.cyou
            </a>
          </p>
        </div>

        {/* Section 2: Inquiries & Concerns */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-zinc-300 font-semibold tracking-wider text-base uppercase">
            <Mail className="w-4 h-4 text-zinc-400" />
            <h3>Inquiries &amp; Concerns</h3>
          </div>
          <p className="text-zinc-400 font-normal leading-relaxed text-sm sm:text-base">
            For formal feedback, notices, or general inquiries, reach us at{' '}
            <a
              href="mailto:contact@sarwar.cyou"
              className="footer-mailto-link font-medium"
            >
              contact@sarwar.cyou
            </a>
          </p>
        </div>

        {/* Section 3: Creator Submissions */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 text-zinc-300 font-semibold tracking-wider text-base uppercase">
            <Sparkles className="w-4 h-4 text-zinc-400" />
            <h3>Creator Submissions</h3>
          </div>
          <p className="text-zinc-400 font-normal leading-relaxed text-sm sm:text-base">
            Interested in featuring your photography or video creations on SARWARCYOU? Submit a publicly accessible Google Drive link (Anyone with the link) to{' '}
            <a
              href="mailto:publisher@sarwar.cyou"
              className="footer-mailto-link font-medium"
            >
              publisher@sarwar.cyou
            </a>{' '}
            for editorial moderation review.
          </p>
        </div>
      </div>

      {/* Discrete Bottom Bar */}
      <div className="mt-14 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs font-mono text-zinc-600">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" />
          <span>CURATED EDITORIAL MEDIA VAULT • ALL RIGHTS RESERVED</span>
        </div>
        <div className="tracking-wider">
          © {CURRENT_YEAR} SARWARCYOU • SARWAR.CYOU
        </div>
      </div>
    </footer>
  );
};
