import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTheme } from 'next-themes'
import { Link } from 'react-router-dom'
import { User, Shield, Bell, CreditCard, SlidersHorizontal, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'

function getInitials(email: string): string {
  return email.slice(0, 2).toUpperCase()
}

export function AccountPage() {
  const { user } = useAuth()
  const { tier, isLoading: subLoading } = useSubscription()
  const { theme, setTheme } = useTheme()

  // Notification preferences (localStorage)
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('bs_notification_prefs')
    if (saved) return JSON.parse(saved)
    return {
      newReport: true,
      extractionComplete: true,
      documentReady: true,
      weeklySummary: false,
    }
  })

  // Fiscal year preference (localStorage)
  const [fiscalYear, setFiscalYear] = useState(() => {
    return localStorage.getItem('bs_fiscal_year') || 'calendar'
  })

  useEffect(() => {
    localStorage.setItem('bs_notification_prefs', JSON.stringify(notifications))
  }, [notifications])

  useEffect(() => {
    localStorage.setItem('bs_fiscal_year', fiscalYear)
  }, [fiscalYear])

  function toggleNotification(key: keyof typeof notifications) {
    setNotifications((prev: typeof notifications) => ({ ...prev, [key]: !prev[key] }))
  }

  const email = user?.email || ''

  return (
    <>
      <Helmet><title>Account - BenchmarkSignal</title></Helmet>
      <div className="mx-auto max-w-[800px] px-4 py-8 sm:px-6">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
            Account
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Manage your profile, security, and preferences.
          </p>
        </div>

        <div className="space-y-6">
          {/* 1. Profile section */}
          <section className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[15px] font-semibold text-foreground">Profile</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)]/10 text-[15px] font-semibold text-[var(--color-primary)]">
                {getInitials(email)}
              </div>
              <div>
                <p className="text-[13px] font-medium text-foreground">{email}</p>
                <p className="text-[11px] text-muted-foreground">Display name</p>
              </div>
            </div>
            <div>
              <label className="text-[13px] text-muted-foreground">Email</label>
              <p className="mt-1 text-[13px] text-foreground">{email}</p>
            </div>
          </section>

          {/* 2. Security section */}
          <section className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[15px] font-semibold text-foreground">Security</h2>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-foreground">Password</p>
                <p className="text-[11px] text-muted-foreground">Change your account password</p>
              </div>
              <Link to="/reset-password">
                <Button variant="outline" size="sm">Change Password</Button>
              </Link>
            </div>
            <div>
              <p className="text-[13px] text-foreground">Active Sessions</p>
              <p className="text-[11px] text-muted-foreground">You are currently signed in from 1 device</p>
            </div>
          </section>

          {/* 3. Notifications section */}
          <section className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[15px] font-semibold text-foreground">Notifications</h2>
            </div>
            <div className="space-y-3">
              <ToggleRow
                label="New report detected"
                checked={notifications.newReport}
                onChange={() => toggleNotification('newReport')}
              />
              <ToggleRow
                label="KPI extraction complete"
                checked={notifications.extractionComplete}
                onChange={() => toggleNotification('extractionComplete')}
              />
              <ToggleRow
                label="Benchmark document ready"
                checked={notifications.documentReady}
                onChange={() => toggleNotification('documentReady')}
              />
              <ToggleRow
                label="Weekly summary email"
                checked={notifications.weeklySummary}
                onChange={() => toggleNotification('weeklySummary')}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">Notification preferences are stored locally</p>
          </section>

          {/* 4. Subscription section */}
          <section className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[15px] font-semibold text-foreground">Subscription</h2>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-foreground">Current Plan</p>
                {subLoading ? (
                  <p className="text-[11px] text-muted-foreground">Loading...</p>
                ) : (
                  <span className="mt-1 inline-flex items-center rounded-full bg-[var(--color-primary)]/10 px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-primary)] capitalize">
                    {tier}
                  </span>
                )}
              </div>
              <Button variant="outline" size="sm" disabled>
                Manage Subscription
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">Subscription management coming soon</p>
          </section>

          {/* 5. Preferences section */}
          <section className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[15px] font-semibold text-foreground">Preferences</h2>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-foreground">Theme</p>
                <p className="text-[11px] text-muted-foreground">Switch between light and dark mode</p>
              </div>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-[13px] text-foreground transition-colors hover:bg-[var(--color-bg-tertiary)]"
              >
                {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                {theme === 'dark' ? 'Dark' : 'Light'}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-foreground">Default Fiscal Year</p>
                <p className="text-[11px] text-muted-foreground">Used for report date ranges</p>
              </div>
              <select
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                className="rounded-lg border border-border bg-[var(--color-background)] px-3 py-1.5 text-[13px] text-foreground outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
              >
                <option value="calendar">Calendar Year (Jan-Dec)</option>
                <option value="april">April - March</option>
                <option value="july">July - June</option>
                <option value="october">October - September</option>
              </select>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-[13px] text-foreground">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-[var(--color-bg-tertiary)] transition-colors checked:bg-[var(--color-primary)] relative before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-4"
      />
    </label>
  )
}
