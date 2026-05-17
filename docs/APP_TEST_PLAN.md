# Valrano — Core Application Test Plan

**Created:** 2026-05-04
**Status:** Not yet executed
**Purpose:** End-to-end verification of the core benchmarking workflow with real data

---

## What This Tests

Valrano's core value proposition: upload a real PDF annual report → AI extracts KPIs → normalize to CHF → peer comparison table updates → review low-confidence values. This plan tests that entire pipeline with real documents.

---

## Prerequisites

1. **Logged-in user account** on https://valrano.com (create via signup or use existing)
2. **Two real PDF annual reports** from seeded companies — download from their IR pages:
   - **Holcim** (CHF-denominated): https://www.holcim.com/investors/results-reports → 2024 Annual Report
   - **CRH** (EUR-denominated): https://www.crh.com/investors/results-centre → 2024 Annual Report
   - These test both the CHF-native path (no FX conversion) and the EUR→CHF conversion path
3. **Supabase dashboard access** to verify DB state (supabase@valrano.com)

---

## Test 1: Dashboard Shows Seeded Data

**Goal:** Verify the dashboard renders correctly with the 49 pre-seeded KPI values.

| Step | Action | Expected |
|------|--------|----------|
| 1.1 | Navigate to /dashboard | Peer comparison table loads |
| 1.2 | Check year selector | Default = FY 2025 (or current year - 1) |
| 1.3 | Switch to FY 2024 | Table shows seeded data for 2024 |
| 1.4 | Verify company list | 16 companies visible. Holcim first with "Primary" badge |
| 1.5 | Check Financial tab | KPI columns: Revenue, EBITDA, EBIT, Net Income, etc. |
| 1.6 | Check ESG tab | KPI columns: CO2 Emissions, CO2 Intensity, LTIFR, etc. |
| 1.7 | Check Operational tab | KPI columns: Cement Volume, etc. |
| 1.8 | Check All tab | All KPI categories combined |
| 1.9 | Hover a KPI value | Tooltip shows: original currency value, source page, source text, review status |
| 1.10 | Verify signal coloring | Green = best in peer group, Red = worst, based on higher/lower-is-better logic |
| 1.11 | Verify "—" cells | Companies without data for a KPI show "—" in muted gray |

**Pass criteria:** Table renders with data, tabs filter correctly, tooltips work, signal colors accurate.

---

## Test 2: Upload a CHF Report (Holcim)

**Goal:** Test the full upload → extract → normalize pipeline with a CHF-denominated report (no FX conversion needed).

| Step | Action | Expected |
|------|--------|----------|
| 2.1 | Navigate to /upload | Upload form with step indicator (Step 1: Upload PDF) |
| 2.2 | Select "Holcim" from company dropdown | 16 companies listed, Holcim selectable |
| 2.3 | Set Report Type = "Annual Report" | Dropdown works |
| 2.4 | Set Fiscal Year = 2024 | Number input accepts 2024 |
| 2.5 | Drag or click to upload Holcim 2024 PDF | File name and size shown in drop zone |
| 2.6 | Click "Upload Report" | Spinner shows "Uploading…", then success toast "Report uploaded successfully" |
| 2.7 | Verify step indicator advances to Step 2 | Shows "Report uploaded" green banner with report ID |
| 2.8 | Click "Extract KPIs" | Spinner shows "Extracting KPIs…" — this calls Claude Sonnet via Anthropic API |
| 2.9 | Wait for extraction (~30-90 seconds) | Success toast "Extracted N KPIs". Results card shows: KPIs Extracted count, Average Confidence %, Needs Review count |
| 2.10 | Verify extraction results make sense | Expected: 8-15 KPIs extracted. Revenue, EBITDA, Net Income should be present. Confidence mostly 0.85-1.0 for a major company's annual report |
| 2.11 | Check "Needs Review" count | Values with confidence < 0.85 are flagged |
| 2.12 | Click "Normalize to CHF" | Spinner shows "Normalizing…" |
| 2.13 | Wait for normalization | Success toast "Normalized N KPI values to CHF". Results show: Values Normalized, Skipped |
| 2.14 | Since Holcim reports in CHF | "Values Normalized" should equal total KPIs (FX rate = 1.0). "Skipped" should be 0 or just ratio KPIs |
| 2.15 | Verify "Processing complete" green banner | Shows with links: "Upload Another Report" and "View Dashboard" |

