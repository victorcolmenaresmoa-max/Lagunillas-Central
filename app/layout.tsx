import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/fraunces/full.css';
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Lagunillas Central',
    template: '%s · Lagunillas Central',
  },
  description: 'Comercios, ofertas flash y pedidos por WhatsApp en el municipio Lagunillas, Mérida.',
  applicationName: 'Lagunillas Central',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Lagunillas',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/favicon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    title: 'Lagunillas Central',
    description: 'Todo Lagunillas en tu teléfono: comercios, ofertas y pedidos por WhatsApp.',
    locale: 'es_VE',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#f8f3e8',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="app-bg font-sans antialiased">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
