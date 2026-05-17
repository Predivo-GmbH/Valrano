import { useState, useEffect, type FormEvent } from 'react'
import { Helmet } from 'react-helmet-async'
import { useTheme } from 'next-themes'
import { User, Shield, CreditCard, SlidersHorizontal, Sun, Moon, Trash2, Eye, EyeOff, Check, KeyRound, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PremiumSelect } from '@/components/ui/premium-select'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { getPasswordScore } from '@/components/auth/password-utils'
import PasswordStrength from '@/components/auth/PasswordStrength'
import { toast } from 'sonner'

function getInitials(email: string): string {
  return email.slice(0, 2).toUpperCase()
}

const FISCAL_OPTIONS = [
  { value: 'calendar', label: 'Calendar Year (Jan–Dec)' },
  { value: 'april', label: 'April – March' },
  { value: 'july', label: 'July – June' },
  { value: 'october', label: 'October – September' },
] as const

export function AccountPage() {
  const { user, updatePassword, deleteAccount } = useAuth()
  const { tier, isLoading: subLoading } = useSubscription()
  const { theme, setTheme } = useTheme()

  // Change password state
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Fiscal year preference (localStorage)
  const [fiscalYear, setFiscalYear] = useState(() => {
    return localStorage.getItem('bs_fiscal_year') || 'calendar'
  })

  const fiscalOptions = FISCAL_OPTIONS.map(o => ({ value: o.value, label: o.label }))

  useEffect(() => {
    localStorage.setItem('bs_fiscal_year', fiscalYear)
  }, [fiscalYear])

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }
    if (getPasswordScore(newPassword) < 3) {
      setPasswordError('Please choose a stronger password')
      return
    }
    setPasswordError(null)
    setPasswordLoading(true)
    try {
      await updatePassword(newPassword)
      setPasswordSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
      toast.success('Password updated successfully')
      setTimeout(() => {
        setShowPasswordForm(false)
        setPasswordSuccess(false)
      }, 2000)
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setPasswordLoading(false)
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deleteAccount()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account')
      setIsDeleting(false)
    }
  }

  const email = user?.email || ''
  const lastSignIn = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <>
      <Helmet><title>Account - Valrano</title></Helmet>
      <div className="mx-auto max-w-[800px] px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
            Account
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Manage your profile, security, and preferences.
          </p>
        </div>

        <div className="space-y-6 section-fade-in">
          {/* 1. Profile */}
          <section className="card-premium rounded-xl border border-border bg-card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[15px] font-semibold text-foreground">Profile</h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[15px] font-semibold text-[var(--color-accent)]">
                {getInitials(email)}
              </div>
              <div>
                <p className="text-[14px] font-medium text-foreground">{email}</p>
                {lastSignIn && (
                  <p className="text-[11px] text-muted-foreground">Last sign-in: {lastSignIn}</p>
                )}
              </div>
            </div>
          </section>

          {/* 2. Security */}
          <section className="card-premium rounded-xl border border-border bg-card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[15px] font-semibold text-foreground">Security</h2>
            </div>

            {!showPasswordForm ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-foreground">Password</p>
                  <p className="text-[11px] text-muted-foreground">Update your account password</p>
                </div>
                <button
                  onClick={() => setShowPasswordForm(true)}
                  className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-[13px] font-medium text-white transition-all hover:opacity-90"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  Change Password
                </button>
              </div>
            ) : passwordSuccess ? (
              <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3">
                <Check className="h-5 w-5 text-emerald-500" />
                <p className="text-[13px] font-medium text-emerald-600 dark:text-emerald-400">Password updated successfully</p>
              </div>
            ) : (
              <form onSubmit={handleChangePassword} className="space-y-4">
                {passwordError && (
                  <div role="alert" className="rounded-lg bg-[var(--color-destructive)]/10 px-4 py-3 text-[13px] text-[var(--color-destructive)]">
                    {passwordError}
                  </div>
                )}

                <div>
                  <label htmlFor="new-pw" className="block text-[12px] font-medium text-muted-foreground mb-1.5">New password</label>
                  <div className="relative">
                    <input
                      id="new-pw"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="block w-full rounded-lg border border-border bg-[var(--color-background)] px-3 py-2.5 pr-10 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
                      placeholder="Min. 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <PasswordStrength password={newPassword} />
                </div>

                <div>
                  <label htmlFor="confirm-pw" className="block text-[12px] font-medium text-muted-foreground mb-1.5">Confirm new password</label>
                  <input
                    id="confirm-pw"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full rounded-lg border border-border bg-[var(--color-background)] px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
                    placeholder="Confirm password"
                  />
                  {confirmPassword && confirmPassword !== newPassword && (
                    <p className="mt-1 text-[11px] text-[var(--color-destructive)]">Passwords do not match</p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    disabled={passwordLoading}
                    className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-[13px] font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
                  >
                    {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {passwordLoading ? 'Updating...' : 'Update Password'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false)
                      setPasswordError(null)
                      setNewPassword('')
                      setConfirmPassword('')
                    }}
                    className="rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-[var(--color-bg-tertiary)] hover:text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* 3. Subscription */}
          <section className="card-premium rounded-xl border border-border bg-card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[15px] font-semibold text-foreground">Subscription</h2>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-foreground">Current Plan</p>
                {subLoading ? (
                  <p className="text-[11px] text-muted-foreground">Loading...</p>
                ) : (
                  <span className="mt-1 inline-flex items-center rounded-full bg-[var(--color-accent)]/10 px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-accent)] capitalize">
                    {tier}
                  </span>
                )}
              </div>
              <Button variant="outline" size="sm" disabled>
                Manage Subscription
              </Button>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">Subscription management coming soon</p>
          </section>

          {/* 5. Preferences */}
          <section className="card-premium rounded-xl border border-border bg-card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-[15px] font-semibold text-foreground">Preferences</h2>
            </div>

            <div className="space-y-4">
              {/* Theme */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-foreground">Theme</p>
                  <p className="text-[11px] text-muted-foreground">Switch between light and dark mode</p>
                </div>
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-[var(--color-bg-tertiary)]"
                >
                  {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                  {theme === 'dark' ? 'Dark' : 'Light'}
                </button>
              </div>

              {/* Fiscal Year — custom dropdown */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] font-medium text-foreground">Default Fiscal Year</p>
                  <p className="text-[11px] text-muted-foreground">Used for report date ranges</p>
                </div>
                <PremiumSelect
                  value={fiscalYear}
                  onChange={setFiscalYear}
                  options={fiscalOptions}
                />
              </div>
            </div>
          </section>

          {/* 6. Danger Zone */}
          <section className="card-danger rounded-xl bg-card p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trash2 className="h-4 w-4 text-red-500" />
              <h2 className="text-[15px] font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-foreground">Delete Account</p>
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
              <div className="mt-4 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 space-y-3">
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
                  <p className="text-[12px] text-red-600" role="alert">{deleteError}</p>
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

