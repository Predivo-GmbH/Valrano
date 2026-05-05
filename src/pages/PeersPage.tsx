import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Upload, CalendarDays, ClipboardCheck } from 'lucide-react'

export function PeersPage() {
  return (
    <>
      <Helmet><title>Peers - BenchmarkSignal</title></Helmet>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">Peers</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Manage your competitive peer group</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link to="/upload" className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-[var(--color-primary)]">
            <Upload className="h-6 w-6 text-[var(--color-primary)]" />
            <h3 className="mt-3 font-semibold text-foreground">Upload Report</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">Upload a competitor's annual report for KPI extraction</p>
          </Link>
          <Link to="/review" className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-[var(--color-primary)]">
            <ClipboardCheck className="h-6 w-6 text-[var(--color-signal-amber)]" />
            <h3 className="mt-3 font-semibold text-foreground">Review KPIs</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">Review and approve flagged KPI extractions</p>
          </Link>
          <Link to="/calendar" className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-[var(--color-primary)]">
            <CalendarDays className="h-6 w-6 text-[var(--color-financial-blue)]" />
            <h3 className="mt-3 font-semibold text-foreground">Publication Calendar</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">Track when competitors publish annual reports</p>
          </Link>
        </div>
      </div>
    </>
  )
}
