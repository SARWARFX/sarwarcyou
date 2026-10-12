import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Play } from 'lucide-react';
import type { ShortsFolder, MediaFile } from '../types';

interface ShortsReelProps {
  folder: ShortsFolder;
  onPlay: (url: string) => void;
}

const ShortCard: React.FC<{ file: MediaFile; onPlay: (url: string) => void }> = ({ file, onPlay }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="flex-none w-[200px] md:w-[240px] aspect-[9/16] relative group cursor-pointer rounded-2xl overflow-hidden glass-card"
      onClick={() => onPlay(file.url)}
    >
      <img
        src={file.thumbnail}
        alt={file.name}
        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity" />

      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="w-14 h-14 rounded-full bg-[#00D2FF]/80 flex items-center justify-center backdrop-blur-md">
          <Play className="w-6 h-6 text-[#09090B] fill-[#09090B] ml-1" />
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="text-sm font-medium text-white line-clamp-2 font-inter shadow-sm">
          {file.name.replace(/\.[^/.]+$/, "")}
        </h3>
      </div>
    </motion.div>
  );
};

export const ShortsReel: React.FC<ShortsReelProps> = ({ folder, onPlay }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  if (!folder || !folder.files || folder.files.length === 0) return null;

  return (
    <section id="shorts" ref={ref} className="py-16 relative">
      {/* Background ambient light */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg h-64 bg-[#00D2FF]/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 mb-8 flex items-end justify-between relative z-10">
        <div>
          <h2 className="text-3xl font-space font-bold text-white tracking-wide">
            {folder.name}
          </h2>
          <p className="text-sm text-[#00D2FF] mt-2 font-mono">VERTICAL REEL</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8 }}
        className="w-full overflow-x-auto no-scrollbar pb-8 pt-2 px-6 relative z-10"
      >
        <div className="flex space-x-4 w-max max-w-7xl mx-auto">
          {folder.files.map((file) => (
            <ShortCard key={file.id} file={file} onPlay={onPlay} />
          ))}
        </div>
      </motion.div>
    </section>
  );
};
