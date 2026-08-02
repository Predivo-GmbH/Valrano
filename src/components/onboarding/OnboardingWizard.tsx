import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  Building2,
  Calendar,
  Check,
  ChevronRight,
  Download,
  FileText,
  Link2,
  Loader2,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PremiumSelect } from '@/components/ui/premium-select'
import { supabase, getCurrentUserId } from '@/lib/supabase'
import { useReports, usePeerGroups, useAllCompanies } from '@/hooks/useData'
import { useAccountingProfile, useAnalyzeAccountingProfile } from '@/hooks/useAccountingProfile'
import { useCreateMyCompany, usePrimaryCompany } from '@/hooks/useMyCompany'
import { useUploadReport, useExtractKpis, useNormalizeKpis } from '@/hooks/useExtraction'
import { useCreatePublicationEvent, usePublicationEvents } from '@/hooks/useCalendar'
import { useSuggestDates } from '@/hooks/useAiSuggestions'
import { useIrCatalogForCompanies, useDownloadCatalogItem } from '@/hooks/useIrCatalog'
import { dismissOnboarding, useOnboarding } from '@/hooks/useOnboarding'
import { useSmoothProgress } from '@/hooks/useSmoothProgress'
import { CompanyAutocomplete } from '@/components/company-autocomplete'
import { CompanyLogo } from '@/components/ui/company-logo'
import type { Company } from '@/types/database'

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

const STEPS = [
  { id: 'framework', label: 'Accounting Framework', icon: BookOpen },
  { id: 'competitors', label: 'Add Competitors', icon: Building2 },
  { id: 'reports', label: 'Analyze Reports', icon: Download },
  { id: 'schedule', label: 'Publication Schedule', icon: Calendar },
] as const


// ---------------------------------------------------------------------------
// Main Wizard
// ---------------------------------------------------------------------------

