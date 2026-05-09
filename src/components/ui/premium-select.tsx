import { useState, useEffect, useRef } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PremiumSelectOption {
  value: string
  label: string
}

interface PremiumSelectProps {
  value: string
  onChange: (value: string) => void
  options: PremiumSelectOption[]
  placeholder?: string
  className?: string
  triggerClassName?: string
  id?: string
  icon?: React.ReactNode
}

export function PremiumSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className,
  triggerClassName,
  id,
  icon,
}: PremiumSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        id={id}
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 rounded-lg border border-border bg-[var(--color-background)] px-3 py-2 text-[13px] text-foreground transition-colors hover:bg-[var(--color-bg-tertiary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30',
          triggerClassName
        )}
      >
        {icon}
        <span className={value ? '' : 'text-muted-foreground'}>{selectedLabel}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-transform',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-full w-max rounded-lg border border-border bg-card py-1 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center justify-between gap-4 px-3 py-2 text-[13px] transition-colors hover:bg-[var(--color-bg-tertiary)]',
                value === opt.value
                  ? 'font-medium text-[var(--color-accent)]'
                  : 'text-foreground'
              )}
            >
              <span>{opt.label}</span>
              {value === opt.value && (
                <Check className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
