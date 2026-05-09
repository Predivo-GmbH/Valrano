import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  Building2,
  Calendar,
  Check,
  ChevronRight,
  Globe,
  Loader2,
  Rocket,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useCompanies, useReports, usePeerGroups } from '@/hooks/useData'
import { useAccountingProfile, useAnalyzeAccountingProfile } from '@/hooks/useAccountingProfile'
import { useCreateMyCompany, usePrimaryCompany } from '@/hooks/useMyCompany'
import { useUploadReport } from '@/hooks/useExtraction'
import { useCreatePublicationEvent, usePublicationEvents } from '@/hooks/useCalendar'
import { useSuggestDates, useSuggestIrUrl, useSuggestCompetitors } from '@/hooks/useAiSuggestions'
import type { CompetitorSuggestion } from '@/hooks/useAiSuggestions'
import { dismissOnboarding, useOnboarding } from '@/hooks/useOnboarding'
import { CompanyAutocomplete, type CompanyResult } from '@/components/company-autocomplete'
import type { Company } from '@/types/database'

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEPS = [
  { id: 'framework', label: 'Accounting Framework', icon: BookOpen },
  { id: 'competitors', label: 'Add Competitors', icon: Building2 },
  { id: 'schedule', label: 'Publication Schedule', icon: Calendar },
  { id: 'activate', label: 'Activate Pipeline', icon: Rocket },
] as const

// ---------------------------------------------------------------------------
// Main Wizard
// ---------------------------------------------------------------------------

