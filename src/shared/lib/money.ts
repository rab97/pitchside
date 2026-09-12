/** Centesimi → '€ 37,50'. Il denaro è sempre un intero di centesimi. */
export function formatEuro(cents: number): string {
  return new Intl.NumberFormat('it-IT',
    { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

// The inverse of formatEuro, for a price form: an <input type="number">
// always reports a dot as the decimal separator regardless of locale, but a
// pasted value can still carry an Italian comma — both are accepted.
export function parseEuroToCents(value: string): number {
  const euros = Number(value.replace(',', '.').trim())
  return Math.round(euros * 100)
}
