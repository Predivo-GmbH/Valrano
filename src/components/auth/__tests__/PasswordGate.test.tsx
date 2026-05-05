import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PasswordGate from '@/components/auth/PasswordGate'

describe('PasswordGate', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('shows password input when locked', () => {
    render(<PasswordGate><div>Protected</div></PasswordGate>)
    expect(screen.getByPlaceholderText('Enter access password')).toBeInTheDocument()
    expect(screen.queryByText('Protected')).not.toBeInTheDocument()
  })

  it('shows children when session is unlocked', () => {
    sessionStorage.setItem('bs_unlocked', 'true')
    render(<PasswordGate><div>Protected</div></PasswordGate>)
    expect(screen.getByText('Protected')).toBeInTheDocument()
  })

  it('unlocks with correct password', async () => {
    render(<PasswordGate><div>Protected</div></PasswordGate>)
    const input = screen.getByPlaceholderText('Enter access password')
    fireEvent.change(input, { target: { value: 'predivo2026' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('Protected')).toBeInTheDocument()
    })
  })

  it('shows error for wrong password', async () => {
    render(<PasswordGate><div>Protected</div></PasswordGate>)
    const input = screen.getByPlaceholderText('Enter access password')
    fireEvent.change(input, { target: { value: 'wrong' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('Incorrect password')).toBeInTheDocument()
    })
  })
})
