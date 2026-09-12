/**
 * A message the customer reads says what did not happen and what they can do.
 * It never repeats what the service answered: `AuthApiError`'s text is English,
 * written for whoever integrates the API, not for whoever is holding the phone.
 *
 * `memberMessages.ts` and `closureMessages.ts` do the same for their screens and
 * stay separate files on purpose — each maps a different set of failures onto a
 * different set of actions.
 */

/** Supabase refuses a second account on one address; both shapes appear. */
export function isEmailTaken(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const e = error as { code?: string; message?: string }
  return e.code === 'email_exists'
    || (e.message ?? '').includes('already been registered')
}

export function accountMessage(
  error: unknown,
  action: 'email' | 'google' | 'signout',
): string {
  if (action === 'email' && isEmailTaken(error)) {
    return 'Questo indirizzo è già collegato a un altro account. Entra con quello, oppure usane uno diverso.'
  }
  if (action === 'email') return 'Non siamo riusciti a salvare l’indirizzo. Riprova.'
  if (action === 'google') return 'Non siamo riusciti a collegare Google. Riprova.'
  return 'Non siamo riusciti a uscire. Riprova.'
}
