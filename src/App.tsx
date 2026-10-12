import { useState } from 'react';
import { useMediaData } from './useMediaData';
import { Layout } from './components/Layout';
import { Hero } from './components/Hero';
import { VideoCarousel } from './components/VideoCarousel';
import { ShortsReel } from './components/ShortsReel';
import { ImageVault } from './components/ImageVault';
import { MediaModal } from './components/MediaModal';
import { Loader2 } from 'lucide-react';

function App() {
  const { data, isLoading, isError } = useMediaData();
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    url: string | null;
    type: 'video' | 'image';
  }>({ isOpen: false, url: null, type: 'video' });

  const openVideo = (url: string) => {
    setModalState({ isOpen: true, url, type: 'video' });
  };

  const openImage = (url: string) => {
    setModalState({ isOpen: true, url, type: 'image' });
  };

  const closeModal = () => {
    setModalState({ ...modalState, isOpen: false });
  };

  if (isError) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center text-white">
        <p className="text-xl font-space text-red-500">Error loading media data. Please try again later.</p>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-[#09090B] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-12 h-12 text-[#0066FF] animate-spin" />
          <p className="text-white font-space tracking-widest text-glow">INITIALIZING VAULT...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <Hero images={data.trailerImages} />

      <div id="albums" className="py-12 relative z-10">
        {data.videoFolders?.map((folder) => (
          <VideoCarousel key={folder.id} folder={folder} onPlay={openVideo} />
        ))}
      </div>

      <ShortsReel folder={data.shortsFolder} onPlay={openVideo} />

      <ImageVault
        leftFolder={data.leftImageFolder}
        centerFolders={data.centerImageFolders}
        onImageClick={openImage}
      />

      <MediaModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        url={modalState.url}
        type={modalState.type}
      />
    </Layout>
  );
}

export default App;
