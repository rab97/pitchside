/**
 * Un errore che il gestore legge deve dire cosa non è riuscito e cosa può
 * fare, mai riportare la risposta del database. `closureMessages.ts` e
 * `bandMessages.ts` fanno lo stesso per le loro schermate, e restano tre file
 * distinti apposta: ognuno mappa SQLSTATE diversi su azioni diverse.
 */

/** Unique violation: l'indice su `phone_key(phone)` ha rifiutato la riga. */
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
