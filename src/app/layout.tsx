import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SipSave Admin',
  description: 'Platform control panel - KYC, disputes, subscriptions, analytics',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
