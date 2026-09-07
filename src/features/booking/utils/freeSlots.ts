export type FreeSlotsInput = {
  /**
   * Le partenze candidate della giornata, in minuti da mezzanotte: sono le
   * chiavi che `slot_prices` ha restituito, cioè le sole partenze per cui
   * esiste un prezzo.
   */
  starts: number[]
  durationMin: number
  /** intervalli occupati in minuti da mezzanotte, estremo destro escluso */
  busy: [number, number][]
  /** se il giorno mostrato è oggi, i minuti già passati */
  nowMin?: number
  /**
   * L'ultima partenza che l'orizzonte di prenotazione ammette, se il giorno
   * mostrato è quello dell'orizzonte. `create_booking` confronta istanti, non
   * giorni interi: l'ultimo giorno è prenotabile solo fino all'ora in cui
   * siamo adesso.
   */
  maxStartMin?: number
}

/**
 * Le partenze prenotabili di una giornata su un campo.
 *
 * Non genera niente: filtra. Le partenze arrivano da `slot_prices`, che le
 * ricava dalle `price_bands` e salta deliberatamente quelle che cadono in un
 * buco fra due fasce. Prima questa funzione le rigenerava da apertura,
 * chiusura e passo, e le partenze senza prezzo ricomparivano in elenco con
 * «—» al posto dell'importo: selezionabili, con un «Totale —» nel riepilogo,
 * e una conferma che moriva con PS005. Su una schermata che riguarda denaro
 * l'elenco degli orari e la fonte del prezzo devono essere lo stesso insieme.
 *
 * Il confronto con gli occupati è semiaperto come il `tstzrange` del
 * database: una prenotazione che finisce alle 21:00 lascia libera la partenza
 * delle 21:00. Se qui fosse chiuso, il cliente vedrebbe meno slot di quanti
 * il database ne accetta, e nessuno capirebbe perché.
 *
 * Non decide niente: il database resta l'unico a stabilire se una
 * prenotazione si può fare. Questa funzione evita al cliente di provarci
 * invano.
 */
export function freeSlots(input: FreeSlotsInput): number[] {
  const { starts, durationMin, busy, nowMin, maxStartMin } = input

  return starts
    .filter((start) => nowMin === undefined || start >= nowMin)
    .filter((start) => maxStartMin === undefined || start <= maxStartMin)
    .filter((start) => {
      const end = start + durationMin
      return !busy.some(([bs, be]) => start < be && end > bs)
    })
    .sort((a, b) => a - b)
}
