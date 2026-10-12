import useSWR from 'swr';
import fetchJsonp from 'fetch-jsonp';
import type { ApiResponse } from './types';
import { FALLBACK_MEDIA_DATA } from './data/fallbackData';

export const API_URL = 'https://script.google.com/macros/s/AKfycbz1ychvuBzDmsaDFtq3qpaCcdVClu4NU4f0nb1tWI94y7BgAziANmEANbor9vMYSRPd/exec';

const fetcher = async (url: string): Promise<ApiResponse> => {
  // 1. Try JSONP first (standard for Google Apps Script with CORS limitations)
  try {
    const jsonpResponse = await fetchJsonp(url, {
      timeout: 10000,
    });
    const data = await jsonpResponse.json();
    if (data && data.status === 'success') {
      return data as ApiResponse;
    }
  } catch (jsonpErr) {
    console.warn('JSONP fetch encountered error, falling back to direct fetch:', jsonpErr);
  }

  // 2. Direct fetch fallback
  try {
    const fetchResponse = await fetch(url);
    if (!fetchResponse.ok) {
      throw new Error(`HTTP error! status: ${fetchResponse.status}`);
    }
    const data = await fetchResponse.json();
    return data as ApiResponse;
  } catch (fetchErr) {
    console.error('Direct fetch also failed:', fetchErr);
    throw fetchErr;
  }
};

export const useMediaData = (flush: boolean = false) => {
  const url = flush ? `${API_URL}?flush=true` : API_URL;
  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(url, fetcher, {
    fallbackData: { status: 'success', cached: true, data: FALLBACK_MEDIA_DATA },
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000,
  });

  const syncMedia = async () => {
    try {
      const refreshed = await fetcher(`${API_URL}?flush=true`);
      mutate(refreshed, false);
      return refreshed;
    } catch (err) {
      console.error('Error refreshing media data:', err);
    }
  };

  return {
    data: data?.data || FALLBACK_MEDIA_DATA,
    isLoading,
    isError: error,
    syncMedia,
  };
};
