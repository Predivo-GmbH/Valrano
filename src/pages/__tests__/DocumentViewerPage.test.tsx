import { render, screen, fireEvent } from '@/test/test-utils'
import { DocumentViewerPage } from '../DocumentViewerPage'

// F-020: Benchmark Document Editability
// Executive summary / findings / section narratives are click-to-edit for draft/in_review,
// read-only for approved/delivered, changes persist via useUpdateDocumentContent, hint banner shown.

const CONTENT = {
  competitive_position: 'stable' as const,
  executive_summary: 'Holcim outperformed peers on EBITDA margin in FY2025.',
  key_findings: ['Revenue grew 4% YoY', 'Net debt reduced'],
  sections: [
    { title: 'Profitability', narrative: 'Margins expanded across regions.', kpi_comparisons: [] },
  ],
  risk_flags: [],
  data_quality: { total_kpis_compared: 12, high_confidence_pct: 90, fx_rates_used: ['CHF/EUR'] },
}

function makeDoc(status: string) {
  return {
    id: 'doc1',
    title: 'Holcim vs CRH Benchmark',
    status,
    fiscal_year: 2025,
    trigger_company: { id: 't1', name: 'CRH plc', ticker: 'CRH' },
    customer_company: { id: 'c1', name: 'Holcim Ltd', ticker: 'HOLN' },
    benchmark_rules: { id: 'r1', name: 'Cement Peers', narrative_style: 'executive' },
    generated_at: '2026-05-01T00:00:00Z',
    content_html: null,
    content_json: CONTENT,
  }
}

const updateContentMock = vi.fn()
const hoisted = vi.hoisted(() => ({ status: 'draft' }))

vi.mock('@/hooks/useBenchmark', () => ({
  useBenchmarkDocument: () => ({ data: makeDoc(hoisted.status), isLoading: false }),
  useUpdateDocumentStatus: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateDocumentContent: () => ({ mutate: updateContentMock, isPending: false }),
}))

vi.mock('@/hooks/useWorkspace', () => ({
  useCurrentWorkspace: () => ({ data: { id: 'w1', owner_id: 'u1' } }),
  useMyWorkspaceRole: () => ({ data: 'admin' }),
}))

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'reviewer@valrano.com' }, loading: false }),
}))

describe('DocumentViewerPage (F-020 editability)', () => {
  beforeEach(() => {
    updateContentMock.mockClear()
    hoisted.status = 'draft'
  })

  it('shows the editable hint banner for draft documents', () => {
    render(<DocumentViewerPage />)
    expect(screen.getByText(/This document is editable/i)).toBeInTheDocument()
  })

  it('activates inline edit mode (textarea) when clicking the executive summary in a draft', () => {
    render(<DocumentViewerPage />)
    // No textarea before interacting
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(CONTENT.executive_summary))
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea).toBeInTheDocument()
    expect(textarea.value).toBe(CONTENT.executive_summary)
  })

  it('persists an edit via the useUpdateDocumentContent mutation', () => {
    render(<DocumentViewerPage />)
    fireEvent.click(screen.getByText(CONTENT.executive_summary))
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'Updated executive summary.' } })
    fireEvent.click(screen.getByText('Save'))
    expect(updateContentMock).toHaveBeenCalledTimes(1)
    expect(updateContentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'doc1',
        content_json: expect.objectContaining({ executive_summary: 'Updated executive summary.' }),
      }),
    )
  })

  it('is read-only when the document is approved (no hint banner, no edit textarea)', () => {
    hoisted.status = 'approved'
    render(<DocumentViewerPage />)
    expect(screen.queryByText(/This document is editable/i)).not.toBeInTheDocument()
    // Clicking the summary must NOT open an editor
    fireEvent.click(screen.getByText(CONTENT.executive_summary))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
})
