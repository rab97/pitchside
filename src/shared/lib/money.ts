/** Centesimi → '€ 37,50'. Il denaro è sempre un intero di centesimi. */
export function formatEuro(cents: number): string {
  return new Intl.NumberFormat('it-IT',
    { style: 'currency', currency: 'EUR' }).format(cents / 100)
}
