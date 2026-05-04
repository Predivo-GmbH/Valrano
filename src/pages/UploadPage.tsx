import { useState, useRef, useCallback } from 'react'
import { useCompanies } from '@/hooks/useData'
import { useUploadReport, useExtractKpis, useNormalizeKpis } from '@/hooks/useExtraction'
import type { ReportType } from '@/types/database'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { FileText, CheckCircle2, AlertCircle, Loader2, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type UploadStep = 'form' | 'uploaded' | 'extracted' | 'normalized'

interface UploadState {
  reportId: string | null
  step: UploadStep
  extractionResult: {
    extraction_id: string
    total_kpis_extracted: number
    avg_confidence: number | null
    needs_review_count: number
  } | null
  normalizeResult: {
    updated: number
    skipped: number
  } | null
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS = [
  { key: 'form', label: 'Upload PDF' },
  { key: 'uploaded', label: 'Extract KPIs' },
  { key: 'extracted', label: 'Normalize' },
  { key: 'normalized', label: 'Done' },
]

const STEP_ORDER: UploadStep[] = ['form', 'uploaded', 'extracted', 'normalized']

function StepIndicator({ currentStep }: { currentStep: UploadStep }) {
  const currentIdx = STEP_ORDER.indexOf(currentStep)
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((s, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        return (
          <div key={s.key} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold transition-all duration-200',
                  done && 'bg-[var(--color-signal-green)] text-white',
                  active && 'bg-accent text-white ring-2 ring-accent/30',
                  !done && !active && 'bg-[var(--color-bg-tertiary)] text-muted-foreground',
                )}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={cn(
                  'text-[10px] font-medium uppercase tracking-wider whitespace-nowrap',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'mx-3 mb-5 h-px w-12 transition-all duration-200',
                  done ? 'bg-[var(--color-signal-green)]' : 'bg-border',
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Drop zone
// ---------------------------------------------------------------------------

interface DropZoneProps {
  file: File | null
  onFile: (f: File) => void
}

function DropZone({ file, onFile }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const dropped = e.dataTransfer.files[0]
      if (dropped?.type === 'application/pdf') onFile(dropped)
      else toast.error('Only PDF files are supported')
    },
    [onFile],
  )

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) onFile(selected)
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'group flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-all duration-200',
        isDragging
          ? 'border-accent bg-accent/5'
          : file
          ? 'border-[var(--color-signal-green)]/50 bg-[var(--color-signal-green)]/5'
          : 'border-border hover:border-accent/50 hover:bg-[var(--color-bg-tertiary)]',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleChange}
      />

      {file ? (
        <>
          <div className="rounded-full bg-[var(--color-signal-green)]/10 p-3">
            <FileText className="h-6 w-6 text-[var(--color-signal-green)]" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-foreground">{file.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {(file.size / 1024 / 1024).toFixed(2)} MB · Click to change
            </p>
          </div>
        </>
      ) : (
        <>
          <div className="rounded-full bg-[var(--color-bg-tertiary)] p-3 transition-colors duration-200 group-hover:bg-accent/10">
            <Upload className="h-6 w-6 text-muted-foreground group-hover:text-accent transition-colors duration-200" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-foreground">Drop PDF here or click to browse</p>
            <p className="text-[11px] text-muted-foreground">Annual reports, sustainability reports, quarterly filings</p>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Result card
// ---------------------------------------------------------------------------

function ResultCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  )
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-[13px] font-medium text-foreground tabular-nums">{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main upload page
// ---------------------------------------------------------------------------

const CURRENT_YEAR = new Date().getFullYear()

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  annual: 'Annual Report',
  quarterly: 'Quarterly Report',
  half_year: 'Half-Year Report',
  sustainability: 'Sustainability Report',
}

export function UploadPage() {
  const { data: companies, isLoading: companiesLoading } = useCompanies()

  const [companyId, setCompanyId] = useState<string>('')
  const [reportType, setReportType] = useState<ReportType>('annual')
  const [fiscalYear, setFiscalYear] = useState<number>(CURRENT_YEAR - 1)
  const [fiscalQuarter, setFiscalQuarter] = useState<number>(1)
  const [file, setFile] = useState<File | null>(null)

  const [state, setState] = useState<UploadState>({
    reportId: null,
    step: 'form',
    extractionResult: null,
    normalizeResult: null,
  })

  const uploadMutation = useUploadReport()
  const extractMutation = useExtractKpis()
  const normalizeMutation = useNormalizeKpis()

  // Upload handler
  const handleUpload = async () => {
    if (!companyId) { toast.error('Select a company'); return }
    if (!file) { toast.error('Select a PDF file'); return }
    if (!fiscalYear) { toast.error('Enter a fiscal year'); return }

    try {
      const result = await uploadMutation.mutateAsync({
        file,
        companyId,
        reportType,
        fiscalYear,
        fiscalQuarter: reportType === 'quarterly' ? fiscalQuarter : undefined,
      })
      setState((s) => ({ ...s, reportId: result.report_id, step: 'uploaded' }))
      toast.success('Report uploaded successfully')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    }
  }

  // Extract handler
  const handleExtract = async () => {
    if (!state.reportId) return
    try {
      const result = await extractMutation.mutateAsync(state.reportId)
      setState((s) => ({ ...s, extractionResult: result, step: 'extracted' }))
      toast.success(`Extracted ${result.total_kpis_extracted} KPIs`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Extraction failed')
    }
  }

  // Normalize handler
  const handleNormalize = async () => {
    if (!state.reportId) return
    try {
      const result = await normalizeMutation.mutateAsync(state.reportId)
      setState((s) => ({ ...s, normalizeResult: result, step: 'normalized' }))
      toast.success(`Normalized ${result.updated} KPI values to CHF`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Normalization failed')
    }
  }

  const isUploading = uploadMutation.isPending
  const isExtracting = extractMutation.isPending
  const isNormalizing = normalizeMutation.isPending

  return (
    <div className="mx-auto max-w-[720px] px-6 py-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
          Upload Report
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Upload an annual or sustainability report PDF to extract and normalize KPIs.
        </p>
      </div>

      {/* Step indicator */}
      <div className="mb-8">
        <StepIndicator currentStep={state.step} />
      </div>

      {/* Form card */}
      {state.step === 'form' && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-5">

          {/* Company selector */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Company
            </Label>
            <Select
              value={companyId}
              onValueChange={(v) => { if (v !== null) setCompanyId(v) }}
              disabled={companiesLoading}
            >
              <SelectTrigger className="w-full rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground">
                <SelectValue placeholder={companiesLoading ? 'Loading…' : 'Select company'} />
              </SelectTrigger>
              <SelectContent className="rounded-lg border-border bg-card text-[13px]">
                {(companies ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-[13px]">
                    {c.name}
                    {c.ticker ? ` (${c.ticker})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Report type */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Report Type
            </Label>
            <Select value={reportType} onValueChange={(v) => { if (v !== null) setReportType(v as ReportType) }}>
              <SelectTrigger className="w-full rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-lg border-border bg-card text-[13px]">
                {(Object.entries(REPORT_TYPE_LABELS) as [ReportType, string][]).map(([k, label]) => (
                  <SelectItem key={k} value={k} className="text-[13px]">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fiscal year + optional quarter */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                Fiscal Year
              </Label>
              <Input
                type="number"
                min={2000}
                max={CURRENT_YEAR}
                value={fiscalYear}
                onChange={(e) => setFiscalYear(Number(e.target.value))}
                className="rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground"
              />
            </div>

            {reportType === 'quarterly' && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  Quarter
                </Label>
                <Select
                  value={String(fiscalQuarter)}
                  onValueChange={(v) => { if (v !== null) setFiscalQuarter(Number(v)) }}
                >
                  <SelectTrigger className="w-full rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border-border bg-card text-[13px]">
                    {[1, 2, 3, 4].map((q) => (
                      <SelectItem key={q} value={String(q)} className="text-[13px]">
                        Q{q}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Drop zone */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              PDF File
            </Label>
            <DropZone file={file} onFile={setFile} />
          </div>

          {/* Upload button */}
          <button
            onClick={handleUpload}
            disabled={isUploading || !companyId || !file}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-[13px] font-medium text-background transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload Report
              </>
            )}
          </button>
        </div>
      )}

      {/* Extract step */}
      {state.step === 'uploaded' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-[var(--color-signal-green)]/30 bg-[var(--color-signal-green)]/5 px-5 py-4">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-[var(--color-signal-green)]" />
            <div>
              <p className="text-[13px] font-medium text-foreground">Report uploaded</p>
              <p className="text-[11px] text-muted-foreground">Report ID: {state.reportId}</p>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="mb-1 text-[15px] font-semibold text-foreground">Extract KPIs</h3>
            <p className="mb-5 text-[13px] text-muted-foreground">
              AI will scan the PDF and extract financial, ESG, and operational KPIs with source references and confidence scores.
            </p>
            <button
              onClick={handleExtract}
              disabled={isExtracting}
              className="flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-[13px] font-medium text-background transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Extracting KPIs…
                </>
              ) : (
                'Extract KPIs'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Normalize step */}
      {state.step === 'extracted' && state.extractionResult && (
        <div className="space-y-4">
          <ResultCard title="Extraction Results">
            <StatRow label="KPIs Extracted" value={state.extractionResult.total_kpis_extracted} />
            <StatRow
              label="Average Confidence"
              value={
                state.extractionResult.avg_confidence !== null
                  ? `${Math.round(state.extractionResult.avg_confidence * 100)}%`
                  : '—'
              }
            />
            <StatRow label="Needs Review" value={state.extractionResult.needs_review_count} />
          </ResultCard>

          {state.extractionResult.needs_review_count > 0 && (
            <div className="flex items-start gap-3 rounded-lg border border-[var(--color-signal-amber)]/30 bg-[var(--color-signal-amber)]/5 px-5 py-4">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-signal-amber)]" />
              <p className="text-[13px] text-muted-foreground">
                {state.extractionResult.needs_review_count} values have low confidence and are queued for manual review.
              </p>
            </div>
          )}

          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="mb-1 text-[15px] font-semibold text-foreground">Normalize to CHF</h3>
            <p className="mb-5 text-[13px] text-muted-foreground">
              Convert all extracted values to CHF using historical FX rates for accurate peer comparison.
            </p>
            <button
              onClick={handleNormalize}
              disabled={isNormalizing}
              className="flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-[13px] font-medium text-background transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isNormalizing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Normalizing…
                </>
              ) : (
                'Normalize to CHF'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Done state */}
      {state.step === 'normalized' && state.normalizeResult && (
        <div className="space-y-4">
          <ResultCard title="Extraction Results">
            <StatRow label="KPIs Extracted" value={state.extractionResult?.total_kpis_extracted ?? '—'} />
            <StatRow
              label="Average Confidence"
              value={
                state.extractionResult?.avg_confidence !== null && state.extractionResult?.avg_confidence !== undefined
                  ? `${Math.round(state.extractionResult.avg_confidence * 100)}%`
                  : '—'
              }
            />
            <StatRow label="Needs Review" value={state.extractionResult?.needs_review_count ?? '—'} />
          </ResultCard>

          <ResultCard title="Normalization Results">
            <StatRow label="Values Normalized" value={state.normalizeResult.updated} />
            <StatRow label="Skipped" value={state.normalizeResult.skipped} />
          </ResultCard>

          <div className="flex items-center gap-3 rounded-lg border border-[var(--color-signal-green)]/30 bg-[var(--color-signal-green)]/5 px-5 py-4">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-[var(--color-signal-green)]" />
            <p className="text-[13px] text-foreground font-medium">
              Processing complete. Data is now available on the Dashboard.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setState({ reportId: null, step: 'form', extractionResult: null, normalizeResult: null })
                setFile(null)
                setCompanyId('')
              }}
              className="flex-1 rounded-full border border-border bg-card px-6 py-2.5 text-[13px] font-medium text-foreground transition-all duration-200 hover:bg-[var(--color-bg-tertiary)]"
            >
              Upload Another Report
            </button>
            <a
              href="/dashboard"
              className="flex-1 flex items-center justify-center rounded-full bg-foreground px-6 py-2.5 text-[13px] font-medium text-background transition-all duration-200 hover:opacity-90"
            >
              View Dashboard
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
