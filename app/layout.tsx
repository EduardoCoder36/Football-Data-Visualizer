import '@/styles/globals.css';
import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Premier League Tactical Analytics & Simulation Engine',
  description:
    'Form-weighted multi-pillar clash models, 18-month recency-decay baselines, FM 1–100 player attribute scouting, and calibrated Softmax probability forecasting.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen antialiased selection:bg-emerald-500 selection:text-neutral-950">
        {children}
      </body>
    </html>
  );
}
