# BenchmarkSignal — Design Brief

**Date:** 2026-05-04
**Phase:** 3 Step 0.1 (DEFINE)
**Reference:** linear.app (Firecrawl brand scrape)
**User decisions:** Light + dark mode, full screen set (6+ screens)

---

## 1. Product Context

BenchmarkSignal is a fully automated competitive benchmarking platform for listed corporations. It uses vision-LLMs to extract financial and ESG KPIs from competitor PDF reports, normalizes them across currencies and accounting standards, and delivers AI-powered peer comparison within 60 minutes of any publication.

**Target persona:** Head of Group Strategy / Group Controlling at large listed companies (pilot: Holcim Ltd, building materials). Budget authority CHF 50-100K/year. Currently spending 22-44 hours per quarter manually collecting, re-keying, and reconciling competitor data in Excel.

**Personality:** Premium, precise, intelligent, trustworthy. This is a CHF 48-72K/year enterprise tool for C-suite decision makers. It must feel like Bloomberg meets Linear — not a startup toy.

**Tone:** Confident, authoritative, data-driven. No playful copy. No emojis. Clean, direct language that respects the buyer's intelligence.

---

## 2. Reference Analysis: linear.app

### Raw Firecrawl Data (saved to `docs/references/brand-scrape-linear-app.json`)

