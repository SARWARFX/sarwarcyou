import useSWR from 'swr';
import fetchJsonp from 'fetch-jsonp';
import type { ApiResponse } from './types';

const API_URL = 'https://script.google.com/macros/s/AKfycbz1ychvuBzDmsaDFtq3qpaCcdVClu4NU4f0nb1tWI94y7BgAziANmEANbor9vMYSRPd/exec';

const fetcher = async (url: string) => {
  try {
    const response = await fetchJsonp(url);
    const data = await response.json();
    return data as ApiResponse;
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
};

export const useMediaData = (flush: boolean = false) => {
  const url = flush ? `${API_URL}?flush=true` : API_URL;
  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const syncMedia = async () => {
    try {
      const response = await fetchJsonp(`${API_URL}?flush=true`);
      const newData = await response.json();
      mutate(newData as ApiResponse, false); // Optimistically update cache
      return newData;
    } catch (err) {
      console.error('Error flushing cache:', err);
    }
  };

  return {
    data: data?.data,
    isLoading,
    isError: error,
    syncMedia,
  };
};
