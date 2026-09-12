import type { Closure } from '../hooks/useClosures'

/**
 * Splits closures into upcoming and past. A closure is past once its period
 * has ended (`ends_at < now`), not once it has started — one already under
 * way still belongs among the upcoming ones, the same way `create_booking`
 * treats "now" as the boundary elsewhere in this codebase.
 *
 * Upcoming are ordered soonest first, past most-recent first — the same
 * convention `splitBookings` uses for the customer's own history.
 */
export function splitClosures(
  closures: Closure[],
  now: Date,
): { upcoming: Closure[]; past: Closure[] } {
  const upcoming = closures
    .filter((c) => c.ends_at >= now)
    .sort((a, b) => a.starts_at.getTime() - b.starts_at.getTime())

  const past = closures
    .filter((c) => c.ends_at < now)
    .sort((a, b) => b.starts_at.getTime() - a.starts_at.getTime())

  return { upcoming, past }
}
