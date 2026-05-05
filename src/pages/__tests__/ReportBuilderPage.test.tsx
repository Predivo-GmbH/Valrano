import { render, screen, waitFor, fireEvent } from '@/test/test-utils'
import { ReportBuilderPage } from '../ReportBuilderPage'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'custom_reports') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }
      }
      if (table === 'report_templates') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              { id: 't1', name: 'Board Presentation', description: 'For board meetings', category: 'executive', template_json: { sections: ['executive_summary'], style: 'board_presentation', max_kpis: 6, include_charts: true, include_narrative: true }, is_system: true },
            ],
            error: null,
          }),
        }
      }
      if (table === 'companies') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [{ id: 'c1', name: 'Holcim', is_active: true }], error: null }),
        }
      }
      if (table === 'kpi_definitions') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [{ id: 'k1', code: 'revenue', name: 'Revenue', is_active: true, display_order: 1 }], error: null }),
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

describe('ReportBuilderPage', () => {
  it('renders page title', () => {
    render(<ReportBuilderPage />)
    expect(screen.getByText('Report Builder')).toBeInTheDocument()
  })

  it('shows New Report button', () => {
    render(<ReportBuilderPage />)
    expect(screen.getByText('New Report')).toBeInTheDocument()
  })

  it('shows empty state when no reports', async () => {
    render(<ReportBuilderPage />)
    await waitFor(() => {
      expect(screen.getByText('No reports yet')).toBeInTheDocument()
    })
  })

  it('opens create dialog on button click', async () => {
    render(<ReportBuilderPage />)
    fireEvent.click(screen.getByText('New Report'))
    expect(screen.getByPlaceholderText('e.g., Q4 2025 Board Presentation')).toBeInTheDocument()
  })

  it('shows template selector in create dialog', async () => {
    render(<ReportBuilderPage />)
    fireEvent.click(screen.getByText('New Report'))
    await waitFor(() => {
      expect(screen.getByText('Custom (no template)')).toBeInTheDocument()
    })
  })
})
