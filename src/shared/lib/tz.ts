import { fromZonedTime, toZonedTime } from 'date-fns-tz'

export const TZ = 'Europe/Rome'

const pad = (n: number) => String(n).padStart(2, '0')

/** Minuti da mezzanotte → '20:30', per etichette e aria-label. */
export function minToLabel(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
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
