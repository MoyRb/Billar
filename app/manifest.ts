import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'RackHouse',
    short_name: 'RackHouse',
    description: 'Sistema de gestión para salones de billar',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0f1f1a',
    theme_color: '#1f3a2f',
    orientation: 'portrait-primary',
    lang: 'es-MX',
    icons: [
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/icons/maskable-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/icons/maskable-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
