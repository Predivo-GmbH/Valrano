import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-background)] px-4">
      <div className="w-full max-w-[400px]">
        <Link to="/" className="mb-8 block text-center">
          <span className="text-lg font-bold text-[var(--color-foreground)]">BenchmarkSignal</span>
        </Link>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 sm:p-8">
          {children}
        </div>
      </div>
    </div>
  )
}
