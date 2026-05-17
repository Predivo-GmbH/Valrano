-- =============================================================================
-- Valrano — Seed Sample KPI Values (2024 Annual, 6 companies)
-- Migration: 20260504100002_seed_sample_kpis
-- =============================================================================
-- FX rates used for CHF normalization (2024 period_average, CHF as base):
--   CHF/CHF = 1.0000
--   EUR→CHF = 1 / 1.04  = 0.96154
--   USD→CHF = 1 / 1.13  = 0.88496
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Step 1: Insert one annual report record per company (2024)
-- ---------------------------------------------------------------------------
-- We use a temp approach: insert reports and capture IDs via CTE in Step 3.
-- First insert all 6 reports, then extractions, then kpi_values.
-- ---------------------------------------------------------------------------

-- Holcim report
INSERT INTO public.reports
  (company_id, report_type, fiscal_year, title, publication_date, status)
SELECT
  c.id,
  'annual',
  2024,
  'Holcim Full Year 2024 Results',
  '2025-02-14',
  'reviewed'
FROM public.companies c WHERE c.ticker = 'HOLN';

-- Heidelberg Materials report
INSERT INTO public.reports
  (company_id, report_type, fiscal_year, title, publication_date, status)
SELECT
  c.id,
  'annual',
  2024,
  'Heidelberg Materials Full Year 2024 Results',
  '2025-03-07',
  'reviewed'
FROM public.companies c WHERE c.ticker = 'HEI';

-- CRH report
INSERT INTO public.reports
  (company_id, report_type, fiscal_year, title, publication_date, status)
SELECT
  c.id,
  'annual',
  2024,
  'CRH Full Year 2024 Results',
  '2025-02-26',
  'reviewed'
FROM public.companies c WHERE c.ticker = 'CRH';

-- Cemex report
INSERT INTO public.reports
  (company_id, report_type, fiscal_year, title, publication_date, status)
SELECT
  c.id,
  'annual',
  2024,
  'Cemex Full Year 2024 Results',
  '2025-02-13',
  'reviewed'
FROM public.companies c WHERE c.ticker = 'CX';

-- Buzzi report
INSERT INTO public.reports
  (company_id, report_type, fiscal_year, title, publication_date, status)
SELECT
  c.id,
  'annual',
  2024,
  'Buzzi SpA Full Year 2024 Results',
  '2025-03-05',
  'reviewed'
FROM public.companies c WHERE c.ticker = 'BZU';

-- Martin Marietta report
INSERT INTO public.reports
  (company_id, report_type, fiscal_year, title, publication_date, status)
SELECT
  c.id,
  'annual',
  2024,
  'Martin Marietta Materials Full Year 2024 Results',
  '2025-02-11',
  'reviewed'
FROM public.companies c WHERE c.ticker = 'MLM';

-- ---------------------------------------------------------------------------
-- Step 2: Insert one extraction record per report
-- ---------------------------------------------------------------------------
INSERT INTO public.extractions
  (report_id, model_used, started_at, completed_at, status, total_kpis_extracted, avg_confidence)
SELECT
  r.id,
  'claude-opus-4-6',
  r.publication_date::timestamptz,
  r.publication_date::timestamptz + interval '3 minutes',
  'completed',
  9,
  0.975
FROM public.reports r
WHERE r.fiscal_year = 2024
  AND r.report_type = 'annual'
  AND r.company_id IN (
    SELECT id FROM public.companies
    WHERE ticker IN ('HOLN', 'HEI', 'CRH', 'CX', 'BZU', 'MLM')
  );

-- ---------------------------------------------------------------------------
-- Step 3: Insert KPI values per company
-- Uses CTEs to resolve IDs at runtime — no hardcoded UUIDs
-- ---------------------------------------------------------------------------
-- FX rate inverses (from CHF base rates, period_average 2024):
--   CHF: fx_rate = 1.0000, normalized = raw
--   EUR: fx_rate = 1/1.04 = 0.96154, normalized = raw * 0.96154
--   USD: fx_rate = 1/1.13 = 0.88496, normalized = raw * 0.88496
-- ---------------------------------------------------------------------------

