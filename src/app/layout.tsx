import type { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Hestiia Restaurant API',
  description: 'DIMISI Restaurant Management Platform - Next.js App Router API',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
