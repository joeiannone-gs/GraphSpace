import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const gothic = localFont({
  src: [
    { path: './fonts/CenturyGothic.ttf', weight: '400' },
    { path: './fonts/CenturyGothic-Bold.ttf', weight: '700' },
  ],
  variable: '--font-gothic',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GraphSpace',
  description: 'Build, train and inspect machine learning models visually.',
  icons: { icon: '/logo.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={gothic.variable}>
      <body>{children}</body>
    </html>
  );
}
