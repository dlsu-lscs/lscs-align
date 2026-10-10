import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'ALIGN Development Environment',
  description: 'ALIGN local development placeholder',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();

  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
