import { useState } from 'react'
import {
  FileText,
  Download,
  ExternalLink,
  Search,
  Loader2,
  CheckCircle2,
  FileSpreadsheet,
  Presentation,
  Newspaper,
  File,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useIrCatalogItems, useScanIrPage, useDownloadCatalogItem } from '@/hooks/useIrCatalog'
import { useSmoothProgress } from '@/hooks/useSmoothProgress'
import type { IrDocumentType } from '@/types/database'

interface IrCatalogPanelProps {
  companyId: string
  companyName: string
  irPageUrl: string | null
  onSetIrUrl?: () => void
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  annual_report: 'Annual Report',
  quarterly_report: 'Quarterly Report',
  half_year_report: 'Half-Year Report',
  sustainability_report: 'Sustainability Report',
  investor_presentation: 'Presentation',
  press_release: 'Press Release',
  financial_statements: 'Financial Statements',
  other: 'Other',
}

const ANALYZABLE_TYPES = new Set([
  'annual_report',
  'quarterly_report',
  'half_year_report',
  'sustainability_report',
  'financial_statements',
])

function getDocumentIcon(docType: string | null) {
  switch (docType) {
    case 'annual_report':
    case 'quarterly_report':
    case 'half_year_report':
    case 'sustainability_report':
      return FileText
    case 'financial_statements':
      return FileSpreadsheet
    case 'investor_presentation':
      return Presentation
    case 'press_release':
      return Newspaper
    default:
      return File
  }
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type FilterType = 'all' | IrDocumentType

export function IrCatalogPanel({ companyId, companyName, irPageUrl, onSetIrUrl }: IrCatalogPanelProps) {
  const { data: items, isLoading } = useIrCatalogItems(companyId)
  const scanMutation = useScanIrPage()
  const downloadMutation = useDownloadCatalogItem()
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [filterYear, setFilterYear] = useState<string>('all')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const progress = useSmoothProgress(scanMutation.isPending ? 20 : scanMutation.isSuccess ? 100 : 0)

  const filteredItems = (items ?? []).filter((item) => {
    if (filterType !== 'all' && item.document_type !== filterType) return false
    if (filterYear !== 'all' && item.fiscal_year !== parseInt(filterYear)) return false
    return true
  })

  const years = [...new Set((items ?? []).map((i) => i.fiscal_year).filter(Boolean) as number[])].sort((a, b) => b - a)

  const handleScan = async () => {
    const result = await scanMutation.mutateAsync(companyId)
    if (result.items_found === 0) {
      toast.info('No documents found on the IR page')
    } else {
      toast.success(`Found ${result.items_found} documents (${result.items_new} new)`)
    }
  }

  const handleDownload = async (itemId: string) => {
    setDownloadingId(itemId)
    try {
      const result = await downloadMutation.mutateAsync({ catalogItemId: itemId, companyId })
      toast.success(`Download started — report ${result.report_id.slice(0, 8)}...`)
    } finally {
      setDownloadingId(null)
    }
  }

  // No IR URL → rich empty state with guidance
  if (!irPageUrl) {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Search className="h-4 w-4 text-[var(--color-accent)]" />
          <h3 className="text-sm font-semibold text-foreground">IR Document Catalog</h3>
        </div>
        <div className="card-premium rounded-xl border border-border bg-card p-6">
          <div className="flex flex-col items-center text-center max-w-md mx-auto">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent)]/10 mb-3">
              <Search className="h-6 w-6 text-[var(--color-accent)]" />
            </div>
            <h3 className="text-[15px] font-semibold text-foreground">No IR Page URL Set</h3>
            <p className="mt-1.5 text-[12px] text-muted-foreground leading-relaxed">
              Set an Investor Relations page URL for {companyName} to discover and catalog all available documents.
            </p>
            <div className="mt-4 w-full rounded-lg bg-[var(--color-bg-tertiary)] p-3 text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground mb-2">What you'll get</p>
              <ul className="space-y-1.5 text-[12px] text-muted-foreground">
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-[var(--color-accent)] shrink-0" /> Automatic discovery of annual reports, presentations, and filings</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-[var(--color-accent)] shrink-0" /> AI-powered classification by type, year, and language</li>
                <li className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-[var(--color-accent)] shrink-0" /> One-click download and KPI extraction</li>
              </ul>
            </div>
            {onSetIrUrl && (
              <button
                type="button"
                onClick={onSetIrUrl}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-4 py-2 min-h-[44px] text-[12px] font-medium text-white transition-colors hover:bg-[var(--color-accent)]/90 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" /> Set IR Page URL
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-[var(--color-accent)]" />
          <h3 className="text-sm font-semibold text-foreground">IR Document Catalog</h3>
          {items && items.length > 0 && (
            <span className="text-xs text-muted-foreground">
              ({items.length} document{items.length !== 1 ? 's' : ''})
            </span>
          )}
        </div>
        <button
          onClick={handleScan}
          disabled={scanMutation.isPending}
          className="flex items-center gap-1.5 rounded-md bg-[var(--color-accent)] px-3 py-1.5 min-h-[44px] text-xs font-medium text-white transition-colors hover:bg-[var(--color-accent)]/90 disabled:opacity-50 cursor-pointer"
        >
          {scanMutation.isPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <Search className="h-3.5 w-3.5" />
              Scan IR Page
            </>
          )}
        </button>
      </div>

      {/* Scanning progress */}
      {scanMutation.isPending && (
        <div className="mb-3 space-y-1">
          <div className="h-1.5 w-full rounded-full bg-[var(--color-bg-tertiary)]">
            <div
              className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">Scanning IR page for documents...</p>
        </div>
      )}

      {/* Content */}
      <div className="card-premium rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="px-5 py-8 text-center">
            <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : !items || items.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No documents cataloged yet. Click "Scan IR Page" to discover available documents.
            </p>
          </div>
        ) : (
          <>
            {/* Filters */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-[var(--color-bg-tertiary)]/30">
              <Select value={filterType} onValueChange={(v) => v && setFilterType(v as FilterType)}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="annual_report">Annual Reports</SelectItem>
                  <SelectItem value="quarterly_report">Quarterly Reports</SelectItem>
                  <SelectItem value="half_year_report">Half-Year Reports</SelectItem>
                  <SelectItem value="sustainability_report">Sustainability</SelectItem>
                  <SelectItem value="investor_presentation">Presentations</SelectItem>
                  <SelectItem value="financial_statements">Financial Statements</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {years.length > 0 && (
                <Select value={filterYear} onValueChange={(v) => v && setFilterYear(v)}>
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue placeholder="All years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All years</SelectItem>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <span className="ml-auto text-[11px] text-muted-foreground">
                {filteredItems.length} of {items.length}
              </span>
            </div>

            {/* Document list */}
            <div className="divide-y divide-border/30">
              {filteredItems.map((item) => {
                const Icon = getDocumentIcon(item.document_type)
                const canAnalyze = ANALYZABLE_TYPES.has(item.document_type ?? '')
                const isDownloading = downloadingId === item.id
                const isAnalyzed = item.is_downloaded && item.report_id

                return (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-bg-tertiary)]/20 transition-colors">
                    {/* Icon */}
                    <div className="flex-shrink-0">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                    </div>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.title || 'Untitled document'}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{DOCUMENT_TYPE_LABELS[item.document_type ?? 'other'] ?? 'Other'}</span>
                        {item.fiscal_year && (
                          <>
                            <span>·</span>
                            <span>
                              {item.fiscal_quarter ? `Q${item.fiscal_quarter} ` : 'FY '}
                              {item.fiscal_year}
                            </span>
                          </>
                        )}
                        {item.file_size_bytes && (
                          <>
                            <span>·</span>
                            <span>{formatFileSize(item.file_size_bytes)}</span>
                          </>
                        )}
                        {item.language && (
                          <>
                            <span>·</span>
                            <span className="uppercase">{item.language}</span>
                          </>
                        )}
                        {item.file_format && (
                          <>
                            <span>·</span>
                            <span className="uppercase">{item.file_format}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Status / Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isAnalyzed ? (
                        <span className="flex items-center gap-1 text-[11px] text-[var(--color-signal-green)] font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Analyzed
                        </span>
                      ) : canAnalyze ? (
                        <button
                          onClick={() => handleDownload(item.id)}
                          disabled={isDownloading || downloadMutation.isPending}
                          className="flex items-center gap-1 rounded-md bg-[var(--color-accent)]/10 px-2.5 py-1.5 min-h-[44px] text-[11px] font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/20 disabled:opacity-50 cursor-pointer"
                        >
                          {isDownloading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Download className="h-3 w-3" />
                          )}
                          Download & Analyze
                        </button>
                      ) : null}

                      {/* External link */}
                      <a
                        href={item.document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center h-8 w-8 min-h-[44px] min-w-[44px] rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-[var(--color-bg-tertiary)]"
                        title="Open document in new tab"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
