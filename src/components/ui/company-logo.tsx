import { useState } from 'react'
import { Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Build a direct favicon URL from a website URL (domain/favicon.ico). */
export function companyLogoUrl(websiteUrl: string | null | undefined): string | null {
  if (!websiteUrl) return null
  try {
    const domain = new URL(websiteUrl).hostname
    return `https://${domain}/favicon.ico`
  } catch {
    return null
  }
}

interface CompanyLogoProps {
  logoUrl?: string | null
  websiteUrl?: string | null
  name?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const SIZE_MAP = {
  xs: { container: 'h-5 w-5', icon: 'h-2.5 w-2.5' },
  sm: { container: 'h-6 w-6', icon: 'h-3 w-3' },
  md: { container: 'h-7 w-7', icon: 'h-3.5 w-3.5' },
  lg: { container: 'h-8 w-8', icon: 'h-4 w-4' },
  xl: { container: 'h-10 w-10', icon: 'h-5 w-5' },
}

export function CompanyLogo({ logoUrl, websiteUrl, name, size = 'sm', className }: CompanyLogoProps) {
  const src = logoUrl || companyLogoUrl(websiteUrl)
  const { container, icon } = SIZE_MAP[size]
  const [failed, setFailed] = useState(false)

  if (src && !failed) {
    return (
      <img
        src={src}
        alt={name ? `${name} logo` : ''}
        className={cn(container, 'rounded border border-border/50 bg-white object-contain p-0.5 shrink-0', className)}
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <div className={cn('flex items-center justify-center rounded border border-border/50 bg-[var(--color-bg-tertiary)] shrink-0', container, className)}>
      <Building2 className={cn(icon, 'text-muted-foreground')} />
    </div>
  )
}
