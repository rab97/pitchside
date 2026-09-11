// Postgres restituisce tstzrange come '["2025-10-14 20:00:00+02","...")'
export function parseRange(raw: string): [Date, Date] {
  const [a, b] = raw.slice(1, -1).split(',').map((s) => s.replace(/"/g, ''))
  return [new Date(a), new Date(b)]
}
