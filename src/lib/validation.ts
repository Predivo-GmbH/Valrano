import { z } from 'zod'

// ---------------------------------------------------------------------------
// Login Form
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export type LoginFormData = z.infer<typeof loginSchema>

// ---------------------------------------------------------------------------
// Signup Form (profile completion step)
// ---------------------------------------------------------------------------

export const signupProfileSchema = z
  .object({
    fullName: z.string().min(1, 'Full name is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type SignupProfileFormData = z.infer<typeof signupProfileSchema>

// ---------------------------------------------------------------------------
// Upload Report — file validation
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 250 * 1024 * 1024 // 250 MB
const ACCEPTED_TYPES = ['application/pdf']

export const uploadFileSchema = z.object({
  file: z
    .instanceof(File)
    .refine((f) => ACCEPTED_TYPES.includes(f.type), 'Only PDF files are supported')
    .refine((f) => f.size <= MAX_FILE_SIZE, 'File exceeds the 250 MB size limit'),
})

export type UploadFileData = z.infer<typeof uploadFileSchema>

/**
 * Validate an array of files for upload.
 * Returns { valid, errors } where errors is a map of filename -> error message.
 */
export function validateUploadFiles(files: File[]): {
  valid: File[]
  errors: Map<string, string>
} {
  const valid: File[] = []
  const errors = new Map<string, string>()

  for (const file of files) {
    const result = uploadFileSchema.safeParse({ file })
    if (result.success) {
      valid.push(file)
    } else {
      errors.set(file.name, result.error.issues[0].message)
    }
  }

  return { valid, errors }
}
