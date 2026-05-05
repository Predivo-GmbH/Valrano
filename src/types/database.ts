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

export type SubscriptionTier = 'starter' | 'professional' | 'enterprise';

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'incomplete' | 'trialing';

export type NarrativeStyle = 'executive_brief' | 'detailed_analysis' | 'board_presentation';

export type DocumentStatus = 'draft' | 'in_review' | 'approved' | 'delivered' | 'rejected';

export type DocumentGeneratedBy = 'system' | 'manual';

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
  ir_page_url: string | null;
  typical_publication_pattern: string | null;
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

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
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

export interface BenchmarkRule {
  id: string;
  customer_company_id: string;
  name: string;
  description: string | null;
  peer_group_id: string | null;
  kpi_selection: KpiSelectionItem[];
  report_template: string | null;
  narrative_style: NarrativeStyle;
  auto_generate: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface KpiSelectionItem {
  kpi_definition_id: string;
  code: string;
  weight: number;
  threshold_pct: number | null;
}

export interface BenchmarkDocument {
  id: string;
  benchmark_rule_id: string;
  trigger_report_id: string | null;
  trigger_company_id: string | null;
  customer_company_id: string;
  fiscal_year: number;
  title: string;
  status: DocumentStatus;
  content_json: BenchmarkContentJson | null;
  content_html: string | null;
  pdf_storage_path: string | null;
  generated_at: string | null;
  generated_by: DocumentGeneratedBy;
  ai_model_used: string | null;
  created_at: string;
  updated_at: string;
}

export interface BenchmarkContentJson {
  executive_summary: string;
  key_findings: string[];
  competitive_position: 'improved' | 'stable' | 'declined';
  sections: BenchmarkSection[];
  risk_flags: string[];
  data_quality: {
    total_kpis_compared: number;
    high_confidence_pct: number;
    fx_rates_used: string[];
  };
}

export interface BenchmarkSection {
  title: string;
  narrative: string;
  kpi_comparisons: BenchmarkKpiComparison[];
}

export interface BenchmarkKpiComparison {
  kpi_code: string;
  kpi_name: string;
  trigger_company_value: number | null;
  customer_company_value: number | null;
  peer_median: number | null;
  peer_rank: number | null;
  peer_count: number;
  yoy_change_pct: number | null;
  assessment: string;
  signal: 'risk' | 'neutral' | 'advantage';
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

export type SubscriptionInsert = Omit<Subscription, 'id' | 'created_at' | 'updated_at'>;

export type UserProfileInsert = Omit<UserProfile, 'created_at' | 'updated_at'>;

export type BenchmarkRuleInsert = Omit<BenchmarkRule, 'id' | 'created_at' | 'updated_at'>;

export type BenchmarkDocumentInsert = Omit<BenchmarkDocument, 'id' | 'created_at' | 'updated_at'>;

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
export type SubscriptionUpdate = Partial<SubscriptionInsert>;
export type UserProfileUpdate = Partial<Omit<UserProfile, 'id' | 'created_at' | 'updated_at'>>;
export type BenchmarkRuleUpdate = Partial<BenchmarkRuleInsert>;
export type BenchmarkDocumentUpdate = Partial<BenchmarkDocumentInsert>;

// ---------------------------------------------------------------------------
// Supabase Database shape (for createClient<Database> generic)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Block 1 types — Publication Event Monitoring
// ---------------------------------------------------------------------------

export type PublicationEventStatus = 'scheduled' | 'due_today' | 'overdue' | 'detected' | 'ingested' | 'benchmark_ready' | 'cancelled';
export type CheckMethod = 'head_request' | 'html_scrape' | 'ai_parse';
export type CheckResult = 'not_found' | 'found' | 'error';

export interface PublicationEvent {
  id: string;
  company_id: string;
  report_type: ReportType;
  fiscal_year: number;
  fiscal_quarter: number | null;
  expected_date: string;
  expected_time: string | null;
  actual_detected_at: string | null;
  ir_page_url: string | null;
  direct_pdf_url: string | null;
  status: PublicationEventStatus;
  monitoring_start_hours_before: number;
  monitoring_interval_minutes: number;
  notify_on_detection: boolean;
  notes: string | null;
  report_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface MonitorCheck {
  id: string;
  publication_event_id: string;
  checked_at: string;
  check_method: CheckMethod | null;
  result: CheckResult;
  found_url: string | null;
  error_message: string | null;
  response_time_ms: number | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Block 4 types — Approval Chains
// ---------------------------------------------------------------------------

export type ApprovalRole = 'analyst' | 'manager' | 'director' | 'c_suite';
export type ApprovalStepStatus = 'pending' | 'in_review' | 'approved' | 'changes_requested' | 'skipped';

export interface ApprovalChainStep {
  step_number: number;
  role: ApprovalRole;
  user_id: string | null;
  is_optional: boolean;
}

export interface ApprovalChain {
  id: string;
  benchmark_rule_id: string | null;
  name: string;
  steps: ApprovalChainStep[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalStep {
  id: string;
  document_id: string;
  chain_id: string;
  step_number: number;
  assignee_id: string | null;
  role: ApprovalRole | null;
  status: ApprovalStepStatus;
  comments: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalComment {
  id: string;
  step_id: string;
  author_id: string | null;
  comment: string;
  attachment_path: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Block 5 types — Notifications
// ---------------------------------------------------------------------------

export type NotificationType = 'report_detected' | 'document_generated' | 'approval_assigned' | 'approval_action' | 'document_delivered';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  related_document_id: string | null;
  related_report_id: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Insert types — Block 1, 4, 5
// ---------------------------------------------------------------------------

export type PublicationEventInsert = Omit<PublicationEvent, 'id' | 'created_at' | 'updated_at'>;
export type MonitorCheckInsert = Omit<MonitorCheck, 'id' | 'created_at'>;
export type ApprovalChainInsert = Omit<ApprovalChain, 'id' | 'created_at' | 'updated_at'>;
export type ApprovalStepInsert = Omit<ApprovalStep, 'id' | 'created_at' | 'updated_at'>;
export type ApprovalCommentInsert = Omit<ApprovalComment, 'id' | 'created_at'>;
export type NotificationInsert = Omit<Notification, 'id' | 'created_at'>;

// ---------------------------------------------------------------------------
// Update types — Block 1, 4, 5
// ---------------------------------------------------------------------------

export type PublicationEventUpdate = Partial<PublicationEventInsert>;
export type ApprovalChainUpdate = Partial<ApprovalChainInsert>;
export type ApprovalStepUpdate = Partial<ApprovalStepInsert>;
export type NotificationUpdate = Partial<NotificationInsert>;

// ---------------------------------------------------------------------------
// Block A types — Self-Benchmarking (Sprint 7)
// ---------------------------------------------------------------------------

export interface MyCompany {
  id: string;
  user_id: string;
  name: string;
  sector: string | null;
  country: string | null;
  reporting_currency: string | null;
  headcount: number | null;
  founded_year: number | null;
  website_url: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface MyCompanyKpi {
  id: string;
  my_company_id: string;
  kpi_definition_id: string;
  fiscal_year: number;
  value: number;
  currency: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SelfBenchmark {
  id: string;
  my_company_id: string;
  peer_group_id: string | null;
  fiscal_year: number;
  results_json: Record<string, unknown>;
  ai_narrative: string | null;
  generated_at: string;
  created_at: string;
  updated_at: string;
}

export type MyCompanyInsert = Omit<MyCompany, 'id' | 'created_at' | 'updated_at'>;
export type MyCompanyKpiInsert = Omit<MyCompanyKpi, 'id' | 'created_at' | 'updated_at'>;
export type SelfBenchmarkInsert = Omit<SelfBenchmark, 'id' | 'created_at' | 'updated_at'>;

export type MyCompanyUpdate = Partial<MyCompanyInsert>;
export type MyCompanyKpiUpdate = Partial<MyCompanyKpiInsert>;

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
      subscriptions: {
        Row: Subscription;
        Insert: SubscriptionInsert;
        Update: SubscriptionUpdate;
      };
      user_profiles: {
        Row: UserProfile;
        Insert: UserProfileInsert;
        Update: UserProfileUpdate;
      };
      benchmark_rules: {
        Row: BenchmarkRule;
        Insert: BenchmarkRuleInsert;
        Update: BenchmarkRuleUpdate;
      };
      benchmark_documents: {
        Row: BenchmarkDocument;
        Insert: BenchmarkDocumentInsert;
        Update: BenchmarkDocumentUpdate;
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
      narrative_style: NarrativeStyle;
      document_status: DocumentStatus;
      document_generated_by: DocumentGeneratedBy;
    };
  };
}
