import { render, screen, fireEvent, waitFor } from '@/test/test-utils'
import { AdminPage } from '../AdminPage'

// F-018: Admin / Dev Tools panel.
// NOTE: the standalone DevTierSwitcher component described in FEATURES.md was removed
// ("admin controls moved to Settings > Admin tab" — see AppLayout.tsx). The tier-override,
// news-gathering toggle and user list now live in src/pages/AdminPage.tsx, which this suite
// covers: super-admin gating, user list (name + company), tier switching, and news toggle
// persistence in localStorage.

const ADMIN_EMAIL = 'roger@mueller.ro' // SUPER_ADMIN_EMAIL

const USERS = [
  { id: 'u1', email: 'alice@corp.com', full_name: 'Alice Admin', company_name: 'Acme AG', created_at: '2026-01-01T00:00:00Z', tier: 'starter' },
  { id: 'u2', email: 'bob@peer.com', full_name: null, company_name: null, created_at: '2026-01-02T00:00:00Z', tier: 'professional' },
]

const rpcMock = vi.fn((fn: string) => {
  if (fn === 'admin_list_users') return Promise.resolve({ data: USERS, error: null })
  return Promise.resolve({ data: null, error: null })
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(args[0] as string),
    from: vi.fn(() => ({ select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockResolvedValue({ data: [], error: null }) })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
  getCurrentUserId: vi.fn().mockResolvedValue('admin'),
}))

const hoisted = vi.hoisted(() => ({ email: 'roger@mueller.ro' }))
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'admin', email: hoisted.email }, loading: false }),
}))

describe('AdminPage (F-018 admin / dev tools)', () => {
  beforeEach(() => {
    localStorage.clear()
    rpcMock.mockClear()
    hoisted.email = ADMIN_EMAIL
  })

  it('denies access to non super-admin users', () => {
    hoisted.email = 'someone@else.com'
    render(<AdminPage />)
    expect(screen.getByText(/Access denied\. Super admin only\./i)).toBeInTheDocument()
  })

  it('renders the user list with name and company for the super admin', async () => {
    render(<AdminPage />)
    expect(await screen.findByText('alice@corp.com')).toBeInTheDocument()
    expect(screen.getByText('Alice Admin · Acme AG')).toBeInTheDocument()
    expect(screen.getByText('bob@peer.com')).toBeInTheDocument()
  })

  it('persists the news-gathering toggle to localStorage', async () => {
    render(<AdminPage />)
    await screen.findByText('alice@corp.com')
    // First News toggle corresponds to the first user (u1), initially enabled
    const newsToggle = screen.getAllByTitle(/News enabled/i)[0]
    fireEvent.click(newsToggle)
    await waitFor(() => {
      const disabled = JSON.parse(localStorage.getItem('valrano-news-disabled-users') || '[]')
      expect(disabled).toContain('u1')
    })
  })

  it('switches a user tier through the confirmation dialog', async () => {
    render(<AdminPage />)
    await screen.findByText('alice@corp.com')
    // u1 is on "starter"; click "Professional" in u1's row (first occurrence)
    fireEvent.click(screen.getAllByText('Professional')[0])
    // Confirmation dialog surfaces the tier change
    expect(await screen.findByText(/tier from starter to professional/i)).toBeInTheDocument()
    // Confirm -> admin_update_tier RPC
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith('admin_update_tier')
    })
  })
})