**Pass criteria:** Full 4-step pipeline completes without errors. KPIs extracted match what Holcim actually reports.

---

## Test 3: Verify Extracted Data on Dashboard

**Goal:** Confirm the newly extracted Holcim 2024 data appears in the peer comparison table.

| Step | Action | Expected |
|------|--------|----------|
| 3.1 | Click "View Dashboard" (or navigate to /dashboard) | Dashboard loads |
| 3.2 | Set year to FY 2024 | Table refreshes |
| 3.3 | Find Holcim row | Should have "Primary" badge, first row |
| 3.4 | Check Financial KPIs | Revenue, EBITDA, Net Income cells now have values (not "—") |
| 3.5 | Hover a Holcim value | Tooltip shows: raw CHF value, source page number, source text excerpt |
| 3.6 | Verify signal coloring | Holcim values compared against peers — green if best, red if worst |
| 3.7 | Check ESG tab for Holcim | CO2 emissions, LTIFR values if extracted |

**Pass criteria:** Holcim 2024 data visible in dashboard, hoverable tooltips with source references work.

---

## Test 4: Upload a EUR Report (CRH) — FX Conversion

**Goal:** Test the FX conversion pipeline with a EUR-denominated report.

| Step | Action | Expected |
|------|--------|----------|
| 4.1 | Navigate to /upload | Form resets (or click "Upload Another Report") |
| 4.2 | Select "CRH" from company dropdown | CRH selectable |
| 4.3 | Set Report Type = "Annual Report", FY = 2024 | Fields set |
| 4.4 | Upload CRH 2024 Annual Report PDF | File shown |
| 4.5 | Complete full pipeline: Upload → Extract → Normalize | All 3 steps succeed |
| 4.6 | Check extraction results | CRH reports in EUR. KPIs should have raw_currency = "EUR" |
| 4.7 | Check normalization results | "Values Normalized" > 0. These were converted EUR → CHF using period_average FX rate |
| 4.8 | If some values are "Skipped" | Could mean FX rate for EUR/CHF 2024 is missing from fx_rates table — note this |

