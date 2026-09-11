/**
 * L'etichetta di una durata in minuti: `60` → `1h`, `90` → `1h 30`.
 *
 * La stessa frase va scritta in tre posti — i pulsanti della durata, il
 * riepilogo a fianco e il foglio di conferma su telefono — e la ripetizione
 * di tre ternari annidati era il modo sicuro di farli divergere.
 *
 * Le durate offerte oggi sono 60, 90 e 120 minuti; la ricaduta non è un caso
 * impossibile ma il comportamento per una durata che non è ancora fra quelle
 * scelte a mano, e dice il vero: `75` diventa `1h 15`.
 */
export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h}h` : `${h}h ${m}`
}
