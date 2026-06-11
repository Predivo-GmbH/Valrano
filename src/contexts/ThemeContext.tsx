import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

/**
 * CSP-safe theme provider (replaces next-themes).
 *
 * next-themes injects an inline <script> to apply the stored theme before
 * paint, which violates our Content-Security-Policy (script-src 'self').
 * The before-paint logic lives in /public/theme-init.js (an external file
 * loaded from index.html), and this provider keeps React state + localStorage
 * in sync afterwards. Same storage key ('theme') and class attribute
 * behavior as the previous next-themes setup.
 */

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const STORAGE_KEY = 'theme'

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
})

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // localStorage unavailable (e.g. blocked) — fall back to default
  }
  return 'dark'
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.remove(theme === 'dark' ? 'light' : 'dark')
  root.classList.add(theme)
  root.style.colorScheme = theme
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Persisting is best-effort; in-memory state still updates
    }
  }, [])

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}