export function OnboardingWizard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { status } = useOnboarding()
  const { data: primaryCompany } = usePrimaryCompany()
  const { data: peerGroups } = usePeerGroups()
  const { data: existingEvents } = usePublicationEvents()
  const [currentStep, setCurrentStep] = useState(0)

  // Pre-populate from existing data
  const existingCompetitorIds = (peerGroups ?? [])
    .flatMap(pg => pg.peer_group_members.map(m => m.company_id))
    .filter((id, i, arr) => arr.indexOf(id) === i)

  const existingSchedules: Record<string, { reportType: string; expectedDate: string }> = {}
  for (const ev of existingEvents ?? []) {
    existingSchedules[ev.company_id] = {
      reportType: ev.report_type,
      expectedDate: ev.expected_date,
    }
  }

  // Shared state across steps — seeded from existing data
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])
  const [schedules, setSchedules] = useState<
    Record<string, { reportType: string; expectedDate: string }>
  >({})

  // Sync existing data into state once loaded
  const competitorCount = existingCompetitorIds.length
  const scheduleCount = Object.keys(existingSchedules).length
  const didSeedCompetitors = useRef(false)
  useEffect(() => {
    if (competitorCount > 0 && !didSeedCompetitors.current) {
      didSeedCompetitors.current = true
      setSelectedCompanyIds(prev => prev.length === 0 ? existingCompetitorIds : prev)
    }
  }, [competitorCount]) // eslint-disable-line react-hooks/exhaustive-deps

  const didSeedSchedules = useRef(false)
  useEffect(() => {
    if (scheduleCount > 0 && !didSeedSchedules.current) {
      didSeedSchedules.current = true
      setSchedules(prev => Object.keys(prev).length === 0 ? existingSchedules : prev)
    }
  }, [scheduleCount]) // eslint-disable-line react-hooks/exhaustive-deps

  // A step is "done" if the real data exists OR the user filled it in this session
  const stepDone = (step: number): boolean => {
    switch (step) {
      case 0: return status.hasFramework
      case 1: return status.hasCompetitors || selectedCompanyIds.length >= 1
      case 2: return status.hasSchedule || Object.keys(schedules).length >= 1
      case 3: return status.isComplete
      default: return false
    }
  }

  const canProceed = (step: number): boolean => {
    switch (step) {
      case 0: return true // Framework is optional (can skip)
      case 1: return stepDone(1)
      case 2: return stepDone(2)
      case 3: return true
      default: return false
    }
  }

  const createEvent = useCreatePublicationEvent()

  const handleNext = async () => {
    if (currentStep < STEPS.length - 1) {
      // Auto-save publication schedules when leaving the schedule step
      if (currentStep === 2) {
        let saved = 0
        for (const [companyId, schedule] of Object.entries(schedules)) {
          if (!schedule.expectedDate) continue
          try {
            await createEvent.mutateAsync({
              company_id: companyId,
              report_type: schedule.reportType,
              fiscal_year: new Date().getFullYear(),
              expected_date: schedule.expectedDate,
            })
            saved++
          } catch (err) {
            if (import.meta.env.DEV) console.error(`Failed to create event for ${companyId}:`, err)
          }
        }
        if (saved > 0) {
          toast.success(`${saved} publication event${saved !== 1 ? 's' : ''} scheduled`)
        }
      }
      setCurrentStep((s) => s + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1)
    }
  }

  const handleComplete = async () => {
    try {
      await dismissOnboarding()
      queryClient.setQueryData(['onboarding-dismissed'], true)
      toast.success('Pipeline activated! Your competitors will be monitored automatically.')
      navigate('/dashboard', { replace: true })
    } catch {
      toast.error('Failed to complete onboarding')
    }
  }

  const handleSkip = async () => {
    try {
      await dismissOnboarding()
    } catch {
      // Proceed even if metadata update fails
    }
    queryClient.setQueryData(['onboarding-dismissed'], true)
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-[var(--color-background)]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-[900px] px-4 py-4 sm:px-6 flex items-center justify-between">
          <span className="text-[15px] font-bold tracking-tight text-foreground">
            BenchmarkSignal
          </span>
          <button
            onClick={handleSkip}
            className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip setup
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mx-auto w-full max-w-[900px] px-4 pt-8 sm:px-6">
        <div className="flex items-center gap-1">
          {STEPS.map((step, i) => {
            const done = stepDone(i)
            const active = i === currentStep
            const clickable = done || i < currentStep
            return (
              <div key={step.id} className="flex flex-1 items-center gap-1">
                <button
                  onClick={() => clickable ? setCurrentStep(i) : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium transition-all',
                    active
                      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                      : done || i < currentStep
                      ? 'text-[var(--color-accent)] cursor-pointer hover:bg-[var(--color-accent)]/5'
                      : 'text-muted-foreground/50',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold',
                      active || done
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'bg-[var(--color-bg-tertiary)] text-muted-foreground',
                    )}
                  >
                    {done && !active ? <Check className="h-3 w-3" /> : i + 1}
                  </div>
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      'h-[2px] flex-1',
                      done ? 'bg-[var(--color-accent)]' : 'bg-border',
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Step content */}
      <div className="mx-auto w-full max-w-[900px] flex-1 px-4 py-8 sm:px-6">
        {currentStep === 0 && <StepFramework />}
        {currentStep === 1 && (
          <StepCompetitors
            selectedIds={selectedCompanyIds}
            onSelectedIdsChange={setSelectedCompanyIds}
            myCompanyName={primaryCompany?.name ?? ''}
          />
        )}
        {currentStep === 2 && (
          <StepSchedule
            selectedCompanyIds={selectedCompanyIds}
            schedules={schedules}
            onSchedulesChange={setSchedules}
          />
        )}
        {currentStep === 3 && (
          <StepActivate
            competitorCount={selectedCompanyIds.length}
            scheduleCount={Object.keys(schedules).length}
          />
        )}
      </div>

      {/* Footer navigation */}
      <div className="border-t border-border bg-[var(--color-background)]">
        <div className="mx-auto max-w-[900px] px-4 py-4 sm:px-6 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="rounded-lg px-4 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-0"
          >
            Back
          </button>
          {currentStep < STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed(currentStep)}
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-[13px] font-medium text-background transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-[13px] font-medium text-white transition-all hover:opacity-90"
            >
              <Rocket className="h-4 w-4" />
              Activate Pipeline
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 1: Accounting Framework
// ---------------------------------------------------------------------------

function StepFramework() {
  const { data: profile, isLoading: profileLoading } = useAccountingProfile()
  const { data: reports, isLoading: reportsLoading } = useReports()
  const analyzeMutation = useAnalyzeAccountingProfile()
  const uploadMutation = useUploadReport()
  const createCompany = useCreateMyCompany()
  const { data: primaryCompany } = usePrimaryCompany()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedReportId, setSelectedReportId] = useState('')
  const [companyNameOverride, setCompanyNameOverride] = useState<string | null>(null)
  const companyName = companyNameOverride ?? primaryCompany?.name ?? ''
  const setCompanyName = (name: string) => setCompanyNameOverride(name)
  const [uploading, setUploading] = useState(false)

  const ownReports = (reports ?? [])
    .filter((r) => r.pdf_storage_path)
    .sort((a, b) => b.fiscal_year - a.fiscal_year)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!companyName.trim()) {
      toast.error('Enter your company name first')
      return
    }

    setUploading(true)
    try {
      // Ensure my_company exists
      let company = primaryCompany
      if (!company) {
        company = await createCompany.mutateAsync({
          name: companyName.trim(),
          is_primary: true,
          sector: null,
          country: null,
          reporting_currency: null,
          headcount: null,
          founded_year: null,
          website_url: null,
        })
      }

      // Upload the report — need a company_id in the companies table
      // For now, use the first available company or create a placeholder
      const { data: existingCompanies } = await supabase
        .from('companies')
        .select('id')
        .ilike('name', companyName.trim())
        .limit(1)

      let companyId = existingCompanies?.[0]?.id
      if (!companyId) {
        const { data: newCompany } = await supabase
          .from('companies')
          .insert({ name: companyName.trim(), is_active: false })
          .select('id')
          .single()
        companyId = newCompany?.id
      }

      if (!companyId) throw new Error('Could not resolve company')

      const result = await uploadMutation.mutateAsync({
        file,
        companyId,
        reportType: 'annual',
        fiscalYear: new Date().getFullYear() - 1,
      })

      // Auto-analyze
      await analyzeMutation.mutateAsync({
        reportId: result.report_id,
        companyName: companyName.trim(),
      })

      toast.success('Report analyzed! Your accounting framework has been detected.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleAnalyzeExisting = () => {
    if (!selectedReportId) return
    analyzeMutation.mutate({ reportId: selectedReportId, companyName: companyName || undefined })
  }

  const isAnalyzing = analyzeMutation.isPending || uploading

  if (profileLoading || reportsLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Profile already exists
  if (profile) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-[22px] font-semibold text-foreground">Accounting Framework</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Your framework has been detected. The AI will normalize competitor data to match your accounting policies.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-accent)]/10">
              <Check className="h-5 w-5 text-[var(--color-accent)]" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-foreground">{profile.company_name}</p>
              <p className="text-[12px] text-muted-foreground">
                {profile.accounting_standard.replace(/_/g, ' ')} ·{' '}
                {Math.round((profile.accounting_standard_confidence ?? 0) * 100)}% confidence
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(profile.policies as Record<string, unknown>)
              .filter(([, v]) => v && typeof v === 'object')
              .slice(0, 5)
              .map(([key]) => (
                <span
                  key={key}
                  className="rounded-full bg-[var(--color-accent)]/10 px-2.5 py-1 text-[10px] font-medium text-[var(--color-accent)]"
                >
                  {key.replace(/_/g, ' ')}
                </span>
              ))}
          </div>
        </div>

        <p className="text-[12px] text-muted-foreground">
          You can update this later in Settings → Accounting Profile.
        </p>
      </div>
    )
  }

  // No profile — setup form
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[22px] font-semibold text-foreground">Set Up Your Accounting Framework</h2>
        <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed max-w-xl">
          Upload your company's annual report. Our AI will detect your accounting standard (IFRS, US GAAP, Swiss GAAP FER)
          and extract your specific policies — EBITDA definition, net debt components, R&D treatment, and more.
          This is the foundation for normalizing competitor data.
        </p>
      </div>

      {/* Company name */}
      <div>
        <label className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
          Your company name
        </label>
        <div className="max-w-sm">
          <CompanyAutocomplete
            value={companyName}
            onChange={setCompanyName}
            onSelect={(company: CompanyResult) => setCompanyName(company.name)}
            placeholder="e.g., Holcim Ltd"
          />
        </div>
      </div>

      {/* Upload zone */}
      <div
        className={cn(
          'relative rounded-xl border-2 border-dashed border-border/50 bg-card/50 p-8 text-center transition-colors',
          isAnalyzing && 'opacity-50 pointer-events-none',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileUpload}
          className="absolute inset-0 cursor-pointer opacity-0"
          disabled={isAnalyzing || !companyName.trim()}
        />
        <Upload className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
        <p className="text-[13px] font-medium text-foreground">
          {isAnalyzing ? 'Analyzing your report...' : 'Drop your annual report here'}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          PDF format · The AI will extract your accounting framework automatically
        </p>
        {isAnalyzing && <Loader2 className="mx-auto mt-3 h-5 w-5 animate-spin text-[var(--color-accent)]" />}
      </div>

      {/* Or analyze existing report */}
      {ownReports.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Or select an existing report
          </p>
          <div className="flex gap-2">
            <select
              value={selectedReportId}
              onChange={(e) => setSelectedReportId(e.target.value)}
              className="flex-1 max-w-sm rounded-lg border border-border bg-[var(--color-bg-tertiary)] px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              <option value="">Choose a report...</option>
              {ownReports.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title ?? `Report FY ${r.fiscal_year}`}
                </option>
              ))}
            </select>
            <button
              onClick={handleAnalyzeExisting}
              disabled={!selectedReportId || isAnalyzing}
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-[12px] font-medium text-background hover:opacity-90 disabled:opacity-40"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Analyze
            </button>
          </div>
        </div>
      )}

      {analyzeMutation.isError && (
        <p className="text-[12px] text-[var(--color-signal-red)]">
          {(analyzeMutation.error as Error).message}
        </p>
      )}

      <p className="text-[11px] text-muted-foreground">
        You can skip this step and set it up later. However, competitor data won't be normalized until your framework is configured.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 2: Add Competitors
