import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface MediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  url: string | null;
  type: 'video' | 'image';
}

export const MediaModal: React.FC<MediaModalProps> = ({ isOpen, onClose, url, type }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !url) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-10"
        onClick={onClose}
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white z-[110]"
        >
          <X className="w-6 h-6" />
        </button>

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-6xl max-h-full rounded-2xl overflow-hidden glass-card shadow-2xl flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {type === 'video' ? (
            <div className="w-full aspect-video">
              <iframe
                src={url}
                className="w-full h-full border-0"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title="Video Player"
              />
            </div>
          ) : (
            <div className="relative w-full h-[80vh] flex items-center justify-center">
              <img
                src={url}
                alt="Full resolution"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