-- =========================================================================
-- HOLCIM (CHF) — fx_rate = 1.0
-- Revenue: 27,000M | EBITDA: 6,500M | EBITDA_ADJ: 6,800M
-- EBITDA_MARGIN: 24.1% | EBIT: 4,200M | NET_INCOME: 3,100M
-- NET_DEBT: 8,500M | NET_DEBT_EBITDA: 1.31x | CAPEX: 1,800M
-- =========================================================================
WITH holcim AS (
  SELECT
    e.id  AS extraction_id,
    r.id  AS report_id,
    c.id  AS company_id
  FROM public.companies c
  JOIN public.reports r    ON r.company_id = c.id AND r.fiscal_year = 2024 AND r.report_type = 'annual'
  JOIN public.extractions e ON e.report_id = r.id
  WHERE c.ticker = 'HOLN'
)
INSERT INTO public.kpi_values
  (extraction_id, report_id, company_id, kpi_definition_id,
   fiscal_year, raw_value, raw_currency, normalized_value, normalized_currency,
   fx_rate_used, fx_rate_type, confidence, needs_review)
SELECT
  h.extraction_id, h.report_id, h.company_id,
  kd.id,
  2024,
  v.raw_value,
  'CHF',
  v.raw_value,   -- CHF = CHF, no conversion
  'CHF',
  1.0,
  'period_average',
  0.98,
  false
FROM holcim h
CROSS JOIN (
  VALUES
    ('REVENUE',        27000.0),
    ('EBITDA',          6500.0),
    ('EBITDA_ADJ',      6800.0),
    ('EBITDA_MARGIN',     24.1),
    ('EBIT',            4200.0),
    ('NET_INCOME',      3100.0),
    ('NET_DEBT',        8500.0),
    ('NET_DEBT_EBITDA',    1.31),
    ('CAPEX',           1800.0)
) AS v(kpi_code, raw_value)
JOIN public.kpi_definitions kd ON kd.code = v.kpi_code;

-- =========================================================================
-- HEIDELBERG MATERIALS (EUR) — fx_rate = 0.96154 (1/1.04)
-- Revenue: 21,200M | EBITDA: 4,800M | EBITDA_ADJ: NULL (not seeded)
-- EBITDA_MARGIN: 22.6% | EBIT: 2,900M | NET_INCOME: 2,100M
-- NET_DEBT: 5,200M | NET_DEBT_EBITDA: 1.08x | CAPEX: 1,500M
-- =========================================================================
WITH hei AS (
  SELECT
    e.id  AS extraction_id,
    r.id  AS report_id,
    c.id  AS company_id
  FROM public.companies c
  JOIN public.reports r    ON r.company_id = c.id AND r.fiscal_year = 2024 AND r.report_type = 'annual'
  JOIN public.extractions e ON e.report_id = r.id
  WHERE c.ticker = 'HEI'
)
INSERT INTO public.kpi_values
  (extraction_id, report_id, company_id, kpi_definition_id,
   fiscal_year, raw_value, raw_currency, normalized_value, normalized_currency,
   fx_rate_used, fx_rate_type, confidence, needs_review)
SELECT
  h.extraction_id, h.report_id, h.company_id,
  kd.id,
  2024,
  v.raw_value,
  'EUR',
  ROUND(v.raw_value * 0.96154, 4),
  'CHF',
  0.96154,
  'period_average',
  0.97,
  false
FROM hei h
CROSS JOIN (
  VALUES
    ('REVENUE',        21200.0),
    ('EBITDA',          4800.0),
    ('EBITDA_MARGIN',     22.6),
    ('EBIT',            2900.0),
    ('NET_INCOME',      2100.0),
    ('NET_DEBT',        5200.0),
    ('NET_DEBT_EBITDA',    1.08),
    ('CAPEX',           1500.0)
) AS v(kpi_code, raw_value)
JOIN public.kpi_definitions kd ON kd.code = v.kpi_code;

