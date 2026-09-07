export type PriceBand = {
  weekdays: number[]
  starts_min: number
  ends_min: number
  price_cents: number
}

/**
 * Stima del prezzo di uno slot dalle stesse `price_bands` che il database
 * legge in `calc_booking_price` (supabase/migrations/0005_price_bands.sql):
 * somma i minuti che cadono in ciascuna fascia, prezzo pro-rata sull'ora.
 *
 * Il calcolo autorevole — con lock sulla riga e dentro la transazione della
 * prenotazione — resta quella funzione plpgsql. Questa è una stima lato
 * client sugli stessi dati pubblici, per mostrare un prezzo prima ancora di
 * aver fatto accesso; i casi qui sotto sono gli stessi di
 * supabase/tests/003_price.test.sql, a garanzia che le due strade concordino.
 *
 * `weekday` è il giorno ISO (1 lunedì … 7 domenica, vedi `isoWeekday` in
 * shared/lib/tz.ts): le fasce non attraversano la mezzanotte, quindi non
 * serve gestire il cambio di giorno dentro il ciclo.
 *
 * Torna `null` quando un minuto dello slot non cade in nessuna fascia: come
 * nel database, l'assenza di fascia vuol dire "fuori orario di apertura", e
 * lì non c'è una stima onesta da mostrare.
 */
export function estimatePrice(
  bands: PriceBand[],
  weekday: number,
  startMin: number,
  durationMin: number,
): number | null {
  const end = startMin + durationMin
  let cur = startMin
  let total = 0
  let guard = 0

  while (cur < end) {
    guard += 1
    if (guard > 100) return null

    const band = bands.find(
      (b) => b.weekdays.includes(weekday) && cur >= b.starts_min && cur < b.ends_min,
    )
    if (!band) return null

    const segEnd = Math.min(end, band.ends_min)
    total += band.price_cents * ((segEnd - cur) / 60)
    cur = segEnd
  }

  return Math.round(total)
}
