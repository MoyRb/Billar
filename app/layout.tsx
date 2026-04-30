import './globals.css';
import type { Metadata, Viewport } from 'next';
import { PWAServiceWorker } from '@/components/pwa-service-worker';

export const metadata: Metadata = {
  applicationName: 'RackHouse',
  title: 'RackHouse',
  description: 'Sistema de gestión para salones de billar',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/icons/icon.svg', type: 'image/svg+xml', sizes: 'any' },
    ],

  },
  appleWebApp: {
    capable: true,
    title: 'RackHouse',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#1f3a2f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body>
        <PWAServiceWorker />
        {children}
      </body>
    </html>
  );
}
