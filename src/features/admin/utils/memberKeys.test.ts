import { describe, expect, it } from 'vitest'
import { digitsOf, nameKey, phoneKey } from './memberKeys'

describe('digitsOf', () => {
  it('tiene solo le cifre, come fa l’insert che scrive il numero', () => {
    expect(digitsOf('333 111 22 33')).toBe('3331112233')
    expect(digitsOf('+39 333/111-2233')).toBe('393331112233')
    expect(digitsOf('')).toBe('')
    expect(digitsOf('   ')).toBe('')
  })
})

describe('phoneKey', () => {
  // The same ten digits `public.phone_key` keeps, and the same ten the unique
  // index is built over: the prefisso has to fall off, or a number typed as an
  // Italian writes it never matches the row it just collided with.
  it('tiene le ultime dieci cifre, come `phone_key` in SQL', () => {
    expect(phoneKey('+39 333 111 2233')).toBe('3331112233')
    expect(phoneKey('393331112233')).toBe('3331112233')
    expect(phoneKey('333 111 22 33')).toBe('3331112233')
  })

  it('due scritture dello stesso numero danno la stessa chiave', () => {
    expect(phoneKey('+39 333 111 2233')).toBe(phoneKey('3331112233'))
  })

  it('un numero più corto di dieci cifre resta quello che è', () => {
    expect(phoneKey('0173 12345')).toBe('017312345')
    expect(phoneKey('')).toBe('')
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
