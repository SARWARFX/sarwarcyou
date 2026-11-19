import React, { useEffect, useState, useCallback, useRef } from 'react';
import type { StageMediaItem } from '../../types';
import { searchWebImages } from '../../services/imageSearchService';

interface WebImageSearchModalProps {
  isOpen: boolean;
  initialQuery: string;
  onClose: () => void;
  onOpenPhoto: (item: StageMediaItem, playlist: StageMediaItem[], index: number) => void;
}

export const WebImageSearchModal: React.FC<WebImageSearchModalProps> = ({
  isOpen,
  initialQuery,
  onClose,
  onOpenPhoto,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<StageMediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    const q = searchQuery.trim();
    if (!q) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setHasSearched(true);

    try {
      const items = await searchWebImages(q, controller.signal);
      setResults(items);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // When opened with a new initial query, update and search
  useEffect(() => {
    if (isOpen && initialQuery) {
      setQuery(initialQuery);
      performSearch(initialQuery);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isOpen, initialQuery, performSearch]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-[#05070b]/95 backdrop-blur-2xl text-white select-none animate-fadeIn"
      style={{ borderRadius: 0 }}
    >
      {/* Top Cyber Window Bar */}
      <div
        className="flex items-center justify-between px-6 sm:px-10 py-4 border-b border-white/10 shrink-0 bg-[#090c12]/80"
        style={{ borderRadius: 0 }}
      >
        {/* Left: Search input strictly with icon and text 'Search' */}
        <form onSubmit={handleSubmit} className="flex items-center gap-3 flex-1 max-w-lg">
          <svg
            className={`w-4 h-4 shrink-0 transition-colors ${isLoading ? 'text-cyan-400 animate-pulse' : 'text-white/60'}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            autoComplete="off"
            spellCheck="false"
            className="w-full bg-transparent text-white text-[15px] sm:text-[16px] tracking-wide font-sans outline-none border-b border-transparent focus:border-cyan-400/80 pb-0.5 transition-all"
            style={{ borderRadius: 0 }}
          />
        </form>

        {/* Right: Minimalist Close Button [ × ] */}
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white hover:text-cyan-400 text-lg sm:text-xl font-mono px-3 py-1 cursor-pointer transition-colors bg-transparent border-0 outline-none"
          title="Close (ESC)"
          style={{ borderRadius: 0 }}
        >
          ✕
        </button>
      </div>

      {/* Cyber Loading Indicator Line */}
      {isLoading && (
        <div className="w-full h-0.5 bg-white/5 overflow-hidden shrink-0">
          <div className="w-full h-full bg-cyan-400 shadow-[0_0_10px_#38bdf8] animate-pulse" />
        </div>
      )}

      {/* Results Content Area */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-10 py-6 scrollbar-thin scrollbar-thumb-white/20">
        {results.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
            {results.map((item, index) => (
              <div
                key={item.id}
                onClick={() => onOpenPhoto(item, results, index)}
                className="group relative aspect-square bg-[#0b0e14] border border-white/10 hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(56,189,248,0.25)] transition-all duration-200 cursor-pointer overflow-hidden"
                style={{ borderRadius: 0 }}
              >
                <img
                  src={item.thumbnail}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  style={{ borderRadius: 0 }}
                  onError={(e) => {
                    // If thumbnail fails, try full image
                    const target = e.currentTarget;
                    if (target.src !== item.url) {
                      target.src = item.url;
                    }
                  }}
                />
              </div>
            ))}
          </div>
        ) : !isLoading && hasSearched ? (
          <div className="w-full h-64 flex items-center justify-center text-white/40 text-sm tracking-widest font-mono">
            // NO MEDIA FOUND
          </div>
        ) : null}
      </div>
    </div>
  );
};
