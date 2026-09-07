/**
 * Etichetta breve del tipo di campo ("a 5", "a 7", "a 11"), usata sia nella
 * scelta del campo sia nel riepilogo di conferma: un solo posto in cui
 * tradurre `kind`, non uno per ciascuna schermata.
 */
export function fieldKind(kind: string): string {
  return kind === 'calcio7' ? 'a 7' : kind === 'calcio11' ? 'a 11' : 'a 5'
}
