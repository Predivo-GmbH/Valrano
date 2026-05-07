import { useState, useRef, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { Building2, Loader2, Search } from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CompanyResult {
  name: string
  jurisdiction: string
  country_code: string
  sector: string | null
  currency: string
  legal_form: string | null
  uid: string | null
  ticker: string | null
  source: 'zefix' | 'opencorporates'
}

interface CompanyAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect: (company: CompanyResult) => void
  placeholder?: string
  className?: string
  id?: string
}

// ---------------------------------------------------------------------------
// Hook: useCompanySearch
// ---------------------------------------------------------------------------

function useCompanySearch() {
  const [results, setResults] = useState<CompanyResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback((query: string) => {
    // Clear previous timer
    if (timerRef.current) clearTimeout(timerRef.current)

    // Abort previous request
    if (abortRef.current) abortRef.current.abort()

    if (query.trim().length < 3) {
      setResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)

    // Debounce 300ms
    timerRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) {
          setIsSearching(false)
          return
        }

        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/company-lookup`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            },
            body: JSON.stringify({ query: query.trim() }),
            signal: controller.signal,
          },
        )

        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const data = await res.json()
        if (!controller.signal.aborted) {
          setResults(data.results ?? [])
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        console.warn('Company search failed:', err)
        if (!controller.signal.aborted) setResults([])
      } finally {
        if (!controller.signal.aborted) setIsSearching(false)
      }
    }, 300)
  }, [])

  const clear = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (abortRef.current) abortRef.current.abort()
    setResults([])
    setIsSearching(false)
  }, [])

  return { results, isSearching, search, clear }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CompanyAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Start typing a company name...',
  className,
  id,
}: CompanyAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { results, isSearching, search, clear } = useCompanySearch()

  // Handle input changes — trigger search inline
  const handleChange = useCallback((newValue: string) => {
    onChange(newValue)
    if (newValue.trim().length >= 3) {
      search(newValue)
      setIsOpen(true)
    } else {
      clear()
      setIsOpen(false)
    }
    setSelectedIndex(-1)
  }, [onChange, search, clear])

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleSelect = (company: CompanyResult) => {
    onChange(company.name)
    onSelect(company)
    setIsOpen(false)
    clear()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex((i) => (i < results.length - 1 ? i + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex((i) => (i > 0 ? i - 1 : results.length - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex])
        }
        break
      case 'Escape':
        setIsOpen(false)
        break
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          id={id}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true)
          }}
          placeholder={placeholder}
          className={cn('pl-9', className)}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-card shadow-lg"
        >
          {results.map((company, idx) => (
            <li
              key={`${company.source}-${company.name}-${idx}`}
              role="option"
              aria-selected={idx === selectedIndex}
              className={cn(
                'flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors',
                idx === selectedIndex
                  ? 'bg-accent/15 text-foreground'
                  : 'text-foreground hover:bg-muted/50',
              )}
              onMouseDown={(e) => {
                e.preventDefault() // Prevent blur
                handleSelect(company)
              }}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <Building2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{company.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[
                    company.jurisdiction,
                    company.sector,
                    company.legal_form,
                    company.currency,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                {company.source === 'zefix' ? 'CH' : company.country_code.toUpperCase()}
              </span>
            </li>
          ))}
        </ul>
      )}

      {isOpen && !isSearching && results.length === 0 && value.trim().length >= 3 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card px-4 py-3 text-center text-sm text-muted-foreground shadow-lg">
          No companies found. You can enter the name manually.
        </div>
      )}
    </div>
  )
}
