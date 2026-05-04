import { render, screen } from '@testing-library/react'
import PasswordStrength from '@/components/auth/PasswordStrength'

describe('PasswordStrength', () => {
  it('renders nothing for empty password', () => {
    const { container } = render(<PasswordStrength password="" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders strength meter for non-empty password', () => {
    render(<PasswordStrength password="abc" />)
    const meter = screen.getByRole('meter')
    expect(meter).toBeInTheDocument()
    expect(meter).toHaveAttribute('aria-valuenow', '1')
  })

  it('shows high score for strong password', () => {
    render(<PasswordStrength password="MyStr0ng!Pass" />)
    const meter = screen.getByRole('meter')
    expect(Number(meter.getAttribute('aria-valuenow'))).toBeGreaterThanOrEqual(4)
  })
})
