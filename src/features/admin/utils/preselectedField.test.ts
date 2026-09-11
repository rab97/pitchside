import { describe, expect, it } from 'vitest'
import { preselectedField } from './preselectedField'

const fields = [{ id: 'a' }, { id: 'b' }]

describe('preselectedField', () => {
  it('picks the pitch the URL names', () => {
    expect(preselectedField('b', fields)).toBe('b')
  })

  it('ignores a pitch that does not exist', () => {
    // A stale link, or a pitch deleted since. Falling back to null lets the
    // page choose its own default rather than selecting nothing at all.
    expect(preselectedField('zzz', fields)).toBeNull()
  })

  it('ignores an absent parameter', () => {
    expect(preselectedField(null, fields)).toBeNull()
    expect(preselectedField('', fields)).toBeNull()
  })

  it('ignores everything while the pitches are still loading', () => {
    expect(preselectedField('b', [])).toBeNull()
  })
})
