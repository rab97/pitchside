import { describe, expect, it } from 'vitest'
import { messageForBandWrite } from './bandMessages'

describe('messageForBandWrite', () => {
  it('names the overlap for what it is', () => {
    // 23P01 is the exclusion violation from price_bands_no_overlap.
    expect(messageForBandWrite({ code: '23P01' }))
      .toBe('Questa fascia si sovrappone a una già impostata: correggi gli orari o modifica quella.')
  })

  it('explains an impossible time range', () => {
    expect(messageForBandWrite({ code: '23514' }))
      .toBe('Gli orari non sono validi: la fine deve venire dopo l’inizio.')
  })

  it('falls back without inventing a cause', () => {
    expect(messageForBandWrite({ code: 'XX000' }))
      .toBe('Non siamo riusciti a salvare la fascia. Riprova.')
  })
})
