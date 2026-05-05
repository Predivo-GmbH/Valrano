import { render, screen, waitFor, fireEvent } from '@/test/test-utils'
import { MyCompanyPage } from '../MyCompanyPage'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'my_companies') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [],
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
              { id: 'kpi-1', code: 'revenue', name: 'Revenue', category: 'financial', unit_type: 'currency', is_active: true, display_order: 1 },
              { id: 'kpi-2', code: 'ebitda_margin', name: 'EBITDA Margin', category: 'financial', unit_type: 'percentage', is_active: true, display_order: 2 },
            ],
            error: null,
          }),
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

describe('MyCompanyPage', () => {
  it('renders page title', async () => {
    render(<MyCompanyPage />)
    expect(screen.getByText('My Company')).toBeInTheDocument()
  })

  it('shows empty state when no companies', async () => {
    render(<MyCompanyPage />)
    await waitFor(() => {
      expect(screen.getByText('Add your company')).toBeInTheDocument()
    })
  })

  it('shows Add Company button', async () => {
    render(<MyCompanyPage />)
    await waitFor(() => {
      expect(screen.getByText('Add Company')).toBeInTheDocument()
    })
  })

  it('opens create dialog on button click', async () => {
    render(<MyCompanyPage />)
    await waitFor(() => {
      fireEvent.click(screen.getByText('Add Company'))
    })
    expect(screen.getByText('Add Your Company')).toBeInTheDocument()
  })

  it('shows company name field in create dialog', async () => {
    render(<MyCompanyPage />)
    await waitFor(() => {
      fireEvent.click(screen.getByText('Add Company'))
    })
    expect(screen.getByPlaceholderText('e.g., Acme Corp')).toBeInTheDocument()
  })
})
