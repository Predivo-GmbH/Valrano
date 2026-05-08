import { render, screen, waitFor } from '@/test/test-utils'
import { AccountingProfilePage } from '../AccountingProfilePage'

vi.mock('@/hooks/useAccountingProfile', () => ({
  useAccountingProfile: () => ({ data: null, isLoading: false }),
  useAnalyzeAccountingProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteAccountingProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useData', () => ({
  useReports: () => ({ data: [], isLoading: false }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
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

describe('AccountingProfilePage', () => {
  it('renders without crashing', () => {
    expect(() => render(<AccountingProfilePage />)).not.toThrow()
  })

  it('shows accounting profile content', async () => {
    render(<AccountingProfilePage />)
    await waitFor(() => {
      const matches = screen.getAllByText(/accounting/i)
      expect(matches.length).toBeGreaterThan(0)
    })
  })
})
