import { Helmet } from 'react-helmet-async'
import { Link } from 'react-router-dom'
import { Building2, Settings, Shield } from 'lucide-react'

export function SettingsPage() {
  return (
    <>
      <Helmet><title>Settings - BenchmarkSignal</title></Helmet>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">Settings</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Configure your BenchmarkSignal account</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link to="/my-company" className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-[var(--color-primary)]">
            <Building2 className="h-6 w-6 text-[var(--color-primary)]" />
            <h3 className="mt-3 font-semibold text-foreground">My Company</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">Your company profile and KPI data</p>
          </Link>
          <Link to="/settings/benchmark-rules" className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-[var(--color-primary)]">
            <Settings className="h-6 w-6 text-[var(--color-signal-amber)]" />
            <h3 className="mt-3 font-semibold text-foreground">Benchmark Rules</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">Configure benchmark document generation</p>
          </Link>
          <Link to="/settings/approval-chains" className="rounded-xl border border-border bg-card p-6 transition-colors hover:border-[var(--color-primary)]">
            <Shield className="h-6 w-6 text-[var(--color-financial-blue)]" />
            <h3 className="mt-3 font-semibold text-foreground">Approval Chains</h3>
            <p className="mt-1 text-[13px] text-muted-foreground">Manage document approval workflows</p>
          </Link>
        </div>
      </div>
    </>
  )
}
