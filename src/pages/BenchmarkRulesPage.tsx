import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { useNavigate } from 'react-router-dom'
import { useBenchmarkRules, useCreateBenchmarkRule, useUpdateBenchmarkRule, useDeleteBenchmarkRule } from '@/hooks/useBenchmark'
import { useCompanies, useKpiDefinitions } from '@/hooks/useData'
import { useMyCompanies } from '@/hooks/useMyCompany'
import type { NarrativeStyle, KpiSelectionItem } from '@/types/database'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ConfirmDeleteDialog } from '@/components/ui/confirm-delete-dialog'
import { CompanyLogo } from '@/components/ui/company-logo'
import { Settings, Plus, Trash2, Loader2, FileText, Zap, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState as SharedEmptyState } from '@/components/ui/empty-state'

// ---------------------------------------------------------------------------
// Narrative style labels
// ---------------------------------------------------------------------------

const STYLE_LABELS: Record<NarrativeStyle, string> = {
  executive_brief: 'Executive Brief',
  detailed_analysis: 'Detailed Analysis',
  board_presentation: 'Board Presentation',
}

// ---------------------------------------------------------------------------
// Empty state — uses shared EmptyState component
// ---------------------------------------------------------------------------

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <SharedEmptyState
      icon={<Settings className="h-6 w-6" />}
      title="No benchmark rules"
      description="Create a benchmark rule to define how competitive analysis documents are generated."
      actionLabel="Create Rule"
      onAction={onAdd}
      actionIcon={<Plus className="h-4 w-4" />}
    />
  )
}

// ---------------------------------------------------------------------------
// Create rule dialog
// ---------------------------------------------------------------------------

interface CreateRuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingRule?: {
    id: string
    name: string
    description?: string | null
    customer_company_id: string
    narrative_style: NarrativeStyle
    auto_generate: boolean
    kpi_selection: KpiSelectionItem[]
  } | null
}

