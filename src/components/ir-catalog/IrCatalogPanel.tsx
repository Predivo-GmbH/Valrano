import { useMemo, useState } from 'react'
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
  ChevronDown,
  ChevronRight,
  Phone,
  ClipboardList,
  BarChart3,
} from 'lucide-react'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useIrCatalogItems, useScanIrPage, useDownloadCatalogItem } from '@/hooks/useIrCatalog'
import { useSmoothProgress } from '@/hooks/useSmoothProgress'
import type { IrCatalogItem, IrDocumentType } from '@/types/database'

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
  conference_call: 'Conference Call',
  factsheet: 'Factsheet',
  consensus: 'Consensus',
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
    case 'conference_call':
      return Phone
    case 'factsheet':
      return ClipboardList
    case 'consensus':
      return BarChart3
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

/** Sort items: fiscal_year DESC, fiscal_quarter DESC (nulls last), title ASC */
function sortItems(a: IrCatalogItem, b: IrCatalogItem): number {
  const ya = a.fiscal_year ?? 0
  const yb = b.fiscal_year ?? 0
  if (yb !== ya) return yb - ya
  const qa = a.fiscal_quarter ?? 99
  const qb = b.fiscal_quarter ?? 99
  if (qb !== qa) return qb - qa
  return (a.title ?? '').localeCompare(b.title ?? '')
}

type FilterType = 'all' | IrDocumentType

function DocumentRow({
  item,
  canAnalyze,
  isDownloading,
  isAnalyzed,
  onDownload,
  downloadDisabled,
}: {
  item: IrCatalogItem
  canAnalyze: boolean
  isDownloading: boolean
  isAnalyzed: boolean
  onDownload: () => void
  downloadDisabled: boolean
}) {
  const Icon = getDocumentIcon(item.document_type)

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--color-bg-tertiary)]/20 transition-colors">
      <div className="flex-shrink-0">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>

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

      <div className="flex items-center gap-2 flex-shrink-0">
        {isAnalyzed ? (
          <span className="flex items-center gap-1 text-[11px] text-[var(--color-signal-green)] font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Analyzed
          </span>
        ) : canAnalyze ? (
          <button
            onClick={onDownload}
            disabled={isDownloading || downloadDisabled}
            className="flex items-center gap-1 rounded-md bg-[var(--color-accent)]/10 px-2.5 py-1.5 min-h-[44px] text-[11px] font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent)]/20 disabled:opacity-50 cursor-pointer"
          >
            {isDownloading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            Download & Analyze
          </button>
        ) : (
          <a
            href={item.document_url}
            download
            className="flex items-center gap-1 rounded-md bg-[var(--color-bg-tertiary)] px-2.5 py-1.5 min-h-[44px] text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-[var(--color-bg-tertiary)]/80 cursor-pointer"
            title="Download document"
          >
            <Download className="h-3 w-3" />
            Download
          </a>
        )}

        <a
          href={item.document_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center h-8 w-8 min-h-[44px] min-w-[44px] rounded-md text-muted-foreground transition-colors hover:text-foreground hover:bg-[var(--color-bg-tertiary)]"
          title="Open in new tab"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  )
}

