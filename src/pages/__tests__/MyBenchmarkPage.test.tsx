import { render, screen, waitFor } from '@/test/test-utils'
import { MyBenchmarkPage } from '../MyBenchmarkPage'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'my_companies') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'mc-1',
              user_id: 'u1',
              name: 'Test Corp',
              sector: 'Technology',
              country: 'Switzerland',
              reporting_currency: 'CHF',
              headcount: 200,
              is_primary: true,
              created_at: '2026-01-01T00:00:00Z',
              updated_at: '2026-01-01T00:00:00Z',
            },
            error: null,
          }),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
        }
      }
      if (table === 'my_company_kpis') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              { id: 'k1', kpi_definition_id: 'kpi-1', fiscal_year: 2025, value: 50000000, kpi_definitions: { code: 'revenue', name: 'Revenue' } },
            ],
            error: null,
          }),
        }
      }
      if (table === 'self_benchmarks') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }
      }
      if (table === 'peer_groups') {
        return {
          select: vi.fn().mockReturnThis(),
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

describe('MyBenchmarkPage', () => {
  it('renders with company loaded (no empty state)', async () => {
    render(<MyBenchmarkPage />)
    await waitFor(() => {
      expect(screen.queryByText('No company set up')).not.toBeInTheDocument()
    })
  })

  it('shows Run Benchmark button', async () => {
    render(<MyBenchmarkPage />)
    await waitFor(() => {
      expect(screen.getByText('Run Benchmark')).toBeInTheDocument()
    })
  })

  it('shows fiscal year selector', async () => {
    render(<MyBenchmarkPage />)
    await waitFor(() => {
      expect(screen.getByText('2025')).toBeInTheDocument()
    })
  })

  it('shows peer group selector with auto option', async () => {
    render(<MyBenchmarkPage />)
    await waitFor(() => {
      expect(screen.getByText('Auto (sector match)')).toBeInTheDocument()
    })
  })

  it('shows no benchmark message when none exists', async () => {
    render(<MyBenchmarkPage />)
    await waitFor(() => {
      expect(screen.getByText('No benchmark yet')).toBeInTheDocument()
    })
  })
})
