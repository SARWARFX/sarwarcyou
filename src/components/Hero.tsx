import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TrailerImage } from '../types';

interface HeroProps {
  images: TrailerImage[];
}

export const Hero: React.FC<HeroProps> = ({ images }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!images || images.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [images]);

  if (!images || images.length === 0) return null;

  return (
    <section id="featured" className="relative h-[80vh] w-full overflow-hidden flex items-end pb-20 pt-32">
      <AnimatePresence initial={false}>
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: 'easeInOut' }}
          className="absolute inset-0 z-0"
        >
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${images[currentIndex].thumbnail.replace('=w1000', '=w2000')})` }}
          />
          {/* Gradients for text readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-[#09090B]/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#09090B] via-[#09090B]/30 to-transparent" />
        </motion.div>
      </AnimatePresence>

      <div className="relative z-10 max-w-7xl mx-auto px-6 w-full">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="max-w-2xl"
        >
          <span className="inline-block px-3 py-1 mb-4 text-xs font-mono text-[#00D2FF] bg-[#0066FF]/20 border border-[#0066FF]/30 rounded-full glass-card">
            FEATURED REEL
          </span>
          <h1 className="text-5xl md:text-7xl font-bold font-space mb-6 leading-tight tracking-tight text-white drop-shadow-2xl">
            {images[currentIndex].folderName.toUpperCase()}
          </h1>
          <p className="text-lg text-gray-300 mb-8 max-w-xl font-light">
            Experience the latest cinematic showcase. Immersive visuals designed for the future of digital media.
          </p>

          <div className="flex items-center space-x-4">
            <button className="px-8 py-3 bg-[#0066FF] hover:bg-[#00D2FF] text-white font-medium rounded-full transition-all duration-300 flex items-center space-x-2 shadow-[0_0_20px_rgba(0,102,255,0.4)]">
              <span>Watch Now</span>
            </button>
          </div>
        </motion.div>

        {/* Carousel Indicators */}
        <div className="absolute bottom-10 right-6 flex space-x-2">
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1 rounded-full transition-all duration-300 ${
                idx === currentIndex ? 'w-8 bg-[#00D2FF]' : 'w-4 bg-white/30 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
