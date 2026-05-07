import { useState, useEffect, useRef } from 'react'
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
  Menu,
  X,
  TrendingUp,
  Target,
  Timer,
  Users,
} from 'lucide-react'

/* ── Animated count-up hook ─────────────────────────── */
function useCountUp(end: number, duration = 2000, startOnView = true) {
  const [count, setCount] = useState(0)
  const [started, setStarted] = useState(
    !startOnView || typeof IntersectionObserver === 'undefined'
  )
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!startOnView || !ref.current || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true)
          observer.disconnect()
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [startOnView])

  useEffect(() => {
    if (!started) return
    let start = 0
    const increment = Math.ceil(end / (duration / 16))
    const timer = setInterval(() => {
      start += increment
      if (start >= end) {
        start = end
        clearInterval(timer)
      }
      setCount(start)
    }, 16)
    return () => clearInterval(timer)
  }, [started, end, duration])

  return { count, ref }
}

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
    <div
      className={`border-b border-[var(--color-border)] transition-colors duration-200 ${
        open ? 'border-l-2 border-l-[var(--color-accent)] pl-4' : 'border-l-2 border-l-transparent pl-4'
      }`}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between py-5 text-left text-[15px] font-medium text-[var(--color-foreground)] transition-colors hover:text-[var(--color-accent)]"
        aria-expanded={open}
      >
        {q}
        <ChevronDown
          aria-hidden="true"
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

/* ── Stat card ─────────────────────────────────────── */
function StatCard({
  value,
  suffix,
  label,
  icon: Icon,
}: {
  value: number
  suffix: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}) {
  const { count, ref } = useCountUp(value, 2000)
  return (
    <div
      ref={ref}
      className="group relative flex flex-col items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-accent)]/30 hover:shadow-[0_8px_30px_var(--color-accent)/8] sm:p-8"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent)]/10 transition-transform duration-300 group-hover:scale-110">
        <Icon className="h-6 w-6 text-[var(--color-accent)]" />
      </div>
      <div className="text-3xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-4xl">
        {count}
        {suffix}
      </div>
      <p className="text-sm text-[var(--color-muted-foreground)]">{label}</p>
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
    span: 'md:col-span-2 md:row-span-2',
    featured: true,
  },
  {
    icon: BarChart3,
    title: 'KPI taxonomy mapping',
    desc: 'Automatically maps company-specific definitions to a canonical taxonomy. Compare apples to apples across IFRS, US GAAP, and Swiss GAAP FER.',
    span: 'md:col-span-1 md:row-span-1',
  },
  {
    icon: Globe,
    title: 'Multi-currency normalization',
    desc: 'Point-in-time and period-average FX conversion across CHF, EUR, USD, GBP, and 10+ currencies.',
    span: 'md:col-span-1 md:row-span-1',
  },
  {
    icon: Zap,
    title: '60-minute briefings',
    desc: 'When a peer publishes at 7 AM, your board-ready briefing is in your inbox by 8 AM — with normalized KPIs, ESG trajectory, and competitive signals.',
    span: 'md:col-span-1 md:row-span-1',
  },
  {
    icon: Shield,
    title: 'Full audit trail',
    desc: 'Every extracted value carries a confidence score and links to the exact PDF page and paragraph. Your team can verify any number in one click.',
    span: 'md:col-span-1 md:row-span-1',
  },
  {
    icon: Clock,
    title: 'Continuous monitoring',
    desc: 'No more quarterly scrambles. BenchmarkSignal monitors 15+ peers across all exchanges and delivers alerts the moment a new report drops.',
    span: 'md:col-span-2 md:row-span-1',
  },
]

