import { useState, useMemo, useCallback, useEffect } from 'react';
import { useMediaData } from './useMediaData';
import { ThreeStage, type StageMediaItem } from './components/ThreeStage';
import { HudOverlay } from './components/HudOverlay';
import { BrandLogo } from './components/BrandLogo';
import { VerticalFolderMenu } from './components/VerticalFolderMenu';
import { MediaModal } from './components/MediaModal';
import { FALLBACK_MEDIA_DATA } from './data/fallbackData';
import type { ApiResponseData, MediaFolderEntry } from './types';
import { Loader2 } from 'lucide-react';

const ITEMS_PER_PAGE = 6;

// Dynamic folder discovery from API payload
function extractAllFolders(data: ApiResponseData): MediaFolderEntry[] {
  const folders: MediaFolderEntry[] = [];

  // 1. Bandhobis (Primary / Featured Folder)
  const bandhobisItems: StageMediaItem[] = [];
  if (data.leftImageFolder?.name?.toLowerCase().includes('bandhobis')) {
    data.leftImageFolder.files?.forEach((f) => {
      bandhobisItems.push({
        id: f.id,
        title: f.name,
        url: f.url,
        thumbnail: f.thumbnail,
        category: 'Bandhobis',
        type: 'image',
      });
    });
  }
  // Check centerImageFolders if leftImageFolder didn't match
  if (bandhobisItems.length === 0) {
    const centerB = data.centerImageFolders?.find((f) =>
      f.name?.toLowerCase().includes('bandhobis')
    );
    if (centerB && centerB.files) {
      centerB.files.forEach((f) => {
        bandhobisItems.push({
          id: f.id,
          title: f.name,
          url: f.url,
          thumbnail: f.thumbnail,
          category: centerB.name,
          type: 'image',
        });
      });
    }
  }
  // Fallback to static fallbackData if still empty
  if (bandhobisItems.length === 0 && FALLBACK_MEDIA_DATA.leftImageFolder?.files) {
    FALLBACK_MEDIA_DATA.leftImageFolder.files.forEach((f) => {
      bandhobisItems.push({
        id: f.id,
        title: f.name,
        url: f.url,
        thumbnail: f.thumbnail,
        category: 'Bandhobis',
        type: 'image',
      });
    });
  }

  folders.push({
    id: 'bandhobis',
    name: 'Bandhobis',
    type: 'image',
    count: bandhobisItems.length,
    items: bandhobisItems,
  });

  // 2. Trailers
  if (data.trailerImages && data.trailerImages.length > 0) {
    folders.push({
      id: 'trailers',
      name: 'Trailers',
      type: 'video',
      count: data.trailerImages.length,
      items: data.trailerImages.map((t) => ({
        id: t.id,
        title: t.name,
        url: t.url,
        thumbnail: t.thumbnail,
        category: t.folderName || 'Trailers',
        type: 'video',
      })),
    });
  }

  // 3. Shorts & Reels
  if (data.shortsFolder && data.shortsFolder.files?.length > 0) {
    folders.push({
      id: 'shorts',
      name: data.shortsFolder.name || 'Shorts',
      type: 'video',
      count: data.shortsFolder.files.length,
      items: data.shortsFolder.files.map((s) => ({
        id: s.id,
        title: s.name,
        url: s.url,
        thumbnail: s.thumbnail,
        category: 'Shorts',
        type: 'video',
      })),
    });
  }

  // 4. Video Albums
  if (data.videoFolders && data.videoFolders.length > 0) {
    data.videoFolders.forEach((vf) => {
      if (vf.files && vf.files.length > 0 && !vf.name?.toLowerCase().includes('bandhobis')) {
        folders.push({
          id: `video-${vf.id}`,
          name: vf.name,
          type: 'video',
          count: vf.files.length,
          items: vf.files.map((f) => ({
            id: f.id,
            title: f.name,
            url: f.url,
            thumbnail: f.thumbnail,
            category: vf.name,
            type: 'video',
          })),
        });
      }
    });
  }

  // 5. Image Folders (other than Bandhobis)
  if (data.centerImageFolders && data.centerImageFolders.length > 0) {
    data.centerImageFolders.forEach((cif) => {
      if (cif.files && cif.files.length > 0 && !cif.name?.toLowerCase().includes('bandhobis')) {
        folders.push({
          id: `image-${cif.id}`,
          name: cif.name,
          type: 'image',
          count: cif.files.length,
          items: cif.files.map((f) => ({
            id: f.id,
            title: f.name,
            url: f.url,
            thumbnail: f.thumbnail,
            category: cif.name,
            type: 'image',
          })),
        });
      }
    });
  }

  // 6. Left image folder if named something other than Bandhobis
  if (
    data.leftImageFolder?.files &&
    data.leftImageFolder.files.length > 0 &&
    !data.leftImageFolder.name?.toLowerCase().includes('bandhobis')
  ) {
    folders.push({
      id: `image-${data.leftImageFolder.id}`,
      name: data.leftImageFolder.name,
      type: 'image',
      count: data.leftImageFolder.files.length,
      items: data.leftImageFolder.files.map((f) => ({
        id: f.id,
        title: f.name,
        url: f.url,
        thumbnail: f.thumbnail,
        category: data.leftImageFolder.name,
        type: 'image',
      })),
    });
  }

  return folders;
}

