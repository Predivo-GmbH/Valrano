import { render, screen, waitFor } from '@/test/test-utils'
import { UploadedReportPage } from '../UploadedReportPage'

// F-005: Report Detail View
// Single uploaded report view (/uploaded-reports/:id): shows report metadata,
// all extracted KPIs with per-value confidence scores, source labels, and a
// "View PDF" link to the source document.

// Unique report ids per scenario — the shared QueryClient in test-utils caches
// by ['uploaded-report', id], so reusing an id would leak state across tests.
const hoisted = vi.hoisted(() => ({ id: 'r1' }))

function makeReport(id: string, status: string) {
  return {
    id,
    title: 'Holcim Annual Report 2025',
    report_type: 'annual',
    fiscal_year: 2025,
    fiscal_quarter: null,
    status,
    pdf_storage_path: 'reports/holcim-2025.pdf',
    companies: { id: 'c1', name: 'Holcim Ltd', ticker: 'HOLN' },
  }
}

const KPIS = [
  {
    id: 'k1',
    raw_value: 26400,
    raw_currency: 'CHF',
    confidence: 0.92,
    raw_label: 'Net sales',
    kpi_definitions: { code: 'REVENUE', name: 'Revenue', unit: 'CHF m' },
  },
  {
    id: 'k2',
    raw_value: 5100,
    raw_currency: 'CHF',
    confidence: 0.7,
    raw_label: 'Recurring EBIT (est.)',
    kpi_definitions: { code: 'EBIT', name: 'EBIT', unit: 'CHF m' },
  },
]

const createSignedUrlMock = vi.fn().mockResolvedValue({
  data: { signedUrl: 'https://example.com/signed.pdf' },
  error: null,
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'reports') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockImplementation(() =>
            Promise.resolve({
              data: makeReport(hoisted.id, hoisted.id === 'r-pending' ? 'pending' : 'extracted'),
              error: null,
            }),
          ),
        }
      }
      if (table === 'kpi_values') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: KPIS, error: null }),
        }
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }
    }),
    storage: {
      from: vi.fn(() => ({ createSignedUrl: createSignedUrlMock })),
    },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useParams: () => ({ id: hoisted.id }) }
})

describe('UploadedReportPage (F-005 report detail)', () => {
  beforeEach(() => {
    hoisted.id = 'r1'
    createSignedUrlMock.mockClear()
  })

  it('renders report title, company, and fiscal year', async () => {
    render(<UploadedReportPage />)
    // Title appears in both the breadcrumb and the page heading
    await waitFor(() => {
      expect(screen.getAllByText('Holcim Annual Report 2025').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText('Holcim Ltd').length).toBeGreaterThan(0)
    expect(screen.getByText(/FY 2025/)).toBeInTheDocument()
  })

  it('displays all extracted KPIs with confidence scores', async () => {
    render(<UploadedReportPage />)
    expect(await screen.findByText('Extracted KPIs (2)')).toBeInTheDocument()
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('EBIT')).toBeInTheDocument()
    // Value rendered via toLocaleString — compute the expected text the same way
    expect(screen.getByText((26400).toLocaleString())).toBeInTheDocument()
    // Confidence scores rendered per value
    expect(screen.getByText('92%')).toBeInTheDocument()
    expect(screen.getByText('70%')).toBeInTheDocument()
  })

  it('flags low-confidence values (below 0.85) in amber, high in green', async () => {
    render(<UploadedReportPage />)
    const high = await screen.findByText('92%')
    const low = screen.getByText('70%')
    expect(high.className).toContain('text-emerald-600')
    expect(low.className).toContain('text-amber-600')
  })

  it('shows source label for each extracted value', async () => {
    render(<UploadedReportPage />)
    expect(await screen.findByText('Net sales')).toBeInTheDocument()
    expect(screen.getByText('Recurring EBIT (est.)')).toBeInTheDocument()
  })

  it('offers a View PDF button that creates a signed URL for the source PDF', async () => {
    render(<UploadedReportPage />)
    const btn = await screen.findByRole('button', { name: /view pdf/i })
    btn.click()
    await waitFor(() => {
      expect(createSignedUrlMock).toHaveBeenCalledWith('reports/holcim-2025.pdf', 300)
    })
  })

  it('shows pending state when extraction has not run yet', async () => {
    hoisted.id = 'r-pending'
    render(<UploadedReportPage />)
    expect(
      await screen.findByText(/pending extraction/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Extracted KPIs/)).not.toBeInTheDocument()
  })
})
