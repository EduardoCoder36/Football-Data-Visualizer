import React from 'react';
import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'Player Profiles & Scouting | Premier League Tactical Analytics',
  description:
    'Football Manager-style 1–100 player attributes, 6-axis spider radar profiles, and deterministic pixel regens for the 2026/2027 Premier League season.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased selection:bg-emerald-500 selection:text-neutral-950">
        {children}
      </body>
    </html>
  );
}
