import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = (requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? 'localhost:3001').split(',')[0].trim();
  const protocol = (requestHeaders.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')).split(',')[0].trim();
  const metadataBase = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? `${protocol}://${host}`);

  return {
    metadataBase,
    title: {
      default: 'FlyLab — Virtual Neuroethology',
      template: '%s · FlyLab',
    },
    description: 'A scientifically transparent virtual Drosophila lab where people and agents can investigate circuits, design controlled perturbations, and test reproducible behavioral predictions.',
    openGraph: {
      type: 'website',
      title: 'FlyLab',
      description: 'Virtual neuroethology for people + agents',
      images: [{ url: '/og.png', width: 1200, height: 630, alt: 'FlyLab virtual neuroethology laboratory' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'FlyLab',
      description: 'Virtual neuroethology for people + agents',
      images: ['/og.png'],
    },
    robots: { index: true, follow: true },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
