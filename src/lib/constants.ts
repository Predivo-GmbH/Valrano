import type { ReportType } from '@/types/database'

/** Full labels — e.g. "Annual Report" */
export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  annual: 'Annual Report',
  quarterly: 'Quarterly Report',
  half_year: 'Half-Year Report',
  sustainability: 'Sustainability Report',
}

/** Short labels — e.g. "Annual" */
export const REPORT_TYPE_LABELS_SHORT: Record<ReportType, string> = {
  annual: 'Annual',
  quarterly: 'Quarterly',
  half_year: 'Half-Year',
  sustainability: 'Sustainability',
}
