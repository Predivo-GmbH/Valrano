import { render, screen, waitFor } from '@/test/test-utils'
import { AccountPage } from '../AccountPage'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    loading: false,
  }),
}))

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    subscription: null,
    tier: 'starter',
    status: 'active',
    isLoading: false,
    isActive: true,
  }),
}))

describe('AccountPage', () => {
  it('renders without crashing', () => {
    expect(() => render(<AccountPage />)).not.toThrow()
  })

  it('shows user email', async () => {
    render(<AccountPage />)
    await waitFor(() => {
      expect(screen.getAllByText('test@example.com').length).toBeGreaterThan(0)
    })
  })

  it('shows theme toggle', async () => {
    render(<AccountPage />)
    await waitFor(() => {
      const themeElements = screen.queryAllByText(/theme/i)
      expect(themeElements.length).toBeGreaterThan(0)
    })
  })
})
