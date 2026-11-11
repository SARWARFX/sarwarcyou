import React, { useState } from 'react';
import { Music2, Play, Disc3, X, ExternalLink } from 'lucide-react';
import musicSoundtracksData from '../data/musicSoundtracks.json';
import { hapticLight } from '../utils/hapticsManager';

export interface SoundtrackItem {
  id: string;
  song: string;
  movie: string;
  actress: string;
  singers: string;
  composer: string;
  year: number;
  youtubeId: string;
  spotifyTrackId?: string;
  thumbnail: string;
  label: string;
}

export const MusicShowcase: React.FC = () => {
  const [selectedTrack, setSelectedTrack] = useState<SoundtrackItem | null>(null);

  const tracks = musicSoundtracksData as SoundtrackItem[];

  return (
    <div className="w-full flex-1 flex flex-col p-4 sm:p-7 lg:p-10 z-10 overflow-y-auto space-scrollbar bg-transparent">
      {/* 1. Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 mb-6 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3 shrink-0">
          <Disc3 className="w-5 h-5 text-[#ccff00] animate-spin-slow" />
          <div>
            <h1 className="font-['Space_Grotesk'] font-black text-lg sm:text-xl tracking-wider uppercase text-white">
              FILM SOUNDTRACK LOUNGE
            </h1>
            <p className="text-[10px] sm:text-[11px] tracking-wide text-neutral-400">
              Curated Cinema Soundtracks & Music Releases • High-Fidelity Audio & Video Streams
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#ccff00] animate-pulse" />
          <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
            OFFICIAL RELEASES • {tracks.length} HIT TRACKS
          </span>
        </div>
      </div>

      {/* 2. Audiovisual Music Track Grid */}
      <div className="w-full pb-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {tracks.map((track) => (
          <div
            key={track.id}
            role="button"
            tabIndex={0}
            onClick={() => {
              hapticLight();
              setSelectedTrack(track);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setSelectedTrack(track);
              }
            }}
            className="group relative rounded-2xl overflow-hidden bg-[#0a0c12] border border-white/10 hover:border-[#ccff00] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex flex-col shadow-[0_12px_35px_rgba(0,0,0,0.85)]"
          >
            {/* 16:9 Thumbnail Poster Container */}
            <div className="relative w-full aspect-[16/9] overflow-hidden bg-neutral-900">
              <img
                src={track.thumbnail}
                alt={track.song}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0c12] via-transparent to-transparent pointer-events-none" />

              {/* Label & Year Tag */}
              <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-full bg-black/80 backdrop-blur-md border border-[#ccff00]/40 text-[#ccff00] font-mono text-[10px] font-bold">
                  {track.year}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-neutral-300 font-mono text-[9px] uppercase">
                  {track.label}
                </span>
              </div>

              {/* Center Play Button Overlay */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-[#ccff00] text-black flex items-center justify-center shadow-2xl transform group-hover:scale-110 transition-transform">
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </div>
              </div>
            </div>

            {/* Track Info Card */}
            <div className="p-4 flex-1 flex flex-col justify-between gap-2.5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[#ccff00] font-mono font-bold text-xs truncate">
                    {track.actress}
                  </span>
                  <span className="text-neutral-500 text-xs">•</span>
                  <span className="text-neutral-400 text-xs font-serif italic truncate">
                    {track.movie}
                  </span>
                </div>
                <h3 className="font-['Space_Grotesk'] font-bold text-base text-white line-clamp-1 group-hover:text-[#ccff00] transition-colors">
                  {track.song}
                </h3>
                <p className="text-[11px] text-neutral-400 line-clamp-1 mt-0.5">
                  Voice: {track.singers}
                </p>
                <p className="text-[10px] font-mono text-neutral-500">
                  Music: {track.composer}
                </p>
              </div>

              <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-[10px] font-mono text-neutral-400">
                <span className="flex items-center gap-1 text-[#ccff00]">
                  <Music2 className="w-3 h-3" />
                  AUDIOVISUAL STREAM
                </span>
                <span className="text-neutral-500">YOUTUBE 4K</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Cinema Soundtrack Theater Modal */}
      {selectedTrack && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[130] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 sm:p-8"
        >
          <div className="relative w-full max-w-5xl bg-[#090b10] border border-white/15 rounded-3xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.95)] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-white/10 bg-[#06070a]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#ccff00]/15 border border-[#ccff00]/30 flex items-center justify-center text-[#ccff00]">
                  <Music2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-['Space_Grotesk'] font-bold text-base sm:text-lg text-white">
                    {selectedTrack.song} • {selectedTrack.movie} ({selectedTrack.year})
                  </h2>
                  <span className="text-xs font-mono text-neutral-400">
                    Featuring {selectedTrack.actress} • Sung by {selectedTrack.singers} • Composed by {selectedTrack.composer}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTrack(null)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-neutral-300 hover:text-white transition-all cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* YouTube Native High-Res Player */}
            <div className="relative w-full aspect-[16/9] bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${selectedTrack.youtubeId}?autoplay=1&controls=1&modestbranding=1&rel=0&playsinline=1`}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                allowFullScreen
                title={selectedTrack.song}
              />
            </div>

            {/* Track Metadata Bar */}
            <div className="p-4 sm:p-5 bg-[#06070a] border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-neutral-400">
              <div className="flex items-center gap-3">
                <span className="px-2.5 py-1 rounded-full bg-[#ccff00]/15 text-[#ccff00] font-mono text-[11px] font-bold">
                  {selectedTrack.label}
                </span>
                <span className="text-neutral-300 font-mono text-[11px]">
                  Original Soundtrack Master • 4K UHD
                </span>
              </div>
              <a
                href={`https://www.youtube.com/watch?v=${selectedTrack.youtubeId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 text-[#ccff00] font-mono text-[11px] transition-all"
              >
                <span>Watch on YouTube</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MusicShowcase;