-- =========================================================================
-- CRH (USD) — fx_rate = 0.88496 (1/1.13)
-- Revenue: 35,600M | EBITDA: 7,200M | EBITDA_MARGIN: 20.2%
-- EBIT: 4,800M | NET_INCOME: 3,500M | NET_DEBT: 4,100M
-- NET_DEBT_EBITDA: 0.57x | CAPEX: 2,200M
-- =========================================================================
WITH crh AS (
  SELECT
    e.id  AS extraction_id,
    r.id  AS report_id,
    c.id  AS company_id
  FROM public.companies c
  JOIN public.reports r    ON r.company_id = c.id AND r.fiscal_year = 2024 AND r.report_type = 'annual'
  JOIN public.extractions e ON e.report_id = r.id
  WHERE c.ticker = 'CRH'
)
INSERT INTO public.kpi_values
  (extraction_id, report_id, company_id, kpi_definition_id,
   fiscal_year, raw_value, raw_currency, normalized_value, normalized_currency,
   fx_rate_used, fx_rate_type, confidence, needs_review)
SELECT
  h.extraction_id, h.report_id, h.company_id,
  kd.id,
  2024,
  v.raw_value,
  'USD',
  ROUND(v.raw_value * 0.88496, 4),
  'CHF',
  0.88496,
  'period_average',
  0.97,
  false
FROM crh h
CROSS JOIN (
  VALUES
    ('REVENUE',        35600.0),
    ('EBITDA',          7200.0),
    ('EBITDA_MARGIN',     20.2),
    ('EBIT',            4800.0),
    ('NET_INCOME',      3500.0),
    ('NET_DEBT',        4100.0),
    ('NET_DEBT_EBITDA',    0.57),
    ('CAPEX',           2200.0)
) AS v(kpi_code, raw_value)
JOIN public.kpi_definitions kd ON kd.code = v.kpi_code;

-- =========================================================================
-- CEMEX (USD) — fx_rate = 0.88496 (1/1.13)
-- Revenue: 15,300M | EBITDA: 3,200M | EBITDA_MARGIN: 20.9%
-- EBIT: 1,900M | NET_INCOME: 1,100M | NET_DEBT: 5,800M
-- NET_DEBT_EBITDA: 1.81x | CAPEX: 900M
-- =========================================================================
WITH cemex AS (
  SELECT
    e.id  AS extraction_id,
    r.id  AS report_id,
    c.id  AS company_id
  FROM public.companies c
  JOIN public.reports r    ON r.company_id = c.id AND r.fiscal_year = 2024 AND r.report_type = 'annual'
  JOIN public.extractions e ON e.report_id = r.id
  WHERE c.ticker = 'CX'
)
INSERT INTO public.kpi_values
  (extraction_id, report_id, company_id, kpi_definition_id,
   fiscal_year, raw_value, raw_currency, normalized_value, normalized_currency,
   fx_rate_used, fx_rate_type, confidence, needs_review)
SELECT
  h.extraction_id, h.report_id, h.company_id,
  kd.id,
  2024,
  v.raw_value,
  'USD',
  ROUND(v.raw_value * 0.88496, 4),
  'CHF',
  0.88496,
  'period_average',
  0.97,
  false
FROM cemex h
CROSS JOIN (
  VALUES
    ('REVENUE',        15300.0),
    ('EBITDA',          3200.0),
    ('EBITDA_MARGIN',     20.9),
    ('EBIT',            1900.0),
    ('NET_INCOME',      1100.0),
    ('NET_DEBT',        5800.0),
    ('NET_DEBT_EBITDA',    1.81),
    ('CAPEX',            900.0)
) AS v(kpi_code, raw_value)
JOIN public.kpi_definitions kd ON kd.code = v.kpi_code;

