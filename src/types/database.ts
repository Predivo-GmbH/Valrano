// =============================================================================
// BenchmarkSignal — Database Types
// Manual types matching the initial schema migration.
// Supabase codegen will replace this file once the project is wired up.
// =============================================================================

// ---------------------------------------------------------------------------
// Enums / Union types
// ---------------------------------------------------------------------------

export type ReportType = 'annual' | 'quarterly' | 'half_year' | 'sustainability';

export type ReportStatus = 'pending' | 'processing' | 'extracted' | 'reviewed' | 'error';

export type ExtractionStatus = 'pending' | 'running' | 'completed' | 'failed';

export type KpiCategory = 'financial' | 'esg' | 'operational';

export type KpiUnitType = 'currency' | 'percentage' | 'ratio' | 'number' | 'tons' | 'intensity';

export type FxRateType = 'period_average' | 'point_in_time';

export type FxRateSource = 'daily_close' | 'period_average';

export type AlertType = 'new_report' | 'anomaly' | 'extraction_complete';

// ---------------------------------------------------------------------------
// Row types — shape of a row returned from Supabase
// ---------------------------------------------------------------------------

export interface Company {
  id: string;
  name: string;
  ticker: string | null;
  exchange: string | null;
  isin: string | null;
  country: string | null;
  sector: string | null;
  reporting_currency: string | null;
  fiscal_year_end: string | null;
  website_url: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PeerGroup {
  id: string;
  name: string;
  description: string | null;
  owner_id: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface PeerGroupMember {
  id: string;
  peer_group_id: string;
  company_id: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface Report {
  id: string;
  company_id: string;
  report_type: ReportType;
  fiscal_year: number;
  fiscal_quarter: number | null;
  title: string | null;
  publication_date: string | null;  // ISO date string (YYYY-MM-DD)
  source_url: string | null;
  pdf_storage_path: string | null;
  page_count: number | null;
  language: string | null;
  status: ReportStatus;
  created_at: string;
  updated_at: string;
}

export interface Extraction {
  id: string;
  report_id: string;
  model_used: string | null;
  started_at: string | null;
  completed_at: string | null;
  status: ExtractionStatus;
  error_message: string | null;
  total_kpis_extracted: number;
  avg_confidence: number | null;  // 0.000 – 1.000
  extraction_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface KpiDefinition {
  id: string;
  code: string;
  name: string;
  category: KpiCategory;
  unit_type: KpiUnitType;
  description: string | null;
  display_order: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KpiValue {
  id: string;
  extraction_id: string;
  report_id: string;
  company_id: string;
  kpi_definition_id: string;
  fiscal_year: number;
  fiscal_quarter: number | null;
  raw_value: number | null;
  raw_currency: string | null;
  raw_label: string | null;
  normalized_value: number | null;
  normalized_currency: string;
  fx_rate_used: number | null;
  fx_rate_type: FxRateType | null;
  confidence: number | null;  // 0.000 – 1.000
  needs_review: boolean;
  is_restated: boolean;
  source_page: number | null;
  source_text: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FxRate {
  id: string;
  base_currency: string;
  quote_currency: string;
  rate: number;
  rate_date: string;  // ISO date string (YYYY-MM-DD)
  rate_type: FxRateSource;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  user_id: string;
  alert_type: AlertType;
  peer_group_id: string | null;
  company_id: string | null;
  is_enabled: boolean;
  last_triggered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertHistory {
  id: string;
  alert_id: string;
  triggered_at: string;
  trigger_data: Record<string, unknown> | null;
  email_sent: boolean;
  email_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  full_name: string | null;
  company_name: string | null;
  job_title: string | null;
  default_peer_group_id: string | null;
  default_currency: string;
  email_alerts_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Insert types — omit server-generated fields for INSERT operations
// ---------------------------------------------------------------------------

export type CompanyInsert = Omit<Company, 'id' | 'created_at' | 'updated_at'>;

export type PeerGroupInsert = Omit<PeerGroup, 'id' | 'created_at' | 'updated_at'>;

export type PeerGroupMemberInsert = Omit<PeerGroupMember, 'id' | 'created_at' | 'updated_at'>;

export type ReportInsert = Omit<Report, 'id' | 'created_at' | 'updated_at'>;

export type ExtractionInsert = Omit<Extraction, 'id' | 'created_at' | 'updated_at'>;

export type KpiDefinitionInsert = Omit<KpiDefinition, 'id' | 'created_at' | 'updated_at'>;

export type KpiValueInsert = Omit<KpiValue, 'id' | 'created_at' | 'updated_at'>;

export type FxRateInsert = Omit<FxRate, 'id' | 'created_at' | 'updated_at'>;

export type AlertInsert = Omit<Alert, 'id' | 'created_at' | 'updated_at'>;

export type AlertHistoryInsert = Omit<AlertHistory, 'id' | 'created_at' | 'updated_at'>;

export type UserProfileInsert = Omit<UserProfile, 'created_at' | 'updated_at'>;

// ---------------------------------------------------------------------------
// Update types — all fields optional except id
// ---------------------------------------------------------------------------

export type CompanyUpdate = Partial<CompanyInsert>;
export type PeerGroupUpdate = Partial<PeerGroupInsert>;
export type PeerGroupMemberUpdate = Partial<PeerGroupMemberInsert>;
export type ReportUpdate = Partial<ReportInsert>;
export type ExtractionUpdate = Partial<ExtractionInsert>;
export type KpiDefinitionUpdate = Partial<KpiDefinitionInsert>;
export type KpiValueUpdate = Partial<KpiValueInsert>;
export type FxRateUpdate = Partial<FxRateInsert>;
export type AlertUpdate = Partial<AlertInsert>;
export type AlertHistoryUpdate = Partial<AlertHistoryInsert>;
export type UserProfileUpdate = Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>;

// ---------------------------------------------------------------------------
// Supabase Database shape (for createClient<Database> generic)
// ---------------------------------------------------------------------------

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: Company;
        Insert: CompanyInsert;
        Update: CompanyUpdate;
      };
      peer_groups: {
        Row: PeerGroup;
        Insert: PeerGroupInsert;
        Update: PeerGroupUpdate;
      };
      peer_group_members: {
        Row: PeerGroupMember;
        Insert: PeerGroupMemberInsert;
        Update: PeerGroupMemberUpdate;
      };
      reports: {
        Row: Report;
        Insert: ReportInsert;
        Update: ReportUpdate;
      };
      extractions: {
        Row: Extraction;
        Insert: ExtractionInsert;
        Update: ExtractionUpdate;
      };
      kpi_definitions: {
        Row: KpiDefinition;
        Insert: KpiDefinitionInsert;
        Update: KpiDefinitionUpdate;
      };
      kpi_values: {
        Row: KpiValue;
        Insert: KpiValueInsert;
        Update: KpiValueUpdate;
      };
      fx_rates: {
        Row: FxRate;
        Insert: FxRateInsert;
        Update: FxRateUpdate;
      };
      alerts: {
        Row: Alert;
        Insert: AlertInsert;
        Update: AlertUpdate;
      };
      alert_history: {
        Row: AlertHistory;
        Insert: AlertHistoryInsert;
        Update: AlertHistoryUpdate;
      };
      user_profiles: {
        Row: UserProfile;
        Insert: UserProfileInsert;
        Update: UserProfileUpdate;
      };
    };
    Enums: {
      report_type: ReportType;
      report_status: ReportStatus;
      extraction_status: ExtractionStatus;
      kpi_category: KpiCategory;
      kpi_unit_type: KpiUnitType;
      fx_rate_type: FxRateType;
      alert_type: AlertType;
    };
  };
}
