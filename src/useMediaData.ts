import useSWR from 'swr';
import type { HfMediaCatalog } from './types';
import { FALLBACK_HF_CATALOG } from './data/fallbackData';

export const HUGGINGFACE_CATALOG_URL =
  'https://huggingface.co/datasets/SARWARFX/stream-vault/resolve/main/media.json';

const fetcher = async (url: string): Promise<HfMediaCatalog> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch media catalog: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (!data || !Array.isArray(data.images) || !Array.isArray(data.clips)) {
    throw new Error('Invalid media catalog schema received');
  }
  return data as HfMediaCatalog;
};

export const useMediaData = () => {
  const { data, error, isLoading, mutate } = useSWR<HfMediaCatalog>(
    HUGGINGFACE_CATALOG_URL,
    fetcher,
    {
      fallbackData: FALLBACK_HF_CATALOG,
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      dedupingInterval: 60000,
    }
  );

  const syncMedia = async () => {
    try {
      const refreshed = await fetcher(HUGGINGFACE_CATALOG_URL);
      mutate(refreshed, false);
      return refreshed;
    } catch (err) {
      console.error('Error refreshing media catalog from Hugging Face CDN:', err);
    }
  };

  return {
    data: data || FALLBACK_HF_CATALOG,
    isLoading,
    isError: error,
    syncMedia,
  };
};
