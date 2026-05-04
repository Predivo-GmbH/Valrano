import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import {
  FileText,
  Zap,
  Shield,
  BarChart3,
  Clock,
  Globe,
  ChevronDown,
  ArrowRight,
  Check,
  AlertCircle,
} from 'lucide-react'

/* ── Section label (uppercase accent badge) ──────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-4 inline-block rounded-full bg-[var(--color-accent)]/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-accent)]">
      {children}
    </span>
  )
}

/* ── FAQ accordion item ──────────────────────────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-[var(--color-border)]">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left text-[15px] font-medium text-[var(--color-foreground)] transition-colors hover:text-[var(--color-accent)]"
        aria-expanded={open}
      >
        {q}
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--color-muted-foreground)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <p className="pb-5 text-[15px] leading-relaxed text-[var(--color-muted-foreground)]">
            {a}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Data ─────────────────────────────────────────────── */
const PAIN_POINTS = [
  {
    icon: Clock,
    title: '22-44 hours per cycle',
    desc: 'Strategy teams spend 3-5 working days every quarter manually collecting, re-keying, and reconciling competitor data in Excel.',
  },
  {
    icon: AlertCircle,
    title: 'Definitional chaos',
    desc: '"Recurring EBIT" at Holcim, "RCO" at Heidelberg, "Adjusted EBITDA" at CRH — every peer uses different KPI definitions, currencies, and accounting standards.',
  },
  {
    icon: Globe,
    title: 'Asynchronous publications',
    desc: 'Peers publish at different times in different formats across SIX, NYSE, XETRA, and Euronext. By the time your team compiles the data, it\'s already stale.',
  },
]

const FEATURES = [
  {
    icon: FileText,
    title: 'Vision-LLM extraction',
    desc: 'AI reads published PDF reports — annual, quarterly, sustainability — and extracts 50+ financial and ESG KPIs with 98% target accuracy. Every value links back to its source page.',
  },
  {
    icon: BarChart3,
    title: 'KPI taxonomy mapping',
    desc: 'Automatically maps company-specific definitions to a canonical taxonomy. Compare apples to apples across IFRS, US GAAP, and Swiss GAAP FER.',
  },
  {
    icon: Globe,
    title: 'Multi-currency normalization',
    desc: 'Point-in-time and period-average FX conversion across CHF, EUR, USD, GBP, and 10+ currencies. No more manual spreadsheet reconciliation.',
  },
  {
    icon: Zap,
    title: '60-minute briefings',
    desc: 'When a peer publishes at 7 AM, your board-ready briefing is in your inbox by 8 AM — with normalized KPIs, ESG trajectory, and competitive signals.',
  },
  {
    icon: Shield,
    title: 'Full audit trail',
    desc: 'Every extracted value carries a confidence score and links to the exact PDF page and paragraph. Your team can verify any number in one click.',
  },
  {
    icon: Clock,
    title: 'Continuous monitoring',
    desc: 'No more quarterly scrambles. BenchmarkSignal monitors 15+ peers across all exchanges and delivers alerts the moment a new report drops.',
  },
]

const TIERS = [
  {
    name: 'Starter',
    target: 'Mid-cap corporates',
    peers: '5',
    highlights: [
      'Core financial KPIs (9)',
      'Quarterly + annual reports',
      'Multi-currency normalization',
      'Email alerts',
      'Up to 3 users',
      'Same-day insights',
    ],
  },
  {
    name: 'Professional',
    target: 'Large-cap corporates',
    peers: '15',
    featured: true,
    highlights: [
      'Extended financial (50+) + ESG KPIs',
      'AI-generated board briefings',
      'Sentiment analysis (earnings calls)',
      'Natural language query',
      '60-minute SLA',
      'Up to 10 users',
    ],
  },
  {
    name: 'Enterprise',
    target: 'Mega-cap / multi-vertical',
    peers: '30+',
    highlights: [
      'Custom KPI definitions',
      'Predictive what-if scenarios',
      'API + PowerBI / Tableau',
      'SSO / SAML',
      'Unlimited users',
      'Dedicated CSM + QBR',
    ],
  },
]

