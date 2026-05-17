-- =============================================================================
-- Valrano — Seed FX Rates (2024 + 2025)
-- Migration: 20260504100001_seed_fx_rates
-- Base currency: CHF (SNB approximate annual averages)
-- =============================================================================

INSERT INTO public.fx_rates
  (base_currency, quote_currency, rate, rate_date, rate_type, source)
VALUES

  -- -------------------------------------------------------------------------
  -- 2024 rates (year-end date used as reference for annual period)
  -- -------------------------------------------------------------------------

  -- CHF → EUR
  ('CHF', 'EUR', 1.04,    '2024-12-31', 'period_average', 'SNB'),
  ('CHF', 'EUR', 1.05,    '2024-12-31', 'daily_close',    'SNB'),

  -- CHF → USD
  ('CHF', 'USD', 1.13,    '2024-12-31', 'period_average', 'SNB'),
  ('CHF', 'USD', 1.12,    '2024-12-31', 'daily_close',    'SNB'),

  -- CHF → GBP
  ('CHF', 'GBP', 0.89,    '2024-12-31', 'period_average', 'SNB'),
  ('CHF', 'GBP', 0.88,    '2024-12-31', 'daily_close',    'SNB'),

  -- CHF → INR
  ('CHF', 'INR', 94.5,    '2024-12-31', 'period_average', 'SNB'),
  ('CHF', 'INR', 94.0,    '2024-12-31', 'daily_close',    'SNB'),

  -- CHF → CNY
  ('CHF', 'CNY', 8.20,    '2024-12-31', 'period_average', 'SNB'),
  ('CHF', 'CNY', 8.15,    '2024-12-31', 'daily_close',    'SNB'),

  -- CHF → JPY
  ('CHF', 'JPY', 171.0,   '2024-12-31', 'period_average', 'SNB'),
  ('CHF', 'JPY', 170.5,   '2024-12-31', 'daily_close',    'SNB'),

  -- CHF → NGN
  ('CHF', 'NGN', 1650.0,  '2024-12-31', 'period_average', 'SNB'),
  ('CHF', 'NGN', 1700.0,  '2024-12-31', 'daily_close',    'SNB'),

  -- CHF → MXN
  ('CHF', 'MXN', 19.5,    '2024-12-31', 'period_average', 'SNB'),
  ('CHF', 'MXN', 19.8,    '2024-12-31', 'daily_close',    'SNB'),

  -- -------------------------------------------------------------------------
  -- 2025 rates (year-end date used as reference for annual period)
  -- -------------------------------------------------------------------------

  -- CHF → EUR
  ('CHF', 'EUR', 1.03,    '2025-12-31', 'period_average', 'SNB'),
  ('CHF', 'EUR', 1.04,    '2025-12-31', 'daily_close',    'SNB'),

  -- CHF → USD
  ('CHF', 'USD', 1.14,    '2025-12-31', 'period_average', 'SNB'),
  ('CHF', 'USD', 1.13,    '2025-12-31', 'daily_close',    'SNB'),

  -- CHF → GBP
  ('CHF', 'GBP', 0.90,    '2025-12-31', 'period_average', 'SNB'),
  ('CHF', 'GBP', 0.89,    '2025-12-31', 'daily_close',    'SNB'),

  -- CHF → INR
  ('CHF', 'INR', 95.0,    '2025-12-31', 'period_average', 'SNB'),
  ('CHF', 'INR', 95.5,    '2025-12-31', 'daily_close',    'SNB'),

  -- CHF → CNY
  ('CHF', 'CNY', 8.30,    '2025-12-31', 'period_average', 'SNB'),
  ('CHF', 'CNY', 8.25,    '2025-12-31', 'daily_close',    'SNB'),

  -- CHF → JPY
  ('CHF', 'JPY', 175.0,   '2025-12-31', 'period_average', 'SNB'),
  ('CHF', 'JPY', 174.0,   '2025-12-31', 'daily_close',    'SNB'),

  -- CHF → NGN
  ('CHF', 'NGN', 1750.0,  '2025-12-31', 'period_average', 'SNB'),
  ('CHF', 'NGN', 1800.0,  '2025-12-31', 'daily_close',    'SNB'),

  -- CHF → MXN
  ('CHF', 'MXN', 20.0,    '2025-12-31', 'period_average', 'SNB'),
  ('CHF', 'MXN', 20.3,    '2025-12-31', 'daily_close',    'SNB');
