/**
 * The pitch a URL asks the prices screen to open, or null.
 *
 * Null rather than a thrown error for a pitch that does not exist: the link
 * may be old, or the pitch deleted since it was made, and a manager following
 * a stale link should land on a working screen rather than an explanation.
 */
export function preselectedField(
  param: string | null,
  fields: { id: string }[],
): string | null {
  if (!param) return null
  return fields.some((f) => f.id === param) ? param : null
}
