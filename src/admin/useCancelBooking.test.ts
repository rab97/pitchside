import { describe, expect, it } from 'vitest'
import { isLateCancel } from './useCancelBooking'

describe('isLateCancel', () => {
  it('prima della scadenza la disdetta è gratuita', () => {
    expect(isLateCancel(
      new Date('2025-10-14T20:30:00Z'), new Date('2025-10-14T18:00:00Z'))).toBe(false)
  })
  it('dopo la scadenza la disdetta è tardiva', () => {
    expect(isLateCancel(
      new Date('2025-10-14T20:30:00Z'), new Date('2025-10-14T21:00:00Z'))).toBe(true)
  })
})
