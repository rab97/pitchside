/**
 * The two failures this form can actually produce, said in words a manager
 * can act on. `23P01` is `price_bands_no_overlap` — the constraint that makes
 * an ambiguous price impossible — and `23514` is the `ends_min > starts_min`
 * check.
 */
export function messageForBandWrite(error: unknown): string {
  const code = (error as { code?: string } | null)?.code
  if (code === '23P01') {
    return 'Questa fascia si sovrappone a una già impostata: correggi gli orari o modifica quella.'
  }
  if (code === '23514') {
    return 'Gli orari non sono validi: la fine deve venire dopo l’inizio.'
  }
  return 'Non siamo riusciti a salvare la fascia. Riprova.'
}
