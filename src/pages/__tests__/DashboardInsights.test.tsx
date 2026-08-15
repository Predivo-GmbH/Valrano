import { render, screen, waitFor } from '@/test/test-utils'
import { DashboardPage } from '../DashboardPage'

// F-019: AI Insights Source Transparency  — each insight links its company (/companies/:id)
//        and KPI code (/analytics?kpi=...), and shows fiscal year + generation time.
// F-022: Company Profile Navigation       — peer company names in the comparison table
//        link to /companies/:id.
//
// NOTE (discrepancy): FEATURES.md F-019 describes a "Sources:" line with 3 fixed links
// (Uploaded Reports / Company Profile / KPI Analytics). The current DashboardPage renders
// per-insight provenance instead: a linked company name, a linked KPI code badge, the
// fiscal year and the generation timestamp. This suite asserts the ACTUAL behavior.

const COMPANIES = [
  { id: 'me', name: 'My Corp Ltd', ticker: 'ME', exchange: 'SIX', reporting_currency: 'CHF', is_active: true, logo_url: null, website_url: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '1', name: 'Holcim Ltd', ticker: 'HOLN', exchange: 'SIX', reporting_currency: 'CHF', is_active: true, logo_url: null, website_url: null, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
]

const KPI_DEFS = [
  { id: 'kd1', code: 'REVENUE', name: 'Revenue', category: 'financial', unit_type: 'currency', display_order: 10, is_active: true, description: 'Total revenue', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
]

const KPI_VALUES = [
  { id: 'v1', company_id: '1', kpi_definition_id: 'kd1', fiscal_year: 2025, normalized_value: 27000, normalized_currency: 'CHF', confidence: 0.95, needs_review: false, is_restated: false, raw_value: 27000, raw_currency: 'CHF', raw_label: null, source_page: 42, source_text: null },
]

const INSIGHT = {
  id: 'i1',
  insight_type: 'outlier',
  priority: 'high',
  title: 'Revenue outlier detected',
  body: 'Holcim revenue is 20% above the peer median.',
  data_confidence: 'high',
  delta_label: 'new',
  is_acted_upon: false,
  is_bookmarked: false,
  acted_at: null,
  action_note: null,
  auto_generated: false,
  fiscal_year: 2025,
  related_kpi_code: 'REVENUE',
  created_at: '2026-05-01T00:00:00Z',
  companies: { id: '1', name: 'Holcim Ltd', ticker: 'HOLN' },
}

vi.mock('@/hooks/useData', () => ({
  useCompanies: () => ({ data: COMPANIES, isLoading: false }),
  useKpiDefinitions: () => ({ data: KPI_DEFS, isLoading: false }),
  useKpiValues: () => ({ data: KPI_VALUES, isLoading: false }),
  useReports: () => ({ data: [] }),
}))

vi.mock('@/hooks/useMyCompany', () => ({
  usePrimaryCompany: () => ({ data: { id: 'p1', company_id: 'me', name: 'My Corp Ltd' } }),
  useMyCompanyKpis: () => ({ data: [] }),
}))

vi.mock('@/hooks/useCalendar', () => ({
  usePublicationEvents: () => ({ data: [] }),
}))

vi.mock('@/hooks/useBenchmark', () => ({
  useBenchmarkDocuments: () => ({ data: [] }),
}))

vi.mock('@/hooks/useInsights', () => ({
  useInsights: () => ({ data: [INSIGHT], isLoading: false }),
  useDismissInsight: () => ({ mutate: vi.fn(), isPending: false }),
  useGenerateInsights: () => ({ mutate: vi.fn(), isPending: false, data: undefined }),
  useBookmarkInsight: () => ({ mutate: vi.fn(), isPending: false }),
  useMarkInsightActed: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useSmartYear', () => ({
  useSmartYear: () => ({ defaultYear: 2025, availableYears: [2025], isLoading: false }),
}))

vi.mock('@/hooks/useOnboarding', () => ({
  useOnboardingDismissed: () => ({ data: true, isLoading: false }),
  useOnboarding: () => ({
    status: { hasFramework: true, hasCompetitors: true, hasSchedule: true, isComplete: true, completedSteps: 3, totalSteps: 3 },
    isLoading: false,
  }),
  dismissOnboarding: vi.fn(),
  resetOnboarding: vi.fn(),
}))

describe('DashboardPage insights & navigation (F-019, F-022)', () => {
  it('links a peer company name in the comparison table to its profile (F-022)', async () => {
    render(<DashboardPage />)
    await waitFor(() => {
      const peerLink = screen.getByRole('link', { name: 'Holcim Ltd' })
      expect(peerLink).toHaveAttribute('href', '/companies/1')
    })
  })

  it('links an insight to its source company profile (F-019)', async () => {
    render(<DashboardPage />)
    await waitFor(() => {
      const companyLink = screen.getByRole('link', { name: 'Holcim Ltd (HOLN)' })
      expect(companyLink).toHaveAttribute('href', '/companies/1')
    })
  })

  it('links an insight KPI code badge to the analytics page (F-019)', async () => {
    render(<DashboardPage />)
    await waitFor(() => {
      const kpiLink = screen.getByRole('link', { name: 'REVENUE' })
      expect(kpiLink).toHaveAttribute('href', '/analytics?kpi=REVENUE')
    })
  })

  it('shows the insight fiscal year and generation time for provenance (F-019)', async () => {
    render(<DashboardPage />)
    await waitFor(() => {
      expect(screen.getByText('Revenue outlier detected')).toBeInTheDocument()
    })
    expect(screen.getAllByText(/FY 2025/).length).toBeGreaterThan(0)
    expect(screen.getByText(/Generated/)).toBeInTheDocument()
  })
})
