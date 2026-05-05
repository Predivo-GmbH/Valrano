import { render, screen, waitFor } from '@/test/test-utils'
import { TrendsPage } from '../TrendsPage'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'companies') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{ id: 'c1', name: 'Holcim', is_active: true }],
            error: null,
          }),
        }
      }
      if (table === 'kpi_definitions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [{ id: 'k1', code: 'revenue', name: 'Revenue', unit_type: 'currency', is_active: true, display_order: 1 }],
            error: null,
          }),
        }
      }
      if (table === 'peer_groups') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      if (table === 'kpi_values') {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
    }),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'test@test.com' } } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    functions: { invoke: vi.fn() },
  },
}))

describe('TrendsPage', () => {
  it('renders page title', () => {
    render(<TrendsPage />)
    expect(screen.getByText('Trends & Time-Series')).toBeInTheDocument()
  })

  it('shows KPI filter dropdown', () => {
    render(<TrendsPage />)
    expect(screen.getByText('All KPIs')).toBeInTheDocument()
  })

  it('shows company filter dropdown', () => {
    render(<TrendsPage />)
    expect(screen.getByText('All Companies')).toBeInTheDocument()
  })

  it('shows empty state when no data', async () => {
    render(<TrendsPage />)
    await waitFor(() => {
      expect(screen.getByText('No trend data')).toBeInTheDocument()
    })
  })
})
