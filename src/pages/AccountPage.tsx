import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTheme } from 'next-themes'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { User, Shield, Bell, CreditCard, SlidersHorizontal, Sun, Moon, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'

function getInitials(email: string): string {
  return email.slice(0, 2).toUpperCase()
}

export function AccountPage() {
  const { user, deleteAccount, signOut } = useAuth()
  const { tier, isLoading: subLoading } = useSubscription()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deleteAccount()
      navigate('/login')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account')
      setIsDeleting(false)
    }
  }

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

        <div className="space-y-6 section-fade-in">
          {/* 1. Profile section */}
          <section className="card-premium rounded-xl border border-border bg-card p-6 space-y-4">
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
          <section className="card-premium rounded-xl border border-border bg-card p-6 space-y-4">
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
          <section className="card-premium rounded-xl border border-border bg-card p-6 space-y-4">
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
          <section className="card-premium rounded-xl border border-border bg-card p-6 space-y-4">
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
          <section className="card-premium rounded-xl border border-border bg-card p-6 space-y-4">
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
                className="rounded-lg border border-border bg-[var(--color-background)] px-3 py-1.5 text-[13px] text-foreground outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
              >
                <option value="calendar">Calendar Year (Jan-Dec)</option>
                <option value="april">April - March</option>
                <option value="july">July - June</option>
                <option value="october">October - September</option>
              </select>
            </div>
          </section>

          {/* 6. Danger Zone */}
          <section className="rounded-xl border border-red-300 dark:border-red-900 bg-card p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-500" />
              <h2 className="text-[15px] font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] text-foreground">Delete Account</p>
                <p className="text-[11px] text-muted-foreground">Permanently delete your account and all associated data. This action cannot be undone.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Account
              </Button>
            </div>

            {showDeleteConfirm && (
              <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 space-y-3">
                <p className="text-[13px] text-red-700 dark:text-red-300 font-medium">
                  Are you sure? This will permanently delete:
                </p>
                <ul className="list-disc pl-5 text-[12px] text-red-600 dark:text-red-400 space-y-1">
                  <li>Your profile and account settings</li>
                  <li>All uploaded reports and extracted KPIs</li>
                  <li>All benchmark documents and peer groups</li>
                  <li>Your subscription (if active)</li>
                </ul>
                <div>
                  <label className="text-[12px] text-red-700 dark:text-red-300 block mb-1">
                    Type <span className="font-mono font-bold">DELETE</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full rounded-md border border-red-300 dark:border-red-800 bg-white dark:bg-red-950/50 px-3 py-2 text-[13px] text-foreground outline-none focus:ring-2 focus:ring-red-400"
                  />
                </div>
                {deleteError && (
                  <p className="text-[12px] text-red-600">{deleteError}</p>
                )}
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); setDeleteError(null) }}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== 'DELETE' || isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Permanently Delete'}
                  </Button>
                </div>
              </div>
            )}
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
        className="h-5 w-9 cursor-pointer appearance-none rounded-full border border-[var(--color-border)] bg-[var(--color-bg-tertiary)] transition-colors checked:border-[var(--color-accent)] checked:bg-[var(--color-accent)] relative before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:shadow-sm before:transition-transform checked:before:translate-x-4"
      />
    </label>
  )
}
