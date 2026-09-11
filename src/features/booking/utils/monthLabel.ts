import { addDays, format } from 'date-fns'
import { it } from 'date-fns/locale'

/**
 * Il mese (o i due mesi) da mostrare sopra la striscia dei sette giorni che
 * inizia a `windowStart`.
 *
 * L'anno compare solo quando differisce da quello corrente: undici mesi su
 * dodici la finestra è nell'anno in corso, e ripeterlo lì sarebbe solo
 * rumore. Ma quando la finestra attraversa il cambio d'anno l'eccezione
 * scompare: comparirebbe un solo anno — quello corrente, per la parte di
 * dicembre — lasciando ambiguo a quale anno appartenga gennaio. In quel caso
 * l'anno si mostra su **entrambe** le metà, anche quella che coincide con
 * l'anno corrente.
 */
export function monthLabel(windowStart: Date, now: Date = new Date()): string {
  const windowEnd = addDays(windowStart, 6)
  const currentYear = now.getFullYear()
  const startYear = windowStart.getFullYear()
  const endYear = windowEnd.getFullYear()
  const startMonth = format(windowStart, 'MMMM', { locale: it })
  const endMonth = format(windowEnd, 'MMMM', { locale: it })
  const crossesYear = startYear !== endYear

  const withYear = (month: string, year: number) =>
    crossesYear || year !== currentYear ? `${month} ${year}` : month

  if (startMonth === endMonth && !crossesYear) {
    return withYear(startMonth, startYear)
  }
  return `${withYear(startMonth, startYear)} – ${withYear(endMonth, endYear)}`
}
