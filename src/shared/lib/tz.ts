import { fromZonedTime, toZonedTime } from 'date-fns-tz'

export const TZ = 'Europe/Rome'

const pad = (n: number) => String(n).padStart(2, '0')

/** Minuti da mezzanotte → '20:30', per etichette e aria-label. */
export function minToLabel(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
}

// The inverse of minToLabel, for reading back an <input type="time">, which
// always reports its value as 'HH:MM' regardless of locale.
export function labelToMin(label: string): number {
  const [h, m] = label.split(':').map(Number)
  return h * 60 + m
}

/** Un istante → minuti da mezzanotte nel fuso della struttura. */
export function minutesOfDay(d: Date): number {
  const local = toZonedTime(d, TZ)
  return local.getHours() * 60 + local.getMinutes()
}

/** Un istante → 'yyyy-MM-dd' nel fuso della struttura. */
export function dayKey(d: Date): string {
  const local = toZonedTime(d, TZ)
  return `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}`
}

/**
 * Un istante → giorno ISO nel fuso della struttura: 1 lunedì … 7 domenica,
 * come `extract(isodow from …)` in Postgres. Le fasce di `price_bands`
 * indicizzano i giorni così, non con la domenica a 0 di `Date.getDay()`.
 */
export function isoWeekday(d: Date): number {
  const local = toZonedTime(d, TZ)
  const day = local.getDay()
  return day === 0 ? 7 : day
}

/**
 * Costruisce il letterale tstzrange che Postgres si aspetta, semiaperto:
 * l'estremo destro è escluso, per questo due slot adiacenti non collidono.
 *
 * `day` è 'yyyy-MM-dd' e `startMin` sono minuti da mezzanotte, entrambi letti
 * nel fuso della struttura: la funzione non guarda mai il fuso del dispositivo.
 * La durata si somma in minuti reali, non di orologio — una prenotazione di
 * 90 minuti dura 90 minuti anche la notte del cambio ora.
 */
export function slotRange(day: string, startMin: number, minutes: number): string {
  const start = fromZonedTime(
    `${day} ${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)}:00`, TZ)
  const end = new Date(start.getTime() + minutes * 60_000)
  return `["${start.toISOString()}","${end.toISOString()}")`
}

// An <input type="datetime-local"> reports 'yyyy-MM-ddTHH:mm' with no
// timezone of its own. Reading it as a wall-clock instant in the facility's
// zone — not the device's — is the same discipline slotRange already applies
// to a day and a minute-of-day.
export function localInputToDate(value: string): Date {
  return fromZonedTime(value, TZ)
}
