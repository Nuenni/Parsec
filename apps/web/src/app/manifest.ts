import type { MetadataRoute } from 'next';
import { APP_NAME } from '@/utils/app';

// Makes the app installable: Add to Dock in Safari, Install in Chrome and Edge,
// Add to Home Screen on a phone. The colours are the light theme's `--background`;
// the browser chrome follows the viewport `themeColor` in the root layout instead,
// which also covers the dark theme.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fafafa',
    theme_color: '#fafafa',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
