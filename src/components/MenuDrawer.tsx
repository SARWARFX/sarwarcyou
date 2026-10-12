import React from 'react';
import { X, Film, Video, Zap, Image, Check, Folder } from 'lucide-react';
import type { ApiResponseData } from '../types';

export type CategoryKey = 'trailers' | 'videos' | 'shorts' | 'vault';

interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  data: ApiResponseData;
  activeCategory: CategoryKey;
  activeVideoFolderId: string | null;
  onSelectCategory: (category: CategoryKey, folderId?: string | null) => void;
}

export const MenuDrawer: React.FC<MenuDrawerProps> = ({
  isOpen,
  onClose,
  data,
  activeCategory,
  activeVideoFolderId,
  onSelectCategory,
}) => {
  if (!isOpen) return null;

  const totalVaultCount = (data.leftImageFolder?.files?.length || 0) +
    (data.centerImageFolders?.reduce((acc, f) => acc + (f.files?.length || 0), 0) || 0);

  const totalVideosCount = data.videoFolders?.reduce((acc, f) => acc + (f.files?.length || 0), 0) || 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-md transition-opacity">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer content */}
      <div className="relative w-full max-w-md h-full bg-[#0a0a0f]/95 border-l border-white/10 shadow-2xl flex flex-col p-6 sm:p-8 overflow-y-auto z-10 font-sans">
        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
            <h2 className="text-sm font-mono tracking-[0.2em] font-bold text-white uppercase">
              :: STAGE NAVIGATOR
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Categories Section */}
        <div className="py-6 space-y-4 flex-1">
          <div className="text-[11px] font-mono tracking-widest text-white/40 uppercase">
            SELECT 3D MEDIA CAROUSEL
          </div>

          {/* 1. TRAILERS */}
          <button
            onClick={() => {
              onSelectCategory('trailers', null);
              onClose();
            }}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left cursor-pointer group ${
              activeCategory === 'trailers'
                ? 'bg-cyan-950/40 border-cyan-500/50 text-white shadow-[0_0_20px_rgba(0,210,255,0.15)]'
                : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/15 text-white/80'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                <Film className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-sm tracking-wide">TRAILERS & PREVIEWS</div>
                <div className="text-xs text-white/40">{data.trailerImages?.length || 0} ITEMS IN 3D ORBIT</div>
              </div>
            </div>
            {activeCategory === 'trailers' && <Check className="w-5 h-5 text-cyan-400" />}
          </button>

          {/* 2. VIDEOS & ALBUMS */}
          <div className="space-y-2">
            <button
              onClick={() => {
                onSelectCategory('videos', null);
                onClose();
              }}
              className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left cursor-pointer group ${
                activeCategory === 'videos' && !activeVideoFolderId
                  ? 'bg-purple-950/40 border-purple-500/50 text-white shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                  : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/15 text-white/80'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-lg bg-purple-500/20 text-purple-400">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm tracking-wide">ALL VIDEO ALBUMS</div>
                  <div className="text-xs text-white/40">{totalVideosCount} VIDEOS TOTAL</div>
                </div>
              </div>
              {activeCategory === 'videos' && !activeVideoFolderId && <Check className="w-5 h-5 text-purple-400" />}
            </button>

            {/* Subfolders for video albums */}
            {data.videoFolders?.length > 0 && (
              <div className="pl-4 space-y-1.5 pt-1">
                {data.videoFolders.map((vf) => (
                  <button
                    key={vf.id}
                    onClick={() => {
                      onSelectCategory('videos', vf.id);
                      onClose();
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                      activeCategory === 'videos' && activeVideoFolderId === vf.id
                        ? 'bg-purple-900/30 border-purple-500/40 text-purple-200'
                        : 'bg-white/[0.03] border-transparent hover:bg-white/5 text-white/60 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Folder className="w-3.5 h-3.5 text-purple-400" />
                      <span className="truncate max-w-[200px]">{vf.name}</span>
                    </div>
                    <span className="text-[10px] text-white/30 font-mono">{vf.count || vf.files.length}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. SHORTS */}
          <button
            onClick={() => {
              onSelectCategory('shorts', null);
              onClose();
            }}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left cursor-pointer group ${
              activeCategory === 'shorts'
                ? 'bg-pink-950/40 border-pink-500/50 text-white shadow-[0_0_20px_rgba(244,63,94,0.15)]'
                : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/15 text-white/80'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-lg bg-pink-500/20 text-pink-400">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-sm tracking-wide">SHORTS & REELS</div>
                <div className="text-xs text-white/40">{data.shortsFolder?.files?.length || 0} VERTICAL MEDIA</div>
              </div>
            </div>
            {activeCategory === 'shorts' && <Check className="w-5 h-5 text-pink-400" />}
          </button>

          {/* 4. VAULT */}
          <button
            onClick={() => {
              onSelectCategory('vault', null);
              onClose();
            }}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all text-left cursor-pointer group ${
              activeCategory === 'vault'
                ? 'bg-emerald-950/40 border-emerald-500/50 text-white shadow-[0_0_20px_rgba(16,185,129,0.15)]'
                : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/15 text-white/80'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400">
                <Image className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-sm tracking-wide">IMAGE VAULT</div>
                <div className="text-xs text-white/40">{totalVaultCount} HD IMAGES</div>
              </div>
            </div>
            {activeCategory === 'vault' && <Check className="w-5 h-5 text-emerald-400" />}
          </button>
        </div>

        {/* Drawer Footer */}
        <div className="pt-6 border-t border-white/10 flex items-center justify-between text-xs text-white/40 font-mono">
          <span>HOST: GOOGLE DRIVE</span>
          <span>SARWAR.CYOU</span>
        </div>
      </div>
    </div>
  );
};
