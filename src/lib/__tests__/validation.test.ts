import { describe, it, expect } from 'vitest'
import { loginSchema, signupProfileSchema, uploadFileSchema, validateUploadFiles } from '@/lib/validation'

describe('loginSchema', () => {
  it('accepts valid email and password', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: 'password123' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'password123' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toContain('email')
  })

  it('rejects short password', () => {
    const result = loginSchema.safeParse({ email: 'test@example.com', password: 'short' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toContain('8 characters')
  })

  it('rejects empty email', () => {
    const result = loginSchema.safeParse({ email: '', password: 'password123' })
    expect(result.success).toBe(false)
  })
})

describe('signupProfileSchema', () => {
  it('accepts valid profile data', () => {
    const result = signupProfileSchema.safeParse({
      fullName: 'Maria Schmidt',
      password: 'securepassword',
      confirmPassword: 'securepassword',
    })
    expect(result.success).toBe(true)
  })

  it('rejects mismatched passwords', () => {
    const result = signupProfileSchema.safeParse({
      fullName: 'Maria Schmidt',
      password: 'securepassword',
      confirmPassword: 'differentpassword',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toContain('match')
  })

  it('rejects empty full name', () => {
    const result = signupProfileSchema.safeParse({
      fullName: '',
      password: 'securepassword',
      confirmPassword: 'securepassword',
    })
    expect(result.success).toBe(false)
  })

  it('rejects password under 8 characters', () => {
    const result = signupProfileSchema.safeParse({
      fullName: 'Maria Schmidt',
      password: '1234567',
      confirmPassword: '1234567',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toContain('8 characters')
  })
})

describe('uploadFileSchema', () => {
  it('accepts a valid PDF file', () => {
    const file = new File(['content'], 'report.pdf', { type: 'application/pdf' })
    const result = uploadFileSchema.safeParse({ file })
    expect(result.success).toBe(true)
  })

  it('rejects non-PDF file', () => {
    const file = new File(['content'], 'image.png', { type: 'image/png' })
    const result = uploadFileSchema.safeParse({ file })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toContain('PDF')
  })
})

describe('validateUploadFiles', () => {
  it('separates valid and invalid files', () => {
    const pdf = new File(['content'], 'report.pdf', { type: 'application/pdf' })
    const png = new File(['content'], 'image.png', { type: 'image/png' })
    const { valid, errors } = validateUploadFiles([pdf, png])
    expect(valid).toHaveLength(1)
    expect(valid[0].name).toBe('report.pdf')
    expect(errors.size).toBe(1)
    expect(errors.has('image.png')).toBe(true)
  })

  it('returns all valid when all files are PDFs', () => {
    const pdf1 = new File(['content'], 'a.pdf', { type: 'application/pdf' })
    const pdf2 = new File(['content'], 'b.pdf', { type: 'application/pdf' })
    const { valid, errors } = validateUploadFiles([pdf1, pdf2])
    expect(valid).toHaveLength(2)
    expect(errors.size).toBe(0)
  })

  it('returns all errors when no files are valid', () => {
    const txt = new File(['content'], 'notes.txt', { type: 'text/plain' })
    const { valid, errors } = validateUploadFiles([txt])
    expect(valid).toHaveLength(0)
    expect(errors.size).toBe(1)
  })
})
