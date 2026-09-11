/**
 * Moves the item at `from` to `to`, leaving every other item in its relative
 * order. Pure array logic: no `sort_order`, no database, provable without
 * either.
 */
export function reorder<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/**
 * Renumbers `items` from 1 in their given order and returns only the rows
 * whose `sort_order` actually changes. A drag near the bottom of a long list
 * moves one row through many positions but leaves everything above it
 * untouched — rewriting every row's `sort_order` regardless would turn a
 * one-row drag into a write on the whole list.
 */
export function sortOrderPatches(
  items: { id: string; sort_order: number }[],
): { id: string; sort_order: number }[] {
  const patches: { id: string; sort_order: number }[] = []
  items.forEach((item, index) => {
    const sort_order = index + 1
    if (item.sort_order !== sort_order) {
      patches.push({ id: item.id, sort_order })
    }
  })
  return patches
}
