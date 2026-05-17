---
name: Valrano Brand Guidelines
description: >
  Auto-enforced brand guidelines for Valrano. Every frontend file — components, pages,
  layouts, styles — MUST comply with these rules. Any AI coding assistant working on this project
  MUST read and follow this file. No design-tokens.json lookup required; all values are inlined.
globs:
  - "src/**/*.tsx"
  - "src/**/*.ts"
  - "src/**/*.css"
  - "src/**/*.html"
  - "index.html"
  - "tailwind.config.*"
---

# Valrano Brand Guidelines

> **Authority:** This file is the single source of truth for all visual and UI decisions.
> If a component deviates from these rules, it is a bug. Fix it — do not rationalize it.

---

## 1. Color Tokens

### Dark Mode (DEFAULT)

| Token                        | Hex         | Usage                                    |
|------------------------------|-------------|------------------------------------------|
| `bg-primary`                 | `#0A0B0D`   | Page background, root `<body>`           |
| `bg-secondary`               | `#141518`   | Card backgrounds, sidebars               |
| `bg-tertiary`                | `#1C1D20`   | Nested surfaces, hover states            |
| `bg-elevated`                | `#272A31`   | Elevated containers, dropdowns, tooltips |
| `text-primary`               | `#E8EAED`   | Headings, body text                      |
| `text-secondary`             | `#9CA3AF`   | Descriptions, secondary labels           |
| `text-muted`                 | `#94A3B8`   | Placeholders, hints, nav links           |
| `accent`                     | `#3B82F6`   | Primary accent, links, active states     |
| `accent-hover`               | `#2563EB`   | Accent on hover/active                   |
| `accent-light`               | `#ADC6FF`   | Light accent for emphasis text           |
| `accent-container`           | `#4D8EFF`   | Accent badges, highlighted containers    |
| `signal-green`               | `#22C55E`   | Positive values, upward trends           |
| `signal-red`                 | `#EF4444`   | Negative values, downward trends         |
| `signal-amber`               | `#F59E0B`   | Warnings, neutral/mixed signals          |
| `border`                     | `#27282B`   | Card borders, dividers                   |
| `border-subtle`              | `#1C1D20`   | Very subtle separators                   |
| `surface-container`          | `#1D2027`   | Container surfaces                       |
| `surface-container-low`      | `#191B23`   | Low-emphasis container surfaces          |
| `surface-container-high`     | `#272A31`   | High-emphasis container surfaces         |
| `surface-container-highest`  | `#32353C`   | Highest-emphasis surfaces                |
| `outline`                    | `#8C909F`   | Input borders, outlines                  |
| `outline-variant`            | `#424754`   | Subtle outlines, disabled states         |

### Light Mode (via toggle)

| Token              | Hex         |
|--------------------|-------------|
| `bg-primary`       | `#FFFFFF`   |
| `bg-secondary`     | `#F8F9FA`   |
| `bg-tertiary`      | `#F1F3F5`   |
| `bg-elevated`      | `#FFFFFF`   |
| `text-primary`     | `#111827`   |
| `text-secondary`   | `#6B7280`   |
| `text-muted`       | `#9CA3AF`   |
| `accent`           | `#2563EB`   |
| `accent-hover`     | `#1D4ED8`   |
| `signal-green`     | `#16A34A`   |
| `signal-red`       | `#DC2626`   |
| `signal-amber`     | `#D97706`   |
| `border`           | `#E5E7EB`   |
| `border-subtle`    | `#F1F3F5`   |

---

## 2. Typography

**Primary font:** `Inter` (loaded from Google Fonts)
**Monospace font:** `JetBrains Mono`

**Font stack:** `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif`

### Scale

| Token          | Size   | Weight | Line-Height | Letter-Spacing | Notes                  |
|----------------|--------|--------|-------------|----------------|------------------------|
| `h1-hero`      | 80px   | 700    | 1.05        | -0.03em        | Landing hero only      |
| `h1`           | 64px   | 700    | 1.1         | -0.02em        | Page titles            |
| `h2`           | 48px   | 700    | 1.2         | -0.02em        | Section headings       |
| `h3`           | 24px   | 600    | 1.4         | —              | Subsection headings    |
| `body-md`      | 15px   | 400    | 1.6         | —              | Default body text      |
| `body-sm`      | 13px   | 400    | 1.5         | —              | Captions, fine print   |
| `label-caps`   | 11px   | 600    | 1.0         | 0.05em         | Uppercase labels, table headers. Always `text-transform: uppercase`. |
| `data-display` | 36px   | 700    | 1.1         | —              | KPI numbers, big stats |

