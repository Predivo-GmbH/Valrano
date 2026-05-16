-- =============================================================================
-- BenchmarkSignal — Auto-normalize KPI values on INSERT
-- Migration: 20260516000000_auto_normalize_trigger
--
-- Guarantees: every inserted kpi_value gets normalized_value set at the DB level.
-- Handles: CHF (copy), percentages/ratios (copy), FX conversion via fx_rates.
-- If no FX rate found, normalized_value stays NULL (Dashboard shows warning).
-- =============================================================================

-- KPI codes that are ratios/percentages — no currency conversion needed
CREATE OR REPLACE FUNCTION auto_normalize_kpi_value()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_currency text;
  v_kpi_code text;
  v_fx_rate  numeric;
BEGIN
  -- Skip if already normalized (e.g. from edge function)
  IF NEW.normalized_value IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if no raw value
  IF NEW.raw_value IS NULL THEN
    RETURN NEW;
  END IF;

  v_currency := UPPER(COALESCE(NEW.raw_currency, 'CHF'));

  -- Look up KPI code for ratio detection
  SELECT code INTO v_kpi_code
  FROM kpi_definitions
  WHERE id = NEW.kpi_definition_id;

  -- Ratios, percentages, and unit-based KPIs: copy raw value directly
  IF v_currency IN ('%', 'TIMES', 'RATE', 'KG/T', 'X')
     OR v_currency LIKE '%CO2%'
     OR v_kpi_code IN ('EBITDA_MARGIN', 'NET_DEBT_EBITDA', 'ROIC', 'EPS_BASIC',
                       'CO2_INTENSITY', 'LTIFR', 'CEMENT_VOLUME', 'CO2_ABSOLUTE')
  THEN
    NEW.normalized_value := NEW.raw_value;
    NEW.normalized_currency := 'CHF';
    RETURN NEW;
  END IF;

  -- Same currency: no conversion needed
  IF v_currency = 'CHF' THEN
    NEW.normalized_value := NEW.raw_value;
    NEW.normalized_currency := 'CHF';
    NEW.fx_rate_used := 1.0;
    RETURN NEW;
  END IF;

  -- FX conversion: look up rate from fx_rates table
  -- DB stores CHF → foreign (1 CHF = X foreign), so we need 1/rate to convert foreign → CHF
  -- Try exact fiscal year first, then closest available
  SELECT r.rate INTO v_fx_rate
  FROM fx_rates r
  WHERE r.base_currency = 'CHF'
    AND r.quote_currency = v_currency
    AND r.rate_type = 'period_average'
  ORDER BY ABS(EXTRACT(YEAR FROM r.rate_date) - NEW.fiscal_year), r.rate_date DESC
  LIMIT 1;

  IF v_fx_rate IS NOT NULL AND v_fx_rate > 0 THEN
    NEW.normalized_value := ROUND((NEW.raw_value / v_fx_rate)::numeric, 3);
    NEW.normalized_currency := 'CHF';
    NEW.fx_rate_used := ROUND((1.0 / v_fx_rate)::numeric, 6);
    RETURN NEW;
  END IF;

  -- Also try direct direction (foreign → CHF) in case rates are stored that way
  SELECT r.rate INTO v_fx_rate
  FROM fx_rates r
  WHERE r.base_currency = v_currency
    AND r.quote_currency = 'CHF'
    AND r.rate_type = 'period_average'
  ORDER BY ABS(EXTRACT(YEAR FROM r.rate_date) - NEW.fiscal_year), r.rate_date DESC
  LIMIT 1;

  IF v_fx_rate IS NOT NULL THEN
    NEW.normalized_value := ROUND((NEW.raw_value * v_fx_rate)::numeric, 3);
    NEW.normalized_currency := 'CHF';
    NEW.fx_rate_used := ROUND(v_fx_rate::numeric, 6);
    RETURN NEW;
  END IF;

  -- No rate found — leave normalized_value NULL (Dashboard warning will catch this)
  RETURN NEW;
END;
$$;

-- Fire BEFORE INSERT so we can modify the row before it's written
CREATE TRIGGER trg_auto_normalize_kpi
  BEFORE INSERT ON kpi_values
  FOR EACH ROW
  EXECUTE FUNCTION auto_normalize_kpi_value();
