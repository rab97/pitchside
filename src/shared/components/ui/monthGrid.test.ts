import { describe, expect, it } from 'vitest'
import { monthGrid } from './monthGrid'

describe('monthGrid', () => {
  it('always returns six whole weeks', () => {
    // A fixed number of cells keeps the popover from resizing as the month
    // changes, which is what makes a calendar feel like it jumps.
    expect(monthGrid(new Date('2026-09-15T12:00:00+02:00'))).toHaveLength(42)
    expect(monthGrid(new Date('2026-02-15T12:00:00+01:00'))).toHaveLength(42)
  })

  it('starts on the Monday on or before the first of the month', () => {
    // 1 September 2026 is a Tuesday, so the grid opens on Monday the 31st.
    const grid = monthGrid(new Date('2026-09-15T12:00:00+02:00'))
    expect(grid[0].getDate()).toBe(31)
    expect(grid[0].getMonth()).toBe(7) // August
  })

  it('puts every day at noon, so a timezone cannot shift it', () => {
    for (const d of monthGrid(new Date('2026-09-15T12:00:00+02:00'))) {
      expect(d.getHours()).toBe(12)
    }
  })

  it('contains every day of the month it is given', () => {
    const grid = monthGrid(new Date('2026-09-15T12:00:00+02:00'))
    const september = grid.filter((d) => d.getMonth() === 8)
    expect(september).toHaveLength(30)
  })
})
