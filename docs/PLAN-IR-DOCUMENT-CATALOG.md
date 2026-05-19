# IR Document Catalog & Automated Download — Implementation Plan

**Created:** 2026-05-19
**Status:** PLAN (not yet implemented)
**Author:** Claude Opus 4.6

---

## Problem Statement

Valrano's current pipeline only detects ONE PDF per IR page check (regex match on `check-publication`), only triggers from calendar events, and provides no visibility into what documents a peer has available on their IR page. Users cannot browse, compare, or selectively download historical documents.

## Scope (Roger-Approved)

### Pillar 1 — Calendar-Driven Automated Download (Enhancement)
Improve the existing `check-publication` → `pipeline-orchestrator` flow so that when a calendar event triggers, the system reliably finds and downloads the correct document from the IR page. Better IR page discovery, smarter document matching, more robust PDF detection.

### Pillar 2 — IR Document Catalog (New Feature)
One-time scrape of each peer's IR page when the peer is added. Build a browsable catalog of all available documents (title, type, date, URL, file size) inside Valrano. User sees what's available. User clicks "Download & Analyze" on any document — system downloads, extracts KPIs, normalizes. No automatic mass-download.

### Pillar 3 — Manual Upload Stays Default for Historicals
Historical backfill is the user's choice. They can upload old reports manually OR pick from the catalog. The system never auto-downloads everything.

### Explicitly OUT OF SCOPE
- Periodic re-scraping of IR pages (Pillar 1 calendar monitoring handles new documents)
- Automatic mass-download of all catalog items
- Automatic historical backfill

---

## Current State Analysis

### What Exists
| Component | Status | Gaps |
|-----------|--------|------|
| `suggest-ir-url` | Works | Building-materials prompt hardcoded; Firecrawl map limited to 200 URLs |
| `check-publication` | Works | Only finds FIRST matching PDF via 5 regex patterns; no document type classification; no metadata extraction |
| `download-report` | Works | No file size limits; no Content-Type validation |
| `pipeline-orchestrator` | Works | Sequential chain (download → extract → normalize → benchmark); no partial retry |
| `monitor-publications` | Works | Time-precise cron; well-designed monitoring windows |
| `publication_events` table | Works | 1:1 with (company, report_type, FY, FQ); no catalog linkage |
| `reports` table | Works | Stores downloaded reports; no link to catalog source |
| IR page URL storage | Works | `companies.ir_page_url` populated by `suggest-ir-url` or manual entry |

### What's Missing
1. **No `ir_catalog` table** — nowhere to store discovered documents
2. **No catalog scraping edge function** — no way to discover all documents on an IR page
3. **No catalog UI** — no page to browse available documents per peer
4. **No selective download** — can't pick a specific document from catalog to analyze
5. **`check-publication` is too simple** — regex-only, finds first match, no AI classification
6. **No document-type classification** — can't distinguish annual report from presentation from press release
7. **No link between catalog items and calendar events** — when calendar triggers, it doesn't know which catalog item matches

---

## Architecture

### New Database Table: `ir_catalog_items`

