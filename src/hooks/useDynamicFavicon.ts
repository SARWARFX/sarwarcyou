import { useEffect } from 'react';

/**
 * useDynamicFavicon
 * Synchronizes the browser tab favicon with the dynamic brand accent color.
 * Generates an SVG data URI featuring the futuristic Orbitron 'C' glyph.
 */
export function useDynamicFavicon(accentColor = '#22d3ee') {
  useEffect(() => {
    let link = document.getElementById('dynamic-favicon') as HTMLLinkElement | null;
    if (!link) {
      link = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
    }
    if (!link) {
      link = document.createElement('link');
      link.id = 'dynamic-favicon';
      link.rel = 'icon';
      link.type = 'image/svg+xml';
      document.head.appendChild(link);
    }

    const encodedColor = encodeURIComponent(accentColor);
    const svgData = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text x='50' y='74' text-anchor='middle' font-size='82' font-family='Orbitron, sans-serif' font-weight='900' fill='${encodedColor}'>C</text></svg>`;
    link.href = `data:image/svg+xml,${svgData}`;
  }, [accentColor]);
}
