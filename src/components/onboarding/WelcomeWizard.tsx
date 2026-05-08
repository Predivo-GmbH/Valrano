import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCreateMyCompany, useUpsertMyCompanyKpis } from '@/hooks/useMyCompany'
import { useKpiDefinitions, useCompanies } from '@/hooks/useData'
import { useOnboarding, dismissOnboarding } from '@/hooks/useOnboarding'
import { CompanyAutocomplete, type CompanyResult } from '@/components/company-autocomplete'
import { cn } from '@/lib/utils'
import {
  Building2,
  BarChart3,
  Radio,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CompanyFormData {
  name: string
  sector: string
  country: string
  reporting_currency: string
}

interface KpiEntry {
  kpi_definition_id: string
  value: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STEPS = [
  { id: 1, title: 'Add Your Company', icon: Building2, duration: '~2 min' },
  { id: 2, title: 'Add Your Peers', icon: BarChart3, duration: '~3 min' },
  { id: 3, title: 'Set Up Monitoring', icon: Radio, duration: '~1 min' },
] as const

const SECTORS = [
  'Banking & Financial Services',
  'Insurance',
  'Asset Management',
  'Real Estate',
  'Technology',
  'Healthcare & Pharma',
  'Industrial & Manufacturing',
  'Energy & Utilities',
  'Consumer Goods',
  'Retail & E-Commerce',
  'Telecommunications',
  'Transportation & Logistics',
  'Media & Entertainment',
  'Construction & Materials',
  'Other',
]

const COUNTRIES = [
  'Switzerland',
  'Germany',
  'Austria',
  'France',
  'United Kingdom',
  'United States',
  'Netherlands',
  'Luxembourg',
  'Italy',
  'Spain',
  'Sweden',
  'Norway',
  'Denmark',
  'Finland',
  'Other',
]

const CURRENCIES = ['CHF', 'EUR', 'USD', 'GBP', 'SEK', 'NOK', 'DKK']

// Map jurisdiction name → COUNTRIES value for auto-fill
const JURISDICTION_TO_COUNTRY_LABEL: Record<string, string> = {
  switzerland: 'Switzerland',
  germany: 'Germany',
  austria: 'Austria',
  france: 'France',
  'united kingdom': 'United Kingdom',
  'united states': 'United States',
  netherlands: 'Netherlands',
  luxembourg: 'Luxembourg',
  italy: 'Italy',
  spain: 'Spain',
  sweden: 'Sweden',
  norway: 'Norway',
  denmark: 'Denmark',
  finland: 'Finland',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WelcomeWizard({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(1)
  const [companyForm, setCompanyForm] = useState<CompanyFormData>({
    name: '',
    sector: '',
    country: '',
    reporting_currency: 'CHF',
  })
  const [kpiEntries, setKpiEntries] = useState<KpiEntry[]>([])
  const [selectedPeerIds, setSelectedPeerIds] = useState<string[]>([])
  const [irUrls, setIrUrls] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const queryClient = useQueryClient()
  const createCompany = useCreateMyCompany()
  const upsertKpis = useUpsertMyCompanyKpis()
  const { data: kpiDefinitions } = useKpiDefinitions()
  const { data: companies } = useCompanies()
  const { status } = useOnboarding()

  // -------------------------------------------------------------------------
  // Company Autocomplete
  // -------------------------------------------------------------------------

  const handleCompanySelect = useCallback((company: CompanyResult) => {
    const countryLabel = JURISDICTION_TO_COUNTRY_LABEL[company.jurisdiction.toLowerCase()]
    const currency = CURRENCIES.includes(company.currency) ? company.currency : 'CHF'
    const sector = company.sector && SECTORS.includes(company.sector) ? company.sector : ''

    setCompanyForm((f) => ({
      ...f,
      name: company.name,
      country: countryLabel ?? f.country,
      reporting_currency: currency,
      sector: sector || f.sector,
    }))
  }, [])

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  const canGoNext = useCallback(() => {
    switch (currentStep) {
      case 1:
        return companyForm.name.trim().length > 0 && companyForm.sector.length > 0
      case 2:
        return true // Peers are optional
      case 3:
        return true // Monitoring URLs are optional
      default:
        return false
    }
  }, [currentStep, companyForm])

  const handleNext = useCallback(async () => {
    if (currentStep === 1 && !status.hasCompany) {
      setIsSubmitting(true)
      try {
        const result = await createCompany.mutateAsync({
          name: companyForm.name.trim(),
          sector: companyForm.sector || null,
          country: companyForm.country || null,
          reporting_currency: companyForm.reporting_currency || 'CHF',
          is_primary: true,
          headcount: null,
          founded_year: null,
          website_url: null,
        })
        // If KPIs were entered, save them
        if (kpiEntries.length > 0) {
          const validKpis = kpiEntries
            .filter((e) => e.value.trim() !== '' && !isNaN(Number(e.value)))
            .map((e) => ({
              kpi_definition_id: e.kpi_definition_id,
              fiscal_year: new Date().getFullYear() - 1,
              value: Number(e.value),
              currency: companyForm.reporting_currency || null,
              notes: null,
            }))
          if (validKpis.length > 0) {
            await upsertKpis.mutateAsync({
              my_company_id: result.id,
              kpis: validKpis,
            })
          }
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('Failed to create company:', err)
        setIsSubmitting(false)
        return
      }
      setIsSubmitting(false)
    }

    if (currentStep < 3) {
      setCurrentStep((s) => s + 1)
    } else {
      // Final step — mark as complete
      try {
        await dismissOnboarding()
        queryClient.invalidateQueries({ queryKey: ['onboarding-dismissed'] })
      } catch (err) {
        if (import.meta.env.DEV) console.warn('Failed to persist onboarding dismissal:', err)
      }
      onComplete()
    }
  }, [
    currentStep,
    companyForm,
    kpiEntries,
    status.hasCompany,
    createCompany,
    upsertKpis,
    queryClient,
    onComplete,
  ])

  const handlePrev = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1)
    }
  }, [currentStep])

  const handleSkip = useCallback(async () => {
    try {
      await dismissOnboarding()
      queryClient.invalidateQueries({ queryKey: ['onboarding-dismissed'] })
    } catch (err) {
      if (import.meta.env.DEV) console.warn('Failed to persist onboarding dismissal:', err)
    }
    onComplete()
  }, [queryClient, onComplete])

  // -------------------------------------------------------------------------
  // KPI Helpers
  // -------------------------------------------------------------------------

  const handleKpiChange = (kpiDefId: string, value: string) => {
    setKpiEntries((prev) => {
      const existing = prev.find((e) => e.kpi_definition_id === kpiDefId)
      if (existing) {
        return prev.map((e) =>
          e.kpi_definition_id === kpiDefId ? { ...e, value } : e,
        )
      }
      return [...prev, { kpi_definition_id: kpiDefId, value }]
    })
  }

  // -------------------------------------------------------------------------
  // Peer Helpers
  // -------------------------------------------------------------------------

  const togglePeer = (companyId: string) => {
    setSelectedPeerIds((prev) =>
      prev.includes(companyId)
        ? prev.filter((id) => id !== companyId)
        : [...prev, companyId],
    )
  }

  // -------------------------------------------------------------------------
  // Render Steps
  // -------------------------------------------------------------------------

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground">Add Your Company</h2>
        <p className="text-sm text-muted-foreground">
          Enter your company details and key KPIs for the most recent fiscal year.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="company-name">Company Name *</Label>
          <CompanyAutocomplete
            id="company-name"
            value={companyForm.name}
            onChange={(v) => setCompanyForm((f) => ({ ...f, name: v }))}
            onSelect={handleCompanySelect}
            placeholder="Start typing to search (e.g. Swiss Re)"
            className="bg-input/30"
          />
          <p className="text-xs text-muted-foreground">
            Type 3+ letters to search Swiss &amp; international company registers
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="company-sector">Sector *</Label>
          <Select
            value={companyForm.sector}
            onValueChange={(v) => v && setCompanyForm((f) => ({ ...f, sector: v }))}
          >
            <SelectTrigger id="company-sector" className="bg-input/30">
              <SelectValue placeholder="Select sector" />
            </SelectTrigger>
            <SelectContent>
              {SECTORS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="company-country">Country</Label>
          <Select
            value={companyForm.country}
            onValueChange={(v) => v && setCompanyForm((f) => ({ ...f, country: v }))}
          >
            <SelectTrigger id="company-country" className="bg-input/30">
              <SelectValue placeholder="Select country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="company-currency">Reporting Currency</Label>
          <Select
            value={companyForm.reporting_currency}
            onValueChange={(v) =>
              v && setCompanyForm((f) => ({ ...f, reporting_currency: v }))
            }
          >
            <SelectTrigger id="company-currency" className="bg-input/30">
              <SelectValue placeholder="CHF" />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Entry */}
      <div className="space-y-3 pt-2">
        <h3 className="text-sm font-medium text-foreground">
          Key KPIs — Fiscal Year {new Date().getFullYear() - 1}
        </h3>
        <p className="text-xs text-muted-foreground">
          Enter 5-10 key performance indicators. You can add more later.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {kpiDefinitions?.slice(0, 10).map((kpi) => {
            const entry = kpiEntries.find(
              (e) => e.kpi_definition_id === kpi.id,
            )
            return (
              <div key={kpi.id} className="flex items-center gap-2">
                <Label className="w-32 shrink-0 text-xs text-muted-foreground truncate" title={kpi.name}>
                  {kpi.name}
                </Label>
                <Input
                  type="number"
                  value={entry?.value ?? ''}
                  onChange={(e) => handleKpiChange(kpi.id, e.target.value)}
                  placeholder="0"
                  className="h-8 bg-input/30 text-sm"
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-foreground">Add Your Peers</h2>
        <p className="text-sm text-muted-foreground">
          Search and select 3-5 competitors to benchmark against. You can upload their
          annual reports later or let monitoring find them.
        </p>
      </div>

      {companies && companies.length > 0 ? (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {companies.map((company) => {
            const isSelected = selectedPeerIds.includes(company.id)
            return (
              <button
                key={company.id}
                type="button"
                onClick={() => togglePeer(company.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors',
                  isSelected
                    ? 'border-accent bg-accent/10'
                    : 'border-border bg-card hover:bg-muted/50',
                )}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {company.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[company.sector, company.country].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {isSelected && (
                  <Check className="size-4 text-accent shrink-0" />
                )}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
          <BarChart3 className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            No peer companies available yet. You can add peers later from the Peers
            page.
          </p>
        </div>
      )}

      {selectedPeerIds.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {selectedPeerIds.length} peer{selectedPeerIds.length !== 1 ? 's' : ''} selected
        </p>
      )}
    </div>
  )

  const renderStep3 = () => {
    const selectedCompanies = companies?.filter((c) =>
      selectedPeerIds.includes(c.id),
    ) ?? []

    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold text-foreground">
            Set Up Monitoring
          </h2>
          <p className="text-sm text-muted-foreground">
            Confirm IR page URLs for each peer. The system will start watching for
            new publications automatically.
          </p>
        </div>

        {selectedCompanies.length > 0 ? (
          <div className="space-y-4">
            {selectedCompanies.map((company) => (
              <div key={company.id} className="space-y-1.5">
                <Label className="text-sm font-medium">{company.name}</Label>
                <Input
                  type="url"
                  value={irUrls[company.id] ?? company.ir_page_url ?? ''}
                  onChange={(e) =>
                    setIrUrls((prev) => ({ ...prev, [company.id]: e.target.value }))
                  }
                  placeholder="https://company.com/investor-relations"
                  className="bg-input/30 text-sm"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center">
            <Radio className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              No peers selected. You can set up monitoring later from the Peers page.
            </p>
          </div>
        )}

        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-xs text-muted-foreground">
            Once set up, BenchmarkSignal monitors these IR pages and automatically
            detects new publications, downloads reports, and triggers benchmark
            generation.
          </p>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Main Render
  // -------------------------------------------------------------------------

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="welcome-wizard-title" className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 id="welcome-wizard-title" className="text-2xl font-bold text-foreground">
            Welcome to BenchmarkSignal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Let's get you set up in a few minutes.
          </p>
        </div>

        {/* Progress Stepper */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {STEPS.map((step, idx) => {
            const StepIcon = step.icon
            const isActive = currentStep === step.id
            const isDone = currentStep > step.id

            return (
              <div key={step.id} className="flex items-center gap-2">
                {idx > 0 && (
                  <div
                    className={cn(
                      'h-px w-8 sm:w-12',
                      isDone ? 'bg-accent' : 'bg-border',
                    )}
                  />
                )}
                <div
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                    isActive && 'bg-accent/15 text-accent border border-accent/40',
                    isDone && 'bg-accent/20 text-accent',
                    !isActive && !isDone && 'text-muted-foreground',
                  )}
                >
                  {isDone ? (
                    <Check className="size-3.5" />
                  ) : (
                    <StepIcon className="size-3.5" />
                  )}
                  <span className="hidden sm:inline">{step.title}</span>
                  <span className="sm:hidden">{step.id}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Step Content */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>

        {/* Navigation */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            {currentStep > 1 ? (
              <Button variant="ghost" size="sm" onClick={handlePrev}>
                <ChevronLeft className="size-4" data-icon="inline-start" />
                Previous
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                <X className="size-4" data-icon="inline-start" />
                Skip for now
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <Button variant="ghost" size="sm" onClick={handleSkip}>
                Skip for now
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleNext}
              disabled={!canGoNext() || isSubmitting}
            >
              {isSubmitting
                ? 'Saving...'
                : currentStep === 3
                  ? 'Finish Setup'
                  : 'Next'}
              {currentStep < 3 && !isSubmitting && (
                <ChevronRight className="size-4" data-icon="inline-end" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
