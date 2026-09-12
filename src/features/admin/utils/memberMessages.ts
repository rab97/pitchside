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
    return 'Questo numero è già di un altro cliente. Qualcuno potrebbe averlo appena creato: cerca di nuovo.'
  }
  return action === 'save'
    ? 'Non siamo riusciti a salvare la nota. Riprova.'
    : 'Non siamo riusciti a creare il cliente. Riprova.'
}
