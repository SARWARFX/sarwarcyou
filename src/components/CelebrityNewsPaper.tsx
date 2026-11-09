import React, { useMemo } from 'react';
import { ExternalLink, Radio, Newspaper as NewspaperIcon, ArrowUpRight } from 'lucide-react';
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
  }).toUpperCase();
}

function formatTimeAgo(isoString: string): string {
  try {
    const pub = new Date(isoString).getTime();
    if (isNaN(pub)) return 'RECENT';
    const diffMs = Date.now() - pub;
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'JUST NOW';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}M AGO`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}H AGO`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay === 1) return 'YESTERDAY';
    if (diffDay < 7) return `${diffDay}D AGO`;
    return new Date(isoString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    }).toUpperCase();
  } catch {
    return 'RECENT';
  }
}

export const CelebrityNewsPaper: React.FC<CelebrityNewsPaperProps> = ({
  articles,
  onResetFilter,
  activeFilter = 'ALL',
}) => {
  const currentDateFormatted = useMemo(() => formatDate(), []);

  // Partition articles into Lead Story, Secondary Column Stories, and Wire Dispatches
  const leadArticle = articles.length > 0 ? articles[0] : null;
  const secondaryArticles = articles.slice(1, 10);
  const wireTelegrams = articles.slice(10, 22);

  if (articles.length === 0) {
    return (
      <div className="newspaper-container rounded-2xl text-center py-20 px-6 flex flex-col items-center justify-center">
        <NewspaperIcon className="w-12 h-12 text-slate-500 mb-4 opacity-50" />
        <h2 className="font-['Playfair_Display'] text-2xl font-bold text-white mb-2">
          No Dispatches on File
        </h2>
        <p className="font-serif italic text-sm text-slate-400 max-w-md mb-6">
          The telegraph wires currently carry no verified reports concerning {activeFilter === 'ALL' ? 'the selected filter' : activeFilter}.
        </p>
        {onResetFilter && (
          <button
            type="button"
            onClick={onResetFilter}
            className="px-4 py-2 rounded-lg bg-[#38bdf8]/15 hover:bg-[#38bdf8]/25 text-[#38bdf8] border border-[#38bdf8]/30 font-mono text-xs uppercase tracking-wider transition-all"
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
          <span>DAILY BOLLYWOOD DISPATCH • LATE CITY EDITION</span>
          <span className="font-bold text-slate-300">{currentDateFormatted}</span>
          <span>VOL. XXVIII NO. 312 • FREE ISSUE • 4K WIRE</span>
        </div>

        {/* Vintage Gothic / Broadsheet Masthead Title */}
        <h1 className="masthead-title">THE BOLLYWOOD CHRONICLE</h1>

        {/* Sub-Motto Rule */}
        <p className="masthead-motto">
          “Verified Celebrity Intelligence, Red Carpet Reports & Cinema Archives”
        </p>

        {/* Double Vintage Print Hairline Rule */}
        <div className="newspaper-double-rule" />
      </header>

      {/* 2. BROADSHEET EDITORIAL GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT / CENTER SPREAD: LEAD FEATURE & COLUMNAR STORIES (8-9 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          {/* LEAD STORY SPREAD */}
          {leadArticle && (
            <article className="border-b-2 border-white/20 pb-8 flex flex-col gap-4">
              {/* Category & Kicker Tag */}
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-[#38bdf8]">
                <span className="font-black bg-[#38bdf8]/15 px-2 py-0.5 rounded border border-[#38bdf8]/30">
                  {leadArticle.category || 'FRONT PAGE EXCLUSIVE'}
                </span>
                <span>•</span>
                <span>[{leadArticle.celebrity}]</span>
              </div>

              {/* Giant Serif Lead Headline */}
              <h2 className="font-['Playfair_Display'] text-2xl sm:text-3xl lg:text-[34px] font-extrabold text-white leading-[1.18] tracking-tight hover:text-[#38bdf8] transition-colors">
                <a href={leadArticle.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {leadArticle.headline}
                </a>
              </h2>

              {/* Classic Dateline Byline */}
              <div className="article-byline flex items-center gap-2">
                <span>MUMBAI BUREAU</span>
                <span>—</span>
                <span>{leadArticle.source}</span>
                <span>—</span>
                <span>{formatTimeAgo(leadArticle.publishedAt)}</span>
              </div>

              {/* Hero Photo (if available) with Editorial Caption */}
              {leadArticle.imageUrl && (
                <div className="w-full rounded-xl overflow-hidden border border-white/10 bg-black/50 relative">
                  <img
                    src={leadArticle.imageUrl}
                    alt={leadArticle.headline}
                    loading="lazy"
                    className="w-full max-h-[420px] object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="p-2.5 bg-black/80 border-t border-white/10 text-[11px] font-serif italic text-slate-300">
                    WIRE PHOTO — {leadArticle.celebrity.toUpperCase()} PHOTOGRAPHED DURING RECENT INDUSTRY ENGAGEMENTS. ARCHIVAL REPRODUCTION VIA {leadArticle.source.toUpperCase()}.
                  </div>
                </div>
              )}

              {/* Body Text with Editorial Drop Cap */}
              <p className="article-body newspaper-drop-cap">
                {leadArticle.summary}
              </p>

              {/* Read Full Report Link */}
              <div>
                <a
                  href={leadArticle.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="article-link"
                >
                  CONTINUE READING FULL REPORT AT {leadArticle.source.toUpperCase()}
                  <ExternalLink className="w-3 h-3 ml-1 inline" />
                </a>
              </div>
            </article>
          )}

          {/* SECONDARY STORIES (Multi-Column Print Flow) */}
          <div className="newspaper-columns">
            {secondaryArticles.map((article) => {
              return (
                <article key={article.id} className="newspaper-article">
                  {/* Actress & Category Meta */}
                  <div className="text-[10px] font-mono uppercase tracking-wider text-[#38bdf8] mb-1.5 flex items-center justify-between">
                    <span className="font-bold">[{article.celebrity}]</span>
                    <span className="text-slate-400">{article.category}</span>
                  </div>

                  {/* Headline */}
                  <h3 className="article-headline">
                    <a
                      href={article.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[#38bdf8] transition-colors"
                    >
                      {article.headline}
                    </a>
                  </h3>

                  {/* Byline */}
                  <div className="article-byline">
                    MUMBAI WIRE • {article.source} • {formatTimeAgo(article.publishedAt)}
                  </div>

                  {/* Thumbnail (if available) */}
                  {article.imageUrl && (
                    <div className="w-full h-36 rounded-lg overflow-hidden border border-white/10 mb-3 bg-black/40">
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
                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="article-link"
                  >
                    READ DISPATCH
                    <ArrowUpRight className="w-3 h-3 ml-0.5 inline" />
                  </a>
                </article>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: "IN BRIEF" // LATE TELEGRAPH DISPATCHES (4 Cols) */}
        <aside className="lg:col-span-4 border-t-2 lg:border-t-0 lg:border-l border-white/15 pt-6 lg:pt-0 lg:pl-6 flex flex-col gap-6">
          <div className="border-b-2 border-white/20 pb-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold tracking-widest text-[#38bdf8] uppercase">
              <Radio className="w-3.5 h-3.5 animate-pulse text-[#38bdf8]" />
              <span>IN BRIEF // TELEGRAPH WIRE</span>
            </div>
            <p className="font-serif italic text-[11px] text-slate-400 mt-1">
              Live updates received over news agency teleprinters.
            </p>
          </div>

          <div className="flex flex-col divide-y divide-white/10">
            {wireTelegrams.length === 0 && (
              <p className="text-xs font-serif text-slate-400 py-4 italic">
                All available dispatches featured on the main front spread.
              </p>
            )}

            {wireTelegrams.map((wire, idx) => {
              return (
                <div key={wire.id || idx} className="py-3.5 first:pt-0 last:pb-0 flex flex-col gap-1.5 group">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span className="font-bold text-[#38bdf8]">[{wire.celebrity}]</span>
                    <span>{formatTimeAgo(wire.publishedAt)}</span>
                  </div>

                  <a
                    href={wire.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-['Playfair_Display'] text-sm font-semibold text-white group-hover:text-[#38bdf8] transition-colors leading-snug"
                  >
                    {wire.headline}
                  </a>

                  {wire.summary && (
                    <p className="font-serif text-[12px] text-slate-400 line-clamp-2 leading-relaxed">
                      {wire.summary}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-slate-500">
                    <span>VIA {wire.source.toUpperCase()}</span>
                    <a
                      href={wire.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#38bdf8] hover:underline flex items-center gap-0.5"
                    >
                      <span>DISPATCH</span>
                      <ArrowUpRight className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Newspaper Footer Colophon Stamp */}
          <div className="mt-auto pt-6 border-t border-white/10 font-mono text-[10px] text-slate-500 flex flex-col gap-1 text-center">
            <span>PRINTED & TRANSMITTED VIA SARWARCYOU FLEET</span>
            <span className="text-[#38bdf8]/70">ALL EDITORIAL RIGHTS RESERVED TO VERIFIED SOURCES</span>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default CelebrityNewsPaper;
