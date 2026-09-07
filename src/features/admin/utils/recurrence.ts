import { addDays, isAfter, isBefore, startOfDay } from 'date-fns'

/**
 * Quante volte cade lo stesso giorno della settimana fra due date, estremi
 * inclusi. Serve a scrivere «32 date» accanto alla spunta: il gestore deve
 * sapere quanto sta bloccando prima di premere, non dopo.
 */
export function countOccurrences(from: Date, to: Date): number {
  // Si confrontano giorni di calendario, non istanti: `from` porta con sé
  // l'ora della prenotazione e `to` è una data scelta col calendario. Senza
  // startOfDay, una prenotazione delle 21:00 perde l'ultima occorrenza —
  // ed è proprio il conteggio che il gestore legge prima di confermare.
  const first = startOfDay(from)
  const last = startOfDay(to)
  if (isBefore(last, first)) return 0
  let n = 0
  for (let d = first; !isAfter(d, last); d = addDays(d, 7)) n++
  return n
}

/**
 * Fine stagione predefinita: il 31 maggio successivo. I gruppi fissi di questo
 * impianto ragionano per stagione — «da ottobre a maggio» — non per numero di
 * settimane, e proporre la data giusta evita che venga digitata a caso.
 */
export function defaultSeasonEnd(from: Date): Date {
  const year = from.getMonth() >= 5 ? from.getFullYear() + 1 : from.getFullYear()
  return new Date(year, 4, 31)
}