const FAQS = [
  {
    q: 'How accurate is AI extraction? Can we trust these numbers for board-level reporting?',
    a: 'BenchmarkSignal uses a multi-layer accuracy architecture: vision-LLM extraction with structured schemas, multi-model voting, confidence scoring (values below 0.85 are flagged for human review), and cross-validation against known financial relationships. Every extracted value links to its source PDF page for one-click verification. The result is more auditable than your current manual process, where a junior analyst\'s Excel formula is the audit trail.',
  },
  {
    q: 'We already have Bloomberg / FactSet. Why do we need another tool?',
    a: 'Bloomberg and FactSet provide raw financial data for investors. They do not extract KPIs from newly published PDF reports, normalize company-specific definitions (Recurring EBIT vs. RCO vs. Adjusted EBITDA), or deliver AI-generated peer briefings within 60 minutes. BenchmarkSignal replaces the 200 hours/year your team spends turning Bloomberg data into peer comparisons. It is a complement, not a replacement.',
  },
  {
    q: 'What about data security and compliance?',
    a: 'BenchmarkSignal processes exclusively publicly available documents — annual reports, quarterly filings, and sustainability reports that companies publish on their IR websites. No customer internal data is ever uploaded or processed. Your peer group configuration is confidential. Data is hosted in EU data centers with encryption at rest and in transit.',
  },
  {
    q: 'Which accounting standards and currencies do you support?',
    a: 'IFRS, US GAAP, and Swiss GAAP FER for accounting standards. For currencies, we support CHF, EUR, USD, GBP, INR, MXN, AUD, HKD, and more — using both point-in-time and period-average FX rates for accurate normalization.',
  },
  {
    q: 'How long does implementation take?',
    a: 'A typical onboarding takes 2 weeks: we configure your peer group, run historical extraction on past reports, validate accuracy with your team, and train users. You receive your first live briefing within 2 weeks of go-live.',
  },
]

/* ── JSON-LD structured data ─────────────────────────── */
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      name: 'BenchmarkSignal',
      url: 'https://benchmarksignal.predivo.ch',
      logo: 'https://benchmarksignal.predivo.ch/logo.svg',
      description:
        'Fully automated competitive benchmarking platform for listed corporations. AI-powered KPI extraction from peer reports.',
      sameAs: [],
      parentOrganization: {
        '@type': 'Organization',
        name: 'Predivo GmbH',
        url: 'https://predivo.ch',
      },
    },
    {
      '@type': 'SoftwareApplication',
      name: 'BenchmarkSignal',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description:
        'AI-powered competitive benchmarking: extract financial and ESG KPIs from peer PDF reports, normalize across currencies and standards, deliver board-ready briefings in 60 minutes.',
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'CHF',
        lowPrice: '28800',
        highPrice: '118800',
        offerCount: 3,
      },
    },
    {
      '@type': 'FAQPage',
      mainEntity: FAQS.map((faq) => ({
        '@type': 'Question',
        name: faq.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: faq.a,
        },
      })),
    },
  ],
}

