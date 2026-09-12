/**
 * Supabase keeps the number the way E.164 wants it and then drops the plus:
 * `393331112233`. Printed as it is, the country code runs into the number and
 * the customer reads a string of digits rather than their own telephone.
 *
 * The plus and one space are all this restores, and that is deliberate.
 * Grouping the national part — `333 111 22 33` — depends on the country and,
 * within Italy, on whether the prefix is a mobile or a landline: the problem
 * libphonenumber exists to solve, weighing 300 KB, for a line of text on one
 * screen. `toE164` in `LoginPage.tsx` goes the other way and stays there; a
 * pure function does not belong inside a component, which is why this is its
 * own file rather than a second export from that one.
 */
export function displayPhone(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '')
  if (!digits) return ''
  // Italy is the only country this app sells to, so its prefix is the only
  // one worth separating. Anything else keeps its digits together, which is
  // still better than no plus at all.
  if (digits.startsWith('39') && digits.length > 2) return `+39 ${digits.slice(2)}`
  return `+${digits}`
}
