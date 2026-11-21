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
      className={`group font-firjar shrink-0 relative flex items-center gap-2 h-[32px] px-2.5 bg-[#06080d]/85 hover:bg-[#0a0d14] backdrop-blur-md transition-all duration-200 cursor-text select-none ${
        isFocused || query
          ? 'border border-[#38bdf8] shadow-[0_0_16px_rgba(56,189,248,0.3)] w-36 xs:w-44 sm:w-64 max-w-[calc(100vw-215px)]'
          : 'border border-white/15 hover:border-[#38bdf8]/60 hover:shadow-[0_0_10px_rgba(56,189,248,0.15)] w-24 xs:w-32 sm:w-40'
      } ${className}`}
      style={{
        borderRadius: 0,
        fontFamily: "'Firjar', 'Science Gothic', sans-serif !important",
      }}
      title="Search (/)"
    >
      {/* Search Reticle / Lens Icon matching website's cyan & slate telemetry color scheme */}
      <svg
        className={`w-3.5 h-3.5 shrink-0 transition-colors duration-200 ${
          isLoading
            ? 'text-[#38bdf8] animate-pulse drop-shadow-[0_0_6px_#38bdf8]'
            : isFocused || query
            ? 'text-[#38bdf8] drop-shadow-[0_0_4px_rgba(56,189,248,0.6)]'
            : 'text-[#64748b] group-hover:text-[#38bdf8]'
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

      {/* Input Field with MiniGraphs (Firjar) font */}
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
        className="font-firjar w-full bg-transparent text-[12.5px] sm:text-[13px] font-medium text-white placeholder:text-[#64748b] group-hover:placeholder:text-white/60 tracking-normal outline-none border-none p-0 focus:ring-0 transition-colors"
        style={{
          borderRadius: 0,
          fontFamily: "'Firjar', 'Science Gothic', sans-serif !important",
        }}
      />

      {/* Shortcut hint [ / ] when empty and not focused, or Clear button when active */}
      {query ? (
        <button
          type="button"
          onClick={handleClear}
          className="font-firjar text-[#64748b] hover:text-[#ef4444] text-[11px] font-bold shrink-0 p-0.5 bg-transparent border-0 cursor-pointer outline-none transition-colors"
          title="Clear Search"
          style={{ borderRadius: 0, fontFamily: "'Firjar', 'Science Gothic', sans-serif !important" }}
        >
          ✕
        </button>
      ) : (
        <span
          className="font-firjar hidden sm:inline-block text-[10px] font-bold text-[#64748b] group-hover:text-white/50 tracking-wider shrink-0 transition-colors select-none"
          style={{ fontFamily: "'Firjar', 'Science Gothic', sans-serif !important" }}
        >
          /
        </span>
      )}
    </form>
  );
};
