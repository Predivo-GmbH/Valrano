import { render, screen, waitFor } from '@/test/test-utils'
import { ReviewPage } from '../ReviewPage'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}))

describe('ReviewPage', () => {
  it('renders without crashing', () => {
    expect(() => render(<ReviewPage />)).not.toThrow()
  })

  it('shows review heading or empty state', async () => {
    render(<ReviewPage />)
    await waitFor(() => {
      const headings = screen.getAllByText(/review/i)
      expect(headings.length).toBeGreaterThan(0)
    })
  })
})