---

## 3. Spacing Scale

Base unit: **8px**

| Token    | Value  |
|----------|--------|
| `xs`     | 4px    |
| `sm`     | 8px    |
| `md`     | 16px   |
| `lg`     | 24px   |
| `xl`     | 48px   |
| `xxl`    | 80px   |
| `gutter` | 24px   |

---

## 4. Border Radius

| Token     | Value      |
|-----------|------------|
| `sm`      | 0.25rem    |
| `DEFAULT` | 0.5rem     |
| `md`      | 0.75rem    |
| `lg`      | 1rem       |
| `xl`      | 1.5rem     |
| `full`    | 9999px     |

---

## 5. Component Patterns

### 5.1 Buttons

**Primary Pill**
- Background: `#E8EAED`
- Text: `#0A0B0D`
- Hover background: `#FFFFFF`
- Border-radius: `9999px` (full pill)
- Padding: `16px 32px`
- Font: 16px / weight 500
- Shadow: `rgba(0,0,0,0) 0px 8px 2px, rgba(0,0,0,0.01) 0px 5px 2px, rgba(0,0,0,0.04) 0px 3px 2px, rgba(0,0,0,0.07) 0px 1px 1px, rgba(0,0,0,0.08) 0px 0px 1px`
- Transition: `all 200ms ease`

**Secondary Pill**
- Background: `#141518`
- Text: `#E8EAED`
- Border: 1px solid `#27282B`
- Hover background: `#1C1D20`
- Border-radius: `9999px`
- Padding: `16px 32px`
- Shadow: `rgba(255,255,255,0.03) 0px 0px 0px 1px inset, rgba(255,255,255,0.04) 0px 1px 0px inset, rgba(0,0,0,0.6) 0px 0px 0px 1px, rgba(0,0,0,0.1) 0px 4px 4px`

**Ghost**
- Background: transparent
- Text: `#3B82F6`
- Hover text: `#2563EB`
- No border, no shadow

### 5.2 Cards

- Background: `#141518`
- Border: 1px solid `#27282B`
- Border-radius: `0.5rem`
- Padding: `32px`
- Hover background: `#1C1D20`
- Highlight shadow (optional, for featured cards only): `0 0 40px rgba(59, 130, 246, 0.1)`
- **No box-shadow by default.** Only the highlight glow on featured/active cards.

### 5.3 Tables

- Header background: transparent
- Header text: `#9CA3AF`, using `label-caps` style (11px, 600, uppercase, 0.05em tracking)
- Row divider: 1px solid `#27282B`
- Row hover background: `#1C1D20`
- Cell padding: `20px 24px`
- Signal colors in cells: green `#22C55E` for positive, red `#EF4444` for negative, amber `#F59E0B` for warning

### 5.4 Nav Bar

- Position: `fixed`, top, full width, z-index 50+
- Height: `64px`
- Background: `rgba(10, 11, 13, 0.8)` (frosted glass)
- Backdrop blur: `12px` (`backdrop-blur-sm` or `backdrop-filter: blur(12px)`)
- Border bottom: 1px solid `#27282B`
- Link color: `#94A3B8`
- Link hover color: `#E8EAED`
- Link active color: `#E8EAED`

### 5.5 Badges

- Background: `rgba(59, 130, 246, 0.1)`
- Text: `#3B82F6`
- Border-radius: `9999px`
- Padding: `4px 16px`
- Font: 11px / weight 600

---

## 6. Layout Constants

| Property                   | Value    |
|----------------------------|----------|
| Max content width          | 1440px   |
| Nav height                 | 64px     |
| Section padding Y          | 80px     |
| Section padding Y (mobile) | 48px    |
| Card padding               | 32px     |
| Grid columns               | 12       |
| Grid gap                   | 24px     |

---

## 7. Shadows

Use shadows **sparingly**. Only these pre-approved shadows exist:

