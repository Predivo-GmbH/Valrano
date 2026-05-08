import { render, screen, waitFor } from '@/test/test-utils'
import { SettingsPage } from '../SettingsPage'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    loading: false,
  }),
}))

vi.mock('@/hooks/useSubscription', () => ({
  SUPER_ADMIN_EMAIL: 'roger@mueller.ro',
  useSubscription: () => ({
    subscription: null,
    tier: 'starter',
    status: 'active',
    isLoading: false,
    isActive: true,
    isSuperAdmin: false,
  }),
}))

vi.mock('@/hooks/useAccountingProfile', () => ({
  useAccountingProfile: () => ({ data: null, isLoading: false }),
  useAnalyzeAccountingProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteAccountingProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useData', () => ({
  useCompanies: () => ({ data: [], isLoading: false }),
  useReports: () => ({ data: [], isLoading: false }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user', email: 'test@example.com' } } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}))

describe('SettingsPage', () => {
  it('renders without crashing', () => {
    expect(() => render(<SettingsPage />)).not.toThrow()
  })

  it('shows settings tab labels', async () => {
    render(<SettingsPage />)
    await waitFor(() => {
      expect(screen.getAllByRole('tab').length).toBeGreaterThanOrEqual(5)
    })
  })

  it('shows Settings heading', async () => {
    render(<SettingsPage />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument()
    })
  })
})