// ---------------------------------------------------------------------------

function StepCompetitors({
  selectedIds,
  onSelectedIdsChange,
  myCompanyName,
}: {
  selectedIds: string[]
  onSelectedIdsChange: (ids: string[]) => void
  myCompanyName: string
}) {
  const { data: companies, isLoading } = useCompanies()
  const [search, setSearch] = useState('')
  const suggestIrUrl = useSuggestIrUrl()
  const suggestCompetitors = useSuggestCompetitors()
  const [aiSuggestions, setAiSuggestions] = useState<CompetitorSuggestion[]>([])

  const filtered = (companies ?? []).filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.ticker ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  const toggleCompany = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectedIdsChange(selectedIds.filter((x) => x !== id))
    } else {
      onSelectedIdsChange([...selectedIds, id])
    }
  }

  const handleSuggestIrUrl = (company: Company) => {
    suggestIrUrl.mutate(
      { company_id: company.id, company_name: company.name },
      {
        onSuccess: (data) => {
          if (data.ir_page_url) {
            toast.success(`IR page found for ${company.name}`)
          } else {
            toast.info(`No IR page found for ${company.name}`)
          }
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  const handleAiSuggest = () => {
    if (!myCompanyName) {
      toast.error('Set up your company name in Step 1 first')
      return
    }
    suggestCompetitors.mutate(
      { company_name: myCompanyName },
      {
        onSuccess: (data) => {
          setAiSuggestions(data.suggestions)
          // Auto-select suggestions that exist in DB
          const newIds = data.suggestions
            .filter((s) => s.existing_id && !selectedIds.includes(s.existing_id))
            .map((s) => s.existing_id!)
          if (newIds.length > 0) {
            onSelectedIdsChange([...selectedIds, ...newIds])
          }
          toast.success(`Found ${data.suggestions.length} competitor suggestions`)
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[22px] font-semibold text-foreground">Add Your Competitors</h2>
        <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed max-w-xl">
          Select the companies you want to benchmark against. Let AI suggest competitors based on your
          company, or search manually.
        </p>
      </div>

      {/* AI Suggest button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleAiSuggest}
          disabled={suggestCompetitors.isPending || !myCompanyName}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-[13px] font-medium text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {suggestCompetitors.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {suggestCompetitors.isPending ? 'Finding competitors...' : 'AI Suggest Competitors'}
        </button>
        {myCompanyName && (
          <span className="text-[12px] text-muted-foreground">
            for <span className="font-medium text-foreground">{myCompanyName}</span>
          </span>
        )}
        {!myCompanyName && (
          <span className="text-[11px] text-muted-foreground">
            Add your company name in Step 1 first
          </span>
        )}
      </div>

      {/* AI Suggestions */}
      {aiSuggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-accent)]">
            AI Suggestions
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {aiSuggestions.map((s, i) => {
              const isInDb = s.in_database && s.existing_id
              const isSelected = isInDb ? selectedIds.includes(s.existing_id!) : false
              return (
                <button
                  key={`ai-${i}`}
                  onClick={() => isInDb ? toggleCompany(s.existing_id!) : undefined}
                  disabled={!isInDb}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border p-3 text-left transition-all',
                    isSelected
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                      : isInDb
                      ? 'border-border hover:border-border/80 hover:bg-[var(--color-bg-tertiary)]/50'
                      : 'border-border/50 opacity-60 cursor-not-allowed',
                  )}
                >
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold flex-shrink-0',
                      isSelected
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'bg-[var(--color-bg-tertiary)] text-muted-foreground',
                    )}
                  >
                    {isSelected ? <Check className="h-4 w-4" /> : s.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground truncate">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {s.ticker ?? ''}{s.ticker && s.sector ? ' · ' : ''}{s.sector ?? ''}
                    </p>
                    {s.reasoning && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-1">
                        {s.reasoning}
                      </p>
                    )}
                  </div>
                  {!isInDb && (
                    <span className="flex-shrink-0 text-[9px] text-muted-foreground font-medium">
                      Not in DB
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Search + Manual selection */}
      <div className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {aiSuggestions.length > 0 ? 'Or search manually' : 'Search companies'}
        </p>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies..."
            className="block w-full rounded-lg border border-border bg-[var(--color-bg-tertiary)] pl-10 pr-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          />
        </div>
      </div>

      {/* Selected count */}
      {selectedIds.length > 0 && (
        <p className="text-[12px] text-[var(--color-accent)] font-medium">
          {selectedIds.length} competitor{selectedIds.length !== 1 ? 's' : ''} selected
        </p>
      )}

      {/* Company grid */}
      {(search || !aiSuggestions.length) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-1">
          {filtered.map((company) => {
            const isSelected = selectedIds.includes(company.id)
            return (
              <button
                key={company.id}
                onClick={() => toggleCompany(company.id)}
                className={cn(
                  'flex items-center gap-3 rounded-lg border p-3 text-left transition-all',
                  isSelected
                    ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
                    : 'border-border hover:border-border/80 hover:bg-[var(--color-bg-tertiary)]/50',
                )}
              >
                <div
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-bold flex-shrink-0',
                    isSelected
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'bg-[var(--color-bg-tertiary)] text-muted-foreground',
                  )}
                >
                  {isSelected ? <Check className="h-4 w-4" /> : company.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-foreground truncate">{company.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {company.ticker ?? 'No ticker'} · {company.sector ?? 'N/A'}
                  </p>
                </div>
                {isSelected && !company.ir_page_url && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleSuggestIrUrl(company)
                    }}
                    className="flex-shrink-0 rounded-md bg-[var(--color-bg-tertiary)] px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    title="Find IR page"
                  >
                    <Globe className="h-3 w-3" />
                  </button>
                )}
                {company.ir_page_url && (
                  <span className="flex-shrink-0 text-[9px] text-[var(--color-signal-green)] font-medium">IR</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {search && filtered.length === 0 && (
        <p className="text-[12px] text-muted-foreground text-center py-8">
          No companies found matching &ldquo;{search}&rdquo;
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3: Publication Schedule
// ---------------------------------------------------------------------------

function StepSchedule({
  selectedCompanyIds,
  schedules,
  onSchedulesChange,
}: {
  selectedCompanyIds: string[]
  schedules: Record<string, { reportType: string; expectedDate: string }>
  onSchedulesChange: (s: Record<string, { reportType: string; expectedDate: string }>) => void
}) {
  const { data: companies } = useCompanies()
  const createEvent = useCreatePublicationEvent()
  const suggestDates = useSuggestDates()

  const selectedCompanies = (companies ?? []).filter((c) => selectedCompanyIds.includes(c.id))

  const updateSchedule = (companyId: string, field: 'reportType' | 'expectedDate', value: string) => {
    const existing = schedules[companyId] ?? { reportType: 'annual', expectedDate: '' }
    onSchedulesChange({
      ...schedules,
      [companyId]: { ...existing, [field]: value },
    })
  }

  const handleSuggestDate = (company: Company) => {
    const schedule = schedules[company.id]
    const reportType = schedule?.reportType ?? 'annual'
    suggestDates.mutate(
      {
        company_id: company.id,
        company_name: company.name,
        report_type: reportType,
        fiscal_year: new Date().getFullYear(),
      },
      {
        onSuccess: (data) => {
          updateSchedule(company.id, 'expectedDate', data.suggestion.suggested_date)
          toast.success(
            `Suggested: ${data.suggestion.suggested_date} (${data.suggestion.confidence}% confidence)`,
          )
        },
        onError: (err) => toast.error(err.message),
      },
    )
  }

  const handleSaveSchedules = async () => {
    let saved = 0
    for (const [companyId, schedule] of Object.entries(schedules)) {
      if (!schedule.expectedDate) continue
      try {
        await createEvent.mutateAsync({
          company_id: companyId,
          report_type: schedule.reportType,
          fiscal_year: new Date().getFullYear(),
          expected_date: schedule.expectedDate,
        })
        saved++
      } catch (err) {
        if (import.meta.env.DEV) console.error(`Failed to create event for ${companyId}:`, err)
      }
    }
    if (saved > 0) {
      toast.success(`${saved} publication event${saved !== 1 ? 's' : ''} scheduled`)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[22px] font-semibold text-foreground">Publication Schedule</h2>
        <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed max-w-xl">
          Set when each competitor typically publishes their reports. The AI can suggest dates based on
          historical patterns. The system will start monitoring before these dates.
        </p>
      </div>

      <div className="space-y-3">
        {selectedCompanies.map((company) => {
          const schedule = schedules[company.id] ?? { reportType: 'annual', expectedDate: '' }
          return (
            <div
              key={company.id}
              className="rounded-lg border border-border bg-card p-4 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground truncate">{company.name}</p>
                <p className="text-[11px] text-muted-foreground">{company.ticker ?? ''}</p>
              </div>

              <select
                value={schedule.reportType}
                onChange={(e) => updateSchedule(company.id, 'reportType', e.target.value)}
                className="rounded-lg border border-border bg-[var(--color-bg-tertiary)] px-3 py-2 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] w-36"
              >
                <option value="annual">Annual</option>
                <option value="half_year">Half-Year</option>
                <option value="quarterly">Quarterly</option>
              </select>

              <input
                type="date"
                value={schedule.expectedDate}
                onChange={(e) => updateSchedule(company.id, 'expectedDate', e.target.value)}
                className="rounded-lg border border-border bg-[var(--color-bg-tertiary)] px-3 py-2 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] w-40"
              />

              <button
                onClick={() => handleSuggestDate(company)}
                disabled={suggestDates.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-40 flex-shrink-0"
                title="AI suggest date"
              >
                {suggestDates.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                Suggest
              </button>
            </div>
          )
        })}
      </div>

      {selectedCompanies.length === 0 && (
        <p className="text-[12px] text-muted-foreground text-center py-8">
          Go back and select at least one competitor first.
        </p>
      )}

      {Object.values(schedules).some((s) => s.expectedDate) && (
        <button
          onClick={handleSaveSchedules}
          disabled={createEvent.isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)]/10 px-4 py-2 text-[12px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors"
        >
          {createEvent.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Calendar className="h-3.5 w-3.5" />
          )}
          Save schedule to calendar
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 4: Activate Pipeline
// ---------------------------------------------------------------------------

function StepActivate({
  competitorCount,
  scheduleCount,
}: {
  competitorCount: number
  scheduleCount: number
}) {
  const { data: profile } = useAccountingProfile()

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-accent)]/10 mb-4">
          <Rocket className="h-8 w-8 text-[var(--color-accent)]" />
        </div>
        <h2 className="text-[22px] font-semibold text-foreground">You're Ready!</h2>
        <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed max-w-md mx-auto">
          Here's what BenchmarkSignal will do automatically:
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <BookOpen className="mx-auto h-5 w-5 text-[var(--color-accent)] mb-2" />
          <p className="text-[20px] font-bold text-foreground">
            {profile ? '1' : '0'}
          </p>
          <p className="text-[11px] text-muted-foreground">Accounting Framework</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <Building2 className="mx-auto h-5 w-5 text-[var(--color-accent)] mb-2" />
          <p className="text-[20px] font-bold text-foreground">{competitorCount}</p>
          <p className="text-[11px] text-muted-foreground">Competitors</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <Calendar className="mx-auto h-5 w-5 text-[var(--color-accent)] mb-2" />
          <p className="text-[20px] font-bold text-foreground">{scheduleCount}</p>
          <p className="text-[11px] text-muted-foreground">Scheduled Events</p>
        </div>
      </div>

      {/* What happens next */}
      <div className="max-w-lg mx-auto space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          What happens next
        </p>
        {[
          'Monitor competitor IR pages automatically before expected publication dates',
          'Download and extract KPIs from new reports using AI',
          'Normalize data to your accounting framework for true comparisons',
          'Generate board-ready benchmark documents automatically',
          'Notify you when documents are ready for review',
        ].map((text, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)]/10 flex-shrink-0 mt-0.5">
              <Check className="h-3 w-3 text-[var(--color-accent)]" />
            </div>
            <p className="text-[13px] text-foreground leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
