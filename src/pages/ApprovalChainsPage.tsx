import { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { Plus, Trash2 } from 'lucide-react'
import { PremiumSelect } from '@/components/ui/premium-select'
import { PageSkeleton } from '@/components/ui/page-skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { useApprovalChains, useCreateApprovalChain } from '@/hooks/useBenchmark'
import { useBenchmarkRules } from '@/hooks/useBenchmark'
import type { ApprovalRole, ApprovalChainStep } from '@/types/database'

const ROLE_LABELS: Record<ApprovalRole, string> = {
  analyst: 'Analyst',
  manager: 'Manager',
  director: 'Director',
  c_suite: 'C-Suite',
}

export function ApprovalChainsPage() {
  const { data: chains, isLoading } = useApprovalChains()
  const { data: rules } = useBenchmarkRules()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <>
      <Helmet><title>Approval Chains - Valrano</title><meta name="robots" content="noindex" /></Helmet>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">Approval Chains</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure review and approval workflows for benchmark documents.
          </p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="mb-6 flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-[var(--color-primary)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          <Plus className="h-4 w-4" />
          Create Approval Chain
        </button>

        {isLoading ? (
          <PageSkeleton />
        ) : (chains ?? []).length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <h3 className="text-lg font-semibold text-foreground">No approval chains</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Create an approval chain to route benchmark documents through review.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {(chains ?? []).map((chain) => {
              const steps = (chain.steps ?? []) as ApprovalChainStep[]
              return (
                <Card key={chain.id} className="p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{chain.name}</h3>
                      {chain.benchmark_rules && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Rule: {chain.benchmark_rules.name}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {steps.length} step{steps.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground">
                          {step.step_number}. {ROLE_LABELS[step.role]}
                          {step.is_optional && <span className="ml-1 text-muted-foreground">(opt)</span>}
                        </div>
                        {i < steps.length - 1 && (
                          <span className="text-muted-foreground">→</span>
                        )}
                      </div>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {showCreate && (
          <CreateChainDialog
            rules={(rules ?? []).map((r) => ({ id: r.id, name: r.name }))}
            onClose={() => setShowCreate(false)}
          />
        )}
      </div>
    </>
  )
}

function CreateChainDialog({
  rules,
  onClose,
}: {
  rules: { id: string; name: string }[]
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [ruleId, setRuleId] = useState('')
  const [steps, setSteps] = useState<ApprovalChainStep[]>([
    { step_number: 1, role: 'analyst', user_id: null, is_optional: false },
    { step_number: 2, role: 'manager', user_id: null, is_optional: false },
  ])
  const createMutation = useCreateApprovalChain()

  function addStep() {
    const roles: ApprovalRole[] = ['analyst', 'manager', 'director', 'c_suite']
    const nextRole = roles[Math.min(steps.length, roles.length - 1)]
    setSteps([...steps, { step_number: steps.length + 1, role: nextRole, user_id: null, is_optional: false }])
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index).map((s, i) => ({ ...s, step_number: i + 1 })))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    createMutation.mutate(
      {
        name,
        benchmark_rule_id: ruleId || null,
        steps,
      },
      {
        onSuccess: () => {
          toast.success('Approval chain created')
          onClose()
        },
        onError: (err) => toast.error(`Failed: ${err.message}`),
      }
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-4 text-lg font-semibold text-foreground">Create Approval Chain</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="chain-name" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Name</label>
            <input
              id="chain-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g., Standard Review"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          <div>
            <label htmlFor="chain-rule" className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Benchmark Rule (optional)</label>
            <PremiumSelect
              id="chain-rule"
              value={ruleId}
              onChange={setRuleId}
              options={[
                { value: '', label: 'All rules' },
                ...rules.map((r) => ({ value: r.id, label: r.name })),
              ]}
              triggerClassName="w-full"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Steps</label>
            <div className="space-y-2">
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 text-center text-xs font-medium text-muted-foreground">{step.step_number}</span>
                  <PremiumSelect
                    value={step.role}
                    onChange={(v) => {
                      const newSteps = [...steps]
                      newSteps[i] = { ...step, role: v as ApprovalRole }
                      setSteps(newSteps)
                    }}
                    options={Object.entries(ROLE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                    triggerClassName="flex-1"
                  />
                  <label className="flex items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={step.is_optional}
                      onChange={(e) => {
                        const newSteps = [...steps]
                        newSteps[i] = { ...step, is_optional: e.target.checked }
                        setSteps(newSteps)
                      }}
                    />
                    Optional
                  </label>
                  {steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(i)}
                      aria-label={`Remove step ${step.step_number}`}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addStep}
              className="mt-2 text-xs font-medium text-[var(--color-accent)] hover:underline"
            >
              + Add Step
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="min-h-[44px] rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]">Cancel</button>
            <button type="submit" disabled={createMutation.isPending} className="min-h-[44px] rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-colors hover:opacity-90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2">
              {createMutation.isPending ? 'Creating...' : 'Create Chain'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
