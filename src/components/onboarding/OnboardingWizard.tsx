import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  Building2,
  Calendar,
  Check,
  ChevronRight,
  FileText,
  Loader2,
  Rocket,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PremiumSelect } from '@/components/ui/premium-select'
import { supabase } from '@/lib/supabase'
import { useReports, usePeerGroups, useAllCompanies } from '@/hooks/useData'
import { useAccountingProfile, useAnalyzeAccountingProfile } from '@/hooks/useAccountingProfile'
import { useCreateMyCompany, usePrimaryCompany } from '@/hooks/useMyCompany'
import { useUploadReport } from '@/hooks/useExtraction'
import { useCreatePublicationEvent, usePublicationEvents } from '@/hooks/useCalendar'
import { useSuggestDates, useSuggestCompetitors } from '@/hooks/useAiSuggestions'
import type { CompetitorSuggestion } from '@/hooks/useAiSuggestions'
import { dismissOnboarding, useOnboarding } from '@/hooks/useOnboarding'
import { CompanyAutocomplete } from '@/components/company-autocomplete'
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
  const [aiSuggestions, setAiSuggestions] = useState<CompetitorSuggestion[]>([])
  const [reportCompetitors, setReportCompetitors] = useState<Array<{ name: string; ticker?: string; context?: string }>>([])
  const [competitorsConfirmed, setCompetitorsConfirmed] = useState(false)

  // Seed report competitors from accounting profile (persists across step navigation)
  const { data: accountingProfile } = useAccountingProfile()
  const didSeedReportCompetitors = useRef(false)
  useEffect(() => {
    if (accountingProfile?.mentioned_competitors?.length && !didSeedReportCompetitors.current) {
      didSeedReportCompetitors.current = true
      setReportCompetitors(accountingProfile.mentioned_competitors)
    }
  }, [accountingProfile])

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
      case 1: return status.hasCompetitors || competitorsConfirmed
      case 2: return currentStep > 2 || Object.values(schedules).some(s => s.expectedDate)
      case 3: return status.isComplete
      default: return false
    }
  }

  const canProceed = (step: number): boolean => stepDone(step)

  // A step is reachable in the breadcrumb if all previous steps are done, or it's before the current step
  const canNavigateTo = (step: number): boolean => {
    if (step <= currentStep) return true // can always go back
    // Can jump forward only if all steps before it are done
    for (let i = 0; i < step; i++) {
      if (!stepDone(i)) return false
    }
    return true
  }

  const createEvent = useCreatePublicationEvent()

  const handleNext = async () => {
    if (currentStep < STEPS.length - 1) {
      // Auto-save selected competitors as a peer group when leaving Step 1
      if (currentStep === 1 && selectedCompanyIds.length > 0) {
        try {
          // Create or find the default peer group
          const { data: existingPg } = await supabase
            .from('peer_groups')
            .select('id')
            .eq('name', 'Default')
            .maybeSingle()

          let pgId: string
          if (existingPg) {
            pgId = existingPg.id
            // Remove old members to replace with current selection
            await supabase.from('peer_group_members').delete().eq('peer_group_id', pgId)
          } else {
            const { data: { user } } = await supabase.auth.getUser()
            const { data: newPg, error: pgError } = await supabase
              .from('peer_groups')
              .insert({ name: 'Default', description: 'Auto-created during onboarding', owner_id: user?.id })
              .select('id')
              .single()
            if (pgError || !newPg) throw pgError
            pgId = newPg.id
          }

          // Add all selected companies as peer group members
          const members = selectedCompanyIds.map((companyId) => ({
            peer_group_id: pgId,
            company_id: companyId,
          }))
          await supabase.from('peer_group_members').insert(members)
          queryClient.invalidateQueries({ queryKey: ['peer-groups'] })
          setCompetitorsConfirmed(true)
        } catch (err) {
          if (import.meta.env.DEV) console.error('Failed to save peer group:', err)
          toast.error('Failed to save competitors')
        }
      }

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
            const clickable = canNavigateTo(i)
            return (
              <div key={step.id} className="flex flex-1 items-center gap-1">
                <button
                  onClick={() => clickable ? setCurrentStep(i) : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium transition-all',
                    active
                      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                      : clickable
                      ? 'text-[var(--color-accent)] cursor-pointer hover:bg-[var(--color-accent)]/5'
                      : 'text-muted-foreground/50 cursor-not-allowed',
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
        {currentStep === 0 && <StepFramework onReportCompetitorsFound={(competitors, autoSelect) => {
          setReportCompetitors(competitors)
          // Auto-select report competitors by inserting them into the DB if needed
          if (autoSelect && competitors.length > 0) {
            void (async () => {
              // Re-fetch companies fresh to avoid race conditions with parallel calls
              const { data: freshCompanies } = await supabase.from('companies').select('id, name, ticker')
              const existingCompanies = freshCompanies ?? []
              const newIds: string[] = [...selectedCompanyIds]
              for (const rc of competitors) {
                const match = existingCompanies.find(
                  (c) => c.name.toLowerCase() === rc.name.toLowerCase() ||
                    (rc.ticker && c.ticker && c.ticker.toLowerCase() === rc.ticker.toLowerCase()),
                )
                if (match) {
                  if (!newIds.includes(match.id)) newIds.push(match.id)
                } else {
                  // Use upsert-like pattern: try insert, on conflict select existing
                  const { data: inserted, error } = await supabase
                    .from('companies')
                    .insert({ name: rc.name, ticker: rc.ticker ?? null })
                    .select('id')
                    .single()
                  if (inserted) {
                    newIds.push(inserted.id)
                    existingCompanies.push({ id: inserted.id, name: rc.name, ticker: rc.ticker ?? null })
                  } else if (error) {
                    // If insert failed (e.g. race condition duplicate), find the existing one
                    const { data: existing } = await supabase
                      .from('companies')
                      .select('id')
                      .ilike('name', rc.name)
                      .limit(1)
                      .single()
                    if (existing && !newIds.includes(existing.id)) newIds.push(existing.id)
                  }
                }
              }
              if (newIds.length > selectedCompanyIds.length) {
                setSelectedCompanyIds(newIds)
                queryClient.invalidateQueries({ queryKey: ['companies-all'] })
              }
            })()
          }
        }} />}
        {currentStep === 1 && (
          <StepCompetitors
            selectedIds={selectedCompanyIds}
            onSelectedIdsChange={setSelectedCompanyIds}
            myCompanyName={primaryCompany?.name ?? ''}
            aiSuggestions={aiSuggestions}
            onAiSuggestionsChange={setAiSuggestions}
            reportCompetitors={reportCompetitors}
          />
        )}
        {currentStep === 2 && (
          <StepSchedule
            selectedCompanyIds={selectedCompanyIds}
            schedules={schedules}
            onSchedulesChange={setSchedules}
            onSkip={() => setCurrentStep(3)}
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

function StepFramework({ onReportCompetitorsFound }: { onReportCompetitorsFound: (competitors: Array<{ name: string; ticker?: string; context?: string }>, autoSelect: boolean) => void }) {
  const { data: profile, isLoading: profileLoading } = useAccountingProfile()
  const { data: reports, isLoading: reportsLoading } = useReports()
  const analyzeMutation = useAnalyzeAccountingProfile()
  const uploadMutation = useUploadReport()
  const createCompany = useCreateMyCompany()
  const { data: primaryCompany } = usePrimaryCompany()

  // Seed report competitors from existing profile on mount (display only — no auto-select,
  // because the upload handler already auto-selects when the report is first analyzed)
  const seededRef = useRef(false)
  useEffect(() => {
    if (profile && !seededRef.current) {
      const mc = profile.mentioned_competitors
      if (mc && mc.length > 0) {
        onReportCompetitorsFound(mc, false)
        seededRef.current = true
      }
    }
  }, [profile, onReportCompetitorsFound])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedReportId, setSelectedReportId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadStep, setUploadStep] = useState<'idle' | 'uploading' | 'processing_file' | 'uploading_to_ai' | 'analyzing' | 'saving' | 'complete' | 'done'>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const progressRef = useRef(0)

  const ownReports = (reports ?? [])
    .filter((r) => r.pdf_storage_path)
    .sort((a, b) => b.fiscal_year - a.fiscal_year)

  // Map edge function processing_status steps to UI display
  const PROGRESS_STEPS = [
    { key: 'uploading', label: 'Uploading PDF to secure storage' },
    { key: 'processing_file', label: 'Processing your PDF file' },
    { key: 'uploading_to_ai', label: 'Uploading PDF to AI engine' },
    { key: 'analyzing', label: 'AI reading your annual report' },
    { key: 'saving', label: 'Saving profile & extracting competitors' },
  ] as const

  const STEP_PROGRESS: Record<string, number> = {
    uploading: 10,
    processing_file: 25,
    uploading_to_ai: 40,
    analyzing: 60,
    saving: 85,
    complete: 100,
  }

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are supported')
      return
    }

    setUploading(true)
    setUploadStep('uploading')
    setUploadProgress(0)
    progressRef.current = 0

    let realtimeChannel: ReturnType<typeof supabase.channel> | null = null

    try {
      // Step 1: Upload PDF — create a placeholder company silently (required by storage path)
      const placeholderName = 'Pending Analysis'
      let company = primaryCompany
      if (!company) {
        company = await createCompany.mutateAsync({
          name: placeholderName,
          is_primary: true,
          sector: null,
          country: null,
          reporting_currency: null,
          headcount: null,
          founded_year: null,
          website_url: null,
        })
      }

      let companyId = company?.company_id
      if (!companyId && company) {
        const { data: created } = await supabase
          .from('companies')
          .insert({ name: placeholderName, is_active: true })
          .select('id')
          .single()
        companyId = created?.id

        if (companyId) {
          await supabase
            .from('my_companies')
            .update({ company_id: companyId })
            .eq('id', company.id)
        }
      }

      if (!companyId) throw new Error('Could not resolve company')

      setUploadProgress(5)

      const result = await uploadMutation.mutateAsync({
        file,
        companyId,
        reportType: 'annual',
        fiscalYear: new Date().getFullYear() - 1,
      })

      setUploadProgress(10)

      // Subscribe to Realtime progress updates from the edge function
      realtimeChannel = supabase
        .channel(`processing-${result.report_id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'processing_status',
            filter: `report_id=eq.${result.report_id}`,
          },
          (payload) => {
            const row = payload.new as { step: string; status: string; message: string }

            if (row.status === 'error') {
              toast.error(row.message || 'Analysis failed')
              return
            }

            // Only update UI on in_progress events (marks the start of each step)
            if (row.status === 'in_progress') {
              setUploadStep(row.step as typeof uploadStep)
              setUploadProgress(STEP_PROGRESS[row.step] ?? progressRef.current)
              progressRef.current = STEP_PROGRESS[row.step] ?? progressRef.current
            }

            if (row.step === 'complete' && row.status === 'done') {
              setUploadProgress(100)
              progressRef.current = 100
            }
          },
        )
        .subscribe()

      // Step 2: Call the analysis edge function (progress comes via Realtime)
      setUploadStep('analyzing')
      setUploadProgress(15)

      const analysisResult = await analyzeMutation.mutateAsync({ reportId: result.report_id })

      // Step 3: Setting up company profile with AI-extracted name
      setUploadStep('saving')
      setUploadProgress(90)

      const analysisData = analysisResult as { company_name?: string; mentioned_competitors?: Array<{ name: string; ticker?: string; context?: string }> }
      const extractedName = analysisData?.company_name
      if (extractedName && company) {
        await supabase
          .from('my_companies')
          .update({ name: extractedName })
          .eq('id', company.id)
      }

      // Capture competitors mentioned in the report for Step 2 (auto-select them)
      if (analysisData?.mentioned_competitors?.length) {
        onReportCompetitorsFound(analysisData.mentioned_competitors, true)
      }

      // Done
      setUploadStep('done')
      setUploadProgress(100)
      toast.success('Report analyzed! Your accounting framework has been detected.')
    } catch (err) {
      setUploadStep('idle')
      setUploadProgress(0)
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      if (realtimeChannel) supabase.removeChannel(realtimeChannel)
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const handleAnalyzeExisting = () => {
    if (!selectedReportId) return
    analyzeMutation.mutate({ reportId: selectedReportId })
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

      {/* Upload zone / Progress tracker */}
      {uploadStep !== 'idle' && uploadStep !== 'done' ? (
        <div className="rounded-xl border border-border/50 bg-card/50 p-6 space-y-5">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Processing your report...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300 ease-out"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>

          {/* Step indicators */}
          <div className="space-y-3">
            {PROGRESS_STEPS.map((step, stepIdx) => {
              const stepOrder: string[] = PROGRESS_STEPS.map(s => s.key)
              const currentIdx = stepOrder.indexOf(uploadStep as string) === -1 ? stepOrder.length : stepOrder.indexOf(uploadStep as string)
              const isActive = step.key === uploadStep
              const isDone = stepIdx < currentIdx

              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full flex-shrink-0 transition-all duration-300',
                    isDone ? 'bg-[var(--color-accent)] text-white' :
                    isActive ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' :
                    'bg-[var(--color-bg-tertiary)] text-muted-foreground/40',
                  )}>
                    {isDone ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : isActive ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <span className="text-[10px] font-medium">{stepIdx + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-[12px] font-medium transition-colors',
                      isDone ? 'text-muted-foreground' :
                      isActive ? 'text-foreground' :
                      'text-muted-foreground/40',
                    )}>
                      {step.label}
                    </p>
                  </div>
                  <span className={cn(
                    'text-[10px] flex-shrink-0 transition-colors',
                    isDone ? 'text-[var(--color-accent)]' :
                    isActive ? 'text-muted-foreground' :
                    'text-muted-foreground/30',
                  )}>
                    {isDone ? 'Done' : isActive ? '…' : ''}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload PDF file"
          onClick={() => !isAnalyzing && fileInputRef.current?.click()}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isAnalyzing) { e.preventDefault(); fileInputRef.current?.click() } }}
          onDragOver={(e) => { e.preventDefault(); if (!isAnalyzing) setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => { if (!isAnalyzing) handleDrop(e); else e.preventDefault() }}
          className={cn(
            'relative rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 cursor-pointer',
            isDragging
              ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
              : 'border-border/50 bg-card/50 hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-bg-tertiary)]',
          )}
        >
          <Upload className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="text-[13px] font-medium text-foreground">
            Drop your annual report here or click to browse
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            PDF format · The AI will extract your company name and accounting framework automatically
          </p>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileUpload}
        className="hidden"
        disabled={isAnalyzing}
      />

      {/* Or analyze existing report — hidden during active upload */}
      {ownReports.length > 0 && uploadStep === 'idle' && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Or select an existing report
          </p>
          <div className="flex gap-2">
            <PremiumSelect
              value={selectedReportId}
              onChange={setSelectedReportId}
              options={[
                { value: '', label: 'Choose a report...' },
                ...ownReports.map((r) => ({
                  value: r.id,
                  label: r.title ?? `Report FY ${r.fiscal_year}`,
                })),
              ]}
              triggerClassName="flex-1 max-w-sm"
            />
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
  aiSuggestions,
  onAiSuggestionsChange,
  reportCompetitors,
}: {
  selectedIds: string[]
  onSelectedIdsChange: (ids: string[]) => void
  myCompanyName: string
  aiSuggestions: CompetitorSuggestion[]
  onAiSuggestionsChange: (suggestions: CompetitorSuggestion[]) => void
  reportCompetitors: Array<{ name: string; ticker?: string; context?: string }>
}) {
  const { data: companies, isLoading } = useAllCompanies()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [addingIdx, setAddingIdx] = useState<number | null>(null)
  const suggestCompetitors = useSuggestCompetitors()

  const toggleCompany = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectedIdsChange(selectedIds.filter((x) => x !== id))
    } else {
      onSelectedIdsChange([...selectedIds, id])
    }
  }

  const handleAddSuggestion = async (suggestion: CompetitorSuggestion, idx: number) => {
    setAddingIdx(idx)
    try {
      const { data: inserted, error } = await supabase
        .from('companies')
        .insert({
          name: suggestion.name,
          ticker: suggestion.ticker ?? null,
          sector: suggestion.sector ?? null,
          website_url: suggestion.website_domain ? `https://${suggestion.website_domain}` : null,
        })
        .select('id')
        .single()
      if (error) {
        toast.error(`Failed to add ${suggestion.name}`)
        return
      }
      // Update suggestion to reflect it's now in DB
      onAiSuggestionsChange(
        aiSuggestions.map((s, i) =>
          i === idx ? { ...s, existing_id: inserted.id, in_database: true } : s,
        ),
      )
      onSelectedIdsChange([...selectedIds, inserted.id])
      await queryClient.invalidateQueries({ queryKey: ['companies-all'] })
      toast.success(`${suggestion.name} added and selected`)
    } catch {
      toast.error(`Failed to add ${suggestion.name}`)
    } finally {
      setAddingIdx(null)
    }
  }

  const handleAiSuggest = () => {
    if (!myCompanyName) {
      toast.error('Set up your company name in Step 1 first')
      return
    }
    const reportNames = reportCompetitors.map((rc) => rc.name)
    suggestCompetitors.mutate(
      { company_name: myCompanyName, exclude_names: reportNames },
      {
        onSuccess: (data) => {
          // Filter out any suggestions that duplicate report-found competitors
          const reportNamesLower = new Set(reportNames.map((n) => n.toLowerCase()))
          const filtered = data.suggestions.filter(
            (s) => !reportNamesLower.has(s.name.toLowerCase()),
          )
          onAiSuggestionsChange(filtered)
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

  // Build unified suggestion list: report competitors first, then AI suggestions
  const unifiedSuggestions: Array<{
    name: string
    ticker?: string
    sector?: string
    context?: string
    reasoning?: string
    source: 'report' | 'ai'
    existing_id?: string | null
    in_database?: boolean
    originalIdx: number
  }> = []

  for (let i = 0; i < reportCompetitors.length; i++) {
    const rc = reportCompetitors[i]
    unifiedSuggestions.push({
      name: rc.name,
      ticker: rc.ticker,
      context: rc.context,
      source: 'report',
      originalIdx: -(i + 1), // negative index for report competitors
    })
  }

  for (let i = 0; i < aiSuggestions.length; i++) {
    const s = aiSuggestions[i]
    unifiedSuggestions.push({
      name: s.name,
      ticker: s.ticker ?? undefined,
      sector: s.sector ?? undefined,
      reasoning: s.reasoning ?? undefined,
      source: 'ai',
      existing_id: s.existing_id,
      in_database: s.in_database,
      originalIdx: i,
    })
  }

  // Helper: resolve DB id for a suggestion item
  const resolveDbId = (item: typeof unifiedSuggestions[number]) => {
    if (item.source === 'report') {
      const existing = (companies ?? []).find(
        (c) => c.name.toLowerCase() === item.name.toLowerCase() ||
          (item.ticker && c.ticker && c.ticker.toLowerCase() === item.ticker.toLowerCase()),
      )
      return existing?.id
    }
    return item.in_database ? item.existing_id : undefined
  }

  // Helper: add a suggestion to DB and select it
  const addAndSelect = async (item: typeof unifiedSuggestions[number]) => {
    setAddingIdx(item.originalIdx)
    try {
      if (item.source === 'report') {
        const { data: inserted, error } = await supabase
          .from('companies')
          .insert({ name: item.name, ticker: item.ticker ?? null })
          .select('id')
          .single()
        if (error) { toast.error(`Failed to add ${item.name}`); return }
        onSelectedIdsChange([...selectedIds, inserted.id])
        await queryClient.invalidateQueries({ queryKey: ['companies-all'] })
        toast.success(`${item.name} added`)
      } else {
        await handleAddSuggestion(aiSuggestions[item.originalIdx], item.originalIdx)
      }
    } catch { toast.error(`Failed to add ${item.name}`) }
    finally { setAddingIdx(null) }
  }

  // Render a suggestion card
  const renderSuggestionCard = (item: typeof unifiedSuggestions[number], idx: number) => {
    const dbId = resolveDbId(item)
    const isSelected = dbId ? selectedIds.includes(dbId) : false
    const isAdding = addingIdx === item.originalIdx

    const handleClick = () => {
      if (dbId) {
        toggleCompany(dbId)
      } else {
        addAndSelect(item)
      }
    }

    return (
      <button
        key={`${item.source}-${idx}`}
        onClick={handleClick}
        disabled={isAdding}
        className={cn(
          'flex items-center gap-3 rounded-lg border p-3 text-left transition-all',
          isSelected
            ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5'
            : 'border-border hover:border-border/80 hover:bg-[var(--color-bg-tertiary)]/50',
          isAdding && 'opacity-60',
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
          {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : isSelected ? <Check className="h-4 w-4" /> : item.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-foreground truncate">{item.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {item.source === 'report'
              ? [item.ticker, item.context].filter(Boolean).join(' · ')
              : [item.ticker, item.sector].filter(Boolean).join(' · ')}
          </p>
          {item.reasoning && (
            <p className="text-[10px] text-muted-foreground/70 mt-0.5 line-clamp-1">
              {item.reasoning}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isSelected ? (
            <span className="text-[10px] text-muted-foreground">✕</span>
          ) : !isAdding ? (
            <span className="text-[10px] text-[var(--color-accent)] font-medium">+ Add</span>
          ) : null}
        </div>
      </button>
    )
  }

  const reportSuggestions = unifiedSuggestions.filter((s) => s.source === 'report')
  const aiSuggestionItems = unifiedSuggestions.filter((s) => s.source === 'ai')
  const selectedCompanies = (companies ?? []).filter((c) => selectedIds.includes(c.id))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[22px] font-semibold text-foreground">Add Your Competitors</h2>
        <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed max-w-xl">
          Build your peer group for benchmarking. Add competitors from three sources:
        </p>
      </div>

      {/* ── Section 1: Report-extracted competitors ── */}
      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10">
            <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-[13px] font-semibold text-foreground">From your annual report</h3>
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            {reportSuggestions.length} found
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {reportSuggestions.length > 0
            ? 'These companies were explicitly mentioned as competitors or peers in your uploaded report. Click to add them to your peer group.'
            : 'No competitors were explicitly named in your report. Use AI discovery or manual search below.'}
        </p>
        {reportSuggestions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {reportSuggestions.map((item, idx) => renderSuggestionCard(item, idx))}
          </div>
        )}
      </div>

      {/* ── Section 2: AI-discovered competitors ── */}
      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--color-accent)]/10">
              <Sparkles className="h-3.5 w-3.5 text-[var(--color-accent)]" />
            </div>
            <h3 className="text-[13px] font-semibold text-foreground">AI-discovered competitors</h3>
            {aiSuggestionItems.length > 0 && (
              <span className="rounded-full bg-[var(--color-accent)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--color-accent)]">
                {aiSuggestionItems.length} found
              </span>
            )}
          </div>
          <button
            onClick={handleAiSuggest}
            disabled={suggestCompetitors.isPending || !myCompanyName}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-[12px] font-medium text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {suggestCompetitors.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {suggestCompetitors.isPending
              ? 'Searching...'
              : aiSuggestionItems.length > 0
              ? 'Find more'
              : 'Discover competitors'}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {aiSuggestionItems.length > 0
            ? `AI analyzed ${myCompanyName}'s industry and found these competitors. Click to add them.`
            : myCompanyName
            ? `Click "Discover competitors" to let AI find companies in the same industry as ${myCompanyName}.`
            : 'Set up your company name in Step 1, then use AI to discover competitors automatically.'}
        </p>
        {aiSuggestionItems.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {aiSuggestionItems.map((item, idx) => renderSuggestionCard(item, idx))}
          </div>
        )}
      </div>

      {/* ── Section 3: Manual search ── */}
      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10">
            <Search className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          </div>
          <h3 className="text-[13px] font-semibold text-foreground">Search & add manually</h3>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Search Swiss (Zefix) and international company registers to add specific competitors.
        </p>
        <div className="max-w-md">
          <CompanyAutocomplete
            value={search}
            onChange={setSearch}
            onSelect={(result) => void (async () => {
              const existing = (companies ?? []).find(
                (c) => c.name.toLowerCase() === result.name.toLowerCase()
              )
              if (existing) {
                if (!selectedIds.includes(existing.id)) {
                  onSelectedIdsChange([...selectedIds, existing.id])
                }
                toast.success(`${result.name} selected`)
              } else {
                const { data: inserted, error } = await supabase
                  .from('companies')
                  .insert({
                    name: result.name,
                    ticker: result.ticker ?? null,
                    sector: result.sector ?? null,
                    country: result.country_code ?? null,
                    reporting_currency: result.currency ?? 'CHF',
                  })
                  .select('id')
                  .single()
                if (error) {
                  toast.error('Failed to add company')
                } else {
                  onSelectedIdsChange([...selectedIds, inserted.id])
                  await queryClient.invalidateQueries({ queryKey: ['companies-all'] })
                  toast.success(`${result.name} added`)
                }
              }
              setSearch('')
            })()}
            placeholder="Type a company name to search..."
            className="border-amber-500/30 focus-within:border-amber-500/60"
          />
        </div>
      </div>

      {/* ── Selected peer group summary ── */}
      {selectedCompanies.length > 0 && (() => {
        const reportNames = new Set(reportCompetitors.map((rc) => rc.name.toLowerCase()))
        const aiNames = new Set(aiSuggestions.map((s) => s.name.toLowerCase()))
        return (
          <div className="rounded-xl border-2 border-[var(--color-accent)]/30 bg-[var(--color-accent)]/3 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-[var(--color-accent)]" />
              <h3 className="text-[13px] font-semibold text-foreground">
                Your peer group ({selectedCompanies.length})
              </h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedCompanies.map((company) => {
                const nameLower = company.name.toLowerCase()
                const source = reportNames.has(nameLower) ? 'report' : aiNames.has(nameLower) ? 'AI' : 'manual'
                return (
                  <button
                    key={company.id}
                    onClick={() => toggleCompany(company.id)}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--color-accent)]/30 bg-background px-3 py-1.5 text-[12px] font-medium text-foreground transition-all hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <span className={cn(
                      'inline-block h-1.5 w-1.5 rounded-full',
                      source === 'report' ? 'bg-emerald-500'
                        : source === 'AI' ? 'bg-[var(--color-accent)]'
                        : 'bg-amber-500',
                    )} />
                    {company.name}
                    <span className="text-muted-foreground group-hover:text-red-500 transition-colors">✕</span>
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /> from report</span>
              <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" /> AI-discovered</span>
              <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" /> manually added</span>
            </div>
          </div>
        )
      })()}
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
  onSkip,
}: {
  selectedCompanyIds: string[]
  schedules: Record<string, { reportType: string; expectedDate: string }>
  onSchedulesChange: (s: Record<string, { reportType: string; expectedDate: string }>) => void
  onSkip: () => void
}) {
  const { data: companies } = useAllCompanies()
  const suggestDates = useSuggestDates()
  const [suggestingCompanyId, setSuggestingCompanyId] = useState<string | null>(null)

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
    setSuggestingCompanyId(company.id)
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
          setSuggestingCompanyId(null)
        },
        onError: (err) => {
          toast.error(err.message)
          setSuggestingCompanyId(null)
        },
      },
    )
  }

  const [suggestingAll, setSuggestingAll] = useState(false)

  const handleSuggestAll = async () => {
    const toSuggest = selectedCompanies.filter((c) => !schedules[c.id]?.expectedDate)
    if (toSuggest.length === 0) {
      toast.info('All competitors already have dates')
      return
    }
    setSuggestingAll(true)
    let completed = 0
    for (const company of toSuggest) {
      const reportType = schedules[company.id]?.reportType ?? 'annual'
      setSuggestingCompanyId(company.id)
      try {
        const data = await suggestDates.mutateAsync({
          company_id: company.id,
          company_name: company.name,
          report_type: reportType,
          fiscal_year: new Date().getFullYear(),
        })
        updateSchedule(company.id, 'expectedDate', data.suggestion.suggested_date)
        completed++
      } catch (err) {
        if (import.meta.env.DEV) console.error(`Failed to suggest for ${company.name}:`, err)
      }
    }
    setSuggestingCompanyId(null)
    setSuggestingAll(false)
    if (completed > 0) {
      toast.success(`Suggested dates for ${completed} competitor${completed !== 1 ? 's' : ''}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-semibold text-foreground">Publication Schedule</h2>
          <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed max-w-xl">
            Set when each competitor typically publishes their reports. The AI can suggest dates based on
            historical patterns.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-1">
          <button
            onClick={onSkip}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2.5 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
          >
            Skip this step
          </button>
        {selectedCompanies.length > 0 && (
          <button
            onClick={handleSuggestAll}
            disabled={suggestingAll}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)]/10 px-4 py-2.5 text-[12px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors disabled:opacity-40 flex-shrink-0 mt-1"
          >
            {suggestingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Suggest All
          </button>
        )}
        </div>
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

              <PremiumSelect
                value={schedule.reportType}
                onChange={(v) => updateSchedule(company.id, 'reportType', v)}
                options={[
                  { value: 'annual', label: 'Annual' },
                  { value: 'half_year', label: 'Half-Year' },
                  { value: 'quarterly', label: 'Quarterly' },
                ]}
                triggerClassName="w-36 text-[12px]"
              />

              <input
                type="date"
                value={schedule.expectedDate}
                onChange={(e) => updateSchedule(company.id, 'expectedDate', e.target.value)}
                className="rounded-lg border border-border bg-[var(--color-bg-tertiary)] px-3 py-2 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] w-40"
              />

              <button
                onClick={() => handleSuggestDate(company)}
                disabled={suggestingCompanyId !== null}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-40 flex-shrink-0"
                title="AI suggest date"
              >
                {suggestingCompanyId === company.id ? (
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
          No competitors selected yet. You can skip this step and add publication dates later from the Calendar page.
        </p>
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
