import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'RackHouse',
  description: 'SaaS multi-tenant para administración de salones de billar',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
