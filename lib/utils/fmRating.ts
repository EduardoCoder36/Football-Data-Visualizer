/**
 * Pure Football Manager (FM 1-100) attribute & overall rating color/badge helpers.
 * Safe for both Next.js Server Components and Client Components.
 */

export function getFmBadgeClasses(value: number): string {
  if (value >= 85) {
    return 'text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-500/30';
  }
  if (value >= 70) {
    return 'text-cyan-400 font-semibold bg-cyan-950/30 border border-cyan-500/20';
  }
  if (value >= 55) {
    return 'text-zinc-200 font-medium border border-zinc-800 bg-zinc-900/60';
  }
  return 'text-zinc-500 border border-zinc-800/60 bg-zinc-950/40';
}

export function getFmBarColorClass(value: number): string {
  if (value >= 85) return 'bg-emerald-400';
  if (value >= 70) return 'bg-cyan-400';
  if (value >= 55) return 'bg-zinc-400';
  return 'bg-zinc-700';
}

export function getFmOvrRingClasses(ovr: number): string {
  if (ovr >= 80) {
    return 'border-emerald-400 text-emerald-300 bg-emerald-950/60 shadow-emerald-500/20';
  }
  if (ovr >= 70) {
    return 'border-cyan-400 text-cyan-300 bg-cyan-950/60 shadow-cyan-500/20';
  }
  if (ovr >= 60) {
    return 'border-blue-400 text-blue-200 bg-blue-950/50 shadow-blue-500/15';
  }
  return 'border-zinc-600 text-zinc-200 bg-zinc-900/80';
}

export function getFmOvrTierLabel(ovr: number): string {
  if (ovr >= 80) return 'World Class';
  if (ovr >= 72) return 'First Team Star';
  if (ovr >= 64) return 'Premier League Starter';
  if (ovr > 50) return 'Squad Rotation';
  return 'Baseline';
}
