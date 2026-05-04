-- =============================================================================
-- BenchmarkSignal — Seed Companies + Default Peer Group
-- Migration: 20260504100000_seed_companies
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Fix peer_groups RLS: allow all authenticated users to read default groups
-- (owner_id IS NULL for seeded default groups, original policy requires match)
-- ---------------------------------------------------------------------------
CREATE POLICY "peer_groups_select_default"
  ON public.peer_groups FOR SELECT
  TO authenticated
  USING (is_default = true);

-- Allow service_role full access to peer_groups (needed for seeding)
CREATE POLICY "peer_groups_all_service_role"
  ON public.peer_groups FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow service_role full access to peer_group_members (needed for seeding)
CREATE POLICY "peer_group_members_all_service_role"
  ON public.peer_group_members FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Allow service_role full access to companies (needed for seeding)
CREATE POLICY "companies_all_service_role"
  ON public.companies FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Seed: 16 companies (Holcim + 15 global building materials peers)
-- ---------------------------------------------------------------------------
INSERT INTO public.companies
  (name, ticker, exchange, isin, country, sector, reporting_currency, fiscal_year_end, website_url, is_active)
VALUES
  -- Holcim (primary company)
  ('Holcim Ltd',                           'HOLN',    'SIX',    'CH0012214059', 'CH', 'Building Materials', 'CHF', '12-31', 'https://www.holcim.com',                  true),

  -- Major global peers
  ('Heidelberg Materials',                 'HEI',     'XETRA',  'DE0006047004', 'DE', 'Building Materials', 'EUR', '12-31', 'https://www.heidelbergmaterials.com',     true),
  ('CRH plc',                              'CRH',     'NYSE',   'IE0001827041', 'IE', 'Building Materials', 'USD', '12-31', 'https://www.crh.com',                     true),
  ('Cemex SAB de CV',                      'CX',      'NYSE',   'MXP225611567', 'MX', 'Building Materials', 'USD', '12-31', 'https://www.cemex.com',                   true),
  ('Buzzi SpA',                            'BZU',     'BIT',    'IT0001347308', 'IT', 'Building Materials', 'EUR', '12-31', 'https://www.buzzi.com',                   true),
  ('Vicat SA',                             'VCT',     'EPA',    'FR0000074759', 'FR', 'Building Materials', 'EUR', '12-31', 'https://www.vicat.fr',                    true),
  ('UltraTech Cement',                     'UTCEM',   'NSE',    'INE481G01011', 'IN', 'Building Materials', 'INR', '03-31', 'https://www.ultratechcement.com',         true),
  ('Anhui Conch Cement',                   '0914',    'HKEX',   'CNE1000001W2', 'CN', 'Building Materials', 'CNY', '12-31', 'https://www.conch.cn',                    true),
  ('Martin Marietta Materials',            'MLM',     'NYSE',   'US5732841060', 'US', 'Building Materials', 'USD', '12-31', 'https://www.martinmarietta.com',          true),
  ('Vulcan Materials',                     'VMC',     'NYSE',   'US9291601097', 'US', 'Building Materials', 'USD', '12-31', 'https://www.vulcanmaterials.com',         true),
  ('Summit Materials',                     'SUM',     'NYSE',   'US86614U1007', 'US', 'Building Materials', 'USD', '12-31', 'https://www.summit-materials.com',        true),
  ('Eagle Materials',                      'EXP',     'NYSE',   'US26969P1084', 'US', 'Building Materials', 'USD', '03-31', 'https://www.eaglematerials.com',          true),
  ('Titan Cement International',           'TITC',    'ENXTBR', 'BE0974338700', 'BE', 'Building Materials', 'EUR', '12-31', 'https://www.titan-cement.com',            true),
  ('Taiheiyo Cement',                      '5233',    'TSE',    'JP3449020001', 'JP', 'Building Materials', 'JPY', '03-31', 'https://www.taiheiyo-cement.co.jp',       true),
  ('ACC Limited',                          'ACC',     'NSE',    'INE012A01025', 'IN', 'Building Materials', 'INR', '12-31', 'https://www.acclimited.com',              true),
  ('Dangote Cement',                       'DANGCEM', 'NGX',    'NGDANGCEM001', 'NG', 'Building Materials', 'NGN', '12-31', 'https://www.dangotecement.com',           true);

-- ---------------------------------------------------------------------------
-- Seed: Default peer group
-- owner_id is NULL — will be claimed/assigned by first admin
-- ---------------------------------------------------------------------------
INSERT INTO public.peer_groups (name, description, is_default, owner_id)
VALUES (
  'Building Materials Global 16',
  'Holcim and 15 global building materials peers',
  true,
  NULL
);

-- ---------------------------------------------------------------------------
-- Seed: Link all 16 companies to the default peer group
-- Holcim (HOLN) is is_primary = true
-- ---------------------------------------------------------------------------
INSERT INTO public.peer_group_members (peer_group_id, company_id, is_primary)
SELECT
  pg.id,
  c.id,
  (c.ticker = 'HOLN')
FROM public.peer_groups pg
CROSS JOIN public.companies c
WHERE pg.name = 'Building Materials Global 16';
