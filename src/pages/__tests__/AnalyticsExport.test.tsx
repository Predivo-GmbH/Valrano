import { render, screen, fireEvent, waitFor } from '@/test/test-utils'
import { AnalyticsPage } from '../AnalyticsPage'

// F-013: Data Export (CSV)
// Analytics page panels export the visible comparison data as CSV files.
// This test covers the pivot-table export: correct headers, all visible
// companies and KPI values in the generated file.

const PIVOT_DATA = {
  cells: [
    { company_id: 'c1', company_name: 'Holcim', kpi_code: 'REVENUE', kpi_name: 'Revenue', value: 26400, fiscal_year: 2025 },
    { company_id: 'c1', company_name: 'Holcim', kpi_code: 'EBITDA', kpi_name: 'EBITDA', value: 5100, fiscal_year: 2025 },
  ],
  companies: [{ id: 'c1', name: 'Holcim' }],
  kpis: [
    { code: 'REVENUE', name: 'Revenue' },
    { code: 'EBITDA', name: 'EBITDA' },
  ],
  fiscalYear: 2025,
}

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}))

vi.mock('@/hooks/useData', () => ({
  useCompanies: () => ({ data: [{ id: 'c1', name: 'Holcim', is_active: true }], isLoading: false }),
  useKpiDefinitions: () => ({
    data: [
      { id: 'k1', code: 'REVENUE', name: 'Revenue', unit_type: 'currency', is_active: true, display_order: 1 },
      { id: 'k2', code: 'EBITDA', name: 'EBITDA', unit_type: 'currency', is_active: true, display_order: 2 },
    ],
    isLoading: false,
  }),
  usePeerGroups: () => ({ data: [], isLoading: false }),
}))

vi.mock('@/hooks/useAnalytics', () => ({
  usePivotData: () => ({ data: PIVOT_DATA, isLoading: false }),
  useScatterData: () => ({ data: [], isLoading: false }),
  useHeatmapData: () => ({ data: { cells: [] }, isLoading: false }),
}))

vi.mock('@/hooks/useTrends', () => ({
  useTrendData: () => ({ data: [], isLoading: false }),
  useCagr: () => ({ data: [], isLoading: false }),
  useMomentum: () => ({ data: [], isLoading: false }),
}))

vi.mock('@/hooks/useSmartYear', () => ({
  useSmartYear: () => ({ defaultYear: 2025, availableYears: [2024, 2025] }),
}))

describe('AnalyticsPage CSV export (F-013)', () => {
  let capturedBlob: Blob | null = null
  const realCreate = URL.createObjectURL
  const realRevoke = URL.revokeObjectURL

  beforeEach(() => {
    capturedBlob = null
    URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob
      return 'blob:mock-url'
    })
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    URL.createObjectURL = realCreate
    URL.revokeObjectURL = realRevoke
  })

  it('exports the pivot table as CSV with headers and all visible data', async () => {
    render(<AnalyticsPage />)

    // Switch to the pivot table view
    fireEvent.click(screen.getByRole('tab', { name: 'Pivot Table' }))

    const exportBtn = await screen.findByRole('button', { name: /download pivot table as csv/i })
    fireEvent.click(exportBtn)

    await waitFor(() => expect(capturedBlob).not.toBeNull())
    const csv = await capturedBlob!.text()
    const lines = csv.split('\n')

    // Header row contains Company + all visible KPI names
    expect(lines[0]).toBe('Company,Revenue,EBITDA')
    // Data row contains every visible company with its values
    expect(lines[1]).toBe('Holcim,26400,5100')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})
