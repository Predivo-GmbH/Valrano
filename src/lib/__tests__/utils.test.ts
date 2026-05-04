import { friendlyAuthError } from '@/lib/utils'

describe('friendlyAuthError', () => {
  it('returns friendly message for rate limit', () => {
    const err = new Error('Rate limit exceeded')
    expect(friendlyAuthError(err, 'fallback')).toBe(
      'Too many attempts. Please wait a moment and try again.'
    )
  })

  it('returns friendly message for email rate limit', () => {
    const err = new Error('Email rate limit exceeded')
    expect(friendlyAuthError(err, 'fallback')).toBe(
      'Too many emails sent. Please wait a few minutes before trying again.'
    )
  })

  it('returns friendly message for invalid credentials', () => {
    const err = new Error('Invalid login credentials')
    expect(friendlyAuthError(err, 'fallback')).toBe(
      'Incorrect email or password. Please check your credentials and try again.'
    )
  })

  it('returns friendly message for expired token', () => {
    const err = new Error('Token has expired or is invalid')
    expect(friendlyAuthError(err, 'fallback')).toBe(
      'Your verification code has expired. Please request a new one.'
    )
  })

  it('returns friendly message for invalid OTP', () => {
    const err = new Error('Invalid OTP token')
    expect(friendlyAuthError(err, 'fallback')).toBe(
      'Invalid verification code. Please check and try again.'
    )
  })

  it('returns friendly message for network error', () => {
    const err = new Error('Network request failed')
    expect(friendlyAuthError(err, 'fallback')).toBe(
      'Connection error. Please check your internet and try again.'
    )
  })

  it('returns error message for unknown Error', () => {
    const err = new Error('Something unexpected')
    expect(friendlyAuthError(err, 'fallback')).toBe('Something unexpected')
  })

  it('returns fallback for non-Error', () => {
    expect(friendlyAuthError('string error', 'fallback')).toBe('fallback')
  })

  it('returns fallback for null', () => {
    expect(friendlyAuthError(null, 'fallback')).toBe('fallback')
  })
})
