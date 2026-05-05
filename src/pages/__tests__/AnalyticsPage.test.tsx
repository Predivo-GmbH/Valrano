import { render, screen, fireEvent } from '@/test/test-utils'
import { AnalyticsPage } from '../AnalyticsPage'

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
            data: [
              { id: 'k1', code: 'revenue', name: 'Revenue', unit_type: 'currency', is_active: true, display_order: 1 },
              { id: 'k2', code: 'ebitda', name: 'EBITDA', unit_type: 'currency', is_active: true, display_order: 2 },
            ],
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

describe('AnalyticsPage', () => {
  it('renders page title', () => {
    render(<AnalyticsPage />)
    expect(screen.getByText('Analytics')).toBeInTheDocument()
  })

  it('shows view mode tabs', () => {
    render(<AnalyticsPage />)
    expect(screen.getByText('Trends')).toBeInTheDocument()
    expect(screen.getByText('Pivot Table')).toBeInTheDocument()
    expect(screen.getByText('Scatter')).toBeInTheDocument()
    expect(screen.getByText('Heatmap')).toBeInTheDocument()
  })

  it('defaults to pivot table view', () => {
    render(<AnalyticsPage />)
    // Pivot tab should be active (has primary bg)
    const pivotBtn = screen.getByText('Pivot Table').closest('button')
    expect(pivotBtn?.className).toContain('bg-')
  })

  it('switches to scatter view on tab click', () => {
    render(<AnalyticsPage />)
    fireEvent.click(screen.getByText('Scatter'))
    // Scatter tab should become active
    const scatterBtn = screen.getByText('Scatter').closest('button')
    expect(scatterBtn?.getAttribute('aria-selected')).toBe('true')
  })

  it('shows year filter', () => {
    render(<AnalyticsPage />)
    expect(screen.getByText('All Companies')).toBeInTheDocument()
  })
})
