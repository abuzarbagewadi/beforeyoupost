import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://beforeyoupost.bagewadiabuzar.chatgpt.site'),
  title: 'Before You Post — Photo privacy check',
  description: 'Check photos for hidden metadata and download a clean copy. Your files never leave your device.',
  openGraph: {
    title: 'Before You Post — Photo privacy check',
    description: 'Check photos for hidden metadata and download a clean copy. Your files never leave your device.',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Before You Post — Photo privacy check',
    description: 'Check photos for hidden metadata and download a clean copy. Your files never leave your device.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
