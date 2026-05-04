import { render, screen, fireEvent } from '@testing-library/react'
import OtpInput from '@/components/auth/OtpInput'

describe('OtpInput', () => {
  it('renders 6 input fields', () => {
    render(<OtpInput onComplete={vi.fn()} />)
    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(6)
  })

  it('auto-advances to next input on digit entry', () => {
    render(<OtpInput onComplete={vi.fn()} />)
    const inputs = screen.getAllByRole('textbox')
    fireEvent.change(inputs[0], { target: { value: '1' } })
    expect(document.activeElement).toBe(inputs[1])
  })

  it('calls onComplete when all 6 digits entered', () => {
    const onComplete = vi.fn()
    render(<OtpInput onComplete={onComplete} />)
    const inputs = screen.getAllByRole('textbox')
    '123456'.split('').forEach((digit, i) => {
      fireEvent.change(inputs[i], { target: { value: digit } })
    })
    expect(onComplete).toHaveBeenCalledWith('123456')
  })

  it('disables all inputs when disabled prop is true', () => {
    render(<OtpInput onComplete={vi.fn()} disabled />)
    const inputs = screen.getAllByRole('textbox')
    inputs.forEach((input) => {
      expect(input).toBeDisabled()
    })
  })

  it('handles paste of 6 digits', () => {
    const onComplete = vi.fn()
    render(<OtpInput onComplete={onComplete} />)
    const inputs = screen.getAllByRole('textbox')
    fireEvent.paste(inputs[0], {
      clipboardData: { getData: () => '654321' },
    })
    expect(onComplete).toHaveBeenCalledWith('654321')
  })
})
