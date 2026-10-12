import React, { useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import type { ImageFolder } from '../types';

interface ImageVaultProps {
  leftFolder: ImageFolder;
  centerFolders: ImageFolder[];
  onImageClick: (url: string) => void;
}

export const ImageVault: React.FC<ImageVaultProps> = ({ leftFolder, centerFolders, onImageClick }) => {
  const [activeTab, setActiveTab] = useState<string>(
    centerFolders && centerFolders.length > 0 ? centerFolders[0].id : ''
  );
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  if (!leftFolder && (!centerFolders || centerFolders.length === 0)) return null;

  const activeFolder = centerFolders?.find((f) => f.id === activeTab) || centerFolders?.[0];

  return (
    <section id="vault" ref={ref} className="py-20 relative">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-12">
          <h2 className="text-4xl font-space font-bold text-white tracking-wide mb-2">
            IMAGE VAULT
          </h2>
          <p className="text-gray-400 font-light">Curated high-resolution digital art</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Hero Image */}
          {leftFolder && leftFolder.files && leftFolder.files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.8 }}
              className="lg:col-span-5 h-[60vh] lg:h-[800px] relative rounded-3xl overflow-hidden cursor-pointer group glass-card"
              onClick={() => onImageClick(leftFolder.files[0].url.replace('/preview', '/view'))}
            >
              <img
                src={leftFolder.files[0].thumbnail.replace('=w1000', '=w1500')}
                alt={leftFolder.files[0].name}
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] to-transparent opacity-60" />
              <div className="absolute bottom-8 left-8">
                <span className="px-3 py-1 text-xs font-mono text-white bg-white/10 backdrop-blur-md rounded-full border border-white/20 mb-3 inline-block">
                  {leftFolder.name}
                </span>
                <h3 className="text-2xl font-space text-white font-medium">
                  {leftFolder.files[0].name.replace(/\.[^/.]+$/, "")}
                </h3>
              </div>
            </motion.div>
          )}

          {/* Center/Right Masonry Gallery */}
          <div className="lg:col-span-7 flex flex-col space-y-6">
            {/* Tabs */}
            {centerFolders && centerFolders.length > 0 && (
              <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-2">
                {centerFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setActiveTab(folder.id)}
                    className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap ${
                      activeTab === folder.id
                        ? 'bg-[#0066FF] text-white shadow-[0_0_15px_rgba(0,102,255,0.3)]'
                        : 'glass-card text-gray-400 hover:text-white'
                    }`}
                  >
                    {folder.name}
                  </button>
                ))}
              </div>
            )}

            {/* Gallery Grid */}
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="grid grid-cols-2 sm:grid-cols-3 gap-4 h-full"
            >
              {activeFolder?.files?.map((file) => (
                <div
                  key={file.id}
                  className="aspect-square relative rounded-xl overflow-hidden cursor-pointer group glass-card"
                  onClick={() => onImageClick(file.url.replace('/preview', '/view'))}
                >
                  <img
                    src={file.thumbnail}
                    alt={file.name}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <span className="text-white font-mono text-xs tracking-wider border border-white/30 px-3 py-1 rounded-full backdrop-blur-sm">
                      VIEW
                    </span>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
};
