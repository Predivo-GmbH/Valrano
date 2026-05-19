/**
 * Realistic test fixtures for integration tests.
 * These represent actual data shapes returned by Supabase.
 */
import type {
  Company,
  PeerGroup,
  PeerGroupMember,
  KpiDefinition,
  KpiValue,
  SubscriptionTier,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const testUser = {
  id: 'user-001-test',
  email: 'test@valrano.com',
  user_metadata: { onboarding_dismissed: false },
  app_metadata: {},
  aud: 'authenticated',
  role: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
}

export const testUserAuthenticated = {
  id: testUser.id,
  email: testUser.email,
  user_metadata: { onboarding_dismissed: true },
  app_metadata: {},
  aud: 'authenticated',
  role: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
}

// ---------------------------------------------------------------------------
// Companies
// ---------------------------------------------------------------------------

export const companies: Company[] = [
  {
    id: 'company-nestlé',
    name: 'Nestlé S.A.',
    ticker: 'NESN',
    exchange: 'SIX',
    isin: 'CH0038863350',
    country: 'CHE',
    sector: 'Consumer Staples',
    reporting_currency: 'CHF',
    fiscal_year_end: '12-31',
    website_url: 'https://www.nestle.com',
    ir_page_url: 'https://www.nestle.com/investors',
    typical_publication_pattern: null,
    logo_url: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'company-roche',
    name: 'Roche Holding AG',
    ticker: 'ROG',
    exchange: 'SIX',
    isin: 'CH0012032048',
    country: 'CHE',
    sector: 'Healthcare',
    reporting_currency: 'CHF',
    fiscal_year_end: '12-31',
    website_url: 'https://www.roche.com',
    ir_page_url: 'https://www.roche.com/investors',
    typical_publication_pattern: null,
    logo_url: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'company-novartis',
    name: 'Novartis AG',
    ticker: 'NOVN',
    exchange: 'SIX',
    isin: 'CH0012005267',
    country: 'CHE',
    sector: 'Healthcare',
    reporting_currency: 'USD',
    fiscal_year_end: '12-31',
    website_url: 'https://www.novartis.com',
    ir_page_url: 'https://www.novartis.com/investors',
    typical_publication_pattern: null,
    logo_url: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'company-user',
    name: 'TestCo AG',
    ticker: null,
    exchange: null,
    isin: null,
    country: 'CHE',
    sector: 'Technology',
    reporting_currency: 'CHF',
    fiscal_year_end: '12-31',
    website_url: null,
    ir_page_url: null,
    typical_publication_pattern: null,
    logo_url: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
]

// ---------------------------------------------------------------------------
// Peer Groups & Members
// ---------------------------------------------------------------------------

export const peerGroup: PeerGroup = {
  id: 'pg-default',
  name: 'Default',
  description: 'Auto-created during onboarding',
  owner_id: testUser.id,
  workspace_id: null,
  is_default: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

export const peerGroupMembers: PeerGroupMember[] = [
  {
    id: 'pgm-1',
    peer_group_id: peerGroup.id,
    company_id: 'company-nestlé',
    is_primary: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'pgm-2',
    peer_group_id: peerGroup.id,
    company_id: 'company-roche',
    is_primary: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'pgm-3',
    peer_group_id: peerGroup.id,
    company_id: 'company-novartis',
    is_primary: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
]

export const peerGroupWithMembers = {
  ...peerGroup,
  peer_group_members: peerGroupMembers.map(m => ({
    ...m,
    companies: companies.find(c => c.id === m.company_id)!,
  })),
}

// The visible company IDs that visible_company_ids() RPC would return
export const visibleCompanyIds = peerGroupMembers.map(m => m.company_id)

// ---------------------------------------------------------------------------
// KPI Definitions
// ---------------------------------------------------------------------------

export const kpiDefinitions: KpiDefinition[] = [
  {
    id: 'kpi-revenue',
    code: 'REVENUE',
    name: 'Revenue',
    category: 'financial',
    unit_type: 'currency',
    display_order: 1,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'kpi-ebitda-margin',
    code: 'EBITDA_MARGIN',
    name: 'EBITDA Margin',
    category: 'financial',
    unit_type: 'percentage',
    display_order: 2,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
]

// ---------------------------------------------------------------------------
// KPI Values
// ---------------------------------------------------------------------------

export const kpiValues: KpiValue[] = [
  {
    id: 'kv-1',
    company_id: 'company-nestlé',
    kpi_definition_id: 'kpi-revenue',
    fiscal_year: 2025,
    raw_value: 94400000000,
    normalized_value: 94400000000,
    currency: 'CHF',
    confidence: 0.95,
    source: 'extraction',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'kv-2',
    company_id: 'company-roche',
    kpi_definition_id: 'kpi-revenue',
    fiscal_year: 2025,
    raw_value: 61500000000,
    normalized_value: 61500000000,
    currency: 'CHF',
    confidence: 0.92,
    source: 'extraction',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
]

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

export const subscription = {
  id: 'sub-1',
  user_id: testUser.id,
  tier: 'professional' as SubscriptionTier,
  status: 'active',
  stripe_customer_id: 'cus_test',
  stripe_subscription_id: 'sub_test',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

// ---------------------------------------------------------------------------
// My Companies (user's own company)
// ---------------------------------------------------------------------------

export const myCompany = {
  id: 'mc-1',
  user_id: testUser.id,
  company_id: 'company-user',
  name: 'TestCo AG',
  is_primary: true,
  sector: 'Technology',
  country: 'CHE',
  reporting_currency: 'CHF',
  headcount: null,
  founded_year: null,
  website_url: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}
