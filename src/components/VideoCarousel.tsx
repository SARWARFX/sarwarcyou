import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Play } from 'lucide-react';
import type { VideoFolder, MediaFile } from '../types';

interface VideoCarouselProps {
  folder: VideoFolder;
  onPlay: (url: string) => void;
}

const VideoCard: React.FC<{ file: MediaFile; onPlay: (url: string) => void }> = ({ file, onPlay }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -5 }}
      whileTap={{ scale: 0.98 }}
      className="flex-none w-[280px] md:w-[320px] relative group cursor-pointer"
      onClick={() => onPlay(file.url)}
    >
      <div className="relative aspect-video rounded-xl overflow-hidden glass-card">
        <img
          src={file.thumbnail}
          alt={file.name}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-[#09090B]/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-[#0066FF]/80 flex items-center justify-center backdrop-blur-md">
            <Play className="w-5 h-5 text-white fill-white ml-1" />
          </div>
        </div>
      </div>
      <div className="mt-4 px-1">
        <h3 className="text-sm font-medium text-white truncate font-inter">
          {file.name.replace(/\.[^/.]+$/, "")}
        </h3>
        <p className="text-xs text-gray-400 mt-1">Video Clip</p>
      </div>
    </motion.div>
  );
};

export const VideoCarousel: React.FC<VideoCarouselProps> = ({ folder, onPlay }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  if (!folder || !folder.files || folder.files.length === 0) return null;

  return (
    <div ref={ref} className="py-8">
      <div className="max-w-7xl mx-auto px-6 mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-space font-bold text-white tracking-wide">
            {folder.name}
          </h2>
          <p className="text-sm text-gray-500 mt-1">{folder.count} items</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={isInView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.6 }}
        className="w-full overflow-x-auto no-scrollbar pb-8 pt-2 px-6"
      >
        <div className="flex space-x-6 w-max max-w-7xl mx-auto">
          {folder.files.map((file) => (
            <VideoCard key={file.id} file={file} onPlay={onPlay} />
          ))}
        </div>
      </motion.div>
    </div>
  );
};
