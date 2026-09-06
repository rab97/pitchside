import { describe, expect, it } from 'vitest'
import { hostnameFor } from './resolveTenant'

describe('hostnameFor', () => {
  it('usa l’hostname sul web', () => {
    expect(hostnameFor({ isNative: false, hostname: 'prenota.palacalcetto.it' }))
      .toBe('prenota.palacalcetto.it')
  })

  it('usa la preferenza salvata su nativo', () => {
    expect(hostnameFor({ isNative: true, hostname: 'localhost', stored: 'palacalcetto' }))
      .toBe('palacalcetto')
  })

  it('lancia su nativo senza struttura scelta', () => {
    expect(() => hostnameFor({ isNative: true, hostname: 'localhost' })).toThrow()
  })
})
