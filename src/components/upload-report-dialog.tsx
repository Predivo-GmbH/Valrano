import { useState, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useUploadReport, useExtractKpis, useNormalizeKpis } from '@/hooks/useExtraction'
import { useSmoothProgress } from '@/hooks/useSmoothProgress'
import { useReports } from '@/hooks/useData'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Upload, FileText, Loader2, Check, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { validateUploadFiles } from '@/lib/validation'

interface UploadReportDialogProps {
  open: boolean
  onClose: () => void
  /** Fixed company — all files use this company. Omit to show per-file company selector. */
  companyId?: string
  /** List of companies for per-file assignment. Required when companyId is not set. */
  companies?: { id: string; name: string; ticker?: string | null }[]
  /** Default company ID (used as initial value when companies list is provided). */
  defaultCompanyId?: string
}

interface QueuedFile {
  id: string
  file: File
  companyId: string
  status: 'queued' | 'uploading' | 'extracting' | 'done' | 'error'
  result?: { total: number; confidence: number | null; needsReview: number }
  error?: string
}

export function UploadReportDialog({
  open,
  onClose,
  companyId: fixedCompanyId,
  companies,
  defaultCompanyId,
}: UploadReportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedCompanyId, setSelectedCompanyId] = useState(defaultCompanyId ?? fixedCompanyId ?? '')

  const [queuedFiles, setQueuedFiles] = useState<QueuedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [allDone, setAllDone] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const displayProgress = useSmoothProgress(uploadProgress)
  const [currentProcessingIdx, setCurrentProcessingIdx] = useState(-1)

  const [cancelRequested, setCancelRequested] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const cancelRef = useRef(false)

  const queryClient = useQueryClient()
  const uploadMutation = useUploadReport()
  const extractMutation = useExtractKpis()
  const normalizeMutation = useNormalizeKpis()

  const effectiveCompanyId = fixedCompanyId ?? selectedCompanyId
  const showCompanySelector = !fixedCompanyId && companies && companies.length > 0

  // Fetch existing reports for duplicate detection
  const { data: existingReports } = useReports(effectiveCompanyId || undefined)

  const closeAndReset = useCallback(() => {
    const hadSuccessfulUploads = queuedFiles.some(f => f.status === 'done')
    onClose()
    setQueuedFiles([])
    setAllDone(false)
    setIsProcessing(false)
    setCurrentProcessingIdx(-1)
    if (hadSuccessfulUploads) {
      queryClient.invalidateQueries()
    }
  }, [onClose, queuedFiles, queryClient])

  const handleOpenChange = useCallback(
    (o: boolean) => {
      if (!o && isProcessing) return
      if (!o) {
        // Files queued but not yet uploaded — warn before discarding
        const hasUnprocessedFiles = queuedFiles.some(f => f.status === 'queued')
        if (hasUnprocessedFiles) {
          const confirmed = window.confirm(
            `You have ${queuedFiles.filter(f => f.status === 'queued').length} file(s) that haven't been uploaded yet.\n\n` +
            'If you close this dialog, they will be discarded.\n\n' +
            'Click "Upload & Extract" to process them first, or press OK to discard.'
          )
          if (!confirmed) return
        }
        closeAndReset()
      }
    },
    [isProcessing, queuedFiles, closeAndReset],
  )

  const addFiles = useCallback((files: File[]) => {
    // Validate files with Zod schema (type + size)
    const { valid: pdfs, errors } = validateUploadFiles(files)
    if (errors.size > 0) {
      for (const [name, msg] of errors) toast.error(`${name}: ${msg}`)
    }
    if (pdfs.length === 0) { if (errors.size === 0) toast.error('Only PDF files are supported'); return }
    if (pdfs.length < files.length - errors.size) toast.info(`${files.length - pdfs.length - errors.size} non-PDF file(s) skipped`)

    // Check for duplicates against existing reports
    const duplicates: string[] = []
    if (existingReports?.length) {
      const existingTitles = new Set(existingReports.map(r => r.title?.toLowerCase()))
      for (const pdf of pdfs) {
        const nameWithoutExt = pdf.name.replace(/\.pdf$/i, '').toLowerCase()
        if (existingTitles.has(nameWithoutExt)) {
          duplicates.push(pdf.name)
        }
      }
    }

    if (duplicates.length > 0) {
      const confirmed = window.confirm(
        `The following file(s) appear to have been uploaded before:\n\n` +
        duplicates.map(n => `• ${n}`).join('\n') +
        `\n\nDo you want to upload them again?`
      )
      if (!confirmed) return
    }

    const newEntries: QueuedFile[] = pdfs.map(f => ({
      id: crypto.randomUUID(),
      file: f,
      companyId: effectiveCompanyId,
      status: 'queued' as const,
    }))
    setQueuedFiles(prev => [...prev, ...newEntries])
  }, [effectiveCompanyId, existingReports])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }, [addFiles])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files
    if (selected && selected.length > 0) addFiles(Array.from(selected))
    e.target.value = ''
  }

  const removeFile = (id: string) => {
    setQueuedFiles(prev => prev.filter(f => f.id !== id))
  }

  const updateQueuedFileCompany = (id: string, companyIdVal: string) => {
    setQueuedFiles(prev => prev.map(f => f.id === id ? { ...f, companyId: companyIdVal } : f))
  }

  const handleCancelUpload = () => {
    cancelRef.current = true
    setCancelRequested(true)
    setShowCancelConfirm(false)
  }

  const handleUpload = async () => {
    const toProcess = queuedFiles.filter(f => f.status === 'queued')
    if (toProcess.length === 0) { toast.error('No files to process'); return }
    if (toProcess.some(f => !f.companyId)) { toast.error('Assign a company to every file'); return }

    setIsProcessing(true)
    setAllDone(false)
    cancelRef.current = false
    setCancelRequested(false)

    for (let i = 0; i < queuedFiles.length; i++) {
      if (cancelRef.current) break
      const item = queuedFiles[i]
      if (item.status !== 'queued') continue

      setCurrentProcessingIdx(i)
      setUploadProgress(10)

      setQueuedFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'uploading' } : f))

      try {
        const result = await uploadMutation.mutateAsync({
          file: item.file,
          companyId: item.companyId,
        })

        setUploadProgress(45)
        setQueuedFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'extracting' } : f))

        try {
          const extraction = await extractMutation.mutateAsync(result.report_id)
          setUploadProgress(80)

          // Normalize KPIs (currency conversion to CHF) — belt-and-suspenders
          // DB trigger handles normalization at INSERT, but edge function catches edge cases
          try {
            await normalizeMutation.mutateAsync(result.report_id)
          } catch (normErr) {
            console.warn('Edge function normalization failed (DB trigger should have handled it):', normErr)
            toast.warning('KPI normalization may be incomplete — check Dashboard')
          }

          setUploadProgress(100)
          setQueuedFiles(prev => prev.map((f, idx) => idx === i ? {
            ...f,
            status: 'done',
            result: {
              total: extraction.total_kpis_extracted ?? 0,
              confidence: extraction.avg_confidence ?? null,
              needsReview: extraction.needs_review_count ?? 0,
            },
          } : f))
        } catch {
          setQueuedFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: 'Extraction failed' } : f))
        }
      } catch (err) {
        setQueuedFiles(prev => prev.map((f, idx) => idx === i ? {
          ...f,
          status: 'error',
          error: err instanceof Error ? err.message : 'Upload failed',
        } : f))
      }
    }

    setIsProcessing(false)
    setUploadProgress(0)
    setCurrentProcessingIdx(-1)

    if (cancelRef.current) {
      setCancelRequested(false)
      toast.info('Upload cancelled')
      // Keep successfully processed files visible, reset remaining to queued
      setQueuedFiles(prev => prev.map(f =>
        f.status === 'queued' ? f : f // already-processed files keep their status
      ))
      closeAndReset()
    } else {
      setAllDone(true)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Report</DialogTitle>
        </DialogHeader>

        {/* ---------- IDLE: configure + add files ---------- */}
        {!isProcessing && !allDone && (
          <div className="space-y-4">
            {/* Company selector (only when multi-company) */}
            {showCompanySelector && (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  Default Company
                </Label>
                <Select value={companies.some(c => c.id === selectedCompanyId) ? selectedCompanyId : undefined} onValueChange={(v) => v && setSelectedCompanyId(v)}>
                  <SelectTrigger className="w-full rounded-lg border-border bg-[var(--color-bg-tertiary)] text-[13px] text-foreground">
                    <SelectValue placeholder="Select company">{(() => { const c = companies.find(c => c.id === selectedCompanyId); return c ? `${c.name}${c.ticker ? ` (${c.ticker})` : ''}` : 'Select company' })()}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-lg border-border bg-card text-[13px]">
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="text-[13px]">
                        {c.name}{c.ticker ? ` (${c.ticker})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Drop Zone */}
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                PDF Files
              </Label>
              <div
                role="button"
                tabIndex={0}
                aria-label="Upload PDF files"
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click() } }}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={cn(
                  'group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-all duration-200',
                  isDragging
                    ? 'border-accent bg-accent/5'
                    : queuedFiles.length > 0
                    ? 'border-[var(--color-signal-green)]/50 bg-[var(--color-signal-green)]/5'
                    : 'border-border hover:border-accent/50 hover:bg-[var(--color-bg-tertiary)]',
                )}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Upload className="h-5 w-5 text-muted-foreground" />
                <p className="text-[13px] font-medium text-foreground">
                  {queuedFiles.length > 0 ? 'Drop more PDFs or click to add' : 'Drop PDFs here or click to browse'}
                </p>
                <p className="text-[11px] text-muted-foreground">Multiple files supported</p>
              </div>
            </div>

            {/* File Queue */}
            {queuedFiles.length > 0 && (
              <div className="space-y-2">
                <Label className="text-[11px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                  {queuedFiles.length} file{queuedFiles.length > 1 ? 's' : ''} queued
                </Label>
                <div className="max-h-48 space-y-1.5 overflow-y-auto">
                  {queuedFiles.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border bg-[var(--color-bg-tertiary)] px-3 py-2">
                      <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-foreground">{item.file.name}</p>
                        <p className="text-[10px] text-muted-foreground">{(item.file.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                      {showCompanySelector && (
                        <Select value={item.companyId ?? ''} onValueChange={(v) => { if (v) updateQueuedFileCompany(item.id, v) }}>
                          <SelectTrigger className="h-7 w-36 rounded border-border bg-card text-[11px]">
                            <SelectValue placeholder="Company">{(() => { const c = companies.find(c => c.id === item.companyId); return c ? c.name : 'Company' })()}</SelectValue>
                          </SelectTrigger>
                          <SelectContent className="rounded-lg border-border bg-card text-[11px]">
                            {companies.map((c) => (
                              <SelectItem key={c.id} value={c.id} className="text-[11px]">{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <button
                        onClick={() => removeFile(item.id)}
                        className="flex-shrink-0 flex min-h-[44px] min-w-[44px] items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Remove ${item.file.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload Button */}
            <Button
              onClick={handleUpload}
              disabled={queuedFiles.length === 0 || queuedFiles.some(f => !f.companyId)}
              className="w-full"
            >
              <Upload className="h-4 w-4" />
              Upload & Extract {queuedFiles.length > 0 ? `(${queuedFiles.length})` : ''}
            </Button>
          </div>
        )}

        {/* ---------- PROCESSING ---------- */}
        {isProcessing && (
          <div className="space-y-4 py-2">
            <p className="text-[12px] text-muted-foreground text-center">
              Processing file {currentProcessingIdx + 1} of {queuedFiles.length}
            </p>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="truncate">{queuedFiles[currentProcessingIdx]?.file.name}</span>
                <span>{displayProgress}%</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--color-bg-tertiary)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-500 ease-out"
                  style={{ width: `${displayProgress}%` }}
                />
              </div>
            </div>

            <div className="max-h-48 space-y-1.5 overflow-y-auto">
              {queuedFiles.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border bg-[var(--color-bg-tertiary)] px-3 py-2">
                  <div className={cn(
                    'flex h-5 w-5 items-center justify-center rounded-full flex-shrink-0',
                    item.status === 'done' ? 'bg-[var(--color-signal-green)]/20 text-[var(--color-signal-green)]' :
                    item.status === 'error' ? 'bg-destructive/20 text-destructive' :
                    (item.status === 'uploading' || item.status === 'extracting') ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)]' :
                    'bg-muted text-muted-foreground/40',
                  )}>
                    {item.status === 'done' ? <Check className="h-3 w-3" /> :
                     item.status === 'error' ? <span className="text-[10px] font-bold">!</span> :
                     (item.status === 'uploading' || item.status === 'extracting') ? <Loader2 className="h-3 w-3 animate-spin" /> :
                     <span className="text-[10px]">{idx + 1}</span>}
                  </div>
                  <p className="truncate text-[12px] text-foreground flex-1">{item.file.name}</p>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {item.status === 'uploading' ? 'Uploading...' :
                     item.status === 'extracting' ? 'Extracting...' :
                     item.status === 'done' ? `${item.result?.total ?? 0} KPIs` :
                     item.status === 'error' ? 'Failed' : 'Queued'}
                  </span>
                </div>
              ))}
            </div>

            {/* Cancel button with inline confirmation */}
            {!showCancelConfirm ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelConfirm(true)}
                disabled={cancelRequested}
                className="w-full mt-2"
              >
                {cancelRequested ? 'Cancelling...' : 'Cancel Upload'}
              </Button>
            ) : (
              <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2">
                <p className="text-[12px] text-foreground">Cancel upload? Files in progress will be lost.</p>
                <div className="flex gap-2">
                  <Button variant="destructive" size="sm" onClick={handleCancelUpload} className="flex-1">
                    Yes, Cancel
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowCancelConfirm(false)} className="flex-1">
                    Continue
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ---------- ALL DONE ---------- */}
        {allDone && !isProcessing && (
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-signal-green)]/10">
                <Check className="h-6 w-6 text-[var(--color-signal-green)]" />
              </div>
              <div className="text-center">
                <p className="text-[14px] font-semibold text-foreground">
                  {queuedFiles.filter(f => f.status === 'done').length} of {queuedFiles.length} reports processed
                </p>
                {queuedFiles.some(f => f.status === 'error') && (
                  <p className="mt-1 text-[12px] text-destructive">
                    {queuedFiles.filter(f => f.status === 'error').length} failed
                  </p>
                )}
              </div>
            </div>

            <div className="max-h-40 space-y-1.5 overflow-y-auto">
              {queuedFiles.map((item) => (
                <div key={item.id} className="flex items-center gap-2 rounded-lg border border-border bg-[var(--color-bg-tertiary)] px-3 py-2">
                  {item.status === 'done' ? (
                    <Check className="h-4 w-4 flex-shrink-0 text-[var(--color-signal-green)]" />
                  ) : (
                    <span className="h-4 w-4 flex-shrink-0 text-center text-[11px] font-bold text-destructive">!</span>
                  )}
                  <p className="truncate text-[12px] text-foreground flex-1">{item.file.name}</p>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {item.status === 'done'
                      ? `${item.result?.total ?? 0} KPIs${item.result?.confidence != null ? ` · ${Math.round(item.result.confidence * 100)}%` : ''}`
                      : item.error ?? 'Failed'}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { setAllDone(false); setQueuedFiles([]) }}
                className="flex-1"
              >
                Upload More
              </Button>
              <Button
                onClick={closeAndReset}
                className="flex-1"
              >
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
