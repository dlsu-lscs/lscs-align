import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Providers } from './providers';
import './globals.css';

import { Jost } from 'next/font/google';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';

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
      <body className="flex min-h-screen flex-col">
        <Providers>
          <Header />
          <div className="flex-1">{children}</div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
