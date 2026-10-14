export interface BrandConfig {
  name: string;
  logoSrc: string;
  sourceUrl: string;
}

declare global {
  interface Window {
    BRAND_CONFIG: BrandConfig;
  }
}

export const BRAND_CONFIG: BrandConfig = {
  name: 'SARWARCYOU',
  logoSrc: '/SARWARCYOU.svg',
  sourceUrl: 'https://www.sarwar.cyou/',
};

if (typeof window !== 'undefined') {
  window.BRAND_CONFIG = BRAND_CONFIG;
}
