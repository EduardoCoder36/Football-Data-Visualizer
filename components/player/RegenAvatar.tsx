'use client';

import React, { useState } from 'react';

export interface RegenAvatarProps {
  faceSeed: string;
  size?: number;
  alt?: string;
  teamColor?: string;
  priority?: boolean;
  className?: string;
}

export const RegenAvatar: React.FC<RegenAvatarProps> = ({
  faceSeed,
  size = 96,
  alt = 'Player pixel avatar',
  teamColor,
  priority = false,
  className = '',
}) => {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const safeSeed = faceSeed || 'default-fm-regen';
  const avatarUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(safeSeed)}&size=${size || 96}`;

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-900/90 shadow-inner ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: teamColor ? `inset 0 0 20px ${teamColor}22` : undefined,
      }}
    >
      {/* Retro scanline/grid backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 35%, rgba(16, 185, 129, 0.25), transparent 70%), repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 3px)',
        }}
      />

      {/* Team color top accent strip */}
      {teamColor && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1 opacity-85"
          style={{ backgroundColor: teamColor }}
        />
      )}

      {/* Fallback loading skeleton */}
      {!loaded && !hasError && (
        <div
          aria-hidden="true"
          className="absolute inset-1.5 animate-pulse rounded-lg bg-zinc-800/80"
        />
      )}

      {!hasError ? (
        <img
          src={avatarUrl}
          alt={alt}
          width={size}
          height={size}
          loading={priority ? undefined : 'lazy'}
          {...(priority ? ({ fetchPriority: 'high' } as any) : {})}
          onLoad={() => setLoaded(true)}
          onError={() => {
            setHasError(true);
            setLoaded(true);
          }}
          className={`relative z-10 h-full w-full object-contain p-1 transition-opacity duration-200 [image-rendering:pixelated] ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ) : (
        <div
          aria-hidden="true"
          className="relative z-10 flex h-full w-full items-center justify-center font-mono text-xs font-bold uppercase text-zinc-500"
        >
          FM
        </div>
      )}

      {/* Subtle inner retro frame bevel */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-white/10"
      />
    </div>
  );
};

export default RegenAvatar;