| Property | Linear Value | BenchmarkSignal Adaptation |
|----------|-------------|---------------------------|
| **Color scheme** | Dark (#08090A background) | Dark mode primary. Light mode as toggle. |
| **Primary text** | #D0D6E0 (soft gray) | Adopt for dark mode body text |
| **Accent** | #5E6AD2 (indigo-purple) | Adapt: financial blue or signal green for BenchmarkSignal identity |
| **Secondary** | #E4F222 (lime) | Do NOT adopt — too playful for enterprise finance |
| **Font heading** | SF Pro Display / Inter | Use Inter only (free, cross-platform) |
| **Font body** | Inter | Confirmed |
| **H1 size** | 64px | Adopt for landing hero |
| **H2 size** | 48px | Adopt |
| **Body size** | 15px | Adopt |
| **Base spacing** | 8px | Adopt |
| **Border radius** | 2px (sharp) | Adapt: 6-8px for cards (warmer for finance audience) |
| **Button radius** | 9999px (full pill) | Adopt for primary CTAs |
| **Button primary** | Light on dark (#E5E5E6 on #08090A) | Adopt pattern |
| **Button secondary** | Dark fill + subtle border inset | Adopt — matches premium feel |
| **Button shadow** | Multi-layer micro-shadows | Adopt — adds depth without being heavy |
| **Input style** | Transparent, minimal | Adopt for dark mode |

### What to Borrow from Linear
- Ultra-clean dark canvas with generous whitespace
- Large, confident typography (64px hero, 48px sections)
- Subtle depth through multi-layer shadows on interactive elements
- Pill-shaped primary buttons with inverted color scheme
- Inter font family throughout (professional, legible)
- Medium energy — not flashy, not boring
- Modern tech-savvy professional aesthetic

### What NOT to Borrow
- Lime/yellow accent (#E4F222) — too casual for enterprise finance
- 2px border radius on cards — too sharp, feels dev-tool-ish for CFO audience
- Product management vocabulary — BenchmarkSignal speaks finance, not software

---

## 3. BenchmarkSignal Color System

### Dark Mode (Primary)
| Token | Hex | Usage |
|-------|-----|-------|
| `bg-primary` | #0A0B0D | Main background (near-black, slightly warmer than Linear) |
| `bg-secondary` | #141518 | Card/panel backgrounds |
| `bg-tertiary` | #1C1D22 | Hover states, elevated surfaces |
| `text-primary` | #E8EAED | Primary text (soft white) |
| `text-secondary` | #9CA3AF | Secondary/muted text |
| `accent` | #3B82F6 | Primary accent — financial blue (trust, data, intelligence) |
| `accent-hover` | #2563EB | Accent hover state |
| `signal-green` | #22C55E | Positive values, uptrends, success states |
| `signal-red` | #EF4444 | Negative values, downtrends, alerts |
| `signal-amber` | #F59E0B | Warnings, low confidence, attention |
| `border` | #2A2B30 | Subtle borders between elements |

### Light Mode
| Token | Hex | Usage |
|-------|-----|-------|
| `bg-primary` | #FFFFFF | Main background |
| `bg-secondary` | #F8F9FA | Card/panel backgrounds |
| `bg-tertiary` | #F1F3F5 | Hover states |
| `text-primary` | #111827 | Primary text |
| `text-secondary` | #6B7280 | Secondary text |
| `accent` | #2563EB | Financial blue (slightly deeper in light mode) |
| `accent-hover` | #1D4ED8 | Accent hover |
| `signal-green` | #16A34A | Positive (darker for light bg contrast) |
| `signal-red` | #DC2626 | Negative |
| `signal-amber` | #D97706 | Warnings |
| `border` | #E5E7EB | Borders |

---

## 4. Typography

| Element | Font | Size | Weight | Line Height |
|---------|------|------|--------|-------------|
| H1 (Hero) | Inter | 64px | 700 | 1.1 |
| H2 (Section) | Inter | 48px | 700 | 1.15 |
| H3 (Subsection) | Inter | 30px | 600 | 1.2 |
| H4 (Card title) | Inter | 20px | 600 | 1.3 |
| Body | Inter | 15px | 400 | 1.6 |
| Body small | Inter | 13px | 400 | 1.5 |
| Caption | Inter | 11px | 500 | 1.4 |
| Button | Inter | 14px | 500 | 1 |
| Data (KPI values) | Inter Tight or JetBrains Mono | 24-48px | 700 | 1.1 |

**Data typography note:** Financial KPI values (revenue figures, percentages, rankings) should use a tighter tracking and potentially monospace font for tabular alignment. Inter Tight for display values, JetBrains Mono for data tables.

---

## 5. Spacing & Layout

| Token | Value |
|-------|-------|
| Base unit | 8px |
| Border radius (cards) | 8px |
| Border radius (buttons) | 9999px (pill) |
| Border radius (inputs) | 6px |
| Section padding | 80px vertical (desktop), 48px (mobile) |
| Card padding | 24px |
| Max content width | 1280px |
| Grid | 12-column, 24px gap |

---

## 6. Component Patterns

### Buttons
- **Primary:** Pill shape, light fill on dark bg (dark fill on light bg), multi-layer shadow
- **Secondary:** Pill shape, transparent fill, subtle border + inset glow
- **Ghost:** No fill, no border, accent text on hover

### Cards
- 8px radius, bg-secondary fill, 1px border, no heavy shadows
- Hover: subtle bg-tertiary transition

### Data Tables
- Zebra striping or subtle row borders
- Monospace numbers for alignment
- Signal colors for positive/negative values
- Sort indicators on column headers

### Charts
- Clean, minimal axes
- Signal color coding (green=positive, red=negative, blue=neutral)
- Tooltip on hover with source reference
- No gradient fills — solid colors only

---

## 7. Anti-Slop Rules

These patterns are BANNED from BenchmarkSignal:

1. **No gradients on backgrounds** — solid colors only (Linear-inspired)
2. **No rounded-full avatars everywhere** — use squares or subtle rounds
3. **No emoji in UI copy** — this is enterprise finance software
4. **No playful illustrations** — use data visualizations, not cartoon art
5. **No excessive shadows** — only on interactive elements (buttons, dropdowns)
6. **No bright lime/yellow accents** — financial blue + signal colors only
7. **No generic SaaS stock photos** — use abstract data visualizations or none
8. **No "Hey [name]!" casual greetings** — professional tone always
9. **No rounded pill badges for everything** — use subtle, squared indicators
10. **No Lucide icons as decorative filler** — icons must be functional

---

## 8. Screen Inventory

Screens to mock up in Stitch:

| # | Screen | Description | Priority |
|---|--------|-------------|----------|
| 1 | **Landing Page** | Marketing homepage — hero, value prop, features, peer group preview, pricing, CTA | P0 |
| 2 | **Dashboard** | Main app view — peer comparison table/chart, KPI selector, peer group filter, ranking view | P0 |
| 3 | **Report Detail** | Single company view — all extracted KPIs, trend charts, source PDF references | P0 |
| 4 | **Upload / Extraction** | PDF upload with Vision-LLM extraction progress, confidence scores, review queue | P0 |
| 5 | **Settings / Billing** | Account settings, peer group configuration, Stripe billing portal | P1 |
| 6 | **Email Alert Preview** | HTML email template for new publication alerts and anomaly notifications | P1 |

---

## 9. Theme Toggle

Both light and dark modes must be fully designed. Dark mode is the default (matches the premium, data-dense aesthetic). Light mode toggle available for users who prefer it (corporate environments with bright offices, projector-friendly).

Theme stored in localStorage, respects system preference on first visit.

---

## 10. Recraft Style

*(To be populated after logo generation in Step 0.2)*

---

*This design brief serves as the brand direction input for Stitch mockup generation and all subsequent frontend implementation. All design decisions trace back to this document.*