```sql
CREATE TABLE ir_catalog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

  -- Document metadata (from scraping)
  title text,                          -- "Annual Report 2025" or link text
  document_url text NOT NULL,          -- Direct URL to the PDF/document
  document_type text,                  -- 'annual_report' | 'quarterly_report' | 'half_year_report' | 'sustainability_report' | 'investor_presentation' | 'press_release' | 'financial_statements' | 'other'
  fiscal_year integer,                 -- Extracted from title/URL/context (nullable)
  fiscal_quarter integer,              -- For quarterly reports (nullable)
  language text,                       -- 'en', 'de', 'fr', etc.
  file_format text,                    -- 'pdf', 'xlsx', 'pptx', etc. (from URL extension or Content-Type)
  file_size_bytes bigint,              -- From HEAD request (nullable)

  -- Classification metadata
  ai_classified boolean DEFAULT false, -- Was document_type set by AI vs. regex?
  classification_confidence numeric(4,3), -- 0.000-1.000

  -- Lifecycle
  detected_at timestamptz DEFAULT now(),   -- When scraper found it
  report_id uuid REFERENCES reports(id) ON DELETE SET NULL,  -- Set when user downloads & analyzes
  is_downloaded boolean DEFAULT false,     -- Has user triggered download?

  -- Deduplication
  url_hash text GENERATED ALWAYS AS (encode(sha256(document_url::bytea), 'hex')) STORED,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE (company_id, url_hash)  -- Prevent duplicate URLs per company
);

-- Indexes
CREATE INDEX idx_ir_catalog_company ON ir_catalog_items(company_id);
CREATE INDEX idx_ir_catalog_type ON ir_catalog_items(document_type);
CREATE INDEX idx_ir_catalog_year ON ir_catalog_items(fiscal_year DESC);
CREATE INDEX idx_ir_catalog_downloaded ON ir_catalog_items(is_downloaded) WHERE is_downloaded = false;

-- RLS: scoped to user's visible companies
ALTER TABLE ir_catalog_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view catalog for visible companies"
  ON ir_catalog_items FOR SELECT TO authenticated
  USING (company_id IN (SELECT unnest(visible_company_ids())));

CREATE POLICY "Service role full access"
  ON ir_catalog_items FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Updated_at trigger (reuse existing pattern)
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON ir_catalog_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### New Edge Function: `scan-ir-page`

**Purpose:** One-time deep scrape of a company's IR page. Discovers all linked documents, classifies them by type, extracts metadata, and stores in `ir_catalog_items`.

**Trigger:** Called once when:
- A peer is added and has an `ir_page_url` set
- User manually clicks "Scan IR Page" on a peer's profile
- `suggest-ir-url` successfully resolves an IR URL (auto-trigger after URL stored)

**NOT called periodically.** New documents are caught by `check-publication` via calendar events.

**Flow:**
```
1. Input: { company_id }
2. Load company → verify ir_page_url exists
3. Firecrawl /v1/scrape on ir_page_url:
   → Extract full page markdown + all links
   → Follow pagination if IR page has multi-page document listings
   (Alternative: if Firecrawl unavailable, fall back to fetch + cheerio-like regex parsing)
4. Extract all document links:
   → Filter for downloadable files: .pdf, .xlsx, .pptx, .docx
   → Also include links with keywords: report, bericht, presentation, financial, results
   → Resolve relative URLs to absolute
   → Deduplicate
5. For each document link (batch, max 50):
   → HEAD request to get Content-Type + Content-Length (file_size_bytes)
   → Extract title from: link text > URL filename > page context
   → Extract file_format from: Content-Type header > URL extension
6. AI Classification (single Gemini 2.5 Flash call for ALL documents):
   → Input: list of { url, title, surrounding_text }
   → Output: for each document → { document_type, fiscal_year, fiscal_quarter, language, confidence }
   → Schema: JSON array matching input order
   → Prompt: "Classify these IR documents by type and extract fiscal period"
