import { describe, expect, it } from 'vitest'
import { durationLabel } from './durationLabel'

describe('durationLabel', () => {
  it('scrive le tre durate offerte come le scrive l\'interfaccia', () => {
    expect(durationLabel(60)).toBe('1h')
    expect(durationLabel(90)).toBe('1h 30')
    expect(durationLabel(120)).toBe('2h')
  })

  it('non inventa niente per una durata fuori dalle tre', () => {
    expect(durationLabel(75)).toBe('1h 15')
    expect(durationLabel(30)).toBe('30 min')
    expect(durationLabel(180)).toBe('3h')
  })
})
