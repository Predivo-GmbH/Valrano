/** Short header labels for tables to prevent overflow */
const KPI_SHORT_LABELS: Record<string, string> = {
  'Adjusted EBITDA': 'Adj. EBITDA',
  'EBITDA Margin': 'EBITDA Mrg.',
  'Net Debt / EBITDA': 'ND / EBITDA',
  'Return on Invested Capital (ROIC)': 'ROIC',
  'Capital Expenditure': 'CapEx',
  'CO2 Absolute Emissions (Scope 1+2)': 'CO2 Abs.',
  'CO2 Intensity': 'CO2 Int.',
  'Lost-Time Injury Frequency Rate (LTIFR)': 'LTIFR',
  'Cement & Clinker Volume': 'Cement Vol.',
  'Net Income': 'Net Inc.',
  'Basic EPS': 'EPS',
}

export function shortKpiLabel(name: string): string {
  return KPI_SHORT_LABELS[name] ?? name
}