7. Upsert into ir_catalog_items:
   → ON CONFLICT (company_id, url_hash) DO UPDATE SET title, document_type, etc.
   → This makes re-scanning safe (updates metadata, doesn't duplicate)
8. Return: { success, items_found, items_new, items_updated }
```

**Cost estimate:** ~$0.02 per scan (1 Firecrawl scrape credit + 1 Gemini Flash call for classification). One-time per peer.

### Enhanced `check-publication` (Pillar 1 Improvement)

**Current problem:** Uses 5 regex patterns, returns first match. Can't distinguish annual from quarterly. Doesn't use the catalog.

**Enhancement:**
```
Current flow:
  1. Fetch IR page HTML
  2. Regex match → first PDF URL
  3. Create report

Enhanced flow:
  1. Fetch IR page HTML
  2. Extract ALL PDF links (not just first match)
  3. Check against ir_catalog_items:
     → Any NEW URLs not in catalog? → Insert them (incremental catalog update)
  4. Match against calendar event criteria:
     → event.report_type matches catalog item document_type
     → event.fiscal_year matches catalog item fiscal_year
     → event.fiscal_quarter matches catalog item fiscal_quarter (if quarterly)
  5. If no exact match: use Gemini Flash to classify the new PDFs and match
  6. If match found → proceed with download (existing flow)
  7. If no match → not_found (existing flow)
```

**Key improvement:** When calendar monitoring finds new documents, they're automatically added to the catalog as a side effect. This means the catalog stays current WITHOUT periodic scanning.

### New Edge Function: `download-catalog-item`

**Purpose:** User clicks "Download & Analyze" on a catalog item. Downloads the PDF and runs the full pipeline.

**Flow:**
```
1. Input: { catalog_item_id }
2. Load ir_catalog_items row → verify not already downloaded
3. Create reports row:
   → company_id from catalog item
   → report_type from catalog item document_type (mapped)
   → fiscal_year, fiscal_quarter from catalog item
   → source_url = catalog item document_url
   → status = 'pending'
4. Update catalog item:
   → is_downloaded = true
   → report_id = new report ID
5. Call pipeline-orchestrator:
   → { report_id, user_id }
   → Chains: download → extract-kpis → normalize-kpis
   → (Skip generate-benchmark — user can trigger manually)
6. Return: { success, report_id }
```

**Cost estimate:** Same as existing pipeline (~$0.09 for extract-kpis + $0.01 normalize). User-initiated only.

### Document Type Mapping

```typescript
// Catalog document_type → report_type mapping
const DOCUMENT_TYPE_TO_REPORT_TYPE: Record<string, ReportType | null> = {
  'annual_report': 'annual',
  'quarterly_report': 'quarterly',
  'half_year_report': 'half_year',
  'sustainability_report': 'sustainability',
  'investor_presentation': null,  // Not a report — catalog-only
  'press_release': null,          // Not a report — catalog-only
  'financial_statements': 'annual', // Usually annual financial statements
  'other': null,                  // Not downloadable for analysis
}
```

Items with `null` mapping are visible in the catalog but the "Download & Analyze" button is disabled (or shows "View Only" with external link).

---

## Frontend Changes

### New Component: `IrCatalogPanel`

**Location:** Shown on the Company Profile page (`/companies/:id`) as a new section below existing content.

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ IR Document Catalog                    [Scan IR Page]│
│ 12 documents found on holcim.com/investors           │
│                                                      │
│ Filter: [All ▾] [2025 ▾] [PDF only ▾]              │
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 📄 Annual Report 2025                    PDF     │ │
│ │    Annual Report · FY 2025 · 4.2 MB · EN        │ │
│ │    [Download & Analyze]  [View ↗]               │ │
│ │    ✅ Analyzed — 13 KPIs extracted              │ │
│ ├──────────────────────────────────────────────────┤ │
│ │ 📄 Q4 2025 Results                      PDF     │ │
│ │    Quarterly Report · Q4 2025 · 1.8 MB · EN     │ │
│ │    [Download & Analyze]  [View ↗]               │ │
│ ├──────────────────────────────────────────────────┤ │
│ │ 📄 Sustainability Report 2025            PDF     │ │
│ │    Sustainability · FY 2025 · 8.1 MB · EN       │ │
│ │    [Download & Analyze]  [View ↗]               │ │
│ ├──────────────────────────────────────────────────┤ │
│ │ 📊 Investor Presentation Q3 2025        PDF     │ │
│ │    Presentation · Q3 2025 · 2.4 MB · EN         │ │
│ │    [View ↗]                                     │ │
│ └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**States:**
- **No IR URL:** "No IR page URL set. [Suggest IR URL] or [Enter manually]"
- **IR URL set, no scan yet:** "IR page found. [Scan for documents]"
- **Scanning:** Progress indicator with `useSmoothProgress`
- **Scan complete:** Document list with filters
- **Item downloaded:** Shows green check + KPI count extracted

**Filters:**
- Document type dropdown (All / Annual / Quarterly / Half-Year / Sustainability / Presentations / Other)
- Fiscal year dropdown (populated from scan results)
- Format filter (PDF / XLSX / All)

### New Hook: `useIrCatalog`

```typescript
// Queries
useIrCatalogItems(companyId)        // List all catalog items for a company
useIrCatalogSummary(companyId)      // Count by type, latest scan date

// Mutations
useScanIrPage()                     // Trigger scan-ir-page edge function
useDownloadCatalogItem()            // Trigger download-catalog-item edge function
```

### Modified Components

1. **PeersPage** — Add catalog badge on peer cards:
   - "12 IR docs" count badge
   - "Not scanned" indicator if no catalog items exist

2. **CompanyProfilePage** — Add `IrCatalogPanel` section

3. **CalendarPage** — When creating an event, if catalog items exist for the company:
   - Show "Matching documents found" hint
   - Link to catalog for that fiscal year/type

4. **OnboardingWizard** — After peer is added + IR URL resolved:
   - Auto-trigger `scan-ir-page` (silent, background)
   - User continues onboarding while scan runs

---

## Integration: Calendar Event ↔ Catalog

When `check-publication` detects a new document during calendar monitoring:

1. The new URL is upserted into `ir_catalog_items` (incremental catalog update)
2. The `ir_catalog_items.report_id` is set to the new report
3. The `ir_catalog_items.is_downloaded` is set to `true`
4. The catalog UI shows "Analyzed" status for this item

This means the catalog stays current as a side effect of normal calendar monitoring — no need for periodic re-scanning.

---

## Implementation Phases

### Phase 1 — Database + Scan Edge Function (Backend)
**Effort:** ~2-3 hours
1. Create migration for `ir_catalog_items` table + RLS policies
2. Build `scan-ir-page` edge function (Firecrawl scrape + Gemini classification)
3. Build `download-catalog-item` edge function (creates report + triggers pipeline)
4. Deploy both edge functions
5. Test with Holcim IR page (known good: https://www.holcim.com/investors/reports-and-publications)

### Phase 2 — Frontend Catalog UI
**Effort:** ~2-3 hours
1. Add `useIrCatalog` hook (queries + mutations)
2. Build `IrCatalogPanel` component
3. Integrate into CompanyProfilePage
4. Add filters (type, year, format)
5. Wire "Download & Analyze" button to `download-catalog-item`
6. Wire "Scan IR Page" button to `scan-ir-page`

### Phase 3 — Enhanced check-publication (Pillar 1)
**Effort:** ~1-2 hours
1. Modify `check-publication` to extract ALL PDF links (not just first)
2. Upsert new URLs into `ir_catalog_items` (incremental update)
3. Match calendar event against catalog items by type + fiscal year
4. Link detected catalog item to report on detection

### Phase 4 — Auto-Scan on Peer Addition
**Effort:** ~1 hour
1. After `suggest-ir-url` stores URL → auto-trigger `scan-ir-page`
2. After manual IR URL entry on CompanyProfilePage → auto-trigger `scan-ir-page`
3. OnboardingWizard: trigger scan after peer setup complete
4. PeersPage: add catalog badge + "Not scanned" indicator

---

## Cost Analysis

| Action | Firecrawl Credits | Gemini Cost | When |
|--------|-------------------|-------------|------|
| Initial scan per peer | 1 scrape | ~$0.02 (Flash) | Once, when peer added |
| Download & Analyze (user-initiated) | 0 | ~$0.10 (Pro) | Per document, user choice |
| Calendar monitoring (existing) | 0 | $0 | Every 2 min (no AI) |
| Calendar detection + catalog upsert | 0 | $0 | On detection (side effect) |

**Example: 10 peers × initial scan = 10 Firecrawl credits + ~$0.20 Gemini = negligible.**
**User downloads 5 reports = ~$0.50 in extraction costs.**

No runaway costs. Everything beyond the initial scan is user-initiated.

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| IR pages with JavaScript-rendered content | Firecrawl handles JS rendering; fallback: static HTML fetch |
| IR pages behind login/paywall | Detect 401/403 → show "Restricted access" in catalog |
| Duplicate documents (same report, different URLs) | `url_hash` unique constraint prevents duplicates |
| Very large IR pages (100+ documents) | Cap at 50 items per scan; paginate in UI |
| Firecrawl unavailable | Fallback: basic HTML fetch + regex extraction (like current check-publication but for ALL links) |
| AI misclassification | Show confidence score; allow manual override of document_type |
| User accidentally downloads expensive document | Show estimated cost before download; confirm dialog |

---

## Files to Create/Modify

### New Files
- `supabase/migrations/20260519xxx_ir_catalog.sql` — Table + RLS + indexes
- `supabase/functions/scan-ir-page/index.ts` — IR page scraping + classification
- `supabase/functions/download-catalog-item/index.ts` — Selective download + pipeline trigger
- `src/hooks/useIrCatalog.ts` — React Query hooks
- `src/components/ir-catalog/IrCatalogPanel.tsx` — Catalog UI component

### Modified Files
- `supabase/functions/check-publication/index.ts` — Extract all PDFs, upsert to catalog, match by type+year
- `src/pages/CompanyProfilePage.tsx` — Add IrCatalogPanel section
- `src/pages/PeersPage.tsx` — Add catalog badge on peer cards
- `src/types/database.ts` — Add IrCatalogItem type + enums
- `src/hooks/useCalendar.ts` — No changes needed (calendar hooks stay as-is)

---

## Success Criteria

1. User adds a peer with an IR page → system scans and shows all available documents within 30 seconds
2. User can browse catalog, filter by type/year, see file sizes
3. User clicks "Download & Analyze" → report appears in system with extracted KPIs within 2 minutes
4. Calendar event triggers → correct document matched from catalog → auto-download + analyze
5. No automatic mass-downloads. No periodic scanning. User in control.
