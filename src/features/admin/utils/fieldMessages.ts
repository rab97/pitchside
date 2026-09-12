/**
 * Postgres error codes turned into something a manager can act on. The
 * interesting one is 23503: `bookings.field_id` is `on delete restrict`, so a
 * pitch that has ever been booked cannot be deleted — and the manager needs
 * to be told what to do instead, not shown a foreign key violation.
 */
export function messageForFieldWrite(error: unknown): string {
  const code = (error as { code?: string } | null)?.code
  if (code === '23503') {
    return 'Questo campo ha prenotazioni: puoi disattivarlo, non eliminarlo.'
  }
  if (code === '42501') {
    return 'Non hai i permessi per modificare questa struttura.'
  }
  return 'Non siamo riusciti a salvare il campo. Riprova.'
}
