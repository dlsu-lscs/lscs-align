import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Providers } from './providers';
import './globals.css';

import { Jost } from 'next/font/google';
import Header from '@/components/layout/header';

const jost = Jost({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-jost',
});

export const metadata: Metadata = {
  title: 'ALIGN Development Environment',
  description: 'ALIGN local development placeholder',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();

  return (
    <html lang="en" className={jost.variable}>
      <body>
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
