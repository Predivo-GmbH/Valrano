import { useState, useRef, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
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
  Link2,
  Unlink,
  ExternalLink,
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
  useGenerateFromGoogleTemplate,
  useDownloadExport,
  useGoogleConnection,
  useConnectGoogle,
  useDisconnectGoogle,
  useAddGoogleTemplate,
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
  google_linked: { icon: Link2, color: 'text-[var(--color-signal-green)]', label: 'Google Linked' },
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function CorporateTemplatesPage() {
  const { data: templates, isLoading } = useCorporateTemplates()
  const { data: googleConnection } = useGoogleConnection()
  const connectGoogle = useConnectGoogle()
  const disconnectGoogle = useDisconnectGoogle()
  const [showUpload, setShowUpload] = useState(false)
  const [showAddGoogle, setShowAddGoogle] = useState(false)
  const [mappingTemplateId, setMappingTemplateId] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()

  const mappingTemplate = templates?.find((t) => t.id === mappingTemplateId) ?? null

  // Handle Google OAuth callback params
  useEffect(() => {
    if (searchParams.get('google_connected') === 'true') {
      toast.success('Google account connected')
      setSearchParams({ tab: 'templates' }, { replace: true })
    }
    const googleError = searchParams.get('google_error')
    if (googleError) {
      toast.error(`Google connection failed: ${googleError}`)
      setSearchParams({ tab: 'templates' }, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const handleConnectGoogle = () => {
    connectGoogle.mutate(undefined, {
      onSuccess: (res) => { window.location.href = res.url },
      onError: (err) => toast.error(`Failed: ${err.message}`),
    })
  }

  const handleDisconnectGoogle = () => {
    disconnectGoogle.mutate(undefined, {
      onSuccess: () => toast.success('Google account disconnected'),
      onError: (err) => toast.error(`Failed: ${err.message}`),
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-semibold text-foreground">Corporate Templates</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            Upload PowerPoint, Excel, or link Google Slides/Sheets templates with {'{{placeholders}}'} to generate branded reports.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {googleConnection && (
            <Button variant="outline" onClick={() => setShowAddGoogle(true)}>
              <Link2 className="h-4 w-4" />
              Add Google Template
            </Button>
          )}
          <Button onClick={() => setShowUpload(true)}>
            <Upload className="h-4 w-4" />
            Upload Template
          </Button>
        </div>
      </div>

      {/* Google Workspace connection */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]/10">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-foreground">Google Workspace</h3>
              {googleConnection ? (
                <p className="text-[12px] text-muted-foreground">
                  Connected as <span className="font-medium text-foreground">{googleConnection.google_email}</span>
                </p>
              ) : (
                <p className="text-[12px] text-muted-foreground">
                  Connect to use Google Slides and Sheets as templates
                </p>
              )}
            </div>
          </div>
          {googleConnection ? (
            <Button variant="outline" size="sm" onClick={handleDisconnectGoogle} disabled={disconnectGoogle.isPending}>
              <Unlink className="h-3.5 w-3.5" />
              Disconnect
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={handleConnectGoogle} disabled={connectGoogle.isPending}>
              {connectGoogle.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
              Connect Google
            </Button>
          )}
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-lg border border-border bg-[var(--color-bg-tertiary)]/50 p-4">
        <h3 className="text-[13px] font-semibold text-foreground mb-2">How it works</h3>
        <ol className="list-decimal list-inside space-y-1 text-[12px] text-muted-foreground">
          <li><strong>PowerPoint / Excel:</strong> Upload a .pptx or .xlsx file with {'{{placeholder}}'} tokens (e.g., {'{{company.name}}'}, {'{{kpi.revenue}}'})</li>
          <li><strong>Google Slides / Sheets:</strong> Connect your Google account and paste a template URL with {'{{placeholder}}'} tokens</li>
          <li>Map each placeholder to a data source (KPIs, company info, dates)</li>
          <li>Generate branded reports — PowerPoint/Excel download as files, Google exports as PDF</li>
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
      <AddGoogleTemplateDialog open={showAddGoogle} onClose={() => setShowAddGoogle(false)} />
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
  const generateGoogleMutation = useGenerateFromGoogleTemplate()
  const downloadMutation = useDownloadExport()
  const [showDelete, setShowDelete] = useState(false)

  const isGoogle = template.file_format === 'gslides' || template.file_format === 'gsheets'
  const status = STATUS_CONFIG[template.status]
  const StatusIcon = status.icon
  const FormatIcon = template.file_format === 'xlsx' || template.file_format === 'gsheets'
    ? FileSpreadsheet
    : Presentation

  const handleParse = () => {
    parseMutation.mutate(template.id, {
      onSuccess: (res) => toast.success(`Found ${res.placeholders.length} placeholders`),
      onError: (err) => toast.error(`Parse failed: ${err.message}`),
    })
  }

  const isGenerating = generateMutation.isPending || generateGoogleMutation.isPending

  const handleGenerate = () => {
    if (isGoogle) {
      // Google templates: generate via Google API, download PDF
      generateGoogleMutation.mutate(
        { template_id: template.id },
        {
          onSuccess: async (res) => {
            toast.success('Report generated as PDF')
            const blob = await downloadMutation.mutateAsync(res.output_path)
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${template.name}.pdf`
            a.click()
            URL.revokeObjectURL(url)
          },
          onError: (err) => toast.error(`Generate failed: ${err.message}`),
        },
      )
    } else {
      // File templates: generate via JSZip, download original format
      generateMutation.mutate(
        { template_id: template.id },
        {
          onSuccess: async (res) => {
            toast.success('Report generated')
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
              <span className="text-[11px] text-muted-foreground uppercase">
                {isGoogle ? (template.file_format === 'gslides' ? 'Google Slides' : 'Google Sheets') : `.${template.file_format}`}
              </span>
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
          {template.google_file_url && (
            <a
              href={template.google_file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Open
            </a>
          )}
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
          {(template.status === 'ready' || template.status === 'google_linked') && (
            <>
              <Button variant="outline" size="sm" onClick={onConfigureMapping}>
                <Settings className="h-3.5 w-3.5" />
                Map
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleGenerate}
                disabled={isGenerating}
              >
                {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
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

// ---------------------------------------------------------------------------
// Add Google Template Dialog
// ---------------------------------------------------------------------------

function AddGoogleTemplateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addGoogleTemplate = useAddGoogleTemplate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [fileUrl, setFileUrl] = useState('')
  const [fileFormat, setFileFormat] = useState<'gslides' | 'gsheets'>('gslides')

  const reset = () => { setName(''); setDescription(''); setFileUrl(''); setFileFormat('gslides') }

  const isValidUrl = fileUrl.includes('docs.google.com/') && fileUrl.includes('/d/')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !isValidUrl) return

    addGoogleTemplate.mutate(
      { name: name.trim(), description: description.trim() || undefined, fileUrl, fileFormat },
      {
        onSuccess: () => {
          toast.success('Google template linked')
          reset()
          onClose()
        },
        onError: (err) => toast.error(`Failed: ${err.message}`),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose() } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Google Template</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Template Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setFileFormat('gslides')}
                className={`flex-1 rounded-lg border px-3 py-2.5 text-[13px] font-medium transition-colors min-h-[44px] ${
                  fileFormat === 'gslides'
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <Presentation className="h-4 w-4 inline mr-1.5" />
                Google Slides
              </button>
              <button
                type="button"
                onClick={() => setFileFormat('gsheets')}
                className={`flex-1 rounded-lg border px-3 py-2.5 text-[13px] font-medium transition-colors min-h-[44px] ${
                  fileFormat === 'gsheets'
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileSpreadsheet className="h-4 w-4 inline mr-1.5" />
                Google Sheets
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="google-url" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Template URL
            </label>
            <input
              id="google-url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder={fileFormat === 'gslides'
                ? 'https://docs.google.com/presentation/d/...'
                : 'https://docs.google.com/spreadsheets/d/...'}
              className={`w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground ${
                fileUrl && !isValidUrl ? 'border-[var(--color-signal-red)]' : 'border-border'
              }`}
            />
            {fileUrl && !isValidUrl && (
              <p className="mt-1 text-[11px] text-[var(--color-signal-red)]">
                Enter a valid Google Slides or Sheets URL
              </p>
            )}
          </div>

          <div>
            <label htmlFor="google-name" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Template Name
            </label>
            <input
              id="google-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Board Presentation Template"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div>
            <label htmlFor="google-desc" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Description (optional)
            </label>
            <input
              id="google-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <p className="text-[11px] text-muted-foreground">
            Make sure the template contains {'{{placeholder}}'} tokens in the text (e.g., {'{{company.name}}'}, {'{{kpi.revenue}}'}).
            The template must be shared with your connected Google account.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => { reset(); onClose() }}>Cancel</Button>
            <Button type="submit" disabled={!name.trim() || !isValidUrl || addGoogleTemplate.isPending}>
              {addGoogleTemplate.isPending ? 'Linking...' : 'Link Template'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
