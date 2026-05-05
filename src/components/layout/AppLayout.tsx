import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { Sun, Moon, LayoutDashboard, Users, Settings, LogOut, User, Menu, X, BarChart3, FileBarChart } from 'lucide-react'
import { NotificationBell } from './NotificationBell'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAuth } from '@/hooks/useAuth'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/peers', label: 'Peers', icon: Users },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const

const navLinkCls = (isActive: boolean) =>
  `flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
    isActive
      ? 'bg-[var(--color-bg-tertiary)] text-foreground'
      : 'text-muted-foreground hover:text-foreground hover:bg-[var(--color-bg-tertiary)]'
  }`

export function AppLayout() {
  const { theme, setTheme } = useTheme()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setMobileNavOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  // Scroll lock when mobile nav is open
  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileNavOpen])

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Skip to content */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-[var(--color-primary)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[var(--color-primary-foreground)]"
        >
          Skip to content
        </a>

        {/* Fixed frosted-glass nav — 64px height per design tokens */}
        <nav
          className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border bg-[var(--color-background)]/80 backdrop-blur-xl"
          aria-label="Main navigation"
        >
          <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-4 sm:px-6">

            {/* Logo */}
            <NavLink
              to="/dashboard"
              className="text-[15px] font-bold tracking-tight text-foreground transition-colors hover:text-foreground/80"
            >
              BenchmarkSignal
            </NavLink>

            {/* Center navigation — desktop */}
            <div className="hidden items-center gap-1 md:flex">
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.to} to={item.to} className={({ isActive }) => navLinkCls(isActive)}>
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </NavLink>
              ))}
            </div>

            {/* Right side — notifications + theme toggle + user menu + mobile hamburger */}
            <div className="flex items-center gap-1">
              <NotificationBell />
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label="Toggle theme"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-[var(--color-bg-tertiary)] hover:text-foreground"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-label="User menu"
                  aria-expanded={menuOpen}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-[var(--color-bg-tertiary)] hover:text-foreground"
                >
                  <User className="h-5 w-5" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-[var(--color-card)] py-1 shadow-lg">
                    <div className="border-b border-border px-4 py-2">
                      <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    <button
                      onClick={() => { setMenuOpen(false); navigate('/account') }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] text-muted-foreground hover:bg-[var(--color-bg-tertiary)] hover:text-foreground"
                    >
                      <User className="h-4 w-4" />
                      Account
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); navigate('/settings') }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] text-muted-foreground hover:bg-[var(--color-bg-tertiary)] hover:text-foreground"
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </button>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={async () => {
                        await signOut()
                        navigate('/login')
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-[13px] text-muted-foreground hover:bg-[var(--color-bg-tertiary)] hover:text-foreground"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
                aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileNavOpen}
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-[var(--color-bg-tertiary)] hover:text-foreground md:hidden"
              >
                {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Mobile nav drawer with backdrop */}
          {mobileNavOpen && (
            <>
              <div
                className="fixed inset-0 top-16 z-40 bg-black/50 backdrop-blur-sm md:hidden"
                aria-hidden="true"
                onClick={() => setMobileNavOpen(false)}
              />
              <div
                className="fixed left-0 right-0 top-16 z-50 border-t border-border bg-[var(--color-background)] px-4 pb-4 pt-2 md:hidden"
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
              >
                {NAV_ITEMS.map((item) => (
                  <NavLink key={item.to} to={item.to} onClick={() => setMobileNavOpen(false)} className={({ isActive }) => navLinkCls(isActive)}>
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </>
          )}
        </nav>

        {/* Content area offset below fixed nav */}
        <main id="main-content" className="pt-16">
          <Outlet />
        </main>
      </div>
    </TooltipProvider>
  )
}
