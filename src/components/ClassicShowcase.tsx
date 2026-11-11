import React, { useState, useMemo } from 'react';
import { Film, Play, X } from 'lucide-react';
import classicArchiveData from '../data/classicArchive.json';
import { hapticLight, hapticMedium } from '../utils/hapticsManager';

export interface ClassicMovieItem {
  id: string;
  title: string;
  actress: string;
  coStar: string;
  director: string;
  year: number;
  era: string;
  language: string;
  region: string;
  duration: string;
  archiveId: string;
  embedUrl: string;
  videoUrl: string;
  thumbnail: string;
  description: string;
}

const ERA_TABS = [
  { id: 'ALL', label: 'ALL ERAS' },
  { id: '1950s-1960s', label: '1950s - 1960s' },
  { id: '1970s', label: '1970s GOLDEN' },
  { id: '1980s', label: '1980s CLASSIC' },
];

export const ClassicShowcase: React.FC = () => {
  const [selectedEra, setSelectedEra] = useState('ALL');
  const [selectedMovie, setSelectedMovie] = useState<ClassicMovieItem | null>(null);

  const movies = classicArchiveData as ClassicMovieItem[];

  const filteredMovies = useMemo(() => {
    if (selectedEra === 'ALL') return movies;
    return movies.filter((m) => m.era === selectedEra);
  }, [movies, selectedEra]);

  return (
    <div className="w-full flex-1 flex flex-col p-4 sm:p-7 lg:p-10 z-10 overflow-y-auto space-scrollbar bg-transparent">
      {/* 1. Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 mb-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 shrink-0">
          <Film className="w-5 h-5 text-[#ccff00]" />
          <div>
            <h1 className="font-['Space_Grotesk'] font-black text-lg sm:text-xl tracking-wider uppercase text-white">
              CLASSIC CINEMA ARCHIVE
            </h1>
            <p className="text-[10px] sm:text-[11px] tracking-wide text-neutral-400">
              Golden Era South Asian Masterpieces • Curated & Preserved via The Internet Archive
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#ccff00] animate-pulse" />
          <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
            PERMANENT ARCHIVE • {movies.length} HISTORIC TITLES
          </span>
        </div>
      </div>

      {/* 2. Era Filter Pills */}
      <div className="w-full flex items-center gap-2 overflow-x-auto no-scrollbar py-1 mb-6 border-b border-white/[0.08] shrink-0">
        {ERA_TABS.map((tab) => {
          const isActive = selectedEra === tab.id;
          const count = tab.id === 'ALL' ? movies.length : movies.filter((m) => m.era === tab.id).length;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                hapticMedium();
                setSelectedEra(tab.id);
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase transition-all duration-150 cursor-pointer shrink-0 border ${
                isActive
                  ? 'bg-[#ccff00] text-black border-[#ccff00] shadow-[0_0_12px_rgba(204,255,0,0.35)]'
                  : 'bg-white/[0.03] text-neutral-400 border-white/10 hover:text-white hover:border-white/20'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-black text-[#ccff00] font-black' : 'bg-white/10 text-neutral-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Widescreen Retro Cinema Grid */}
      <div className="w-full pb-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredMovies.map((movie) => (
          <div
            key={movie.id}
            role="button"
            tabIndex={0}
            onClick={() => {
              hapticLight();
              setSelectedMovie(movie);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedMovie(movie);
              }
            }}
            className="group relative rounded-2xl overflow-hidden bg-[#0a0c12] border border-white/10 hover:border-[#ccff00] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex flex-col shadow-[0_12px_35px_rgba(0,0,0,0.85)]"
          >
            {/* 16:9 Aspect Poster Container */}
            <div className="relative w-full aspect-[16/9] overflow-hidden bg-neutral-900">
              <img
                src={movie.thumbnail}
                alt={movie.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c12] via-transparent to-transparent pointer-events-none" />

              {/* Era & Year Tag */}
              <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md border border-[#ccff00]/40 text-[#ccff00] font-mono text-[10px] font-bold">
                  {movie.year}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-neutral-300 font-mono text-[9px] uppercase">
                  {movie.language}
                </span>
              </div>

              {/* Duration Tag */}
              <div className="absolute top-2.5 right-2.5 z-10">
                <span className="px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md border border-white/15 text-neutral-300 font-mono text-[10px]">
                  {movie.duration}
                </span>
              </div>

              {/* Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-[#ccff00] text-black flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform">
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </div>
              </div>
            </div>

            {/* Content Details */}
            <div className="p-4 flex-1 flex flex-col justify-between gap-2.5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[#ccff00] font-mono font-bold text-xs">
                    {movie.actress}
                  </span>
                  <span className="text-neutral-500 text-xs">•</span>
                  <span className="text-neutral-400 text-xs font-serif italic">
                    dir. {movie.director}
                  </span>
                </div>
                <h3 className="font-['Space_Grotesk'] font-bold text-sm text-white line-clamp-1 group-hover:text-[#ccff00] transition-colors">
                  {movie.title}
                </h3>
                <p className="text-[11px] text-neutral-400 line-clamp-2 mt-1 leading-relaxed">
                  {movie.description}
                </p>
              </div>

              <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-[10px] font-mono text-neutral-400">
                <span>ARCHIVE.ORG VERIFIED</span>
                <span className="text-[#ccff00]">FREE PUBLIC STREAM</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 4. Fullscreen Retro Cinema Modal (The Internet Archive Player) */}
      {selectedMovie && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[130] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8"
        >
          <div className="relative w-full max-w-5xl bg-[#090b10] border border-white/15 rounded-3xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.95)] flex flex-col">
            {/* Modal Top Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-[#06070a]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#ccff00]/15 border border-[#ccff00]/30 flex items-center justify-center text-[#ccff00]">
                  <Film className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-['Space_Grotesk'] font-bold text-base sm:text-lg text-white">
                    {selectedMovie.title}
                  </h2>
                  <span className="text-xs font-mono text-neutral-400">
                    Starring {selectedMovie.actress} & {selectedMovie.coStar} • Directed by {selectedMovie.director} ({selectedMovie.year})
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMovie(null)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-all cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Archive.org Embedded Stream */}
            <div className="relative w-full aspect-[16/9] bg-black">
              <iframe
                src={`${selectedMovie.embedUrl}?autoplay=1`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                allowFullScreen
                title={selectedMovie.title}
              />
            </div>

            {/* Modal Bottom Info */}
            <div className="p-4 sm:p-6 bg-[#06070a] border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-neutral-400">
              <p className="max-w-2xl text-[12px] leading-relaxed">
                {selectedMovie.description}
              </p>
              <a
                href={`https://archive.org/details/${selectedMovie.archiveId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 text-[#ccff00] font-mono text-[11px] shrink-0 transition-all"
              >
                View on Archive.org ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassicShowcase;
