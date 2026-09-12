import { describe, expect, it } from 'vitest'
import { digitsOf, nameKey } from './memberKeys'

describe('digitsOf', () => {
  it('tiene solo le cifre, come fa l’insert che scrive il numero', () => {
    expect(digitsOf('333 111 22 33')).toBe('3331112233')
    expect(digitsOf('+39 333/111-2233')).toBe('393331112233')
    expect(digitsOf('')).toBe('')
    expect(digitsOf('   ')).toBe('')
  })
})

describe('nameKey', () => {
  it('ignora accenti, maiuscole e spazi ai bordi, come `name_key` in SQL', () => {
    expect(nameKey('Nicolò')).toBe(nameKey('nicolo'))
    expect(nameKey('  Rossi Luca ')).toBe('rossi luca')
    expect(nameKey('ÀÈÌÒÙ')).toBe('aeiou')
  })

  it('non confonde due nomi diversi', () => {
    expect(nameKey('Rossi Luca')).not.toBe(nameKey('Rossi Luigi'))
  })
})
