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

// The conflict preview is a plain `select`, not an RPC: whatever it fails
// on (network, a stale session, anything else) is not something a manager
// can tell apart from here, and none of it changes what has to be said —
// the check simply did not happen, so the dialog must not claim it did.
export function messageForClosureConflictsError(_error: unknown): string {
  return 'Non siamo riusciti a controllare le prenotazioni in questo periodo.'
}

// Distinct from messageForClosureWrite: that one is create_closure's RPC
// failure ("save"), this one is the plain `delete` on `closures` — saying
// "save" for a failed delete would misstate what was actually attempted.
export function messageForClosureDelete(_error: unknown): string {
  return 'Non siamo riusciti a eliminare la chiusura. Riprova.'
}
