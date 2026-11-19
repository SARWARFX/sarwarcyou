import React, { useState, useRef, useEffect, useCallback } from 'react';

interface CyberSearchBarProps {
  onSearch: (query: string) => void;
  onClear?: () => void;
  isLoading?: boolean;
  className?: string;
}

export const CyberSearchBar: React.FC<CyberSearchBarProps> = ({
  onSearch,
  onClear,
  isLoading = false,
  className = '',
}) => {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global '/' keyboard listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/') {
        const active = document.activeElement;
        const isTyping =
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement ||
          active?.getAttribute('contenteditable') === 'true';

        if (!isTyping) {
          e.preventDefault();
          inputRef.current?.focus();
          inputRef.current?.select();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = query.trim();
      if (trimmed) {
        onSearch(trimmed);
      }
    },
    [query, onSearch]
  );

  const handleClear = useCallback(
    (e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      setQuery('');
      onClear?.();
      inputRef.current?.blur();
    },
    [onClear]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (query) {
        handleClear();
      } else {
        inputRef.current?.blur();
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      onClick={() => inputRef.current?.focus()}
      className={`group flex items-center gap-2 h-[32px] px-3 bg-[#0d1117]/60 hover:bg-[#161b22]/80 transition-all duration-200 cursor-text select-none ${
        isFocused || query
          ? 'border border-cyan-400 shadow-[0_0_12px_rgba(56,189,248,0.25)] w-44 sm:w-56'
          : 'border border-white/20 hover:border-cyan-400/50 w-28 sm:w-36'
      } ${className}`}
      style={{ borderRadius: 0 }}
      title="Search (/)"
    >
      {/* Search Reticle Icon */}
      <svg
        className={`w-3.5 h-3.5 shrink-0 transition-colors duration-200 ${
          isLoading
            ? 'text-cyan-400 animate-pulse'
            : isFocused || query
            ? 'text-cyan-400'
            : 'text-white/60 group-hover:text-white'
        }`}
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

      {/* Input strictly displaying only 'Search' as placeholder and zero other text */}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!e.target.value) {
            onClear?.();
          }
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder="Search"
        autoComplete="off"
        spellCheck="false"
        className="w-full bg-transparent text-[13px] text-white placeholder:text-white/50 tracking-wide font-sans outline-none border-none p-0 focus:ring-0"
        style={{ borderRadius: 0 }}
      />

      {/* Clear Button when query has text */}
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="text-white/50 hover:text-white text-xs shrink-0 p-0.5 bg-transparent border-0 cursor-pointer outline-none transition-colors"
          title="Clear"
          style={{ borderRadius: 0 }}
        >
          ✕
        </button>
      )}
    </form>
  );
};
