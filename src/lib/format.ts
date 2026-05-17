/**
 * Valrano — Value formatting utilities
 * Handles KPI display: currency (millions/billions), percentages, ratios, tons, intensities.
 */

export function formatKpiValue(value: number | null | undefined, unitType: string): string {
  if (value === null || value === undefined) return '—'

  switch (unitType) {
    case 'currency':
      if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}B`
      return `${value.toFixed(0)}M`
    case 'percentage':
      return `${value.toFixed(1)}%`
    case 'ratio':
      return `${value.toFixed(1)}x`
    case 'number':
      return value.toFixed(1)
    case 'tons':
      if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}Mt`
      if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(0)}kt`
      return `${value.toFixed(0)}t`
    case 'intensity':
      return `${value.toFixed(0)}`
    default:
      return value.toString()
  }
}

export function formatCurrency(value: number, currency: string = 'CHF'): string {
  if (Math.abs(value) >= 1000) return `${currency} ${(value / 1000).toFixed(1)}B`
  return `${currency} ${value.toFixed(0)}M`
}

/**
 * Formats a 0–1 confidence score as a percentage label and returns a color class.
 */
export function confidenceColor(confidence: number | null | undefined): string {
  if (confidence === null || confidence === undefined) return 'text-muted-foreground'
  if (confidence >= 0.85) return 'text-[var(--color-signal-green)]'
  if (confidence >= 0.65) return 'text-[var(--color-signal-amber)]'
  return 'text-[var(--color-signal-red)]'
}

export function formatConfidence(confidence: number | null | undefined): string {
  if (confidence === null || confidence === undefined) return '—'
  return `${Math.round(confidence * 100)}%`
}