export function OnboardingWizard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { status } = useOnboarding()
  const { data: peerGroups } = usePeerGroups()
  const { data: existingEvents } = usePublicationEvents()
  // User-driven step (null = auto-detect from status)
  const [userStep, setUserStep] = useState<number | null>(null)
  const autoStep = status.hasFramework && status.hasCompetitors ? 2
    : status.hasFramework ? 1 : 0
  // Get user's fiscal year from their uploaded report (for FY-matched competitor report filtering)
  // Prefer the fiscal year of the most recent ANNUAL report — quarterly/half-year reports
  // may reference a FY that hasn't ended yet (e.g., Q1 2026 uploaded in May 2026).
  // Fall back to (currentYear - 1), the most recent completed fiscal year.
  const { data: ownReportsAll } = useReports()
  const userFiscalYear = (ownReportsAll ?? [])
    .filter(r => r.fiscal_year && r.report_type === 'annual')
    .sort((a, b) => b.fiscal_year - a.fiscal_year)[0]?.fiscal_year
    ?? (ownReportsAll ?? [])
      .filter(r => r.fiscal_year)
      .sort((a, b) => b.fiscal_year - a.fiscal_year)[0]?.fiscal_year
    ?? (new Date().getFullYear() - 1)
  const currentStep = userStep ?? autoStep

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
  const selectedCompanyIdsRef = useRef(selectedCompanyIds)
  useEffect(() => { selectedCompanyIdsRef.current = selectedCompanyIds }, [selectedCompanyIds])
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
  // Track which schedule dates the user explicitly confirmed (manual input or individual suggest)
  const [userConfirmedScheduleIds, setUserConfirmedScheduleIds] = useState<Set<string>>(new Set())

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
      case 2: return currentStep > 2 // reports step is optional — only mark done once user has passed it
      case 3: return status.hasSchedule || Object.values(schedules).some(s => s.expectedDate)
      default: return false
    }
  }

  const canProceed = (step: number): boolean => {
    if (step === 1) return stepDone(1) || selectedCompanyIds.length >= 1
    if (step === 2) return true // reports step is optional
    if (step === 3) return true // schedule is optional
    return stepDone(step)
  }

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
            const userId = await getCurrentUserId()
            const { data: newPg, error: pgError } = await supabase
              .from('peer_groups')
              .insert({ name: 'Default', description: 'Auto-created during onboarding', owner_id: userId })
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
          queryClient.invalidateQueries({ queryKey: ['visible-company-ids'] })
          queryClient.invalidateQueries({ queryKey: ['companies'] })
          setCompetitorsConfirmed(true)
        } catch (err) {
          if (import.meta.env.DEV) console.error('Failed to save peer group:', err)
          toast.error('Failed to save competitors')
        }
      }

      // Auto-save publication schedules when leaving the schedule step
      // ONLY save events the user explicitly confirmed (manual date entry or individual suggest)
      if (currentStep === 3) {
        let saved = 0
        for (const [companyId, schedule] of Object.entries(schedules)) {
          if (!schedule.expectedDate) continue
          if (!userConfirmedScheduleIds.has(companyId)) continue
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
      setUserStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setUserStep(currentStep - 1)
    }
  }

  const handleFinishSetup = async () => {
    // Save schedules if any were entered (same as handleNext for step 3)
    if (currentStep === 3) {
      const userId = await getCurrentUserId()
      if (userId) {
        let saved = 0
        for (const [companyId, schedule] of Object.entries(schedules)) {
          if (schedule.expectedDate) {
            const { error } = await supabase.from('publication_events').upsert(
              {
                company_id: companyId,
                report_type: schedule.reportType || 'annual',
                expected_date: schedule.expectedDate,
                status: 'scheduled',
                created_by: userId,
              },
              { onConflict: 'company_id,report_type,expected_date' },
            )
            if (!error) saved++
          }
        }
        if (saved > 0) {
          queryClient.invalidateQueries({ queryKey: ['publication-events'] })
        }
      }
    }
    try {
      await dismissOnboarding()
      queryClient.setQueryData(['onboarding-dismissed'], true)
      const hasSchedules = Object.values(schedules).some(s => s.expectedDate)
      if (hasSchedules) {
        toast.success('Setup complete! Your competitors will be monitored automatically.')
      } else {
        toast.success('Setup complete! Add publication dates on the Calendar page to start monitoring.')
      }
      navigate('/dashboard', { replace: true })
    } catch {
      toast.error('Failed to complete setup')
    }
  }

  const handleSkipSchedule = async () => {
    try {
      await dismissOnboarding()
      queryClient.setQueryData(['onboarding-dismissed'], true)
      toast.success('Setup complete! Add publication dates on the Calendar page to start monitoring.')
      navigate('/dashboard', { replace: true })
    } catch {
      toast.error('Failed to complete setup')
    }
  }

  const handleSkip = async () => {
    // Must set onboarding_dismissed so OnboardingGuard doesn't redirect back
    try {
      await dismissOnboarding()
    } catch { /* proceed anyway */ }
    queryClient.setQueryData(['onboarding-dismissed'], true)
    navigate('/dashboard', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-[var(--color-background)]/80 backdrop-blur-xl">
        <div className="mx-auto max-w-[900px] px-4 py-4 sm:px-6 flex items-center justify-between">
          <span className="text-[15px] font-bold tracking-tight text-foreground">
            Valrano
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
                  onClick={() => clickable ? setUserStep(i) : undefined}
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
          // Auto-select report competitors — always create fresh company records (data isolation Rule E)
          if (autoSelect && competitors.length > 0) {
            void (async () => {
              const userId = await getCurrentUserId()
              const session = (await supabase.auth.getSession()).data.session
              const newIds: string[] = [...selectedCompanyIdsRef.current]
              for (const rc of competitors) {
                const { data: inserted } = await supabase
                  .from('companies')
                  .insert({ name: rc.name, ticker: rc.ticker ?? null, created_by: userId })
                  .select('id')
                  .single()
                if (inserted) {
                  newIds.push(inserted.id)
                  // Resolve website + discover IR page in background
                  if (session) {
                    const headers = {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${session.access_token}`,
                      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    }
                    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-company-website`, {
                      method: 'POST',
                      headers,
                      body: JSON.stringify({ name: rc.name, company_id: inserted.id }),
                    }).then(() => {
                      queryClient.invalidateQueries({ queryKey: ['companies-all'] })
                      // Auto-discover IR page URL → then scan for documents
                      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-ir-url`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ company_id: inserted.id, company_name: rc.name }),
                      }).then(() => {
                        queryClient.invalidateQueries({ queryKey: ['companies-all'] })
                        // Trigger scan-ir-page with user JWT (server-side auto-trigger is unreliable)
                        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-ir-page`, {
                          method: 'POST',
                          headers,
                          body: JSON.stringify({ company_id: inserted.id }),
                        }).then(() => {
                          queryClient.invalidateQueries({ queryKey: ['ir-catalog'] })
                          queryClient.invalidateQueries({ queryKey: ['companies-all'] })
                        }).catch(() => {})
                      }).catch(() => {})
                    }).catch(() => {})
                  }
                }
              }
              if (newIds.length > selectedCompanyIdsRef.current.length) {
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
            reportCompetitors={reportCompetitors}
          />
        )}
        {currentStep === 2 && (
          <StepReports
            selectedCompanyIds={selectedCompanyIds}
            userFiscalYear={userFiscalYear}
          />
        )}
        {currentStep === 3 && (
          <StepSchedule
            selectedCompanyIds={selectedCompanyIds}
            schedules={schedules}
            onSchedulesChange={setSchedules}
            onConfirmSchedule={(id) => setUserConfirmedScheduleIds((prev) => new Set(prev).add(id))}
            onSkip={handleSkipSchedule}
          />
        )}
      </div>

      {/* Footer navigation */}
      <div className="border-t border-border bg-[var(--color-background)]">
        <div className="mx-auto max-w-[900px] px-4 py-4 sm:px-6 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="min-h-[44px] rounded-lg px-4 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-0"
          >
            Back
          </button>
          {currentStep < STEPS.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed(currentStep)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-foreground px-5 py-2.5 text-[13px] font-medium text-background transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleFinishSetup}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-[13px] font-medium text-white transition-all hover:opacity-90"
            >
              <Check className="h-4 w-4" />
              Finish Setup
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
  const queryClient = useQueryClient()
  const { data: profile, isLoading: profileLoading } = useAccountingProfile()
  const { data: reports, isLoading: reportsLoading } = useReports()
  const analyzeMutation = useAnalyzeAccountingProfile()
  const uploadMutation = useUploadReport()
  const extractMutation = useExtractKpis()
  const normalizeMutation = useNormalizeKpis()
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
  const displayProgress = useSmoothProgress(uploadProgress)
  const progressRef = useRef(0)
  const MIN_STEP_MS = 5000

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

    try {
      // ── Step 1: Uploading PDF to secure storage ──
      const stepStart1 = Date.now()
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
        const currentUserId = await getCurrentUserId()
        const { data: created } = await supabase
          .from('companies')
          .insert({ name: placeholderName, is_active: true, created_by: currentUserId })
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

      // Auto-resolve website URL (and thus logo) in background
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) return
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-company-website`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ name: placeholderName, company_id: companyId }),
          },
        ).then(() => {
          queryClient.invalidateQueries({ queryKey: ['companies-all'] })
        }).catch(() => {})
      })

      setUploadProgress(5)

      const result = await uploadMutation.mutateAsync({
        file,
        companyId,
      })

      // Ensure step 1 displayed for at least MIN_STEP_MS
      const elapsed1 = Date.now() - stepStart1
      if (elapsed1 < MIN_STEP_MS) await new Promise(r => setTimeout(r, MIN_STEP_MS - elapsed1))

      // ── Step 2: Processing your PDF file ──
      setUploadStep('processing_file')
      setUploadProgress(STEP_PROGRESS['processing_file'])
      await new Promise(r => setTimeout(r, MIN_STEP_MS))

      // ── Step 3: Uploading PDF to AI engine ──
      setUploadStep('uploading_to_ai')
      setUploadProgress(STEP_PROGRESS['uploading_to_ai'])
      await new Promise(r => setTimeout(r, MIN_STEP_MS))

      // ── Step 4: AI reading your annual report ──
      // This is the real long-running step — the edge function does the work here
      setUploadStep('analyzing')
      setUploadProgress(STEP_PROGRESS['analyzing'])

      const analysisResult = await analyzeMutation.mutateAsync({ reportId: result.report_id })

      // ── Step 5: Saving profile & extracting competitors ──
      setUploadStep('saving')
      setUploadProgress(90)
      const stepStart5 = Date.now()

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

      // ── Step 6: Extract KPIs from the report ──
      try {
        await extractMutation.mutateAsync(result.report_id)
        // Normalize KPIs (currency conversion) — DB trigger handles most, edge function catches edge cases
        try {
          await normalizeMutation.mutateAsync(result.report_id)
        } catch (normErr) {
          if (import.meta.env.DEV) console.warn('Edge function normalization failed (DB trigger should have handled it):', normErr)
        }
      } catch (extractErr) {
        if (import.meta.env.DEV) console.warn('KPI extraction failed during onboarding:', extractErr)
        toast.warning('Accounting profile saved, but KPI extraction failed. You can retry from My Company page.')
      }

      // Ensure step 5 displayed for at least MIN_STEP_MS
      const elapsed5 = Date.now() - stepStart5
      if (elapsed5 < MIN_STEP_MS) await new Promise(r => setTimeout(r, MIN_STEP_MS - elapsed5))

      // Done
      setUploadStep('done')
      setUploadProgress(100)
      toast.success('Report analyzed! Your accounting framework has been detected.')
    } catch (err) {
      setUploadStep('idle')
      setUploadProgress(0)
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
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

  const handleAnalyzeExisting = async () => {
    if (!selectedReportId) return
    try {
      await analyzeMutation.mutateAsync({ reportId: selectedReportId })
      // Also extract KPIs so report moves from "pending" to "extracted"
      try {
        await extractMutation.mutateAsync(selectedReportId)
        try { await normalizeMutation.mutateAsync(selectedReportId) } catch { /* DB trigger fallback */ }
      } catch {
        toast.warning('KPI extraction failed. You can retry from My Company page.')
      }
    } catch {
      // analyzeMutation.onError already shows toast via hook
    }
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
        <h2 className="text-[22px] font-semibold text-foreground">Upload Your Annual Report</h2>
        <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed max-w-xl">
          This report is the foundation for everything that follows. Upload your company's <strong className="text-foreground font-medium">most recent annual report</strong> for
          the best results — the system will find matching competitor reports for the same fiscal year.
        </p>
      </div>

      {/* What we extract — info box */}
      {uploadStep === 'idle' && !profile && (
        <div className="rounded-xl border border-border/50 bg-card/50 p-4 space-y-3">
          <p className="text-[12px] font-semibold text-foreground">What our AI extracts from your report:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { label: 'Company name', desc: 'Identified from the cover page' },
              { label: 'Accounting standard', desc: 'IFRS, US GAAP, Swiss GAAP FER, HGB' },
              { label: 'Accounting policies', desc: 'EBITDA definition, net debt, R&D treatment, leases' },
              { label: 'KPI definitions', desc: 'How your company calculates each metric' },
              { label: 'Competitors', desc: 'Peer companies mentioned in your report' },
              { label: 'Fiscal year', desc: 'Used to find matching competitor reports' },
            ].map(item => (
              <div key={item.label} className="flex items-start gap-2">
                <Check className="h-3.5 w-3.5 text-[var(--color-accent)] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[12px] font-medium text-foreground">{item.label}</p>
                  <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground/70 border-t border-border/30 pt-2">
            All competitor data will be normalized against your accounting framework, ensuring apples-to-apples comparisons.
          </p>
        </div>
      )}

      {/* Upload zone / Progress tracker */}
      {uploadStep !== 'idle' && uploadStep !== 'done' ? (
        <div className="rounded-xl border border-border/50 bg-card/50 p-6 space-y-5">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Processing your report...</span>
              <span>{displayProgress}%</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500 ease-out"
                style={{ width: `${displayProgress}%` }}
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
            Drop your latest annual report here or click to browse
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            PDF format · We recommend your most recent annual report for the best competitor matching
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
  reportCompetitors,
}: {
  selectedIds: string[]
  onSelectedIdsChange: (ids: string[]) => void
  reportCompetitors: Array<{ name: string; ticker?: string; context?: string }>
}) {
  const { data: companies, isLoading } = useAllCompanies()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [addingIdx, setAddingIdx] = useState<number | null>(null)

  const toggleCompany = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectedIdsChange(selectedIds.filter((x) => x !== id))
    } else {
      onSelectedIdsChange([...selectedIds, id])
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Build report suggestion list
  const reportSuggestionItems: Array<{
    name: string
    ticker?: string
    context?: string
    originalIdx: number
  }> = reportCompetitors.map((rc, i) => ({
    name: rc.name,
    ticker: rc.ticker,
    context: rc.context,
    originalIdx: -(i + 1),
  }))

  // Helper: add a report suggestion to DB and select it
  const addAndSelect = async (item: typeof reportSuggestionItems[number]) => {
    setAddingIdx(item.originalIdx)
    try {
      const currentUserId = await getCurrentUserId()
      const { data: inserted, error } = await supabase
        .from('companies')
        .insert({ name: item.name, ticker: item.ticker ?? null, created_by: currentUserId })
        .select('id')
        .single()
      if (error) { toast.error(`Failed to add ${item.name}`); return }
      onSelectedIdsChange([...selectedIds, inserted.id])
      await queryClient.invalidateQueries({ queryKey: ['companies-all'] })
      // Resolve website + discover IR page in background
      const session = (await supabase.auth.getSession()).data.session
      if (session) {
        const headers = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        }
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-company-website`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: item.name, company_id: inserted.id }),
        }).then(() => {
          queryClient.invalidateQueries({ queryKey: ['companies-all'] })
          // Auto-discover IR page URL → then scan for documents
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-ir-url`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ company_id: inserted.id, company_name: item.name }),
          }).then(() => {
            queryClient.invalidateQueries({ queryKey: ['companies-all'] })
            // Trigger scan-ir-page with user JWT (server-side auto-trigger is unreliable)
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-ir-page`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ company_id: inserted.id }),
            }).then(() => {
              queryClient.invalidateQueries({ queryKey: ['ir-catalog'] })
              queryClient.invalidateQueries({ queryKey: ['companies-all'] })
            }).catch(() => {})
          }).catch(() => {})
        }).catch(() => {})
      }
      toast.success(`${item.name} added`)
    } catch { toast.error(`Failed to add ${item.name}`) }
    finally { setAddingIdx(null) }
  }

  // Resolve DB id — only match against companies already selected by THIS user (data isolation)
  const resolveDbId = (item: typeof reportSuggestionItems[number]) => {
    const selected = (companies ?? []).filter((c) => selectedIds.includes(c.id))
    const match = selected.find((c) => c.name.toLowerCase() === item.name.toLowerCase())
    return match?.id
  }

  // Render a report suggestion card — toggleable (click to select/deselect), blue accent
  const renderSuggestionCard = (item: typeof reportSuggestionItems[number], idx: number) => {
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
        key={`report-${idx}`}
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
        {isAdding ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)] flex-shrink-0">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : isSelected ? (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent)] text-white flex-shrink-0">
            <Check className="h-4 w-4" />
          </div>
        ) : (() => {
          const matchedCompany = dbId ? (companies ?? []).find(c => c.id === dbId) : undefined
          return matchedCompany ? (
            <CompanyLogo logoUrl={matchedCompany.logo_url} websiteUrl={matchedCompany.website_url} name={matchedCompany.name} size="lg" className="rounded-lg" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-bg-tertiary)] text-[11px] font-bold text-muted-foreground flex-shrink-0">
              {item.name.slice(0, 2).toUpperCase()}
            </div>
          )
        })()}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-foreground truncate">{item.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {[item.ticker, item.context].filter(Boolean).join(' · ')}
          </p>
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
  const selectedCompanies = (companies ?? []).filter((c) => selectedIds.includes(c.id))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[22px] font-semibold text-foreground">Add Your Competitors</h2>
        <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed max-w-xl">
          Build your peer group for benchmarking. Add competitors from your report or search manually.
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
            {reportSuggestionItems.length} found
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          {reportSuggestionItems.length > 0
            ? 'These companies were explicitly mentioned as competitors or peers in your uploaded report. Click to add them to your peer group.'
            : 'No competitors were explicitly named in your report. Use manual search below to add them.'}
        </p>
        {reportSuggestionItems.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {reportSuggestionItems.map((item, idx) => renderSuggestionCard(item, idx))}
          </div>
        )}
      </div>

      {/* ── Section 2: Manual search ── */}
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
              // ALWAYS create a new company — never reuse existing records from other accounts
              const currentUserId = await getCurrentUserId()
              const { data: inserted, error } = await supabase
                .from('companies')
                .insert({
                  name: result.name,
                  ticker: result.ticker ?? null,
                  sector: result.sector ?? null,
                  country: result.country_code ?? null,
                  reporting_currency: result.currency ?? 'CHF',
                  created_by: currentUserId,
                })
                .select('id')
                .single()
              if (error) {
                toast.error('Failed to add company')
              } else {
                onSelectedIdsChange([...selectedIds, inserted.id])
                await queryClient.invalidateQueries({ queryKey: ['companies-all'] })
                // Resolve website + discover IR page in background
                const session = (await supabase.auth.getSession()).data.session
                if (session) {
                  const headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                  }
                  fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-company-website`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name: result.name, company_id: inserted.id }),
                  }).then(() => {
                    queryClient.invalidateQueries({ queryKey: ['companies-all'] })
                    // Auto-discover IR page URL → then scan for documents
                    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/suggest-ir-url`, {
                      method: 'POST',
                      headers,
                      body: JSON.stringify({ company_id: inserted.id, company_name: result.name }),
                    }).then(() => {
                      queryClient.invalidateQueries({ queryKey: ['companies-all'] })
                      // Trigger scan-ir-page with user JWT (server-side auto-trigger is unreliable)
                      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-ir-page`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ company_id: inserted.id }),
                      }).then(() => {
                        queryClient.invalidateQueries({ queryKey: ['ir-catalog'] })
                        queryClient.invalidateQueries({ queryKey: ['companies-all'] })
                      }).catch(() => {})
                    }).catch(() => {})
                  }).catch(() => {})
                }
                toast.success(`${result.name} added`)
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
                const source = reportNames.has(nameLower) ? 'report' : 'manual'
                return (
                  <button
                    key={company.id}
                    onClick={() => toggleCompany(company.id)}
                    className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--color-accent)]/30 bg-background px-2 py-1 text-[12px] font-medium text-foreground transition-all hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <CompanyLogo logoUrl={company.logo_url} websiteUrl={company.website_url} name={company.name} size="xs" />
                    <span className={cn(
                      'inline-block h-1.5 w-1.5 rounded-full',
                      source === 'report' ? 'bg-emerald-500' : 'bg-amber-500',
                    )} />
                    {company.name}
                    <span className="text-muted-foreground group-hover:text-red-500 transition-colors">✕</span>
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" /> from report</span>
              <span className="flex items-center gap-1"><span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" /> manually added</span>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 3: Analyze Reports (FY-matched competitor report selection)
// ---------------------------------------------------------------------------

const ANALYSIS_STEPS = [
  { key: 'downloading', label: 'Downloading report' },
  { key: 'extracting', label: 'Extracting KPIs' },
  { key: 'normalizing', label: 'Normalizing values' },
  { key: 'generating', label: 'Generating benchmark' },
] as const

const ANALYSIS_PROGRESS: Record<string, number> = {
  downloading: 10,
  extracting: 35,
  normalizing: 60,
  generating: 80,
  complete: 100,
  error: 0,
}

function StepReports({
  selectedCompanyIds,
  userFiscalYear,
}: {
  selectedCompanyIds: string[]
  userFiscalYear: number
}) {
  const queryClient = useQueryClient()
  // Poll company data every 10s so ir_page_url updates show up quickly
  const { data: companies } = useAllCompanies()
  const { data: catalogItems, isLoading } = useIrCatalogForCompanies(selectedCompanyIds)
  const downloadMutation = useDownloadCatalogItem()
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set())
  const [irUrlInputs, setIrUrlInputs] = useState<Record<string, string>>({})
  const [showIrUrlInput, setShowIrUrlInput] = useState<Set<string>>(new Set())

  // Pipeline progress tracking per company (after download triggers analysis)
  type AnalysisState = { reportId: string; step: 'downloading' | 'extracting' | 'normalizing' | 'generating' | 'complete' | 'error'; progress: number }
  const [analyzingCompanies, setAnalyzingCompanies] = useState<Record<string, AnalysisState>>({})

  // Poll report status for companies with active analysis pipelines
  useEffect(() => {
    const activeReports = Object.entries(analyzingCompanies).filter(([, s]) => s.step !== 'complete' && s.step !== 'error')
    if (activeReports.length === 0) return

    const interval = setInterval(async () => {
      for (const [companyId, state] of activeReports) {
        const { data: report } = await supabase
          .from('reports')
          .select('status')
          .eq('id', state.reportId)
          .single()
        if (!report) continue

        let newStep: AnalysisState['step'] = state.step
        if (report.status === 'error') newStep = 'error'
        else if (report.status === 'pending') newStep = 'downloading'
        else if (report.status === 'processing') newStep = 'extracting'
        else if (report.status === 'extracted') newStep = 'normalizing'
        else if (report.status === 'normalized' || report.status === 'benchmark_ready') newStep = 'generating'
        else if (report.status === 'reviewed') newStep = 'complete'

        if (newStep !== state.step) {
          setAnalyzingCompanies(prev => ({
            ...prev,
            [companyId]: { ...prev[companyId], step: newStep, progress: ANALYSIS_PROGRESS[newStep] },
          }))
          if (newStep === 'complete') {
            queryClient.invalidateQueries({ queryKey: ['ir-catalog'] })
            queryClient.invalidateQueries({ queryKey: ['reports'] })
          }
        }
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [analyzingCompanies, queryClient])

  // Poll companies data every 10s while on this step (so ir_page_url/website_url updates appear)
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['companies-all'] })
    }, 10_000)
    return () => clearInterval(interval)
  }, [queryClient])

  const selectedCompanies = (companies ?? []).filter(c => selectedCompanyIds.includes(c.id))

  // Group catalog items by company, filter to analyzable annual reports matching user's FY
  const companyCatalog = selectedCompanies.map(company => {
    const items = (catalogItems ?? []).filter(item => item.company_id === company.id)
    const matchingAnnual = items.find(
      item => item.document_type === 'annual_report' && item.fiscal_year === userFiscalYear
    )
    const hasAnyItems = items.length > 0
    return { company, matchingAnnual, hasAnyItems, totalItems: items.length }
  })

  // Track elapsed time for timeout detection (re-renders every 30s)
  const [tickCount, setTickCount] = useState(0)
  useEffect(() => {
    const interval = setInterval(() => setTickCount(t => t + 1), 30_000)
    return () => clearInterval(interval)
  }, [])

  const matchCount = companyCatalog.filter(c => c.matchingAnnual).length
  // Pipeline states per company — "scanning" includes companies with ir_page_url but no items yet
  // (scan-ir-page runs async after suggest-ir-url sets ir_page_url)
  // After 4 ticks (2 minutes at 30s each), consider still-scanning companies as timed out
  const pendingCount = companyCatalog.filter(c => !c.hasAnyItems && !c.matchingAnnual).length
  const timedOut = tickCount >= 4 && pendingCount > 0
  const scanningCount = companyCatalog.filter(c => {
    if (c.hasAnyItems || c.matchingAnnual) return false
    if (timedOut) return false
    return true
  }).length
  const completedCount = selectedCompanies.length - scanningCount
  const noReportCount = companyCatalog.filter(c =>
    !c.hasAnyItems && !c.matchingAnnual && timedOut
  ).length

  const handleDownload = async (catalogItemId: string, companyId: string) => {
    setDownloadingIds(prev => new Set(prev).add(catalogItemId))
    try {
      const result = await downloadMutation.mutateAsync({ catalogItemId, companyId })
      if (result.report_id) {
        setAnalyzingCompanies(prev => ({
          ...prev,
          [companyId]: { reportId: result.report_id, step: 'downloading', progress: ANALYSIS_PROGRESS['downloading'] },
        }))
      }
    } catch {
      // Error toast handled by mutation
    } finally {
      setDownloadingIds(prev => { const next = new Set(prev); next.delete(catalogItemId); return next })
    }
  }

  const handleDownloadAll = async () => {
    const toDownload = companyCatalog
      .filter(c => c.matchingAnnual && !c.matchingAnnual.is_downloaded)
      .map(c => ({ id: c.matchingAnnual!.id, companyId: c.company.id }))
    if (toDownload.length === 0) {
      toast.info('All matching reports are already downloaded')
      return
    }
    for (const item of toDownload) {
      await handleDownload(item.id, item.companyId)
    }
  }

  const handleSetIrUrl = async (companyId: string) => {
    const url = irUrlInputs[companyId]?.trim()
    if (!url) return
    try {
      new URL(url) // validate
    } catch {
      toast.error('Please enter a valid URL')
      return
    }
    const { error } = await supabase.from('companies').update({ ir_page_url: url }).eq('id', companyId)
    if (error) {
      toast.error('Failed to save IR page URL')
      return
    }
    toast.success('IR page URL saved — scanning for reports...')
    setShowIrUrlInput(prev => { const next = new Set(prev); next.delete(companyId); return next })
    queryClient.invalidateQueries({ queryKey: ['companies-all'] })
    // Trigger scan-ir-page
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scan-ir-page`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ company_id: companyId }),
      }).catch(() => {})
    }
  }

  // Determine per-company pipeline status
  const getCompanyStatus = (c: typeof companyCatalog[0]): 'resolving' | 'discovering_ir' | 'scanning_reports' | 'found' | 'downloaded' | 'no_report' | 'no_ir_page' => {
    if (c.matchingAnnual?.is_downloaded) return 'downloaded'
    if (c.matchingAnnual) return 'found'
    // If scan metadata exists, scan has completed — use its results immediately (no timeout needed)
    const meta = c.company.ir_scan_metadata
    if (meta) {
      return meta.items_found > 0 ? 'no_report' : 'no_report'
    }
    if (c.hasAnyItems) return 'no_report'
    if (c.company.ir_page_url) {
      return timedOut ? 'no_report' : 'scanning_reports'
    }
    if (c.company.website_url) {
      return timedOut ? 'no_ir_page' : 'discovering_ir'
    }
    return timedOut ? 'no_ir_page' : 'resolving'
  }

  // Build comprehensive explanation from scan metadata
  const getScanExplanation = (c: typeof companyCatalog[0]): string | null => {
    const meta = c.company.ir_scan_metadata
    if (!meta) return null
    const status = getCompanyStatus(c)
    if (status === 'found' || status === 'downloaded') return null

    if (meta.items_found === 0) {
      return 'No downloadable documents found on the IR page.'
    }

    const annualYears = meta.annual_report_years
    if (annualYears.length > 0) {
      const hasTarget = annualYears.includes(userFiscalYear)
      if (!hasTarget) {
        return `${meta.items_found} documents found. Annual reports available for FY${annualYears.join(', FY')} — FY${userFiscalYear} not yet published or uses a different format.`
      }
    }

    return `${meta.items_found} documents found but no FY${userFiscalYear} annual report among them. Available fiscal years: ${meta.fiscal_years_found.length > 0 ? 'FY' + meta.fiscal_years_found.join(', FY') : 'none detected'}.`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Pipeline step index per status (for the stepper visualization)
  const PIPELINE_STEPS = ['Website', 'IR Page', 'Reports'] as const
  const getStepStates = (status: ReturnType<typeof getCompanyStatus>) => {
    // Returns [website, irPage, reports] — each: 'done' | 'active' | 'failed' | 'pending'
    type StepState = 'done' | 'active' | 'failed' | 'pending'
    switch (status) {
      case 'resolving': return ['active', 'pending', 'pending'] as StepState[]
      case 'discovering_ir': return ['done', 'active', 'pending'] as StepState[]
      case 'scanning_reports': return ['done', 'done', 'active'] as StepState[]
      case 'found': return ['done', 'done', 'done'] as StepState[]
      case 'downloaded': return ['done', 'done', 'done'] as StepState[]
      case 'no_report': return ['done', 'done', 'failed'] as StepState[]
      case 'no_ir_page': return ['done', 'failed', 'pending'] as StepState[]
      default: return ['pending', 'pending', 'pending'] as StepState[]
    }
  }

  // Compute overall progress percentage
  const progressPercent = selectedCompanies.length > 0
    ? Math.round((completedCount / selectedCompanies.length) * 100)
    : 0

  return (
    <div className="space-y-6">
      {/* Educational header */}
      <div>
        <h2 className="text-[22px] font-semibold text-foreground">Analyze Competitor Reports</h2>
        <p className="mt-2 text-[13px] text-muted-foreground leading-relaxed max-w-2xl">
          Valrano automatically discovers each competitor's Investor Relations page and scans it for
          FY{userFiscalYear} annual reports. This runs in the background — you can continue or skip this step.
        </p>
      </div>

      {/* Overall progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[12px]">
          <span className="text-muted-foreground">
            {scanningCount > 0 && !timedOut ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Analyzing {selectedCompanies.length} competitor{selectedCompanies.length !== 1 ? 's' : ''}...
              </span>
            ) : (
              <span>
                {matchCount > 0
                  ? `${matchCount} report${matchCount !== 1 ? 's' : ''} found`
                  : 'Analysis complete'}
                {noReportCount > 0 && ` · ${noReportCount} not found`}
              </span>
            )}
          </span>
          <span className="text-muted-foreground/70 tabular-nums">{completedCount}/{selectedCompanies.length} complete</span>
        </div>
        <div className="h-1.5 rounded-full bg-border/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-700 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Download All button (when reports are available) */}
      {matchCount > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleDownloadAll}
            disabled={downloadMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)]/10 px-4 py-2.5 text-[12px] font-medium text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20 transition-colors disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" />
            Download All ({matchCount})
          </button>
        </div>
      )}

      {/* Per-company cards with pipeline stepper */}
      <div className="space-y-3">
        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{selectedCompanies.length} competitor{selectedCompanies.length !== 1 ? 's' : ''}</p>
        {companyCatalog.map((entry) => {
          const { company, matchingAnnual } = entry
          const status = getCompanyStatus(entry)
          const stepStates = getStepStates(status)

          return (
          <div
            key={company.id}
            className={cn(
              'rounded-lg border p-4 transition-colors',
              matchingAnnual
                ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/3'
                : 'border-border bg-card',
            )}
          >
            {/* Company name row */}
            <div className="flex items-center gap-3">
              <CompanyLogo
                logoUrl={company.logo_url}
                websiteUrl={company.website_url}
                name={company.name}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-foreground truncate">{company.name}</p>
              </div>

              {/* Action buttons (right side) */}
              {status === 'downloaded' && (!analyzingCompanies[company.id] || analyzingCompanies[company.id].step === 'complete') && (
                <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
                  <Check className="h-3 w-3" />
                  Analyzed
                </span>
              )}
              {status === 'downloaded' && analyzingCompanies[company.id] && analyzingCompanies[company.id].step !== 'complete' && (
                <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-[var(--color-accent)] bg-[var(--color-accent)]/10">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Analyzing...
                </span>
              )}
              {status === 'found' && matchingAnnual && (
                <button
                  onClick={() => handleDownload(matchingAnnual.id, company.id)}
                  disabled={downloadingIds.has(matchingAnnual.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-[11px] font-medium text-white hover:opacity-90 transition-colors disabled:opacity-40"
                >
                  {downloadingIds.has(matchingAnnual.id) ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3" />
                  )}
                  Download & Analyze
                </button>
              )}
              {(status === 'no_report' || status === 'no_ir_page') && (
                <button
                  onClick={() => setShowIrUrlInput(prev => {
                    const next = new Set(prev)
                    if (next.has(company.id)) next.delete(company.id)
                    else next.add(company.id)
                    return next
                  })}
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--color-accent)] hover:underline"
                >
                  <Link2 className="h-3 w-3" />
                  Enter IR page URL
                </button>
              )}
            </div>

            {/* Pipeline stepper */}
            <div className="mt-3 ml-10 flex items-center gap-0">
              {PIPELINE_STEPS.map((label, i) => {
                const state = stepStates[i]
                return (
                  <div key={label} className="flex items-center">
                    {/* Step indicator */}
                    <div className="flex items-center gap-1.5">
                      <div className={cn(
                        'flex items-center justify-center rounded-full transition-colors',
                        state === 'done' && 'h-4 w-4 bg-emerald-500/20',
                        state === 'active' && 'h-4 w-4 bg-[var(--color-accent)]/20',
                        state === 'failed' && 'h-4 w-4 bg-red-500/20',
                        state === 'pending' && 'h-4 w-4 bg-border/50',
                      )}>
                        {state === 'done' && <Check className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />}
                        {state === 'active' && <Loader2 className="h-2.5 w-2.5 animate-spin text-[var(--color-accent)]" />}
                        {state === 'failed' && <X className="h-2.5 w-2.5 text-red-500" />}
                        {state === 'pending' && <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />}
                      </div>
                      <span className={cn(
                        'text-[10px]',
                        state === 'done' && 'text-emerald-600 dark:text-emerald-400',
                        state === 'active' && 'text-[var(--color-accent)]',
                        state === 'failed' && 'text-red-500',
                        state === 'pending' && 'text-muted-foreground/40',
                      )}>
                        {label}
                      </span>
                    </div>
                    {/* Connector line between steps */}
                    {i < PIPELINE_STEPS.length - 1 && (
                      <div className={cn(
                        'mx-2 h-px w-6',
                        stepStates[i + 1] !== 'pending' ? 'bg-emerald-500/40' : 'bg-border/50',
                      )} />
                    )}
                  </div>
                )
              })}

              {/* Status description after stepper */}
              <span className="ml-auto text-[10px] text-muted-foreground/60">
                {status === 'resolving' && 'Looking up company website...'}
                {status === 'discovering_ir' && 'Crawling website for IR page...'}
                {status === 'scanning_reports' && 'Checking IR page for annual reports...'}
                {status === 'found' && `FY${userFiscalYear} annual report available`}
                {status === 'downloaded' && (
                  analyzingCompanies[company.id] && analyzingCompanies[company.id].step !== 'complete'
                    ? 'Analysis in progress...'
                    : 'Report analyzed'
                )}
                {status === 'no_report' && (
                  entry.company.ir_scan_metadata
                    ? `${entry.company.ir_scan_metadata.items_found} docs found · No FY${userFiscalYear} annual report`
                    : `No FY${userFiscalYear} report found`
                )}
                {status === 'no_ir_page' && 'IR page not detected'}
              </span>
            </div>

            {/* Comprehensive scan explanation for failed states */}
            {(status === 'no_report' || status === 'no_ir_page') && getScanExplanation(entry) && (
              <div className="mt-2 ml-10 rounded-md bg-amber-500/5 border border-amber-500/20 px-3 py-2">
                <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed">
                  {getScanExplanation(entry)}
                </p>
                {entry.company.ir_scan_metadata && entry.company.ir_scan_metadata.annual_report_years.length > 0 && (
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Available annual reports: {entry.company.ir_scan_metadata.annual_report_years.map(y => `FY${y}`).join(', ')}
                  </p>
                )}
              </div>
            )}

            {/* Analysis pipeline progress */}
            {analyzingCompanies[company.id] && analyzingCompanies[company.id].step === 'error' && (
              <div className="mt-3 ml-10 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-[11px] text-destructive">Download failed — the report could not be retrieved from this company's website. The file may be unavailable or blocked.</p>
              </div>
            )}
            {analyzingCompanies[company.id] && analyzingCompanies[company.id].step !== 'complete' && analyzingCompanies[company.id].step !== 'error' && (
              <div className="mt-3 ml-10 rounded-lg border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/3 p-3 space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Processing report...</span>
                    <span className="tabular-nums">{analyzingCompanies[company.id].progress}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-700 ease-out"
                      style={{ width: `${analyzingCompanies[company.id].progress}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  {ANALYSIS_STEPS.map((step, stepIdx) => {
                    const currentStepIdx = ANALYSIS_STEPS.findIndex(s => s.key === analyzingCompanies[company.id].step)
                    const isDone = stepIdx < currentStepIdx
                    const isActive = stepIdx === currentStepIdx
                    return (
                      <div key={step.key} className="flex items-center gap-2.5">
                        <div className={cn(
                          'flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0 transition-all duration-300',
                          isDone ? 'bg-[var(--color-accent)] text-white' :
                          isActive ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' :
                          'bg-[var(--color-bg-tertiary)] text-muted-foreground/40',
                        )}>
                          {isDone ? (
                            <Check className="h-3 w-3" />
                          ) : isActive ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <span className="text-[9px] font-medium">{stepIdx + 1}</span>
                          )}
                        </div>
                        <span className={cn(
                          'text-[11px] transition-colors',
                          isDone ? 'text-muted-foreground' :
                          isActive ? 'text-foreground font-medium' :
                          'text-muted-foreground/40',
                        )}>
                          {step.label}
                        </span>
                        <span className={cn(
                          'ml-auto text-[9px] flex-shrink-0',
                          isDone ? 'text-[var(--color-accent)]' :
                          isActive ? 'text-muted-foreground' :
                          'text-muted-foreground/30',
                        )}>
                          {isDone ? 'Done' : isActive ? '...' : ''}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* IR URL input field */}
            {showIrUrlInput.has(company.id) && (
              <div className="mt-3 ml-10 space-y-2">
                <p className="text-[11px] text-muted-foreground/70">
                  Paste the URL of this company's Investor Relations page (where they publish annual reports and financial results).
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    placeholder="https://www.company.com/investors"
                    value={irUrlInputs[company.id] ?? ''}
                    onChange={e => setIrUrlInputs(prev => ({ ...prev, [company.id]: e.target.value }))}
                    className="flex-1 rounded-lg border border-border bg-[var(--color-bg-tertiary)] px-3 py-1.5 text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                    onKeyDown={e => { if (e.key === 'Enter') handleSetIrUrl(company.id) }}
                  />
                  <button
                    onClick={() => handleSetIrUrl(company.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-[11px] font-medium text-white hover:opacity-90 transition-colors"
                  >
                    <Search className="h-3 w-3" />
                    Scan
                  </button>
                </div>
              </div>
            )}

          </div>
          )
        })}
      </div>

      {/* Contextual guidance */}
      <div className="rounded-lg border border-border/50 bg-[var(--color-bg-secondary)] p-4 space-y-2">
        <p className="text-[12px] font-medium text-foreground">What happens next?</p>
        <ul className="space-y-1.5 text-[11px] text-muted-foreground leading-relaxed">
          <li className="flex items-start gap-2">
            <Download className="h-3 w-3 mt-0.5 flex-shrink-0 text-[var(--color-accent)]" />
            <span>Downloaded reports are automatically analyzed: KPI extraction, normalization, and benchmark generation.</span>
          </li>
          <li className="flex items-start gap-2">
            <Upload className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground/60" />
            <span>You can also <span className="text-foreground">upload reports manually</span> for any competitor from the Competitors page.</span>
          </li>
          <li className="flex items-start gap-2">
            <Calendar className="h-3 w-3 mt-0.5 flex-shrink-0 text-muted-foreground/60" />
            <span>No reports yet? <span className="text-foreground">Skip this step</span> — you can add IR pages or upload reports at any time.</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 4: Publication Schedule
// ---------------------------------------------------------------------------

function StepSchedule({
  selectedCompanyIds,
  schedules,
  onSchedulesChange,
  onConfirmSchedule,
  onSkip,
}: {
  selectedCompanyIds: string[]
  schedules: Record<string, { reportType: string; expectedDate: string }>
  onSchedulesChange: (s: Record<string, { reportType: string; expectedDate: string }>) => void
  onConfirmSchedule: (companyId: string) => void
  onSkip: () => void
}) {
  const { data: companies } = useAllCompanies()
  const { data: existingEvents } = usePublicationEvents()
  const suggestDates = useSuggestDates()
  const [suggestingCompanyId, setSuggestingCompanyId] = useState<string | null>(null)

  const selectedCompanies = (companies ?? []).filter((c) => selectedCompanyIds.includes(c.id))

  const updateScheduleRef = useRef(schedules)
  useEffect(() => { updateScheduleRef.current = schedules }, [schedules])

  const updateSchedule = (companyId: string, field: 'reportType' | 'expectedDate', value: string) => {
    const current = updateScheduleRef.current
    const existing = current[companyId] ?? { reportType: 'annual', expectedDate: '' }
    const updated = {
      ...current,
      [companyId]: { ...existing, [field]: value },
    }
    updateScheduleRef.current = updated
    onSchedulesChange(updated)
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
          setSuggestedIds((prev) => new Set(prev).add(company.id))
          onConfirmSchedule(company.id)
          toast.success(
            `Detected: ${data.suggestion.suggested_date} (${data.suggestion.confidence}% confidence, based on historical patterns)`,
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

  const [suggestedIds, setSuggestedIds] = useState<Set<string>>(new Set())
  const [suggestingAll, setSuggestingAll] = useState(false)

  const handleSuggestAll = async () => {
    const toSuggest = selectedCompanies.filter((c) => !schedules[c.id]?.expectedDate)
    if (toSuggest.length === 0) {
      toast.info('All competitors already have publication dates set')
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
        setSuggestedIds((prev) => new Set(prev).add(company.id))
        completed++
      } catch (err) {
        if (import.meta.env.DEV) console.error(`Failed to suggest for ${company.name}:`, err)
      }
    }
    setSuggestingCompanyId(null)
    setSuggestingAll(false)
    if (completed > 0) {
      toast.success(`Detected publication dates for ${completed} competitor${completed !== 1 ? 's' : ''}`)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[22px] font-semibold text-foreground">Publication Schedule</h2>
          <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed max-w-xl">
            Set expected publication dates so Valrano can notify you when competitors release new reports
            and auto-download them for benchmarking. This step is optional — you can always add dates later from the Calendar page.
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
            title="Uses AI to detect when each competitor historically publishes reports"
          >
            {suggestingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Auto-detect dates
          </button>
        )}
        </div>
      </div>

      <div className="space-y-3">
        {selectedCompanies.map((company) => {
          const schedule = schedules[company.id] ?? { reportType: 'annual', expectedDate: '' }
          const justSuggested = suggestedIds.has(company.id)
          const isDuplicate = schedule.expectedDate && existingEvents?.some(
            e => e.company_id === company.id && e.report_type === schedule.reportType && e.expected_date === schedule.expectedDate
          )
          return (
            <div
              key={company.id}
              className={cn(
                'rounded-lg border bg-card p-4 space-y-3 transition-colors duration-700',
                justSuggested ? 'border-emerald-500/50' : 'border-border',
              )}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <CompanyLogo logoUrl={company.logo_url} websiteUrl={company.website_url} name={company.name} size="sm" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-foreground truncate">{company.name}</p>
                    {company.ticker && <p className="text-[11px] text-muted-foreground">{company.ticker}</p>}
                  </div>
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
                  onChange={(e) => { updateSchedule(company.id, 'expectedDate', e.target.value); onConfirmSchedule(company.id) }}
                  className={cn(
                    'rounded-lg border bg-[var(--color-bg-tertiary)] px-3 py-2 text-[12px] text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] w-40',
                    isDuplicate ? 'border-[var(--color-signal-amber)]' : 'border-border',
                  )}
                />

                {justSuggested && suggestingCompanyId !== company.id ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex-shrink-0 animate-in fade-in duration-300">
                    <Check className="h-3 w-3" />
                    Done
                  </span>
                ) : (
                  <button
                    onClick={() => handleSuggestDate(company)}
                    disabled={suggestingCompanyId !== null}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-[var(--color-bg-tertiary)] transition-colors disabled:opacity-40 flex-shrink-0"
                    title="Detect historical publication date"
                  >
                    {suggestingCompanyId === company.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    Detect
                  </button>
                )}
              </div>

              {/* Duplicate warning only — IR page status removed (belongs in Step 3) */}
              {isDuplicate && (
                <div className="pl-8">
                  <span className="text-[11px] text-[var(--color-signal-amber)]">
                    Event already exists for this date & type
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {selectedCompanies.length === 0 && (
        <p className="text-[12px] text-muted-foreground text-center py-8">
          No competitors selected yet. Go back to Step 2 to add competitors, or skip this step.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Step 4: Activate Pipeline
// ---------------------------------------------------------------------------

