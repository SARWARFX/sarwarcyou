import { useState, useMemo, useCallback } from 'react';
import { useMediaData } from './useMediaData';
import { ThreeStage, type StageMediaItem } from './components/ThreeStage';
import { HudOverlay } from './components/HudOverlay';
import { MenuDrawer, type CategoryKey } from './components/MenuDrawer';
import { MediaModal } from './components/MediaModal';
import { Loader2 } from 'lucide-react';

function App() {
  const { data, isLoading, isError } = useMediaData();

  const [activeCategory, setActiveCategory] = useState<CategoryKey>('trailers');
  const [activeVideoFolderId, setActiveVideoFolderId] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    url: string | null;
    type: 'video' | 'image';
    title?: string;
  }>({
    isOpen: false,
    url: null,
    type: 'video',
    title: '',
  });

  // Transform current folder items into 3D Stage items
  const currentItems = useMemo<StageMediaItem[]>(() => {
    if (!data) return [];

    switch (activeCategory) {
      case 'trailers':
        return (data.trailerImages || []).map((t) => ({
          id: t.id,
          title: t.name,
          url: t.url,
          thumbnail: t.thumbnail,
          category: t.folderName || 'Trailers',
          type: 'video',
        }));

      case 'videos': {
        if (activeVideoFolderId) {
          const folder = data.videoFolders?.find((f) => f.id === activeVideoFolderId);
          return (folder?.files || []).map((f) => ({
            id: f.id,
            title: f.name,
            url: f.url,
            thumbnail: f.thumbnail,
            category: folder?.name || 'Videos',
            type: 'video',
          }));
        }
        // All video albums combined
        const allVideos: StageMediaItem[] = [];
        data.videoFolders?.forEach((f) => {
          f.files?.forEach((file) => {
            allVideos.push({
              id: file.id,
              title: file.name,
              url: file.url,
              thumbnail: file.thumbnail,
              category: f.name,
              type: 'video',
            });
          });
        });
        return allVideos;
      }

      case 'shorts':
        return (data.shortsFolder?.files || []).map((s) => ({
          id: s.id,
          title: s.name,
          url: s.url,
          thumbnail: s.thumbnail,
          category: 'Shorts',
          type: 'video',
        }));

      case 'vault': {
        const vaultItems: StageMediaItem[] = [];
        data.leftImageFolder?.files?.forEach((img) => {
          vaultItems.push({
            id: img.id,
            title: img.name,
            url: img.url,
            thumbnail: img.thumbnail,
            category: data.leftImageFolder.name || 'Vault',
            type: 'image',
          });
        });
        data.centerImageFolders?.forEach((folder) => {
          folder.files?.forEach((img) => {
            vaultItems.push({
              id: img.id,
              title: img.name,
              url: img.url,
              thumbnail: img.thumbnail,
              category: folder.name || 'Vault',
              type: 'image',
            });
          });
        });
        return vaultItems;
      }

      default:
        return [];
    }
  }, [data, activeCategory, activeVideoFolderId]);

  const activeItem = currentItems[activeIndex] || currentItems[0];

  const handlePrev = useCallback(() => {
    if (currentItems.length === 0) return;
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : currentItems.length - 1));
  }, [currentItems.length]);

  const handleNext = useCallback(() => {
    if (currentItems.length === 0) return;
    setActiveIndex((prev) => (prev < currentItems.length - 1 ? prev + 1 : 0));
  }, [currentItems.length]);

  const handleScrub = useCallback((targetIndex: number) => {
    setActiveIndex(targetIndex);
  }, []);

  const handleOpenPlay = useCallback((item?: StageMediaItem) => {
    const target = item || activeItem;
    if (!target) return;
    setModalState({
      isOpen: true,
      url: target.url,
      type: target.type,
      title: target.title,
    });
  }, [activeItem]);

  const handleSelectCategory = (cat: CategoryKey, folderId?: string | null) => {
    setActiveCategory(cat);
    setActiveVideoFolderId(folderId || null);
    setActiveIndex(0);
  };

  // Loading Screen
  if (isLoading || !data) {
    return (
      <div className="fixed inset-0 bg-[#000000] flex flex-col items-center justify-center text-white z-50">
        <div className="relative flex flex-col items-center gap-6">
          {/* Futuristic Concentric Spinner */}
          <div className="relative flex items-center justify-center">
            <div className="w-20 h-20 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
            <div className="absolute w-12 h-12 rounded-full border-2 border-pink-500/20 border-b-pink-500 animate-spin" style={{ animationDirection: 'reverse' }} />
            <Loader2 className="absolute w-6 h-6 text-white animate-pulse" />
          </div>

          <div className="flex flex-col items-center gap-1.5 font-mono text-center">
            <div className="text-sm font-bold tracking-[0.3em] text-white uppercase drop-shadow-[0_0_10px_rgba(0,210,255,0.5)]">
              INITIALIZING 3D WEBGL ENGINE...
            </div>
            <div className="text-[11px] tracking-widest text-white/40 uppercase">
              STREAMING ASSETS // SARWARCYOU STAGE
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error Screen
  if (isError) {
    return (
      <div className="fixed inset-0 bg-[#000000] flex items-center justify-center text-white p-6 font-mono">
        <div className="max-w-md p-8 rounded-2xl bg-red-950/20 border border-red-500/30 text-center space-y-4">
          <div className="text-red-500 text-3xl font-black">[ ERR: 500 ]</div>
          <p className="text-sm text-red-200">
            UNABLE TO STREAM CLOUD MEDIA DATA. PLEASE CHECK NETWORK CONNECTION.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 rounded-full bg-white text-black font-bold text-xs uppercase hover:bg-neutral-200 transition-colors"
          >
            RETRY CONNECTION
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* 1. Full-Viewport Three.js 3D Orbital Cylindrical Ring Canvas */}
      <ThreeStage
        items={currentItems}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        onSelectActiveItem={handleOpenPlay}
      />

      {/* 2. Ciao Energy HUD & Viewfinder Staging */}
      <HudOverlay
        activeItem={activeItem}
        activeIndex={activeIndex}
        totalItems={currentItems.length}
        onPrev={handlePrev}
        onNext={handleNext}
        onScrub={handleScrub}
        onPlay={() => handleOpenPlay()}
        onToggleMenu={() => setIsMenuOpen(true)}
      />

      {/* 3. Folder Selector Drawer */}
      <MenuDrawer
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        data={data}
        activeCategory={activeCategory}
        activeVideoFolderId={activeVideoFolderId}
        onSelectCategory={handleSelectCategory}
      />

      {/* 4. Stream Media Modal Player */}
      <MediaModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        url={modalState.url}
        type={modalState.type}
        title={modalState.title}
      />
    </div>
  );
}

export default App;
