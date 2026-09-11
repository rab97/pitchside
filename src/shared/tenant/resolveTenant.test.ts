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

describe('hostnameFor — hostname imposto in sviluppo', () => {
  it('batte l’hostname del browser', () => {
    // Il caso vero: l’app aperta dal telefono all’indirizzo di rete della
    // macchina, che nessuna struttura dichiara fra i propri domini.
    expect(hostnameFor({
      isNative: false, hostname: '192.168.0.249', override: 'localhost',
    })).toBe('localhost')
  })

  it('batte anche la preferenza salvata su nativo', () => {
    expect(hostnameFor({
      isNative: true, hostname: 'localhost', stored: 'palacalcetto', override: 'altra',
    })).toBe('altra')
  })

  it('assente o vuoto, non cambia niente', () => {
    expect(hostnameFor({ isNative: false, hostname: 'localhost', override: null }))
      .toBe('localhost')
    expect(hostnameFor({ isNative: false, hostname: 'localhost', override: '' }))
      .toBe('localhost')
  })
})
