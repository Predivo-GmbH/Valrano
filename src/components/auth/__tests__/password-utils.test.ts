import { getPasswordScore } from '@/components/auth/password-utils'

describe('getPasswordScore', () => {
  it('returns 0 for empty string', () => {
    expect(getPasswordScore('')).toBe(0)
  })

  it('returns 1 for short lowercase only', () => {
    expect(getPasswordScore('abcdefgh')).toBe(2) // length + lowercase
  })

  it('returns higher score for mixed case', () => {
    expect(getPasswordScore('Abcdefgh')).toBe(3) // length + upper + lower
  })

  it('returns higher score with numbers', () => {
    expect(getPasswordScore('Abcdef1h')).toBe(4) // length + upper + lower + number
  })

  it('returns 5 for strong password', () => {
    expect(getPasswordScore('Abcdef1!')).toBe(5) // all 5 criteria
  })

  it('short password misses length point', () => {
    expect(getPasswordScore('Ab1!')).toBe(4) // upper + lower + number + special, no length
  })
})
