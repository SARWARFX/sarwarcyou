import React, { useMemo } from 'react';
import { Newspaper as NewspaperIcon, ArrowUpRight } from 'lucide-react';
import type { CelebrityNewsItem } from './CelebrityShowcase';

export interface CelebrityNewsPaperProps {
  articles: CelebrityNewsItem[];
  onResetFilter?: () => void;
  activeFilter?: string;
}

function formatDate(date: Date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatTimeAgo(isoString: string): string {
  try {
    const pub = new Date(isoString).getTime();
    if (isNaN(pub)) return 'recently';
    const diffMs = Date.now() - pub;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin === 1) return '1 minute ago';
    if (diffMin < 60) return `${diffMin} minutes ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr === 1) return '1 hour ago';
    if (diffHr < 24) return `${diffHr} hours ago`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return 'yesterday';
    if (diffDay < 7) return `${diffDay} days ago`;
    return new Date(isoString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'recently';
  }
}

export const CelebrityNewsPaper: React.FC<CelebrityNewsPaperProps> = ({
  articles,
  onResetFilter,
  activeFilter = 'ALL',
}) => {
  const currentDateFormatted = useMemo(() => formatDate(), []);

  // Partition articles into Lead Story, Secondary Column Stories, and Right Wire Dispatches
  const leadArticle = articles.length > 0 ? articles[0] : null;
  const secondaryArticles = articles.slice(1, 9);
  const wireTelegrams = articles.slice(9, 22);

  if (articles.length === 0) {
    return (
      <div className="newspaper-container rounded-2xl text-center py-20 px-6 flex flex-col items-center justify-center">
        <NewspaperIcon className="w-10 h-10 text-neutral-600 mb-4" />
        <h2 className="font-['Playfair_Display'] text-2xl font-bold text-[#f4f4f5] mb-2">
          No dispatches recorded today.
        </h2>
        <p className="font-serif italic text-sm text-neutral-400 max-w-md mb-6">
          There are currently no verified reports on file for {activeFilter === 'ALL' ? 'the selected filter' : activeFilter}.
        </p>
        {onResetFilter && (
          <button
            type="button"
            onClick={onResetFilter}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 border border-white/10 text-xs tracking-wider uppercase transition-all cursor-pointer"
          >
            Return to General Front Page
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="newspaper-container rounded-2xl my-2">
      {/* 1. BROADSHEET MASTHEAD */}
      <header className="newspaper-masthead">
        {/* Top Dateline & Publication Issue Bar */}
        <div className="masthead-top-bar flex-wrap gap-2">
          <span>DAILY CELEBRITY DISPATCH</span>
          <span className="font-serif italic text-neutral-400">{currentDateFormatted}</span>
          <span>EDITORIAL EDITION</span>
        </div>

        {/* Elegant Broadsheet Masthead Title */}
        <h1 className="masthead-title">THE CELEBRITY CHRONICLE</h1>

        {/* Sub-Motto Rule */}
        <p className="masthead-motto">
          Curated High-Definition Portraits &amp; Verified Editorial Intelligence
        </p>

        {/* Subtle Double Hairline Rule */}
        <div className="newspaper-double-rule" />
      </header>

      {/* 2. BROADSHEET EDITORIAL GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
        {/* LEFT / CENTER SPREAD: LEAD FEATURE & COLUMNAR STORIES (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-10">
          {/* LEAD STORY SPREAD */}
          {leadArticle && (
            <article className="border-b border-white/[0.08] pb-10 flex flex-col gap-4">
              {/* Clean Typographic Byline */}
              <div className="text-xs text-neutral-400 tracking-wide font-sans">
                <span className="text-neutral-200 font-medium">{leadArticle.celebrity}</span>
                <span className="mx-2 text-neutral-600">·</span>
                <span>{leadArticle.source}</span>
                <span className="mx-2 text-neutral-600">·</span>
                <span>{formatTimeAgo(leadArticle.publishedAt)}</span>
              </div>

              {/* Giant Serif Lead Headline */}
              <h2 className="font-['Playfair_Display'] text-2xl sm:text-3xl lg:text-[36px] font-bold text-[#f4f4f5] leading-[1.2] tracking-tight hover:text-white transition-colors">
                <a href={leadArticle.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {leadArticle.headline}
                </a>
              </h2>

              {/* Hero Photo (if available) with Editorial Caption */}
              {leadArticle.imageUrl && (
                <div className="w-full rounded-lg overflow-hidden border border-white/[0.08] bg-[#121215] relative mt-1">
                  <img
                    src={leadArticle.imageUrl}
                    alt={leadArticle.headline}
                    loading="lazy"
                    className="w-full max-h-[440px] object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="px-3.5 py-2 bg-[#09090b]/90 border-t border-white/[0.06] text-xs font-serif italic text-neutral-400">
                    Photograph: {leadArticle.celebrity} via {leadArticle.source}.
                  </div>
                </div>
              )}

              {/* Body Text with Editorial Drop Cap */}
              <p className="article-body newspaper-drop-cap mt-1">
                {leadArticle.summary}
              </p>

              {/* Read Full Story Link */}
              <div className="pt-1">
                <a
                  href={leadArticle.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="article-link group inline-flex items-center gap-1.5 text-xs text-neutral-300 hover:text-white transition-colors"
                >
                  <span className="underline underline-offset-4 decoration-neutral-600 group-hover:decoration-white">Read Full Story</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-neutral-400 group-hover:text-white transition-colors" />
                </a>
              </div>
            </article>
          )}

          {/* SECONDARY STORIES (Multi-Column Print Flow) */}
          <div className="newspaper-columns">
            {secondaryArticles.map((article) => (
              <article key={article.id} className="newspaper-article">
                {/* Byline */}
                <div className="text-[11px] text-neutral-400 mb-2">
                  <span className="text-neutral-300 font-medium">{article.celebrity}</span>
                  <span className="mx-1.5 text-neutral-600">·</span>
                  <span>{article.source}</span>
                  <span className="mx-1.5 text-neutral-600">·</span>
                  <span>{formatTimeAgo(article.publishedAt)}</span>
                </div>

                {/* Headline */}
                <h3 className="article-headline">
                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    {article.headline}
                  </a>
                </h3>

                {/* Thumbnail */}
                {article.imageUrl && (
                  <div className="w-full h-40 rounded-lg overflow-hidden border border-white/[0.08] mb-3 bg-[#121215]">
                    <img
                      src={article.imageUrl}
                      alt={article.headline}
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}

                {/* Body Paragraph */}
                <p className="article-body">
                  {article.summary}
                </p>

                {/* Read Link */}
                <div className="pt-2">
                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="article-link group inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-white transition-colors"
                  >
                    <span className="underline underline-offset-4 decoration-neutral-700 group-hover:decoration-white">Read Story</span>
                    <ArrowUpRight className="w-3 h-3 text-neutral-500 group-hover:text-white transition-colors" />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* RIGHT COLUMN: COMPACT NEWS DISPATCH LIST (4 Cols) */}
        <aside className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-white/[0.08] pt-6 lg:pt-0 lg:pl-8 flex flex-col gap-6">
          <div className="border-b border-white/[0.08] pb-3">
            <h3 className="font-['Playfair_Display'] text-lg font-bold text-[#f4f4f5] tracking-wide">
              Latest Dispatches
            </h3>
            <p className="text-xs text-neutral-500 mt-0.5">
              Continuous editorial coverage and syndicated reports
            </p>
          </div>

          <div className="flex flex-col divide-y divide-white/[0.06]">
            {wireTelegrams.length === 0 && (
              <p className="text-xs font-serif text-neutral-400 py-4 italic">
                All available reports featured on the main front spread.
              </p>
            )}

            {wireTelegrams.map((wire, idx) => {
              return (
                <div key={wire.id || idx} className="py-4 first:pt-0 last:pb-0 flex flex-col gap-1.5 group">
                  {/* Celebrity Tag / Source */}
                  <div className="flex items-center justify-between text-[11px] text-neutral-500 tracking-wider uppercase">
                    <span className="font-medium text-neutral-400">{wire.celebrity} · {wire.source}</span>
                    <span>{formatTimeAgo(wire.publishedAt)}</span>
                  </div>

                  {/* Direct Headline */}
                  <a
                    href={wire.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-['Playfair_Display'] text-[15px] sm:text-[16px] font-semibold text-[#f4f4f5] group-hover:text-white transition-colors leading-snug"
                  >
                    {wire.headline}
                  </a>

                  {wire.summary && (
                    <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                      {wire.summary}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Minimalist Colophon */}
          <div className="mt-auto pt-6 border-t border-white/[0.08] text-[11px] text-neutral-500 flex flex-col gap-1 text-center font-sans">
            <span>The Celebrity Chronicle · Global Editorial Bureau</span>
            <span className="text-neutral-600">Verified syndicated entertainment reports</span>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CelebrityNewsPaper;
