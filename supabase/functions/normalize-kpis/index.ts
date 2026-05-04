import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { authenticateRequest, errorResponse, jsonResponse } from '../_shared/auth.ts'

// ---------------------------------------------------------------------------
// KPI classification for FX conversion strategy
// ---------------------------------------------------------------------------

// P&L KPIs: use period_average FX rate for the fiscal year
const PL_KPI_CODES = new Set([
  'REVENUE',
  'EBITDA',
  'EBITDA_ADJ',
  'EBIT',
  'NET_INCOME',
  'CAPEX',
])

// Balance sheet KPIs: use point_in_time (daily_close) rate closest to report date
const BS_KPI_CODES = new Set(['NET_DEBT'])

// Ratio / percentage / volume KPIs: no currency conversion needed
const NO_CONVERSION_KPI_CODES = new Set([
  'EBITDA_MARGIN',
  'NET_DEBT_EBITDA',
  'ROIC',
  'EPS_BASIC',
  'CO2_INTENSITY',
  'LTIFR',
  'CEMENT_VOLUME',
  'CO2_ABSOLUTE',
])

interface KpiValueRow {
  id: string
  raw_value: number | null
  raw_currency: string | null
  fiscal_year: number
  kpi_definitions: { code: string }
  reports: { fiscal_year: number; publication_date: string | null }
}

interface FxRateRow {
  rate: number
  rate_date: string
  rate_type: string
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }

  try {
    const { adminClient } = await authenticateRequest(req)

    const { report_id: reportId } = await req.json()
    if (!reportId) {
      return jsonResponse({ error: 'Missing required field: report_id' }, 400)
    }

    // ------------------------------------------------------------------
    // 1. Load all un-normalized kpi_values for this report
    // ------------------------------------------------------------------
    const { data: kpiValues, error: kpiError } = await adminClient
      .from('kpi_values')
      .select(`
        id,
        raw_value,
        raw_currency,
        fiscal_year,
        kpi_definitions ( code ),
        reports ( fiscal_year, publication_date )
      `)
      .eq('report_id', reportId)
      .is('normalized_value', null)

    if (kpiError) throw new Error(`KPI values lookup failed: ${kpiError.message}`)
    if (!kpiValues || kpiValues.length === 0) {
      return jsonResponse({ message: 'No un-normalized KPI values found', updated: 0 })
    }

    // ------------------------------------------------------------------
    // 2. Normalize each value
    // ------------------------------------------------------------------
    let updatedCount = 0

    for (const kv of kpiValues as KpiValueRow[]) {
      const kpiCode = kv.kpi_definitions?.code
      const rawValue = kv.raw_value
      const rawCurrency = kv.raw_currency?.toUpperCase() ?? 'CHF'

      if (rawValue === null || rawValue === undefined) continue

      let normalizedValue: number
      let fxRateUsed: number | null = null
      let fxRateType: 'period_average' | 'point_in_time' | null = null

      // Already in CHF or no conversion needed
      if (rawCurrency === 'CHF' || NO_CONVERSION_KPI_CODES.has(kpiCode)) {
        normalizedValue = rawValue
        fxRateUsed = rawCurrency === 'CHF' ? 1.0 : null
        fxRateType = rawCurrency === 'CHF' ? 'period_average' : null
      } else if (PL_KPI_CODES.has(kpiCode)) {
        // P&L: use period_average rate for the fiscal year
        const fiscalYear = kv.fiscal_year

        const { data: fxRows, error: fxError } = await adminClient
          .from('fx_rates')
          .select('rate, rate_date, rate_type')
          .eq('base_currency', rawCurrency)
          .eq('quote_currency', 'CHF')
          .eq('rate_type', 'period_average')
          // period_average rows are dated to the last day of the period; match by year
          .gte('rate_date', `${fiscalYear}-01-01`)
          .lte('rate_date', `${fiscalYear}-12-31`)
          .order('rate_date', { ascending: false })
          .limit(1)

        if (fxError) throw new Error(`FX rate lookup failed: ${fxError.message}`)

        if (!fxRows || fxRows.length === 0) {
          // No rate available — skip normalization for this row
          console.warn(
            `No period_average FX rate found for ${rawCurrency}/CHF in ${fiscalYear}. Skipping kpi_value ${kv.id}`,
          )
          continue
        }

        const fx = fxRows[0] as FxRateRow
        fxRateUsed = fx.rate
        fxRateType = 'period_average'
        normalizedValue = rawValue * fx.rate
      } else if (BS_KPI_CODES.has(kpiCode)) {
        // Balance sheet: use closest daily_close rate to publication_date (or fiscal year end)
        const reportDate =
          kv.reports?.publication_date ?? `${kv.reports?.fiscal_year ?? kv.fiscal_year}-12-31`

        const { data: fxRows, error: fxError } = await adminClient
          .from('fx_rates')
          .select('rate, rate_date, rate_type')
          .eq('base_currency', rawCurrency)
          .eq('quote_currency', 'CHF')
          .eq('rate_type', 'daily_close')
          .lte('rate_date', reportDate)
          .order('rate_date', { ascending: false })
          .limit(1)

        if (fxError) throw new Error(`FX rate lookup failed: ${fxError.message}`)

        if (!fxRows || fxRows.length === 0) {
          console.warn(
            `No daily_close FX rate found for ${rawCurrency}/CHF on/before ${reportDate}. Skipping kpi_value ${kv.id}`,
          )
          continue
        }

        const fx = fxRows[0] as FxRateRow
        fxRateUsed = fx.rate
        fxRateType = 'point_in_time'
        normalizedValue = rawValue * fx.rate
      } else {
        // Unknown KPI code — skip
        console.warn(`Unknown KPI code "${kpiCode}" — skipping normalization for kpi_value ${kv.id}`)
        continue
      }

      // ------------------------------------------------------------------
      // 3. Persist normalized value
      // ------------------------------------------------------------------
      const { error: updateError } = await adminClient
        .from('kpi_values')
        .update({
          normalized_value: normalizedValue,
          normalized_currency: 'CHF',
          fx_rate_used: fxRateUsed,
          fx_rate_type: fxRateType,
        })
        .eq('id', kv.id)

      if (updateError) {
        console.error(`Failed to update kpi_value ${kv.id}: ${updateError.message}`)
        continue
      }

      updatedCount++
    }

    return jsonResponse({
      report_id: reportId,
      updated: updatedCount,
      skipped: (kpiValues?.length ?? 0) - updatedCount,
    })
  } catch (err) {
    return errorResponse(err)
  }
})
