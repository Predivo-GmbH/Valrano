import { render, screen, fireEvent, waitFor } from '@/test/test-utils'
import { UploadReportDialog } from '../upload-report-dialog'
import { toast } from 'sonner'

// F-006: PDF Upload & Extraction
// Accepts PDF only, shows extraction progress, displays confidence scores,
// captures the review count for low-confidence values (surfaced in the KPI review queue).

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn(), warning: vi.fn() },
}))

const uploadMutate = vi.fn()
const extractMutate = vi.fn()
const normalizeMutate = vi.fn()

vi.mock('@/hooks/useExtraction', () => ({
  useUploadReport: () => ({ mutateAsync: uploadMutate, isPending: false }),
  useExtractKpis: () => ({ mutateAsync: extractMutate, isPending: false }),
  useNormalizeKpis: () => ({ mutateAsync: normalizeMutate, isPending: false }),
}))

vi.mock('@/hooks/useData', () => ({
  useReports: () => ({ data: [] }),
}))

// Pass progress through unchanged so the bar reflects the raw milestone value
vi.mock('@/hooks/useSmoothProgress', () => ({
  useSmoothProgress: (v: number) => v,
}))

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement
}

describe('UploadReportDialog (F-006 upload & extraction)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the upload dialog with a PDF drop zone', () => {
    render(<UploadReportDialog open onClose={vi.fn()} companyId="c1" />)
    expect(screen.getByText('Upload Report')).toBeInTheDocument()
    expect(screen.getByText('PDF Files')).toBeInTheDocument()
    expect(screen.getByText(/Drop PDFs here or click to browse/i)).toBeInTheDocument()
  })

  it('restricts the file input to PDF files', () => {
    render(<UploadReportDialog open onClose={vi.fn()} companyId="c1" />)
    expect(fileInput()).toHaveAttribute('accept', '.pdf,application/pdf')
  })

  it('rejects non-PDF files and does not queue them', () => {
    render(<UploadReportDialog open onClose={vi.fn()} companyId="c1" />)
    const txt = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    fireEvent.change(fileInput(), { target: { files: [txt] } })
    expect(toast.error).toHaveBeenCalledWith('notes.txt: Only PDF files are supported')
    expect(screen.queryByText('notes.txt')).not.toBeInTheDocument()
    expect(screen.queryByText(/file queued/i)).not.toBeInTheDocument()
  })

  it('queues a PDF, shows extraction progress, then displays the confidence score', async () => {
    render(<UploadReportDialog open onClose={vi.fn()} companyId="c1" />)

    // Deferred upload so we can observe the in-progress UI before it completes
    let resolveUpload: (v: { report_id: string }) => void
    uploadMutate.mockReturnValue(new Promise((r) => { resolveUpload = r }))
    extractMutate.mockResolvedValue({ total_kpis_extracted: 10, avg_confidence: 0.92, needs_review_count: 2 })
    normalizeMutate.mockResolvedValue({})

    const pdf = new File(['%PDF-1.4'], 'annual-report.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput(), { target: { files: [pdf] } })

    // File is queued
    expect(await screen.findByText('annual-report.pdf')).toBeInTheDocument()
    expect(screen.getByText(/1 file queued/i)).toBeInTheDocument()

    // Start the pipeline
    fireEvent.click(screen.getByText(/Upload & Extract/i))

    // Extraction progress UI is visible while the upload promise is pending
    expect(await screen.findByText(/Processing file 1 of 1/i)).toBeInTheDocument()

    // Complete the pipeline
    resolveUpload!({ report_id: 'r1' })

    // Confidence score is displayed in the done state (10 KPIs, 92% avg confidence)
    await waitFor(() => {
      expect(screen.getByText(/10 KPIs\s*·\s*92%/)).toBeInTheDocument()
    })
    expect(screen.getByText(/1 of 1 reports processed/i)).toBeInTheDocument()

    // Extraction returned 2 low-confidence values destined for the KPI review queue
    expect(extractMutate).toHaveBeenCalledWith('r1')
  })
})