| Name                | Value                                                                                       | Usage                  |
|---------------------|---------------------------------------------------------------------------------------------|------------------------|
| `button-primary`    | See Section 5.1 Primary Pill                                                                | Primary buttons only   |
| `button-secondary`  | See Section 5.1 Secondary Pill                                                              | Secondary buttons only |
| `card-highlight`    | `0 0 40px rgba(59, 130, 246, 0.1)`                                                         | Featured cards only    |

**No other shadows are permitted.** Cards, containers, and surfaces rely on border + background contrast, not drop shadows.

---

## 8. Animation

- All interactive elements: `transition: all 200ms ease`
- Color-only transitions (links, text): `transition: color 200ms ease, background-color 200ms ease`
- No animation duration above 200ms for micro-interactions
- Page-level animations (hero entrance, section reveals) may use longer durations but must feel snappy

---

## 9. BANNED Patterns (Anti-Slop Rules)

These patterns are **strictly forbidden** across the entire project. Any PR or commit containing them MUST be rejected.

1. **No gradients on backgrounds.** Backgrounds are flat solid colors from the token palette. No linear-gradient, radial-gradient, or mesh-gradient on any `bg-*` surface.

2. **No emojis in UI.** Zero emojis in headings, labels, buttons, descriptions, or any user-facing text. Use signal colors and icons instead.

3. **No playful illustrations.** No cartoon-style, hand-drawn, or whimsical illustrations. The visual language is data-driven, technical, and institutional.

4. **No generic stock photos.** If imagery is needed, use data visualizations, abstract geometric patterns, or screenshots of the actual product.

5. **No excessive shadows on cards.** Cards use border + background contrast. The only permitted shadow is `card-highlight` on featured cards. No `shadow-lg`, `shadow-xl`, or custom box-shadows on standard cards.

6. **No lime or yellow accents.** The accent palette is blue (`#3B82F6`). Signal amber (`#F59E0B`) is reserved exclusively for warning states. No lime-green, bright yellow, or warm accent colors anywhere.

7. **No `rounded-full` avatars everywhere.** Circular avatars are not a pattern in this product. Profile elements use `rounded-md` or `rounded-lg`. Reserve `rounded-full` for pills and badges only.

8. **No Lucide/icon-library icons as decoration.** Icons serve functional purposes (navigation, actions, status indicators). Never scatter decorative icons around headings or sections for visual flair.

9. **No casual greetings.** No "Hey there!", "Welcome back!", "Hi [Name]!". The tone is professional and direct. Use functional labels: "Dashboard", "Overview", "Signal Report".

10. **No pure black text (`#000000`).** Dark mode text is `#E8EAED`. Light mode text is `#111827`. Pure black is never used anywhere.

---

## 10. Implementation Rules

### Tailwind 4
- Use Tailwind CSS v4 utility classes for all styling
- Define color tokens as CSS custom properties in `@theme` and reference them via Tailwind utilities
- Avoid inline `style` attributes except for truly dynamic values (e.g., chart widths)

### Dark Mode Default
- Dark mode is the default. The `<html>` element starts without a class or with `class="dark"`
- Light mode is activated via a toggle that adds/swaps to `class="light"`
- All components must support both modes using the token system

### Font Loading
- Inter is loaded from Google Fonts via `<link>` in `index.html`
- JetBrains Mono loaded for code/data displays
- Always set `font-display: swap` to prevent FOIT

### Signal Colors
- Green (`signal-green`) = positive change, growth, buy signal
- Red (`signal-red`) = negative change, decline, sell signal
- Amber (`signal-amber`) = warning, caution, neutral/mixed signal
- Never use signal colors for decorative purposes

### Transitions
- Every interactive element (buttons, links, cards, toggles, inputs) MUST have `transition: all 200ms ease`
- No element should change appearance without a smooth transition

### Max Content Width
- All page content is constrained to `max-w-[1440px] mx-auto`
- Full-bleed backgrounds (nav, hero, footer) extend to viewport edge but inner content stays within 1440px

### No Public Pricing
- The landing page does NOT display pricing tiers or dollar amounts
- Use "Request a Demo" as the primary CTA instead of "Buy Now", "Subscribe", or "Start Free Trial"
- Pricing details are shared only during the demo/sales process
