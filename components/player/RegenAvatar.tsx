'use client';

import React, { useState } from 'react';
import GenericTeamCrest, { getClubCrestStyle } from '@/components/analytics/GenericTeamCrest';

export interface RegenAvatarProps {
  faceSeed: string;
  size?: number;
  alt?: string;
  teamColor?: string;
  team?: {
    id: number;
    name: string;
    tla?: string | null;
  } | null;
  showClubBadge?: boolean;
  priority?: boolean;
  className?: string;
}

export const RegenAvatar: React.FC<RegenAvatarProps> = ({
  faceSeed,
  size = 96,
  alt = 'Player pixel avatar',
  teamColor,
  team = null,
  showClubBadge = false,
  priority = false,
  className = '',
}) => {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  const safeSeed = faceSeed || 'default-fm-regen';
  const avatarUrl = `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(safeSeed)}&size=${size || 96}`;

  const crestStyle = team ? getClubCrestStyle(team) : null;
  const primaryAccent = crestStyle?.primary || teamColor || '#10b981';
  const trimAccent = crestStyle?.trim || primaryAccent;
  const badgeSize = Math.max(18, Math.round(size * 0.32));

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center rounded-xl border bg-zinc-900/90 shadow-inner ${className}`}
      style={{
        width: size,
        height: size,
        borderColor: `${trimAccent}55`,
        boxShadow: `inset 0 0 22px ${primaryAccent}28`,
      }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-xl">
        {/* Retro scanline/grid backdrop */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-25"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 35%, ${primaryAccent}44, transparent 70%), repeating-linear-gradient(0deg, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.06) 1px, transparent 1px, transparent 3px)`,
          }}
        />

        {/* Club crest palette top accent strip */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1 opacity-90"
          style={{
            background: crestStyle
              ? `linear-gradient(90deg, ${crestStyle.primary} 0%, ${crestStyle.secondary} 50%, ${crestStyle.trim} 100%)`
              : primaryAccent,
          }}
        />

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

      {/* Optional Mini Custom Club Crest Corner Badge */}
      {showClubBadge && team && (
        <div
          className="pointer-events-none absolute -bottom-1.5 -right-1.5 z-20 rounded-full bg-zinc-950/90 p-0.5 shadow-md ring-1 ring-zinc-700/80"
          aria-hidden="true"
        >
          <GenericTeamCrest team={team} size={badgeSize} />
        </div>
      )}
    </div>
  );
};

export default RegenAvatar;
