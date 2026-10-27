import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from './router/useRouter';
import { loadCatalog } from './services/mediaService';
import type { CatalogState, MediaItem, Album } from './models/media';
import { TopNavbar } from './components/layout/TopNavbar';
import { SiteFooter } from './components/layout/SiteFooter';
import { HomeView } from './components/views/HomeView';
import { AlbumView } from './components/views/AlbumView';
import { WatchView } from './components/views/WatchView';
import { PhotoLightbox } from './components/viewer/PhotoLightbox';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

export function App() {
  const { route, navigate, goBack } = useRouter();

  const [catalog, setCatalog] = useState<CatalogState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch catalog on mount
  const fetchCatalogData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await loadCatalog();
      setCatalog(data);
    } catch (err) {
      console.error('Failed to load media catalog:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to connect to media vault');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalogData();
  }, [fetchCatalogData]);

  // Media selection dispatcher
  const handleSelectMedia = useCallback(
    (item: MediaItem) => {
      if (item.type === 'image') {
        navigate({ name: 'photo', mediaId: item.id, albumId: item.albumId });
      } else {
        navigate({ name: 'watch', mediaId: item.id, albumId: item.albumId });
      }
    },
    [navigate]
  );

  // Album selection dispatcher
  const handleSelectAlbum = useCallback(
    (album: Album) => {
      navigate({ name: 'album', albumId: album.id });
    },
    [navigate]
  );

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [route.name]);

  // Lookup active album if route is album
  const currentAlbum = useMemo(() => {
    if (!catalog || route.name !== 'album') return null;
    const cleanId = route.albumId.toLowerCase();
    return (
      catalog.albums.find(
        (a) =>
          a.id.toLowerCase() === cleanId ||
          a.folderPath.toLowerCase() === cleanId ||
          encodeURIComponent(a.folderPath).toLowerCase() === cleanId
      ) || null
    );
  }, [catalog, route]);

  // Lookup active media item if route is watch or photo
  const currentMedia = useMemo(() => {
    if (!catalog) return null;
    if (route.name === 'watch' || route.name === 'photo') {
      const targetId = route.mediaId;
      return (
        catalog.items.find(
          (i) =>
            i.id === targetId ||
            i.path === targetId ||
            i.id.toLowerCase() === targetId.toLowerCase() ||
            i.path.toLowerCase() === targetId.toLowerCase()
        ) || null
      );
    }
    return null;
  }, [catalog, route]);

  // Active queue for watch view: parent album items or latest releases
  const watchQueue = useMemo(() => {
    if (!catalog || !currentMedia) return [];
    if (currentMedia.albumId) {
      const album = catalog.albums.find((a) => a.id === currentMedia.albumId);
      if (album && album.items.length > 0) {
        return album.items.filter((i) => i.type === 'video');
      }
    }
    return catalog.latestReleases;
  }, [catalog, currentMedia]);

  // Photo lightbox album/collection items for next/prev navigation
  const photoCollection = useMemo(() => {
    if (!catalog || !currentMedia || currentMedia.type !== 'image') return [];
    if (currentMedia.albumId) {
      const album = catalog.albums.find((a) => a.id === currentMedia.albumId);
      if (album) {
        return album.items.filter((i) => i.type === 'image');
      }
    }
    return catalog.items.filter((i) => i.type === 'image');
  }, [catalog, currentMedia]);

  return (
    <div className="min-h-screen bg-[#07080c] text-zinc-100 flex flex-col font-sans selection:bg-[#00E5FF]/30 selection:text-[#00E5FF]">
      {/* Top Navbar */}
      <TopNavbar
        currentRoute={route}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNavigateHome={() => navigate({ name: 'home' })}
        onGoBack={goBack}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        {/* Loading State */}
        {isLoading && !catalog && (
          <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center">
            <Loader2 className="w-12 h-12 text-[#00E5FF] animate-spin" />
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white uppercase tracking-wider">
                Connecting to Media Vault
              </h2>
              <p className="text-xs font-mono text-zinc-500">
                Synchronizing repository catalog and thumbnail maps...
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {loadError && !catalog && (
          <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6 bg-red-500/5 border border-red-500/20 rounded-3xl max-w-lg mx-auto my-12">
            <AlertCircle className="w-12 h-12 text-red-400 mb-3" />
            <h2 className="text-lg font-bold text-white mb-1">Failed to Load Media Catalog</h2>
            <p className="text-xs font-mono text-zinc-400 mb-6">{loadError}</p>
            <button
              type="button"
              onClick={fetchCatalogData}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-mono font-bold tracking-wider uppercase transition cursor-pointer active:scale-95"
            >
              <RefreshCw className="w-4 h-4 text-[#00E5FF]" />
              Retry Connection
            </button>
          </div>
        )}

        {/* Active Route View */}
        {catalog && (
          <>
            {/* 1. Home View */}
            {route.name === 'home' && (
              <HomeView
                catalog={catalog}
                searchQuery={searchQuery}
                onSelectMedia={handleSelectMedia}
                onSelectAlbum={handleSelectAlbum}
              />
            )}

            {/* 2. Album View */}
            {route.name === 'album' && (
              <>
                {currentAlbum ? (
                  <AlbumView album={currentAlbum} onSelectMedia={handleSelectMedia} />
                ) : (
                  <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6">
                    <h2 className="text-xl font-bold text-white mb-2">Album Not Found</h2>
                    <p className="text-xs font-mono text-zinc-400 mb-6">
                      The folder &ldquo;{route.albumId}&rdquo; does not exist in the media vault.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate({ name: 'home' })}
                      className="px-5 py-2.5 rounded-full bg-[#00E5FF] text-black font-sans font-bold text-xs uppercase tracking-wider cursor-pointer active:scale-95 transition"
                    >
                      Return Home
                    </button>
                  </div>
                )}
              </>
            )}

            {/* 3. Watch Stream View */}
            {route.name === 'watch' && (
              <>
                {currentMedia ? (
                  <WatchView
                    item={currentMedia}
                    album={
                      currentMedia.albumId
                        ? catalog.albums.find((a) => a.id === currentMedia.albumId)
                        : undefined
                    }
                    queue={watchQueue}
                    onSelectMedia={handleSelectMedia}
                    onNavigateAlbum={(albumId) => navigate({ name: 'album', albumId })}
                  />
                ) : (
                  <div className="min-h-[50vh] flex flex-col items-center justify-center text-center p-6">
                    <h2 className="text-xl font-bold text-white mb-2">Media Stream Not Found</h2>
                    <p className="text-xs font-mono text-zinc-400 mb-6 max-w-md break-all">
                      Could not find media item &ldquo;{route.mediaId}&rdquo;.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate({ name: 'home' })}
                      className="px-5 py-2.5 rounded-full bg-[#00E5FF] text-black font-sans font-bold text-xs uppercase tracking-wider cursor-pointer active:scale-95 transition"
                    >
                      Return Home
                    </button>
                  </div>
                )}
              </>
            )}

            {/* 4. Photo Lightbox Modal (Renders on top of album/home or directly) */}
            {route.name === 'photo' && currentMedia && (
              <PhotoLightbox
                item={currentMedia}
                items={photoCollection.length > 0 ? photoCollection : [currentMedia]}
                onClose={goBack}
                onNavigate={handleSelectMedia}
              />
            )}
          </>
        )}
      </main>

      {/* Site Footer */}
      <SiteFooter />
    </div>
  );
}

export default App;
