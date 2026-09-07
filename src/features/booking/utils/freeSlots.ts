export type FreeSlotsInput = {
  openMin: number
  closeMin: number
  stepMin: number
  durationMin: number
  /** intervalli occupati in minuti da mezzanotte, estremo destro escluso */
  busy: [number, number][]
  /** se il giorno mostrato è oggi, i minuti già passati */
  nowMin?: number
}

/**
 * Le partenze prenotabili di una giornata su un campo.
 *
 * Il confronto è semiaperto come il `tstzrange` del database: una prenotazione
 * che finisce alle 21:00 lascia libera la partenza delle 21:00. Se qui fosse
 * chiuso, il cliente vedrebbe meno slot di quanti il database ne accetta, e
 * nessuno capirebbe perché.
 *
 * Non decide niente: il database resta l'unico a stabilire se una prenotazione
 * si può fare. Questa funzione evita al cliente di provarci invano.
 */
export function freeSlots(input: FreeSlotsInput): number[] {
  const { openMin, closeMin, stepMin, durationMin, busy, nowMin } = input
  const out: number[] = []

  for (let start = openMin; start + durationMin <= closeMin; start += stepMin) {
    if (nowMin !== undefined && start < nowMin) continue
    const end = start + durationMin
    const collide = busy.some(([bs, be]) => start < be && end > bs)
    if (!collide) out.push(start)
  }

  return out
}