**Pass criteria:** EUR values extracted and converted to CHF. If FX rates are missing, normalization correctly skips those values (doesn't crash).

---

## Test 5: Dashboard Comparison — Holcim vs CRH

**Goal:** Verify both companies' data shows side-by-side in CHF for meaningful comparison.

| Step | Action | Expected |
|------|--------|----------|
| 5.1 | Navigate to /dashboard, FY 2024, Financial tab | Both Holcim and CRH rows visible |
| 5.2 | Compare Revenue columns | Both in CHF (CRH converted from EUR). Values should be realistic (Holcim ~27B CHF, CRH ~35B CHF equivalent) |
| 5.3 | Check signal coloring | Green/red reflects which company leads on each KPI |
| 5.4 | Hover CRH value | Tooltip shows: original EUR amount, normalized CHF amount, FX rate used, source page |
| 5.5 | Check other tabs (ESG, Operational) | CRH data appears where extracted |

**Pass criteria:** Side-by-side peer comparison works with mixed-currency data, all normalized to CHF.

---

## Test 6: Review Queue

**Goal:** Verify low-confidence KPI values appear in the review queue and can be approved.

| Step | Action | Expected |
|------|--------|----------|
| 6.1 | Navigate to /review | Review queue loads |
| 6.2 | Check if items exist | If any extracted KPIs had confidence < 0.85, they appear here |
| 6.3 | Verify table columns | Company, KPI, Category, Raw Value, Normalized (CHF), Confidence, Source, Approve button |
| 6.4 | Check confidence badges | Color-coded: green (≥85%), amber (65-84%), red (<65%) |
| 6.5 | Check source text column | Shows excerpt from PDF with page number |
| 6.6 | Click "Approve" on one item | Spinner, then toast "Value approved", item disappears from queue |
| 6.7 | Navigate to /dashboard | The approved value is now shown in the peer comparison table (no longer flagged) |
| 6.8 | Return to /review | Approved item is gone. Count decreased by 1 |

**Pass criteria:** Review queue shows flagged items, approve action works, dashboard reflects changes.

---

## Test 7: Empty / Edge States

**Goal:** Verify the app handles edge cases gracefully.

| Step | Action | Expected |
|------|--------|----------|
| 7.1 | Dashboard with no data for a year | Switch to FY 2020 (no data). Shows "No data available" empty state with "Upload a Report" link |
| 7.2 | Upload without selecting company | Click "Upload Report" → toast error "Select a company" |
| 7.3 | Upload without selecting file | Click "Upload Report" → toast error "Select a PDF file" |
| 7.4 | Drag a non-PDF file | Toast error "Only PDF files are supported" |
| 7.5 | Review queue when empty | Shows "Review queue is empty" message with explanation |
| 7.6 | Upload a very large PDF (>50MB) | Should either upload successfully or show meaningful error (not a hang) |
| 7.7 | Upload same report twice | Should either create a second extraction or show "already exists" error |

**Pass criteria:** No crashes, no blank screens, all error states have user-friendly messages.

---

## Test 8: Data Integrity Checks (Supabase Dashboard)

**Goal:** Verify the database state is correct after the pipeline runs.

| Step | Action | Expected |
|------|--------|----------|
| 8.1 | Open Supabase Table Editor → `reports` | New rows for Holcim 2024 and CRH 2024. status = "extracted" |
| 8.2 | Check `reports.pdf_storage_path` | Non-null, points to a valid Storage path |
| 8.3 | Open `extractions` table | Rows for each extraction. status = "completed", model_used = "claude-sonnet-4-6" |
| 8.4 | Check `extractions.total_kpis_extracted` | Matches the count shown in the UI |
| 8.5 | Open `kpi_values` table | Rows for each extracted KPI. Filter by report_id |
| 8.6 | Verify `normalized_value` is set | Non-null for all values that went through normalization |
| 8.7 | Verify `fx_rate_used` for EUR values | Non-null, reasonable rate (EUR/CHF ~0.93-0.97 range) |
| 8.8 | Verify `needs_review` flags | True only for values with confidence < 0.85 |
| 8.9 | Check `subscriptions` table | Your user has tier = "starter", status = "active" |
| 8.10 | Open Supabase Storage → `reports` bucket | PDF files present at the expected paths |

**Pass criteria:** All DB state is consistent with what the UI showed.

---

## Results Summary

| Test | Description | Tests | Passed | Failed | Notes |
|------|-------------|-------|--------|--------|-------|
| 1 | Dashboard seeded data | 11 | | | |
| 2 | Upload CHF report (Holcim) | 15 | | | |
| 3 | Dashboard shows extracted data | 7 | | | |
| 4 | Upload EUR report (CRH) + FX | 8 | | | |
| 5 | Peer comparison (Holcim vs CRH) | 5 | | | |
| 6 | Review queue | 8 | | | |
| 7 | Empty / edge states | 7 | | | |
| 8 | Data integrity (Supabase) | 10 | | | |
| **Total** | | **71** | | | |

---

## Known Risks / Things That Might Fail

1. **Anthropic API quota/rate limits** — extract-kpis calls Claude Sonnet 4.6. Large PDFs (>100 pages) may hit token limits or time out (Supabase edge function has a 60s default timeout)
2. **FX rates for 2024 may not be seeded** — If EUR/CHF 2024 rates are missing from `fx_rates` table, normalization will skip EUR values. Check the seed migration to verify.
3. **PDF size limits** — Very large PDFs (>50MB) may fail on upload or base64 encoding in the edge function
4. **KPI code mapping** — Claude must return exact codes from the enum (REVENUE, EBITDA, etc.). If the PDF uses unusual labeling, some KPIs may not be mapped.
5. **Duplicate uploads** — No dedup logic exists. Uploading the same report twice creates duplicate kpi_values rows.
