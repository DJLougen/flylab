import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const productionSiteUrl = 'https://flylab-neuroethology.d-lougen.chatgpt.site';
const trustedMetadataHosts = new Set([
  'flylab-neuroethology.d-lougen.chatgpt.site',
  'localhost:3001',
  'localhost:3002',
]);

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

function resolveMetadataBase() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (configuredUrl) {
    try {
      const candidate = new URL(configuredUrl);
      const isLocalDevelopment =
        candidate.hostname === 'localhost' && candidate.protocol === 'http:';
      const isProduction =
        candidate.hostname === 'flylab-neuroethology.d-lougen.chatgpt.site' &&
        candidate.protocol === 'https:';

      if (trustedMetadataHosts.has(candidate.host) && (isLocalDevelopment || isProduction)) {
        return candidate;
      }
    } catch {
      // Ignore malformed configuration and use the known production origin.
    }
  }

  return new URL(productionSiteUrl);
}

export function generateMetadata(): Metadata {
  const metadataBase = resolveMetadataBase();

  return {
    metadataBase,
    title: {
      default: 'FlyLab — Virtual Neuroethology',
      template: '%s · FlyLab',
    },
    description: 'An agent-first WebMCP virtual Drosophila lab with typed site tools, reproducible experiments, source-backed circuits, and a visible supervisor audit surface.',
    openGraph: {
      type: 'website',
      title: 'FlyLab',
      description: 'Agent-first WebMCP virtual neuroethology',
      images: [{ url: '/og.png', width: 1200, height: 630, alt: 'FlyLab virtual neuroethology laboratory' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'FlyLab',
      description: 'Agent-first WebMCP virtual neuroethology',
      images: ['/og.png'],
    },
    robots: { index: true, follow: true },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="alternate" type="application/json" href="/flylab-agent-manifest.json" title="FlyLab agent manifest" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