function App() {
  const { data, isLoading, isError } = useMediaData();

  // Dynamic folders list from data
  const allFolders = useMemo(() => {
    return extractAllFolders(data || FALLBACK_MEDIA_DATA);
  }, [data]);

  // Active folder selection (defaults to 'bandhobis')
  const [activeFolderId, setActiveFolderId] = useState<string>('bandhobis');
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);

  // Active Folder Entry
  const selectedFolder = useMemo(() => {
    return allFolders.find((f) => f.id === activeFolderId) || allFolders[0];
  }, [allFolders, activeFolderId]);

  const totalFolderItems = selectedFolder ? selectedFolder.items.length : 0;
  const totalPages = Math.max(1, Math.ceil(totalFolderItems / ITEMS_PER_PAGE));

  // Current batch of 5 to 6 items displayed in the 3D space
  const currentBatchItems = useMemo<StageMediaItem[]>(() => {
    if (!selectedFolder || !selectedFolder.items.length) return [];
    const start = currentPage * ITEMS_PER_PAGE;
    return selectedFolder.items.slice(start, start + ITEMS_PER_PAGE);
  }, [selectedFolder, currentPage]);

  const activeItem = currentBatchItems[activeSlotIndex] || currentBatchItems[0];

  // Fullscreen Modal State
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    url: string | null;
    type: 'video' | 'image';
    title?: string;
  }>({
    isOpen: false,
    url: null,
    type: 'image',
    title: '',
  });

  const handleOpenModal = useCallback((item?: StageMediaItem) => {
    const target = item || activeItem;
    if (!target) return;
    setModalState({
      isOpen: true,
      url: target.url,
      type: target.type,
      title: target.title,
    });
  }, [activeItem]);

  // Folder selection with page reset
  const handleSelectFolder = useCallback((folderId: string) => {
    setActiveFolderId(folderId);
    setCurrentPage(0);
    setActiveSlotIndex(0);
  }, []);

  // Item Navigation
  const handlePrevItem = useCallback(() => {
    setActiveSlotIndex((prev) => {
      if (prev > 0) return prev - 1;
      if (currentPage > 0) {
        setCurrentPage((p) => p - 1);
        return ITEMS_PER_PAGE - 1;
      }
      return currentBatchItems.length - 1;
    });
  }, [currentPage, currentBatchItems.length]);

  const handleNextItem = useCallback(() => {
    setActiveSlotIndex((prev) => {
      if (prev < currentBatchItems.length - 1) return prev + 1;
      if (currentPage < totalPages - 1) {
        setCurrentPage((p) => p + 1);
        return 0;
      }
      return 0;
    });
  }, [currentPage, totalPages, currentBatchItems.length]);

  // Batch / Page Navigation
  const handlePrevPage = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage((p) => p - 1);
      setActiveSlotIndex(0);
    }
  }, [currentPage]);

  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages - 1) {
      setCurrentPage((p) => p + 1);
      setActiveSlotIndex(0);
    }
  }, [currentPage, totalPages]);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (modalState.isOpen) return;
      if (e.key === 'ArrowLeft') handlePrevItem();
      if (e.key === 'ArrowRight') handleNextItem();
      if (e.key === ' ' || e.key === 'Enter') {
        if (activeItem) handleOpenModal(activeItem);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [modalState.isOpen, handlePrevItem, handleNextItem, activeItem, handleOpenModal]);

  // Loading Screen (only if no fallback data is available)
  if (!data && isLoading) {
    return (
      <div className="fixed inset-0 bg-[#000000] flex flex-col items-center justify-center text-white z-50">
        <div className="relative flex flex-col items-center gap-6">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-2 border-[#00D2FF]/20 border-t-[#00D2FF] animate-spin" />
            <Loader2 className="absolute w-5 h-5 text-white animate-pulse" />
          </div>
          <div className="text-xs font-mono tracking-[0.3em] text-white/50 uppercase">
            INITIALIZING 3D STAGE...
          </div>
        </div>
      </div>
    );
  }

  // Error Screen
  if (!data && isError) {
    return (
      <div className="fixed inset-0 bg-[#000000] flex items-center justify-center text-white p-6 font-mono">
        <div className="max-w-md p-8 rounded-2xl bg-neutral-900 border border-white/10 text-center space-y-4">
          <div className="text-red-400 text-2xl font-bold">[ CONNECTION ERROR ]</div>
          <p className="text-xs text-white/60">
            Unable to stream cloud media. Please check your internet connection.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 rounded-full bg-white text-black font-bold text-xs uppercase hover:bg-neutral-200 transition-colors"
          >
            RETRY
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* 1. 3D Portrait Stage — 5 to 6 Items Only in Shallow Orbital Arc */}
      <ThreeStage
        items={currentBatchItems}
        activeIndex={activeSlotIndex}
        onActiveIndexChange={setActiveSlotIndex}
        onSelectActiveItem={handleOpenModal}
      />

      {/* 2. Sleek Minimalist HUD Overlay (No debug badges, tech labels, or raw filenames) */}
      <HudOverlay
        activeItem={activeItem}
        activeIndex={activeSlotIndex}
        totalBatchItems={currentBatchItems.length}
        currentPage={currentPage}
        totalPages={totalPages}
        totalFolderItems={totalFolderItems}
        onPrevItem={handlePrevItem}
        onNextItem={handleNextItem}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
        onOpenModal={() => handleOpenModal()}
      />

      {/* 3. Bottom-Left Modern Electric-Blue Play Logo & Branding */}
      <BrandLogo />

      {/* 4. Right-Side Floating Vertical Navigation Folder Menu */}
      <VerticalFolderMenu
        folders={allFolders}
        activeFolderId={activeFolderId}
        onSelectFolder={handleSelectFolder}
      />

      {/* 5. Fullscreen High-Definition Image Lightbox & Responsive Video Modal */}
      <MediaModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
        url={modalState.url}
        type={modalState.type}
        title={modalState.title}
      />
    </main>
  );
}

export default App;