function CreateRuleDialog({ open, onOpenChange, editingRule }: CreateRuleDialogProps) {
  const navigate = useNavigate()
  const { data: companies } = useCompanies()
  const { data: myCompanies } = useMyCompanies()
  const { data: kpiDefs } = useKpiDefinitions()
  const createMutation = useCreateBenchmarkRule()
  const updateMutation = useUpdateBenchmarkRule()
  const hasCompany = (myCompanies ?? []).length > 0

  // Derive default customer company from my_companies primary record
  const defaultCustomerCompanyId = (() => {
    const primary = myCompanies?.find((mc) => mc.is_primary) ?? myCompanies?.[0]
    if (!primary) return ''
    const match = companies?.find((c) => c.name.toLowerCase() === primary.name.toLowerCase())
    return match?.id ?? ''
  })()

  const [name, setName] = useState(editingRule?.name ?? '')
  const [description, setDescription] = useState(editingRule?.description ?? '')
  const [customerCompanyId, setCustomerCompanyId] = useState(editingRule?.customer_company_id ?? '')

  const [narrativeStyle, setNarrativeStyle] = useState<NarrativeStyle>(editingRule?.narrative_style ?? 'executive_brief')

  // The effective company ID: user's selection takes priority, otherwise derived default
  const effectiveCompanyId = customerCompanyId || defaultCustomerCompanyId
  const [autoGenerate, setAutoGenerate] = useState(editingRule?.auto_generate ?? true)
  const [selectedKpis, setSelectedKpis] = useState<Set<string>>(
    new Set(editingRule?.kpi_selection.map((k) => k.kpi_definition_id) ?? [])
  )

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Enter a rule name'); return }
    if (!effectiveCompanyId) { toast.error('Select a customer company'); return }
    if (selectedKpis.size === 0) { toast.error('Select at least one KPI'); return }

    const kpiSelection: KpiSelectionItem[] = (kpiDefs ?? [])
      .filter((d) => selectedKpis.has(d.id))
      .map((d) => ({
        kpi_definition_id: d.id,
        code: d.code,
        weight: 1.0,
        threshold_pct: null,
      }))

    try {
      if (editingRule) {
        await updateMutation.mutateAsync({
          id: editingRule.id,
          name: name.trim(),
          description: description.trim() || undefined,
          kpi_selection: kpiSelection,
          narrative_style: narrativeStyle,
          auto_generate: autoGenerate,
        })
        toast.success('Benchmark rule updated')
      } else {
        await createMutation.mutateAsync({
          customer_company_id: effectiveCompanyId,
          name: name.trim(),
          description: description.trim() || undefined,
          kpi_selection: kpiSelection,
          narrative_style: narrativeStyle,
          auto_generate: autoGenerate,
        })
        toast.success('Benchmark rule created')
      }
      onOpenChange(false)
      setName('')
      setDescription('')
      setSelectedKpis(new Set())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : editingRule ? 'Failed to update rule' : 'Failed to create rule')
    }
  }

  const toggleKpi = (id: string) => {
    setSelectedKpis((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (kpiDefs) setSelectedKpis(new Set(kpiDefs.map((d) => d.id)))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingRule ? 'Edit Rule' : 'Create Benchmark Rule'}</DialogTitle>
          <DialogDescription>
            Define how competitive benchmark documents are generated.
          </DialogDescription>
        </DialogHeader>

        {!hasCompany ? (
          <div className="py-6 text-center">
            <Settings className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-3 text-[14px] font-semibold text-foreground">Add your company first</h3>
            <p className="mt-1 text-[13px] text-muted-foreground max-w-xs mx-auto">
              Before creating benchmark rules, set up your company in Settings so we know which entity to benchmark.
            </p>
            <Button onClick={() => { onOpenChange(false); navigate('/my-company') }} className="mt-4">
              Go to My Company
            </Button>
          </div>
        ) : (
        <>
        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Rule Name
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Q4 2025 Peer Benchmark"
              className="rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Description (optional)
            </Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              placeholder="Brief description of this rule's purpose"
              rows={3}
              className="w-full resize-y rounded-lg border border-border bg-[var(--color-bg-tertiary)] px-3 py-2 text-[13px] text-foreground"
            />
            <p className="text-[11px] text-muted-foreground">{description.length}/500</p>
          </div>

          {/* Customer company */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Customer Company (your company)
            </Label>
            <Select value={effectiveCompanyId} onValueChange={(v) => { if (v !== null) setCustomerCompanyId(v) }}>
              <SelectTrigger className="w-full rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground">
                <SelectValue placeholder="Select company">{(() => { const c = (companies ?? []).find((c) => c.id === effectiveCompanyId); return c ? `${c.name}${c.ticker ? ` (${c.ticker})` : ''}` : 'Select company' })()}</SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-lg border-border bg-card text-[13px]">
                {(companies ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-[13px]">
                    {c.name}{c.ticker ? ` (${c.ticker})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Narrative style */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
              Narrative Style
            </Label>
            <Select value={narrativeStyle} onValueChange={(v) => setNarrativeStyle(v as NarrativeStyle)}>
              <SelectTrigger className="w-full rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground">
                <SelectValue>{STYLE_LABELS[narrativeStyle]}</SelectValue>
              </SelectTrigger>
              <SelectContent className="rounded-lg border-border bg-card text-[13px]">
                {(Object.entries(STYLE_LABELS) as [NarrativeStyle, string][]).map(([k, label]) => (
                  <SelectItem key={k} value={k} className="text-[13px]">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Auto-generate toggle */}
          <label className="flex items-center gap-3 cursor-pointer py-1">
            <input
              type="checkbox"
              checked={autoGenerate}
              onChange={(e) => setAutoGenerate(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-[var(--color-accent)]"
            />
            <div>
              <span className="text-[13px] font-medium text-foreground">Auto-generate</span>
              <p className="text-[11px] text-muted-foreground">Automatically create benchmark when new reports are processed</p>
            </div>
          </label>

          {/* KPI Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                KPIs to Include ({selectedKpis.size} selected)
              </Label>
              <Button variant="link" size="xs" onClick={selectAll}>
                Select All
              </Button>
            </div>
            <div className="max-h-[200px] overflow-y-auto rounded-lg border border-border bg-[var(--color-bg-tertiary)] p-2 space-y-0.5">
              {(kpiDefs ?? []).map((def) => (
                <label
                  key={def.id}
                  className="flex items-center gap-2.5 rounded-md px-2 py-1.5 cursor-pointer hover:bg-[var(--color-background)] transition-colors min-h-[36px]"
                >
                  <input
                    type="checkbox"
                    checked={selectedKpis.has(def.id)}
                    onChange={() => toggleKpi(def.id)}
                    className="h-3.5 w-3.5 rounded border-border accent-[var(--color-accent)]"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] text-foreground">{def.name}</span>
                    <span className="ml-2 text-[11px] text-muted-foreground uppercase">{def.category}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
            {(createMutation.isPending || updateMutation.isPending) ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {editingRule ? 'Saving…' : 'Creating…'}
              </>
            ) : (
              editingRule ? 'Save Changes' : 'Create Rule'
            )}
          </Button>
        </DialogFooter>
        </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export function BenchmarkRulesPage() {
  const { data: rules, isLoading } = useBenchmarkRules()
  const deleteMutation = useDeleteBenchmarkRule()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<Parameters<typeof CreateRuleDialog>[0]['editingRule']>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)

  const handleDelete = (id: string, name: string) => {
    setDeleteTarget({ id, name })
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success('Rule deleted')
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    }
  }

  return (
    <>
    <Helmet><title>Benchmark Rules - Valrano</title><meta name="robots" content="noindex" /></Helmet>
    <div className="mx-auto max-w-[960px] px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
            Benchmark Rules
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Configure how competitive benchmark documents are generated from extracted KPI data.
          </p>
        </div>
        <Button onClick={() => { setEditingRule(null); setDialogOpen(true) }}>
          <Plus className="h-4 w-4" />
          Create Rule
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 skeleton-shimmer rounded-lg" />
          ))}
        </div>
      ) : !rules || rules.length === 0 ? (
        <EmptyState onAdd={() => setDialogOpen(true)} />
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="card-premium rounded-lg border border-border bg-card p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <FileText className="h-4 w-4 text-[var(--color-accent)] flex-shrink-0" />
                    <h3 className="text-[15px] font-semibold text-foreground truncate">
                      {rule.name}
                    </h3>
                  </div>
                  {rule.description && (
                    <p className="text-[13px] text-muted-foreground ml-7 mb-2">{rule.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 ml-7 text-[11px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">Customer: <CompanyLogo logoUrl={rule.companies?.logo_url} websiteUrl={rule.companies?.website_url} name={rule.companies?.name} size="xs" /><span className="text-foreground font-medium">{rule.companies?.name ?? '—'}</span>{rule.companies?.ticker && <span className="text-muted-foreground">({rule.companies.ticker})</span>}</span>
                    <span>Style: <span className="text-foreground font-medium">{STYLE_LABELS[rule.narrative_style]}</span></span>
                    <span>KPIs: <span className="text-foreground font-medium">{rule.kpi_selection.length}</span></span>
                    {rule.auto_generate && (
                      <span className="inline-flex items-center gap-1 text-[var(--color-signal-green)]">
                        <Zap className="h-3 w-3" />
                        Auto-generate
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingRule({
                        id: rule.id,
                        name: rule.name,
                        description: rule.description,
                        customer_company_id: rule.customer_company_id,
                        narrative_style: rule.narrative_style,
                        auto_generate: rule.auto_generate,
                        kpi_selection: rule.kpi_selection,
                      })
                      setDialogOpen(true)
                    }}
                    aria-label={`Edit rule ${rule.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(rule.id, rule.name)}
                    disabled={deleteMutation.isPending}
                    aria-label={`Delete rule ${rule.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateRuleDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditingRule(null)
        }}
        editingRule={editingRule}
      />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title="Delete Rule"
        description={deleteTarget ? `Delete rule "${deleteTarget.name}"? This will also delete associated documents.` : ''}
        onConfirm={handleDeleteConfirm}
        isPending={deleteMutation.isPending}
      />
    </div>
    </>
  )
}
