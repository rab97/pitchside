import { dayKey, minutesOfDay } from '@/shared/lib/tz'

/**
 * L'istante oltre il quale `create_booking` rifiuta con PS007.
 *
 * Il database confronta `lower(p_slot) > now() + make_interval(days => n)` con
 * la propria sessione in UTC (`TimeZone = UTC`, dal file di configurazione, e
 * nessun ruolo la cambia): sono **n × 24 ore esatte**, non n giorni di
 * calendario. Le due cose coincidono quasi sempre e differiscono di un'ora
 * quando in mezzo c'è il cambio dell'ora legale — nel verso peggiore, cioè
 * offrendo al cliente un'ora che il database poi rifiuta. Verificato a mano
 * il 7 settembre 2026 con orizzonte a 61 giorni: la partenza delle 13:30 del
 * 7 novembre veniva offerta e tornava PS007, perché il limite vero era alle
 * 12:59 di Roma.
 */
export function horizonLimit(now: Date, horizonDays: number): Date {
  return new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000)
}

/**
 * L'ultima partenza ammessa nel giorno mostrato, in minuti da mezzanotte:
 *
 * - `undefined` se l'orizzonte cade dopo quel giorno, e quindi non lo tocca;
 * - i minuti del limite se il giorno mostrato *è* quello dell'orizzonte —
 *   di quel giorno è prenotabile solo la parte fino a quell'ora;
 * - `-1` se il giorno è per intero oltre l'orizzonte: nessuna partenza è
 *   `<= -1`, quindi la lista resta vuota.
 *
 * Il confronto passa da `dayKey`, cioè dal fuso della struttura, non da
 * quello del dispositivo: il giorno dell'orizzonte è quello che vede il
 * cliente al campo.
 */
export function maxStartMinForDay(day: Date, limit: Date): number | undefined {
  const shown = dayKey(day)
  const last = dayKey(limit)
  if (shown < last) return undefined
  if (shown > last) return -1
  return minutesOfDay(limit)
}
