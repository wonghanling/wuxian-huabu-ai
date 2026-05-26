export const BRAND = (process.env.NEXT_PUBLIC_BRAND || 'boluolab') as 'boluolab' | 'filmavo';

export const BRAND_CONFIG = {
  boluolab: {
    siteName: 'Boluo Lab',
    siteUrl: 'https://boluolab.com',
    logoText: 'BoluoLab',
  },
  filmavo: {
    siteName: 'Filmavo',
    siteUrl: 'https://filmavo.com',
    logoText: 'Filmavo',
  },
}[BRAND];

export const IS_FILMAVO = BRAND === 'filmavo';