-- =========================================================================
-- BUZZI (EUR) — fx_rate = 0.96154 (1/1.04)
-- Revenue: 4,100M | EBITDA: 1,200M | EBITDA_MARGIN: 29.3%
-- EBIT: 900M | NET_INCOME: 700M | NET_DEBT: -200M (net cash)
-- NET_DEBT_EBITDA: -0.17x | CAPEX: 350M
-- =========================================================================
WITH buzzi AS (
  SELECT
    e.id  AS extraction_id,
    r.id  AS report_id,
    c.id  AS company_id
  FROM public.companies c
  JOIN public.reports r    ON r.company_id = c.id AND r.fiscal_year = 2024 AND r.report_type = 'annual'
  JOIN public.extractions e ON e.report_id = r.id
  WHERE c.ticker = 'BZU'
)
INSERT INTO public.kpi_values
  (extraction_id, report_id, company_id, kpi_definition_id,
   fiscal_year, raw_value, raw_currency, normalized_value, normalized_currency,
   fx_rate_used, fx_rate_type, confidence, needs_review)
SELECT
  h.extraction_id, h.report_id, h.company_id,
  kd.id,
  2024,
  v.raw_value,
  'EUR',
  ROUND(v.raw_value * 0.96154, 4),
  'CHF',
  0.96154,
  'period_average',
  0.97,
  false
FROM buzzi h
CROSS JOIN (
  VALUES
    ('REVENUE',         4100.0),
    ('EBITDA',          1200.0),
    ('EBITDA_MARGIN',     29.3),
    ('EBIT',             900.0),
    ('NET_INCOME',       700.0),
    ('NET_DEBT',        -200.0),
    ('NET_DEBT_EBITDA',   -0.17),
    ('CAPEX',            350.0)
) AS v(kpi_code, raw_value)
JOIN public.kpi_definitions kd ON kd.code = v.kpi_code;

-- =========================================================================
-- MARTIN MARIETTA (USD) — fx_rate = 0.88496 (1/1.13)
-- Revenue: 6,500M | EBITDA: 2,100M | EBITDA_MARGIN: 32.3%
-- EBIT: 1,700M | NET_INCOME: 1,200M | NET_DEBT: 3,800M
-- NET_DEBT_EBITDA: 1.81x | CAPEX: 650M
-- =========================================================================
WITH mlm AS (
  SELECT
    e.id  AS extraction_id,
    r.id  AS report_id,
    c.id  AS company_id
  FROM public.companies c
  JOIN public.reports r    ON r.company_id = c.id AND r.fiscal_year = 2024 AND r.report_type = 'annual'
  JOIN public.extractions e ON e.report_id = r.id
  WHERE c.ticker = 'MLM'
)
INSERT INTO public.kpi_values
  (extraction_id, report_id, company_id, kpi_definition_id,
   fiscal_year, raw_value, raw_currency, normalized_value, normalized_currency,
   fx_rate_used, fx_rate_type, confidence, needs_review)
SELECT
  h.extraction_id, h.report_id, h.company_id,
  kd.id,
  2024,
  v.raw_value,
  'USD',
  ROUND(v.raw_value * 0.88496, 4),
  'CHF',
  0.88496,
  'period_average',
  0.97,
  false
FROM mlm h
CROSS JOIN (
  VALUES
    ('REVENUE',         6500.0),
    ('EBITDA',          2100.0),
    ('EBITDA_MARGIN',     32.3),
    ('EBIT',            1700.0),
    ('NET_INCOME',      1200.0),
    ('NET_DEBT',        3800.0),
    ('NET_DEBT_EBITDA',    1.81),
    ('CAPEX',            650.0)
) AS v(kpi_code, raw_value)
JOIN public.kpi_definitions kd ON kd.code = v.kpi_code;