const STATS = [
  { value: 200, suffix: '+', label: 'Hours saved per year', icon: Timer },
  { value: 60, suffix: 'min', label: 'Publication to briefing', icon: Zap },
  { value: 98, suffix: '%', label: 'Extraction accuracy', icon: Target },
  { value: 15, suffix: '+', label: 'Peers monitored continuously', icon: Users },
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

const COMPARISON_ROWS = [
  { label: 'Peers monitored', values: ['5', '15', '30+'] },
  { label: 'Financial KPIs', values: ['9', '50+', 'Custom'] },
  { label: 'ESG KPIs', values: [false, true, true] },
  { label: 'Board briefings', values: [false, true, true] },
  { label: 'Sentiment analysis', values: [false, true, true] },
  { label: 'Natural language query', values: [false, true, true] },
  { label: '60-minute SLA', values: [false, true, true] },
  { label: 'API / BI integration', values: [false, false, true] },
  { label: 'SSO / SAML', values: [false, false, true] },
  { label: 'Users included', values: ['3', '10', 'Unlimited'] },
  { label: 'Dedicated CSM', values: [false, false, true] },
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
      logo: 'https://benchmarksignal.predivo.ch/og-image.svg',
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

/* ── CSS Keyframes (injected once) ────────────────────── */
const KEYFRAMES_ID = 'landing-animations'
function useAnimationStyles() {
  useEffect(() => {
    if (document.getElementById(KEYFRAMES_ID)) return
    const style = document.createElement('style')
    style.id = KEYFRAMES_ID
    style.textContent = `
      @keyframes landing-fade-up {
        0% { opacity: 0; transform: translateY(24px); filter: blur(8px); }
        100% { opacity: 1; transform: translateY(0); filter: blur(0); }
      }
      @keyframes landing-float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }
      @keyframes landing-pulse-glow {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 0.7; }
      }
      @keyframes landing-gradient-shift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      .landing-animate-in {
        animation: landing-fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        opacity: 0;
      }
      .landing-delay-1 { animation-delay: 0.1s; }
      .landing-delay-2 { animation-delay: 0.2s; }
      .landing-delay-3 { animation-delay: 0.35s; }
      .landing-delay-4 { animation-delay: 0.5s; }
      .landing-delay-5 { animation-delay: 0.65s; }
      .landing-float { animation: landing-float 6s ease-in-out infinite; }
      .landing-gradient-badge {
        background: linear-gradient(90deg, #3B82F6, #8B5CF6, #EC4899, #3B82F6);
        background-size: 300% 100%;
        animation: landing-gradient-shift 3s linear infinite;
      }
    `
    document.head.appendChild(style)
    return () => { style.remove() }
  }, [])
}

/* ── Landing Page ─────────────────────────────────────── */
export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  useAnimationStyles()

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
          content="https://benchmarksignal.predivo.ch/og-image.svg"
        />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <link
          rel="canonical"
          href="https://benchmarksignal.predivo.ch"
        />
        <link
          rel="preconnect"
          href="https://iplfnausgpexckrrrhov.supabase.co"
        />
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      </Helmet>

      {/* ── Navbar ───────────────────────────────────── */}
      <nav className="fixed top-0 z-50 w-full border-b border-[var(--color-border)] bg-[var(--color-background)]/80 backdrop-blur-xl" aria-label="Landing navigation">
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
              className="inline-flex min-h-[44px] items-center text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="inline-flex min-h-[44px] items-center text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
            >
              Pricing
            </a>
            <a
              href="#faq"
              className="inline-flex min-h-[44px] items-center text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
            >
              FAQ
            </a>
            <Link
              to="/login"
              className="inline-flex min-h-[44px] items-center text-sm font-medium text-[var(--color-foreground)] transition-colors hover:text-[var(--color-accent)]"
            >
              Sign in
            </Link>
          </div>

          {/* Mobile: hamburger + CTA */}
          <div className="flex items-center gap-2 md:hidden">
            <Link
              to="/signup"
              className="rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90"
            >
              Get Started
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="border-t border-[var(--color-border)] bg-[var(--color-background)] px-6 pb-4 pt-2 md:hidden">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block min-h-[44px] py-3 text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">Features</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block min-h-[44px] py-3 text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">Pricing</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="block min-h-[44px] py-3 text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">FAQ</a>
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block min-h-[44px] py-3 text-sm font-medium text-[var(--color-foreground)]">Sign in</Link>
          </div>
        )}
      </nav>

      <main>
        {/* ── Hero ─────────────────────────────────── */}
        <section className="relative flex min-h-[90vh] items-center justify-center overflow-hidden pt-16">
          {/* Layered background effects */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-accent)/8%,transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,var(--color-accent)/5%,transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--color-accent)/4%,transparent_40%)]" />
          {/* Dot grid pattern */}
          <div
            className="absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage: 'radial-gradient(var(--color-muted-foreground) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
              maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
            }}
          />
          {/* Floating accent glow */}
          <div
            className="absolute left-1/2 top-1/3 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-accent)] opacity-[0.04] blur-[100px]"
            style={{ animation: 'landing-pulse-glow 4s ease-in-out infinite' }}
          />

          <div className="relative mx-auto max-w-4xl px-6 py-20 text-center md:py-32">
            <div className="landing-animate-in landing-delay-1">
              <SectionLabel>AI-Powered Competitive Intelligence</SectionLabel>
            </div>
            <h1 className="landing-animate-in landing-delay-2 mt-4 text-[clamp(2.5rem,6vw,5rem)] font-bold leading-[1.05] tracking-[-0.03em] text-[var(--color-foreground)]">
              Board-ready peer benchmarking
              <br />
              <span className="bg-gradient-to-r from-[var(--color-accent)] to-[#8B5CF6] bg-clip-text text-transparent">
                in 60 minutes
              </span>
            </h1>
            <p className="landing-animate-in landing-delay-3 mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[var(--color-muted-foreground)] sm:text-lg">
              Replace CHF 300K consulting engagements and 200 hours of manual
              analyst work with a single platform that extracts, normalizes,
              and compares financial and ESG KPIs from peer reports
              automatically.
            </p>
            <div className="landing-animate-in landing-delay-4 mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a
                href="#pricing"
                className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-8 py-3.5 text-[15px] font-medium text-[var(--color-primary-foreground)] shadow-lg shadow-[var(--color-accent)]/10 transition-all hover:opacity-90 hover:shadow-xl hover:shadow-[var(--color-accent)]/15"
              >
                Request a Demo
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-8 py-3.5 text-[15px] font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
              >
                See How It Works
              </a>
            </div>
            <p className="landing-animate-in landing-delay-5 mt-6 text-xs text-[var(--color-muted-foreground)]">
              Trusted by corporate strategy teams at listed companies
            </p>
          </div>
        </section>

        {/* ── Stats ─────────────────────────────────── */}
        <section className="border-t border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STATS.map((stat) => (
                <StatCard
                  key={stat.label}
                  value={stat.value}
                  suffix={stat.suffix}
                  label={stat.label}
                  icon={stat.icon}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── Problem ──────────────────────────────── */}
        <section className="border-t border-[var(--color-border)]">
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
                  className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-signal-red)]/30 hover:shadow-lg sm:p-8"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-signal-red)]/10 transition-transform duration-300 group-hover:scale-110">
                    <p.icon className="h-5 w-5 text-[var(--color-signal-red)]" aria-hidden="true" />
                  </div>
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
        <section className="border-t border-[var(--color-border)] bg-[var(--color-card)]">
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
                  icon: Globe,
                },
                {
                  step: '02',
                  title: 'Extract & Normalize',
                  desc: 'Vision-LLMs read the PDF and extract 50+ financial and ESG KPIs. Multi-currency normalization, KPI taxonomy mapping, and confidence scoring — all automated.',
                  icon: BarChart3,
                },
                {
                  step: '03',
                  title: 'Deliver',
                  desc: 'Board-ready briefings with normalized peer comparisons, trend analysis, and competitive signals delivered to your inbox within 60 minutes.',
                  icon: TrendingUp,
                },
              ].map((s) => (
                <div
                  key={s.step}
                  className="group relative rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-accent)]/30 hover:shadow-lg sm:p-8"
                >
                  {/* Step number badge */}
                  <div className="absolute -top-3 left-6 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent)] text-xs font-bold text-white">
                    {s.step}
                  </div>
                  <div className="mt-2 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-accent)]/10 transition-transform duration-300 group-hover:scale-110">
                    <s.icon className="h-5 w-5 text-[var(--color-accent)]" aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-[var(--color-foreground)]">
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

        {/* ── Features — Bento Grid ──────────────── */}
        <section
          id="features"
          className="border-t border-[var(--color-border)]"
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
            <div className="mt-14 grid auto-rows-[minmax(140px,auto)] gap-4 md:grid-cols-4">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className={`group relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-accent)]/30 hover:shadow-[0_8px_30px_var(--color-accent)/8] sm:p-6 ${f.span}`}
                >
                  {/* Subtle gradient on featured card */}
                  {f.featured && (
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)]/5 to-transparent" />
                  )}
                  <div className="relative">
                    <div className={`flex items-center justify-center rounded-lg bg-[var(--color-accent)]/10 transition-transform duration-300 group-hover:scale-110 ${f.featured ? 'h-12 w-12' : 'h-10 w-10'}`}>
                      <f.icon className={`text-[var(--color-accent)] ${f.featured ? 'h-6 w-6' : 'h-5 w-5'}`} aria-hidden="true" />
                    </div>
                    <h3 className={`mt-4 font-semibold text-[var(--color-foreground)] ${f.featured ? 'text-xl' : 'text-[15px]'}`}>
                      {f.title}
                    </h3>
                    <p className={`mt-2 leading-relaxed text-[var(--color-muted-foreground)] ${f.featured ? 'text-[15px]' : 'text-sm'}`}>
                      {f.desc}
                    </p>
                    {f.featured && (
                      <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-accent)]">
                        Learn more <ArrowRight className="h-3.5 w-3.5" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ──────────────────────────────── */}
        <section
          id="pricing"
          className="border-t border-[var(--color-border)] bg-[var(--color-card)]"
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

            {/* Tier cards */}
            <div className="mt-14 grid gap-8 md:grid-cols-3">
              {TIERS.map((tier) => (
                <div
                  key={tier.name}
                  className={`relative overflow-visible rounded-xl border p-5 transition-all duration-300 hover:-translate-y-1 sm:p-8 ${
                    tier.featured
                      ? 'border-[var(--color-accent)] bg-[var(--color-background)] shadow-[0_0_40px_var(--color-accent)/10]'
                      : 'border-[var(--color-border)] bg-[var(--color-background)]'
                  }`}
                >
                  {tier.featured && (
                    <span className="landing-gradient-badge absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">
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
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-signal-green)]" aria-hidden="true" />
                        {h}
                      </li>
                    ))}
                  </ul>
                  <a
                    href="mailto:roger@predivo.ch?subject=BenchmarkSignal%20Demo%20Request"
                    className={`mt-8 block min-h-[44px] w-full rounded-full py-3 text-center text-sm font-medium transition-all hover:opacity-90 ${
                      tier.featured
                        ? 'bg-[var(--color-accent)] text-white shadow-lg shadow-[var(--color-accent)]/20 hover:shadow-xl hover:shadow-[var(--color-accent)]/30'
                        : 'border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-foreground)] hover:bg-[var(--color-bg-tertiary)]'
                    }`}
                  >
                    Request a Demo
                  </a>
                </div>
              ))}
            </div>

            {/* Comparison table */}
            <div className="mt-12 overflow-x-auto rounded-xl border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
                    <th className="px-4 py-3 text-left font-medium text-[var(--color-muted-foreground)]">Feature</th>
                    {TIERS.map((t) => (
                      <th key={t.name} className={`px-4 py-3 text-center font-medium ${t.featured ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted-foreground)]'}`}>
                        {t.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row, i) => (
                    <tr key={row.label} className={`border-b border-[var(--color-border)] ${i % 2 === 0 ? '' : 'bg-[var(--color-bg-tertiary)]/50'}`}>
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-[var(--color-foreground)]">{row.label}</td>
                      {row.values.map((val, j) => (
                        <td key={j} className="px-4 py-3 text-center">
                          {val === true ? (
                            <Check className="mx-auto h-4 w-4 text-[var(--color-signal-green)]" aria-label="Included" />
                          ) : val === false ? (
                            <span className="text-[var(--color-muted-foreground)]" aria-label="Not included">&mdash;</span>
                          ) : (
                            <span className="text-[var(--color-foreground)]">{val}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────── */}
        <section
          id="faq"
          className="border-t border-[var(--color-border)]"
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
        <section className="border-t border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="relative mx-auto max-w-4xl overflow-hidden px-6 py-20 text-center md:py-[80px]">
            {/* Subtle background glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-accent)/6%,transparent_60%)]" />
            <div className="relative">
              <h2 className="text-[clamp(1.75rem,4vw,3rem)] font-bold tracking-[-0.02em] text-[var(--color-foreground)]">
                Stop building peer comparisons manually
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[var(--color-muted-foreground)] sm:text-lg">
                Your team spends 3-5 days building peer comparisons that are
                outdated before the board meeting. BenchmarkSignal delivers them
                in 60 minutes, continuously, for less than a single Bloomberg
                seat.
              </p>
              <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <a
                  href="mailto:roger@predivo.ch?subject=BenchmarkSignal%20Demo%20Request"
                  className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-8 py-3.5 text-[15px] font-medium text-[var(--color-primary-foreground)] shadow-lg shadow-[var(--color-accent)]/10 transition-all hover:opacity-90 hover:shadow-xl hover:shadow-[var(--color-accent)]/15"
                >
                  Request a Demo
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-background)] px-8 py-3.5 text-[15px] font-medium text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
                >
                  Create Account
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────── */}
        <footer className="border-t border-[var(--color-border)]">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              &copy; {new Date().getFullYear()} Predivo GmbH. All rights
              reserved.
            </p>
            <div className="flex gap-6">
              <Link
                to="/login"
                className="inline-flex min-h-[44px] items-center text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
              >
                Sign in
              </Link>
              <a
                href="mailto:roger@predivo.ch"
                className="inline-flex min-h-[44px] items-center text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
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
