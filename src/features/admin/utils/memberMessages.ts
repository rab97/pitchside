/**
 * An error the manager reads has to say what failed and what they can do about
 * it, never repeat what the database answered. `closureMessages.ts` and
 * `bandMessages.ts` do the same for their own screens, and the three stay
 * separate files on purpose: each maps different SQLSTATEs onto different
 * actions, and merging them would mean one table of codes that no screen can
 * read in full.
 */

/** Unique violation: the index on `phone_key(phone)` refused the row. */
const UNIQUE_VIOLATION = '23505'

export function isPhoneTaken(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && (error as { code?: string }).code === UNIQUE_VIOLATION
}

export function memberMessage(error: unknown, action: 'save' | 'create'): string {
  if (isPhoneTaken(error)) {
    // Two choices, and both are real ones — §2.7. It used to say «cerca di
    // nuovo», which is the one thing that cannot work: the manager is here
    // because searching by the name they have found nothing, and the existing
    // row is under a different spelling. So the card is offered beside this
    // sentence, and «togli il numero» is gone, because §2.6 no longer allows
    // a customer to be created without one.
    return 'Questo numero è già di un altro cliente: usa la sua scheda, oppure correggi il numero.'
  }
  return action === 'save'
    ? 'Non siamo riusciti a salvare la nota. Riprova.'
    : 'Non siamo riusciti a creare il cliente. Riprova.'
}
