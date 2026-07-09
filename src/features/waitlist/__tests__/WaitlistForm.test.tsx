import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WaitlistForm } from '@/features/waitlist/WaitlistForm'

// Control the anon insert into the `waitlist` table per test.
const insertMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(() => ({ insert: insertMock })) },
}))

describe('WaitlistForm', () => {
  beforeEach(() => {
    insertMock.mockReset()
    insertMock.mockResolvedValue({ error: null })
  })

  it('rejects an invalid email without calling insert', async () => {
    const user = userEvent.setup()
    render(<WaitlistForm source="test" />)
    await user.type(screen.getByLabelText(/email address/i), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /notify me/i }))
    expect(screen.getByText(/valid email address/i)).toBeInTheDocument()
    expect(insertMock).not.toHaveBeenCalled()
  })

  it('inserts the normalized email + source and confirms on success', async () => {
    const user = userEvent.setup()
    render(<WaitlistForm source="landing-hero" />)
    await user.type(screen.getByLabelText(/email address/i), 'Founder@Company.com')
    await user.click(screen.getByRole('button', { name: /notify me/i }))
    expect(await screen.findByText(/on the list/i)).toBeInTheDocument()
    expect(insertMock).toHaveBeenCalledWith({ email: 'founder@company.com', source: 'landing-hero' })
  })

  it('treats a duplicate (23505) as already on the list', async () => {
    insertMock.mockResolvedValue({ error: { code: '23505' } })
    const user = userEvent.setup()
    render(<WaitlistForm source="test" />)
    await user.type(screen.getByLabelText(/email address/i), 'dupe@company.com')
    await user.click(screen.getByRole('button', { name: /notify me/i }))
    expect(await screen.findByText(/already on the waitlist/i)).toBeInTheDocument()
  })
})
