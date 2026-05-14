import { useState, useRef } from 'react'
import {
  Upload,
  FileSpreadsheet,
  Presentation,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  Zap,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import {
  useCorporateTemplates,
  useUploadCorporateTemplate,
  useParseTemplate,
  useDeleteCorporateTemplate,
  useUpdatePlaceholderMapping,
  useGenerateFromTemplate,
  useDownloadExport,
  type CorporateTemplate,
} from '@/hooks/useCorporateTemplates'

// ---------------------------------------------------------------------------
// Data source options for placeholder mapping
// ---------------------------------------------------------------------------

const DATA_SOURCES = [
  { group: 'Company', items: [
    { value: 'company.name', label: 'Company Name' },
    { value: 'company.ticker', label: 'Ticker' },
    { value: 'company.sector', label: 'Sector' },
    { value: 'company.industry', label: 'Industry' },
    { value: 'company.country', label: 'Country' },
    { value: 'company.website', label: 'Website' },
  ]},
  { group: 'KPIs', items: [
    { value: 'kpi.revenue', label: 'Revenue' },
    { value: 'kpi.ebitda', label: 'EBITDA' },
    { value: 'kpi.ebit', label: 'EBIT' },
    { value: 'kpi.net_income', label: 'Net Income' },
    { value: 'kpi.total_assets', label: 'Total Assets' },
    { value: 'kpi.equity', label: 'Equity' },
    { value: 'kpi.employees', label: 'Employees' },
    { value: 'kpi.revenue_growth', label: 'Revenue Growth %' },
    { value: 'kpi.ebitda_margin', label: 'EBITDA Margin %' },
    { value: 'kpi.roe', label: 'Return on Equity %' },
  ]},
  { group: 'Dates', items: [
    { value: 'date.today', label: 'Today' },
    { value: 'date.year', label: 'Current Year' },
  ]},
]

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<CorporateTemplate['status'], { icon: typeof CheckCircle2; color: string; label: string }> = {
  uploaded: { icon: Upload, color: 'text-muted-foreground', label: 'Uploaded' },
  parsing: { icon: Loader2, color: 'text-[var(--color-accent)]', label: 'Parsing...' },
  ready: { icon: CheckCircle2, color: 'text-[var(--color-signal-green)]', label: 'Ready' },
  error: { icon: AlertCircle, color: 'text-[var(--color-signal-red)]', label: 'Error' },
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function CorporateTemplatesPage() {
  const { data: templates, isLoading } = useCorporateTemplates()
  const [showUpload, setShowUpload] = useState(false)
  const [mappingTemplateId, setMappingTemplateId] = useState<string | null>(null)

  const mappingTemplate = templates?.find((t) => t.id === mappingTemplateId) ?? null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-semibold text-foreground">Corporate Templates</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Upload your PowerPoint or Excel templates with {'{{placeholders}}'} to generate branded benchmark reports.
          </p>
        </div>
        <Button onClick={() => setShowUpload(true)}>
          <Upload className="h-4 w-4" />
          Upload Template
        </Button>
      </div>

      {/* How it works */}
      <div className="rounded-lg border border-border bg-[var(--color-bg-tertiary)]/50 p-4">
        <h3 className="text-[13px] font-semibold text-foreground mb-2">How it works</h3>
        <ol className="list-decimal list-inside space-y-1 text-[12px] text-muted-foreground">
          <li>Upload a .pptx or .xlsx file with {'{{placeholder}}'} tokens (e.g., {'{{company.name}}'}, {'{{kpi.revenue}}'})</li>
          <li>We automatically detect all placeholders in your template</li>
          <li>Map each placeholder to a data source (KPIs, company info, dates)</li>
          <li>Generate branded reports with your data filled in</li>
        </ol>
      </div>

      {/* Template list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : !templates?.length ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 rounded-full bg-[var(--color-bg-tertiary)] p-4">
            <Presentation className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mb-2 text-[15px] font-semibold text-foreground">No templates yet</h3>
          <p className="mb-4 text-[13px] text-muted-foreground max-w-sm">
            Upload a PowerPoint or Excel template to start generating branded benchmark reports.
          </p>
          <Button onClick={() => setShowUpload(true)}>
            <Upload className="h-4 w-4" />
            Upload Template
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onConfigureMapping={() => setMappingTemplateId(t.id)}
            />
          ))}
        </div>
      )}

      <UploadTemplateDialog open={showUpload} onClose={() => setShowUpload(false)} />
      {mappingTemplate && (
        <PlaceholderMappingDialog
          template={mappingTemplate}
          onClose={() => setMappingTemplateId(null)}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Template Card
// ---------------------------------------------------------------------------

function TemplateCard({
  template,
  onConfigureMapping,
}: {
  template: CorporateTemplate
  onConfigureMapping: () => void
}) {
  const parseMutation = useParseTemplate()
  const deleteMutation = useDeleteCorporateTemplate()
  const generateMutation = useGenerateFromTemplate()
  const downloadMutation = useDownloadExport()
  const [showDelete, setShowDelete] = useState(false)

  const status = STATUS_CONFIG[template.status]
  const StatusIcon = status.icon
  const FormatIcon = template.file_format === 'xlsx' ? FileSpreadsheet : Presentation

  const handleParse = () => {
    parseMutation.mutate(template.id, {
      onSuccess: (res) => toast.success(`Found ${res.placeholders.length} placeholders`),
      onError: (err) => toast.error(`Parse failed: ${err.message}`),
    })
  }

  const handleGenerate = () => {
    generateMutation.mutate(
      { template_id: template.id },
      {
        onSuccess: async (res) => {
          toast.success('Report generated')
          // Auto-download
          const blob = await downloadMutation.mutateAsync(res.output_path)
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${template.name}.${template.file_format}`
          a.click()
          URL.revokeObjectURL(url)
        },
        onError: (err) => toast.error(`Generate failed: ${err.message}`),
      },
    )
  }

  return (
    <div className="card-premium rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]/10">
            <FormatIcon className="h-5 w-5 text-[var(--color-accent)]" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground truncate">{template.name}</h3>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${status.color}`}>
                <StatusIcon className={`h-3 w-3 ${template.status === 'parsing' ? 'animate-spin' : ''}`} />
                {status.label}
              </span>
              <span className="text-[11px] text-muted-foreground uppercase">.{template.file_format}</span>
              {template.slide_count != null && (
                <span className="text-[11px] text-muted-foreground">
                  {template.slide_count} {template.file_format === 'xlsx' ? 'sheets' : 'slides'}
                </span>
              )}
              {template.placeholders.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  {template.placeholders.length} placeholders
                </span>
              )}
            </div>
            {template.description && (
              <p className="mt-1 text-[12px] text-muted-foreground truncate max-w-[400px]">{template.description}</p>
            )}
            {template.error_message && (
              <p className="mt-1 text-[12px] text-[var(--color-signal-red)]">{template.error_message}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {template.status === 'uploaded' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleParse}
              disabled={parseMutation.isPending}
            >
              {parseMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Parse
            </Button>
          )}
          {template.status === 'ready' && (
            <>
              <Button variant="outline" size="sm" onClick={onConfigureMapping}>
                <Settings className="h-3.5 w-3.5" />
                Map
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Generate
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete template"
            onClick={() => setShowDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title="Delete Template"
        description="This will permanently delete the template and all generated exports. This cannot be undone."
        onConfirm={() => {
          deleteMutation.mutate(template, {
            onSuccess: () => { toast.success('Template deleted'); setShowDelete(false) },
            onError: (err) => toast.error(`Delete failed: ${err.message}`),
          })
        }}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Upload Dialog
// ---------------------------------------------------------------------------

function UploadTemplateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const uploadMutation = useUploadCorporateTemplate()
  const parseMutation = useParseTemplate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)

  const reset = () => { setName(''); setDescription(''); setFile(null) }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !name.trim()) return

    uploadMutation.mutate(
      { file, name: name.trim(), description: description.trim() || undefined },
      {
        onSuccess: (template) => {
          toast.success('Template uploaded, parsing placeholders...')
          // Auto-parse
          parseMutation.mutate(template.id, {
            onSuccess: (res) => toast.success(`Found ${res.placeholders.length} placeholders`),
            onError: () => toast.error('Parsing failed — you can retry from the template card'),
          })
          reset()
          onClose()
        },
        onError: (err) => toast.error(`Upload failed: ${err.message}`),
      },
    )
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (!name.trim()) {
      setName(f.name.replace(/\.(pptx|xlsx)$/i, ''))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose() } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Corporate Template</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Drop zone */}
          <div
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6 cursor-pointer hover:border-[var(--color-accent)] transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files[0]
              if (f && (f.name.endsWith('.pptx') || f.name.endsWith('.xlsx'))) {
                setFile(f)
                if (!name.trim()) setName(f.name.replace(/\.(pptx|xlsx)$/i, ''))
              } else {
                toast.error('Only .pptx and .xlsx files are supported')
              }
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pptx,.xlsx"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="text-center">
                <div className="flex items-center gap-2 text-[var(--color-accent)]">
                  {file.name.endsWith('.xlsx') ? (
                    <FileSpreadsheet className="h-6 w-6" />
                  ) : (
                    <Presentation className="h-6 w-6" />
                  )}
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
            ) : (
              <>
                <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-[13px] text-muted-foreground">Drop .pptx or .xlsx file here, or click to browse</p>
                <p className="text-[11px] text-muted-foreground mt-1">Max 50 MB</p>
              </>
            )}
          </div>

          <div>
            <label htmlFor="tpl-name" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Template Name
            </label>
            <input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Board Presentation Q4"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div>
            <label htmlFor="tpl-desc" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Description (optional)
            </label>
            <input
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => { reset(); onClose() }}>Cancel</Button>
            <Button type="submit" disabled={!file || !name.trim() || uploadMutation.isPending}>
              {uploadMutation.isPending ? 'Uploading...' : 'Upload & Parse'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Placeholder Mapping Dialog
// ---------------------------------------------------------------------------

function PlaceholderMappingDialog({
  template,
  onClose,
}: {
  template: CorporateTemplate
  onClose: () => void
}) {
  const updateMapping = useUpdatePlaceholderMapping()
  const [mapping, setMapping] = useState<Record<string, string>>(
    () => ({ ...template.placeholder_mapping }),
  )
  const [expanded, setExpanded] = useState(true)

  const handleSave = () => {
    updateMapping.mutate(
      { templateId: template.id, mapping },
      {
        onSuccess: () => { toast.success('Mapping saved'); onClose() },
        onError: (err) => toast.error(`Save failed: ${err.message}`),
      },
    )
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Placeholder Mapping</DialogTitle>
        </DialogHeader>
        <p className="text-[13px] text-muted-foreground mb-4">
          Map each detected placeholder to a data source. When generating, these will be replaced with actual values.
        </p>

        {template.placeholders.length === 0 ? (
          <p className="text-[13px] text-muted-foreground text-center py-8">
            No placeholders detected. Make sure your template contains {'{{placeholder}}'} tokens.
          </p>
        ) : (
          <div className="space-y-3">
            {template.placeholders.map((placeholder) => (
              <div key={placeholder} className="flex items-center gap-3">
                <code className="shrink-0 rounded bg-muted px-2 py-1 text-[12px] font-mono text-foreground min-w-[140px]">
                  {`{{${placeholder}}}`}
                </code>
                <span className="text-muted-foreground text-[12px]">&rarr;</span>
                <select
                  value={mapping[placeholder] ?? ''}
                  onChange={(e) => setMapping({ ...mapping, [placeholder]: e.target.value })}
                  className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-[12px] text-foreground"
                >
                  <option value="">— Not mapped —</option>
                  {DATA_SOURCES.map((group) => (
                    <optgroup key={group.group} label={group.group}>
                      {group.items.map((item) => (
                        <option key={item.value} value={item.value}>{item.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        {/* Available data sources reference */}
        <div className="mt-4 border-t border-border pt-4">
          <button
            type="button"
            className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Available data sources
          </button>
          {expanded && (
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
              {DATA_SOURCES.flatMap((g) =>
                g.items.map((item) => (
                  <div key={item.value}>
                    <code className="text-[10px]">{item.value}</code> — {item.label}
                  </div>
                )),
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={updateMapping.isPending}>
            {updateMapping.isPending ? 'Saving...' : 'Save Mapping'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
