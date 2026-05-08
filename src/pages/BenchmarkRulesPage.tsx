import { useState } from 'react'
import { useBenchmarkRules, useCreateBenchmarkRule, useDeleteBenchmarkRule } from '@/hooks/useBenchmark'
import { useCompanies, useKpiDefinitions } from '@/hooks/useData'
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
import { Settings, Plus, Trash2, Loader2, FileText, Zap } from 'lucide-react'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Narrative style labels
// ---------------------------------------------------------------------------

const STYLE_LABELS: Record<NarrativeStyle, string> = {
  executive_brief: 'Executive Brief',
  detailed_analysis: 'Detailed Analysis',
  board_presentation: 'Board Presentation',
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="mb-4 rounded-full bg-[var(--color-bg-tertiary)] p-4">
        <Settings className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-[15px] font-semibold text-foreground">No benchmark rules</h3>
      <p className="mb-6 text-[13px] text-muted-foreground max-w-sm">
        Create a benchmark rule to define how competitive analysis documents are generated.
      </p>
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4" />
        Create Rule
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create rule dialog
// ---------------------------------------------------------------------------

interface CreateRuleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function CreateRuleDialog({ open, onOpenChange }: CreateRuleDialogProps) {
  const { data: companies } = useCompanies()
  const { data: kpiDefs } = useKpiDefinitions()
  const createMutation = useCreateBenchmarkRule()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [customerCompanyId, setCustomerCompanyId] = useState('')
  const [narrativeStyle, setNarrativeStyle] = useState<NarrativeStyle>('executive_brief')
  const [autoGenerate, setAutoGenerate] = useState(true)
  const [selectedKpis, setSelectedKpis] = useState<Set<string>>(new Set())

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Enter a rule name'); return }
    if (!customerCompanyId) { toast.error('Select a customer company'); return }
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
      await createMutation.mutateAsync({
        customer_company_id: customerCompanyId,
        name: name.trim(),
        description: description.trim() || undefined,
        kpi_selection: kpiSelection,
        narrative_style: narrativeStyle,
        auto_generate: autoGenerate,
      })
      toast.success('Benchmark rule created')
      onOpenChange(false)
      setName('')
      setDescription('')
      setSelectedKpis(new Set())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create rule')
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
          <DialogTitle>Create Benchmark Rule</DialogTitle>
          <DialogDescription>
            Define how competitive benchmark documents are generated.
          </DialogDescription>
        </DialogHeader>

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
            <Select value={customerCompanyId} onValueChange={(v) => { if (v !== null) setCustomerCompanyId(v) }}>
              <SelectTrigger className="w-full rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground">
                <SelectValue placeholder="Select company" />
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
                <SelectValue />
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
          <Button onClick={handleCreate} disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              'Create Rule'
            )}
          </Button>
        </DialogFooter>
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
        <Button onClick={() => setDialogOpen(true)}>
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
                    <span>Customer: <span className="text-foreground font-medium">{rule.companies?.name ?? '—'}</span></span>
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
          ))}
        </div>
      )}

      <CreateRuleDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}
        title="Delete Rule"
        description={deleteTarget ? `Delete rule "${deleteTarget.name}"? This will also delete associated documents.` : ''}
        onConfirm={handleDeleteConfirm}
        isPending={deleteMutation.isPending}
      />
    </div>
  )
}
