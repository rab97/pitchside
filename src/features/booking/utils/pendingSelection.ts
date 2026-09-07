/**
 * La scelta di campo, giorno e orario deve sopravvivere al giro per /accedi:
 * BookPage ci naviga via con `next=/prenota` in query string apposta per
 * reggere il redirect di Google (vedi il commento lì), ma la scelta stessa
 * non ci sta dentro quel parametro. La teniamo in `sessionStorage`, che vive
 * per tutta la scheda — incluso un redirect esterno e il ritorno — e non
 * per altre schede o visite future.
 */
const KEY = 'pitchside:pending-booking'

export type PendingSelection = {
  fieldId: string
  /** `Date.toISOString()`: l'istante esatto, non una chiave di giorno da
   *  reinterpretare in un fuso — evita ogni ambiguità alla rilettura. */
  dayIso: string
  minutes: number
  startMin: number
}

export function savePendingSelection(v: PendingSelection): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    // Storage non disponibile (navigazione privata, quota piena): si
    // riparte dalla scelta vuota dopo l'accesso, non è un errore bloccante.
  }
}

/** Legge la scelta in sospeso e la consuma: si usa una volta sola. */
export function takePendingSelection(): PendingSelection | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
    return raw ? (JSON.parse(raw) as PendingSelection) : null
  } catch {
    return null
  }
}