/* ── Landing Page ─────────────────────────────────────── */
export default function LandingPage() {
  return (
    <>
      <Helmet>
        <title>
          BenchmarkSignal — AI-Powered Competitive Benchmarking for Listed
          Corporations
        </title>
        <meta
          name="description"
          content="Replace 200 hours of manual analyst work with AI-powered peer benchmarking. Extract financial and ESG KPIs from competitor reports, normalize across currencies and standards, get board-ready briefings in 60 minutes."
        />
        <meta
          property="og:title"
          content="BenchmarkSignal — AI-Powered Competitive Benchmarking"
        />
        <meta
          property="og:description"
          content="Extract financial and ESG KPIs from competitor PDF reports, normalize across currencies and standards, deliver board-ready briefings in 60 minutes."
        />
        <meta property="og:type" content="website" />
        <meta
          property="og:url"
          content="https://benchmarksignal.predivo.ch"
        />
        <meta
          property="og:image"
          content="https://benchmarksignal.predivo.ch/og-image.png"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <link
          rel="canonical"
          href="https://benchmarksignal.predivo.ch"
        />
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      </Helmet>

      {/* ── Navbar ───────────────────────────────────── */}
      <nav className="fixed top-0 z-50 w-full border-b border-[var(--color-border)] bg-[var(--color-background)]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            to="/"
            className="text-lg font-bold tracking-tight text-[var(--color-foreground)]"
          >
            BenchmarkSignal
          </Link>
          <div className="hidden items-center gap-8 md:flex">
            <a
              href="#features"
              className="text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
            >
              Pricing
            </a>
            <a
              href="#faq"
              className="text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
            >
              FAQ
            </a>
            <Link
              to="/login"
              className="text-sm font-medium text-[var(--color-foreground)] transition-colors hover:text-[var(--color-accent)]"
            >
              Sign in
            </Link>
          </div>
          <Link
            to="/signup"
            className="rounded-full bg-[var(--color-primary)] px-5 py-2 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90 md:hidden"
          >
            Get Started
          </Link>
        </div>
      </nav>

      <main>
        {/* ── Hero ─────────────────────────────────── */}
        <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-accent)/8%,transparent_60%)]" />
          <div className="relative mx-auto max-w-4xl px-6 py-20 text-center md:py-32">
            <SectionLabel>AI-Powered Competitive Intelligence</SectionLabel>
            <h1 className="mt-4 text-[clamp(2.5rem,6vw,5rem)] font-bold leading-[1.05] tracking-[-0.03em] text-[var(--color-foreground)]">
              Board-ready peer benchmarking
              <br />
              <span className="text-[var(--color-accent)]">
                in 60 minutes
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--color-muted-foreground)]">
              Replace CHF 300K consulting engagements and 200 hours of manual
              analyst work with a single platform that extracts, normalizes,
              and compares financial and ESG KPIs from peer reports
              automatically.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-8 py-3.5 text-[15px] font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
              >
                Request a Demo
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-8 py-3.5 text-[15px] font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
              >
                See How It Works
              </a>
            </div>
            <p className="mt-6 text-xs text-[var(--color-muted-foreground)]">
              Trusted by corporate strategy teams at listed companies
            </p>
          </div>
        </section>

        {/* ── Problem ──────────────────────────────── */}
        <section className="border-t border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="mx-auto max-w-6xl px-6 py-20 md:py-[80px]">
            <div className="text-center">
              <SectionLabel>The Problem</SectionLabel>
              <h2 className="mt-2 text-[clamp(1.75rem,4vw,3rem)] font-bold tracking-[-0.02em] text-[var(--color-foreground)]">
                Peer benchmarking is broken
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted-foreground)]">
                Every quarter, strategy teams download PDFs from IR pages,
                open Bloomberg for market data, pull ESG from a third source,
                and spend days in Excel normalizing everything.
              </p>
            </div>
            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {PAIN_POINTS.map((p) => (
                <div
                  key={p.title}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-8"
                >
                  <p.icon className="h-6 w-6 text-[var(--color-accent)]" />
                  <h3 className="mt-4 text-lg font-semibold text-[var(--color-foreground)]">
                    {p.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-muted-foreground)]">
                    {p.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Solution ─────────────────────────────── */}
        <section className="border-t border-[var(--color-border)]">
          <div className="mx-auto max-w-6xl px-6 py-20 md:py-[80px]">
            <div className="text-center">
              <SectionLabel>The Solution</SectionLabel>
              <h2 className="mt-2 text-[clamp(1.75rem,4vw,3rem)] font-bold tracking-[-0.02em] text-[var(--color-foreground)]">
                From publication to board briefing in 60 minutes
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted-foreground)]">
                BenchmarkSignal monitors your peers across every exchange,
                automatically extracts KPIs from published reports, normalizes
                across currencies and accounting standards, and delivers
                AI-generated briefings — so your board gets answers, not raw
                data.
              </p>
            </div>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              {[
                {
                  step: '01',
                  title: 'Monitor',
                  desc: 'Automatic detection when any peer publishes a new annual, quarterly, or sustainability report across SIX, NYSE, XETRA, Euronext, and more.',
                },
                {
                  step: '02',
                  title: 'Extract & Normalize',
                  desc: 'Vision-LLMs read the PDF and extract 50+ financial and ESG KPIs. Multi-currency normalization, KPI taxonomy mapping, and confidence scoring — all automated.',
                },
                {
                  step: '03',
                  title: 'Deliver',
                  desc: 'Board-ready briefings with normalized peer comparisons, trend analysis, and competitive signals delivered to your inbox within 60 minutes.',
                },
              ].map((s) => (
                <div
                  key={s.step}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-8"
                >
                  <span className="text-sm font-bold text-[var(--color-accent)]">
                    {s.step}
                  </span>
                  <h3 className="mt-3 text-lg font-semibold text-[var(--color-foreground)]">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-muted-foreground)]">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────── */}
        <section
          id="features"
          className="border-t border-[var(--color-border)] bg-[var(--color-card)]"
        >
          <div className="mx-auto max-w-6xl px-6 py-20 md:py-[80px]">
            <div className="text-center">
              <SectionLabel>Features</SectionLabel>
              <h2 className="mt-2 text-[clamp(1.75rem,4vw,3rem)] font-bold tracking-[-0.02em] text-[var(--color-foreground)]">
                Built for corporate strategy teams
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted-foreground)]">
                Every feature designed for CFOs, strategy heads, controllers,
                and IR officers — not investors screening stocks.
              </p>
            </div>
            <div className="mt-14 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-8 transition-colors hover:bg-[var(--color-bg-tertiary)]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-accent)]/10">
                    <f.icon className="h-5 w-5 text-[var(--color-accent)]" />
                  </div>
                  <h3 className="mt-4 text-[15px] font-semibold text-[var(--color-foreground)]">
                    {f.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ──────────────────────────────── */}
        <section
          id="pricing"
          className="border-t border-[var(--color-border)]"
        >
          <div className="mx-auto max-w-6xl px-6 py-20 md:py-[80px]">
            <div className="text-center">
              <SectionLabel>Pricing</SectionLabel>
              <h2 className="mt-2 text-[clamp(1.75rem,4vw,3rem)] font-bold tracking-[-0.02em] text-[var(--color-foreground)]">
                Plans that scale with your peer group
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--color-muted-foreground)]">
                Annual contracts. No monthly option. Enterprise SaaS standard.
                All plans include multi-currency normalization and full audit
                trail.
              </p>
            </div>
            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className={`relative rounded-lg border p-8 ${
                    tier.featured
                      ? 'border-[var(--color-accent)] bg-[var(--color-card)] shadow-[0_0_40px_rgba(59,130,246,0.1)]'
                      : 'border-[var(--color-border)] bg-[var(--color-card)]'
                  }`}
                >
                  {tier.featured && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-accent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
                      Most Popular
                    </span>
                  )}
                  <h3 className="text-lg font-semibold text-[var(--color-foreground)]">
                    {tier.name}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                    {tier.target}
                  </p>
                  <p className="mt-4 text-sm text-[var(--color-muted-foreground)]">
                    Up to{' '}
                    <span className="text-2xl font-bold text-[var(--color-foreground)]">
                      {tier.peers}
                    </span>{' '}
                    peers monitored
                  </p>
                  <ul className="mt-6 space-y-3">
                    {tier.highlights.map((h) => (
                      <li
                        key={h}
                        className="flex items-start gap-3 text-sm text-[var(--color-muted-foreground)]"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-signal-green)]" />
                        {h}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="mailto:roger@predivo.ch?subject=BenchmarkSignal%20Demo%20Request"
                    className={`mt-8 block w-full rounded-full py-3 text-center text-sm font-medium transition-opacity hover:opacity-90 ${
                      tier.featured
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)]'
                    }`}
                  >
                    Request a Demo
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────── */}
        <section
          id="faq"
          className="border-t border-[var(--color-border)] bg-[var(--color-card)]"
        >
          <div className="mx-auto max-w-3xl px-6 py-20 md:py-[80px]">
            <div className="text-center">
              <SectionLabel>FAQ</SectionLabel>
              <h2 className="mt-2 text-[clamp(1.75rem,4vw,3rem)] font-bold tracking-[-0.02em] text-[var(--color-foreground)]">
                Frequently asked questions
              </h2>
            </div>
            <div className="mt-12">
              {FAQS.map((faq) => (
                <FaqItem key={faq.q} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────── */}
        <section className="border-t border-[var(--color-border)]">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center md:py-[80px]">
            <h2 className="text-[clamp(1.75rem,4vw,3rem)] font-bold tracking-[-0.02em] text-[var(--color-foreground)]">
              Stop building peer comparisons manually
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-[var(--color-muted-foreground)]">
              Your team spends 3-5 days building peer comparisons that are
              outdated before the board meeting. BenchmarkSignal delivers them
              in 60 minutes, continuously, for less than a single Bloomberg
              seat.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a
                href="mailto:roger@predivo.ch?subject=BenchmarkSignal%20Demo%20Request"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-8 py-3.5 text-[15px] font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
              >
                Request a Demo
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-8 py-3.5 text-[15px] font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
              >
                Create Account
              </Link>
            </div>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────── */}
        <footer className="border-t border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              &copy; {new Date().getFullYear()} Predivo GmbH. All rights
              reserved.
            </p>
            <div className="flex gap-6">
              <Link
                to="/login"
                className="text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
              >
                Sign in
              </Link>
              <a
                href="mailto:roger@predivo.ch"
                className="text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
              >
                Contact
              </a>
            </div>
          </div>
        </footer>
      </main>
    </>
  )
}
