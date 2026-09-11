// The RPC raises PS016 when the caller does not administer this facility
// (see `create_closure` in supabase/migrations/0019_create_closure.sql) —
// every other failure is said the same generic way, because none of them is
// something a manager could act on differently.
export function messageForClosureWrite(error: unknown): string {
  const code = (error as { code?: string } | null)?.code
  if (code === 'PS016') {
    return 'Non hai i permessi per chiudere questo impianto.'
  }
  return 'Non siamo riusciti a salvare la chiusura. Riprova.'
}
