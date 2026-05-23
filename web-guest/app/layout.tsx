import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '된다 (DenDa)',
  description: '친구들과 모임 시간 맞추고 예약까지 한 번에',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
