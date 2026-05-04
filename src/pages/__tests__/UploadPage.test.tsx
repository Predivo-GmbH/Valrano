import { render, screen, waitFor } from '@/test/test-utils'
import { UploadPage } from '../UploadPage'

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'companies') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: '1',
                name: 'Holcim Ltd',
                ticker: 'HOLN',
                exchange: 'SIX',
                reporting_currency: 'CHF',
                is_active: true,
                created_at: '2026-01-01T00:00:00Z',
                updated_at: '2026-01-01T00:00:00Z',
              },
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
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  },
}))

describe('UploadPage', () => {
  it('renders without crashing', () => {
    expect(() => render(<UploadPage />)).not.toThrow()
  })

  it('renders the Upload Report page heading', () => {
    render(<UploadPage />)
    // Use role=heading to target the h1 specifically, not the button
    expect(screen.getByRole('heading', { name: /upload report/i })).toBeInTheDocument()
  })

  it('shows Company label for company selector', () => {
    render(<UploadPage />)
    expect(screen.getByText('Company')).toBeInTheDocument()
  })

  it('shows Report Type label', () => {
    render(<UploadPage />)
    expect(screen.getByText('Report Type')).toBeInTheDocument()
  })

  it('shows Fiscal Year label', () => {
    render(<UploadPage />)
    expect(screen.getByText('Fiscal Year')).toBeInTheDocument()
  })

  it('shows PDF File label', () => {
    render(<UploadPage />)
    expect(screen.getByText('PDF File')).toBeInTheDocument()
  })

  it('shows drop zone with browse text', () => {
    render(<UploadPage />)
    expect(screen.getByText(/drop pdf here or click to browse/i)).toBeInTheDocument()
  })

  it('has a file input that accepts PDF files', () => {
    render(<UploadPage />)
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null
    expect(fileInput).not.toBeNull()
    expect(fileInput?.getAttribute('accept')).toMatch(/pdf/)
  })

  it('renders all step indicator steps', () => {
    render(<UploadPage />)
    expect(screen.getByText('Upload PDF')).toBeInTheDocument()
    expect(screen.getByText('Extract KPIs')).toBeInTheDocument()
    expect(screen.getByText('Normalize')).toBeInTheDocument()
    expect(screen.getByText('Done')).toBeInTheDocument()
  })

  it('renders an Upload Report action button', () => {
    render(<UploadPage />)
    // There are two "Upload Report" texts: h1 and button — use getAllByText
    const matches = screen.getAllByText(/upload report/i)
    expect(matches.length).toBeGreaterThanOrEqual(2) // heading + button
  })

  it('shows subtitle about PDF and KPI extraction', () => {
    render(<UploadPage />)
    expect(screen.getByText(/upload an annual or sustainability report/i)).toBeInTheDocument()
  })

  it('loads company list from supabase and shows select placeholder', async () => {
    render(<UploadPage />)
    await waitFor(() => {
      expect(screen.getByText(/select company/i)).toBeInTheDocument()
    })
  })
})
