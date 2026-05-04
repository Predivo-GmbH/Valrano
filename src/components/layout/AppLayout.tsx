import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useTheme } from 'next-themes'
import { Sun, Moon, Upload, LayoutDashboard, ClipboardCheck, LogOut, User } from 'lucide-react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAuth } from '@/hooks/useAuth'

export function AppLayout() {
  const { theme, setTheme } = useTheme()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
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

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Fixed frosted-glass nav — 64px height per design tokens */}
        <nav
          className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-border"
          style={{ background: 'rgba(10,11,13,0.8)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
        >
          <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-6">

            {/* Logo */}
            <NavLink
              to="/dashboard"
              className="text-[15px] font-bold tracking-tight text-foreground transition-colors hover:text-foreground/80"
            >
              BenchmarkSignal
            </NavLink>

            {/* Center navigation */}
            <div className="flex items-center gap-1">
              <NavLink
                to="/dashboard"
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-[var(--color-bg-tertiary)] text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-[var(--color-bg-tertiary)]'
                  }`
                }
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </NavLink>

              <NavLink
                to="/upload"
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-[var(--color-bg-tertiary)] text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-[var(--color-bg-tertiary)]'
                  }`
                }
              >
                <Upload className="h-4 w-4" />
                Upload
              </NavLink>

              <NavLink
                to="/review"
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-[var(--color-bg-tertiary)] text-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-[var(--color-bg-tertiary)]'
                  }`
                }
              >
                <ClipboardCheck className="h-4 w-4" />
                Review
              </NavLink>
            </div>

            {/* Right side — theme toggle + user menu */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label="Toggle theme"
                className="rounded-lg p-2 text-muted-foreground transition-all duration-200 hover:text-foreground hover:bg-[var(--color-bg-tertiary)]"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  aria-label="User menu"
                  className="rounded-lg p-2 text-muted-foreground transition-all duration-200 hover:text-foreground hover:bg-[var(--color-bg-tertiary)]"
                >
                  <User className="h-5 w-5" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-[var(--color-card)] py-1 shadow-lg">
                    <div className="border-b border-border px-4 py-2">
                      <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                    <button
                      onClick={async () => {
                        await signOut()
                        navigate('/login')
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-[13px] text-muted-foreground hover:bg-[var(--color-bg-tertiary)] hover:text-foreground"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Content area offset below fixed nav */}
        <main className="pt-16">
          <Outlet />
        </main>
      </div>
    </TooltipProvider>
  )
}
