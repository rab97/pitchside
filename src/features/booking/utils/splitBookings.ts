import type { MyBooking } from '../hooks/useMyBookings'

/**
 * Divide le prenotazioni fra future e passate. Non basta confrontare
 * `slot_start` con adesso: una disdetta resta fra le passate anche se lo slot
 * che aveva prenotato deve ancora arrivare — non è più qualcosa a cui andare,
 * ed è lì che il cliente la ritrova, con l'etichetta che dice cos'è successo.
 * Solo le prenotazioni ancora `active` possono comparire fra le future.
 *
 * Le future sono in ordine crescente (la più vicina per prima), le passate
 * in ordine decrescente (la più recente per prima).
 */
export function splitBookings(
  bookings: MyBooking[],
  now: Date,
): { future: MyBooking[]; past: MyBooking[] } {
  const future = bookings
    .filter((b) => b.status === 'active' && b.slot_start >= now)
    .sort((a, b) => a.slot_start.getTime() - b.slot_start.getTime())

  const past = bookings
    .filter((b) => b.status !== 'active' || b.slot_start < now)
    .sort((a, b) => b.slot_start.getTime() - a.slot_start.getTime())

  return { future, past }
}