export function IrCatalogPanel({ companyId, companyName, irPageUrl, onSetIrUrl }: IrCatalogPanelProps) {
  const { data: items, isLoading } = useIrCatalogItems(companyId)
  const scanMutation = useScanIrPage()
  const downloadMutation = useDownloadCatalogItem()
  const [filterType, setFilterType] = useState<FilterType>('all')
  const [filterYear, setFilterYear] = useState<string>('all')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [referenceCollapsed, setReferenceCollapsed] = useState(false)

  const progress = useSmoothProgress(scanMutation.isPending ? 20 : scanMutation.isSuccess ? 100 : 0)

  // Split items into analyzable and reference
  const { analyzableItems, referenceItems, availableTypes, availableYears, stats } = useMemo(() => {
    const all = items ?? []
    const analyzable: IrCatalogItem[] = []
    const reference: IrCatalogItem[] = []
    const counts = new Map<string, number>()
    const yearSet = new Set<number>()

    for (const item of all) {
      const type = item.document_type ?? 'other'
      counts.set(type, (counts.get(type) ?? 0) + 1)
      if (item.fiscal_year) yearSet.add(item.fiscal_year)

      if (ANALYZABLE_TYPES.has(type)) {
        analyzable.push(item)
      } else {
        reference.push(item)
      }
    }

    analyzable.sort(sortItems)
    reference.sort(sortItems)

    // Build available types (only types that exist in data)
    const types = [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([type, count]) => ({ type, count, label: DOCUMENT_TYPE_LABELS[type] ?? type }))

    const years = [...yearSet].sort((a, b) => b - a)

    return {
      analyzableItems: analyzable,
      referenceItems: reference,
      availableTypes: types,
      availableYears: years,
      stats: { total: all.length, analyzable: analyzable.length, reference: reference.length, years: years.length },
    }
  }, [items])

  // Cross-filter: when type is selected, only show years that have items of that type (and vice versa)
  const filteredYears = useMemo(() => {
    if (filterType === 'all') return availableYears
    return availableYears.filter((y) =>
      (items ?? []).some((i) => i.document_type === filterType && i.fiscal_year === y),
    )
  }, [items, filterType, availableYears])

  const filteredTypes = useMemo(() => {
    if (filterYear === 'all') return availableTypes
    const yr = parseInt(filterYear)
    return availableTypes.filter(({ type }) =>
      (items ?? []).some((i) => i.document_type === type && i.fiscal_year === yr),
    )
  }, [items, filterYear, availableTypes])

  // Reset year filter if it becomes invalid after type change
  if (filterYear !== 'all' && !filteredYears.includes(parseInt(filterYear))) {
    setFilterYear('all')
  }

  // Apply filters to both sections
  const filterFn = (item: IrCatalogItem) => {
    if (filterType !== 'all' && item.document_type !== filterType) return false
    if (filterYear !== 'all' && item.fiscal_year !== parseInt(filterYear)) return false
    return true
  }

  const filteredAnalyzable = analyzableItems.filter(filterFn)
  const filteredReference = referenceItems.filter(filterFn)
  const totalFiltered = filteredAnalyzable.length + filteredReference.length

  // Auto-collapse reference when there are analyzable results
  const showAnalyzable = filterType === 'all' || ANALYZABLE_TYPES.has(filterType)
  const showReference = filterType === 'all' || !ANALYZABLE_TYPES.has(filterType)

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
          {stats.total > 0 && (
            <span className="text-xs text-muted-foreground">
              ({stats.total} document{stats.total !== 1 ? 's' : ''})
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
              No documents cataloged yet. Click &quot;Scan IR Page&quot; to discover available documents.
            </p>
          </div>
        ) : (
          <>
            {/* Stats bar + Filters */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-[var(--color-bg-tertiary)]/30">
              <Select value={filterType} onValueChange={(v) => v && setFilterType(v as FilterType)}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types ({stats.total})</SelectItem>
                  {filteredTypes.map(({ type, count, label }) => (
                    <SelectItem key={type} value={type}>{label} ({count})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {availableYears.length > 0 && (
                <Select value={filterYear} onValueChange={(v) => v && setFilterYear(v)}>
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue placeholder="All years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All years</SelectItem>
                    {filteredYears.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
                <span>{totalFiltered} of {stats.total}</span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline text-[var(--color-accent)]">{stats.analyzable} analyzable</span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">{stats.reference} reference</span>
              </div>
            </div>

            {/* Reports for Analysis section */}
            {showAnalyzable && filteredAnalyzable.length > 0 && (
              <div>
                <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-[var(--color-accent)]/5">
                  <FileText className="h-3.5 w-3.5 text-[var(--color-accent)]" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-accent)]">
                    Reports for Analysis
                  </span>
                  <span className="text-[11px] text-[var(--color-accent)]/60">({filteredAnalyzable.length})</span>
                </div>
                <div className="divide-y divide-border/30">
                  {filteredAnalyzable.map((item) => (
                    <DocumentRow
                      key={item.id}
                      item={item}
                      canAnalyze
                      isDownloading={downloadingId === item.id}
                      isAnalyzed={!!(item.is_downloaded && item.report_id)}
                      onDownload={() => handleDownload(item.id)}
                      downloadDisabled={downloadMutation.isPending}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Reference Documents section */}
            {showReference && filteredReference.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => setReferenceCollapsed(!referenceCollapsed)}
                  className="flex items-center gap-2 w-full px-4 py-2 border-b border-border/50 bg-[var(--color-bg-tertiary)]/20 hover:bg-[var(--color-bg-tertiary)]/40 transition-colors cursor-pointer text-left"
                >
                  {referenceCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <File className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                    Reference Documents
                  </span>
                  <span className="text-[11px] text-muted-foreground/60">({filteredReference.length})</span>
                </button>
                {!referenceCollapsed && (
                  <div className="divide-y divide-border/30">
                    {filteredReference.map((item) => (
                      <DocumentRow
                        key={item.id}
                        item={item}
                        canAnalyze={false}
                        isDownloading={false}
                        isAnalyzed={false}
                        onDownload={() => {}}
                        downloadDisabled={false}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* No results after filtering */}
            {totalFiltered === 0 && (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No documents match the selected filters.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
