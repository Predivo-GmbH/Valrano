import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useTheme } from 'next-themes'
import {
  FileText,
  Zap,
  Shield,
  BarChart3,
  Clock,
  Globe,
  ChevronDown,
  ArrowRight,
  AlertCircle,
  Menu,
  X,
  TrendingUp,
  Target,
  Timer,
  Users,
  Sun,
  Moon,
  Lock,
  Mail,
  CheckCircle,
  Loader2,
} from 'lucide-react'
// supabase loaded dynamically in DemoRequestModal to avoid modulepreloading on landing

/* ── Demo Request Modal ──────────────────────────────── */
function DemoRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', company: '', role: '', message: '' })
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.company.trim()) return

    setStatus('sending')
    setErrorMsg('')

    try {
      const { supabase } = await import('@/lib/supabase')
      const { data, error } = await supabase.functions.invoke('request-demo', {
        body: {
          name: form.name.trim(),
          email: form.email.trim(),
          company: form.company.trim(),
          role: form.role.trim() || undefined,
          message: form.message.trim() || undefined,
        },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      setStatus('success')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStatus('error')
    }
  }, [form])

  const handleClose = useCallback(() => {
    onClose()
    // Reset after animation
    setTimeout(() => {
      setForm({ name: '', email: '', company: '', role: '', message: '' })
      setStatus('idle')
      setErrorMsg('')
    }, 200)
  }, [onClose])

  if (!open) return null

  const inputClass = 'w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] px-3.5 py-2.5 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)]/60 outline-none transition-colors focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]/30'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="demo-modal-title">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in-0 duration-200" onClick={handleClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200 sm:p-8">
        <button onClick={handleClose} className="absolute right-4 top-4 rounded-md p-1 text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)] cursor-pointer" aria-label="Close">
          <X className="h-4 w-4" />
        </button>

        {status === 'success' ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10">
              <CheckCircle className="h-7 w-7 text-emerald-500" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-foreground)]">Demo request received</h3>
            <p className="text-sm leading-relaxed text-[var(--color-muted-foreground)]">
              Thank you! We&rsquo;ll reach out within one business day to schedule your personalized walkthrough. Check your inbox for a confirmation email.
            </p>
            <button onClick={handleClose} className="mt-2 rounded-full bg-[var(--color-accent)] px-6 py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-[var(--color-accent)]/90 cursor-pointer">
              Close
            </button>
          </div>
        ) : (
          <>
            <h3 id="demo-modal-title" className="text-lg font-semibold text-[var(--color-foreground)]">Request a Demo</h3>
            <p className="mt-1.5 text-sm text-[var(--color-muted-foreground)]">Tell us about your organization and we&rsquo;ll schedule a personalized walkthrough.</p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="demo-name" className="mb-1.5 block text-xs font-medium text-[var(--color-foreground)]">Full name *</label>
                <input id="demo-name" type="text" required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={inputClass} placeholder="Jane Smith" />
              </div>
              <div>
                <label htmlFor="demo-email" className="mb-1.5 block text-xs font-medium text-[var(--color-foreground)]">Work email *</label>
                <input id="demo-email" type="email" required value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className={inputClass} placeholder="jane@company.com" />
              </div>
              <div>
                <label htmlFor="demo-company" className="mb-1.5 block text-xs font-medium text-[var(--color-foreground)]">Company name *</label>
                <input id="demo-company" type="text" required value={form.company} onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))} className={inputClass} placeholder="Acme Corp" />
              </div>
              <div>
                <label htmlFor="demo-role" className="mb-1.5 block text-xs font-medium text-[var(--color-muted-foreground)]">Role / Title</label>
                <input id="demo-role" type="text" value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))} className={inputClass} placeholder="Head of Corporate Strategy" />
              </div>
              <div>
                <label htmlFor="demo-message" className="mb-1.5 block text-xs font-medium text-[var(--color-muted-foreground)]">Message</label>
                <textarea id="demo-message" rows={3} value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} className={inputClass + ' resize-none'} placeholder="Tell us about your benchmarking needs..." />
              </div>

              {status === 'error' && (
                <p className="flex items-center gap-1.5 text-sm text-red-500">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={status === 'sending'}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-accent-foreground shadow-lg shadow-[var(--color-accent)]/20 transition-all hover:shadow-xl hover:shadow-[var(--color-accent)]/30 disabled:opacity-60 cursor-pointer min-h-[44px]"
              >
                {status === 'sending' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Submit Request
                  </>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Scroll-reveal hook ────────────────────────────── */
function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return { ref, visible }
}

/* ── Reduced-motion check ─────────────────────────── */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return reduced
}

/* ── Mouse parallax hook (hero only) — throttled to ~60fps ── */
function useMouseParallax() {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const rafId = useRef(0)
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (reducedMotion) return
    const handleMove = (e: MouseEvent) => {
      if (rafId.current) return
      rafId.current = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * 2
        const y = (e.clientY / window.innerHeight - 0.5) * 2
        setOffset({ x, y })
        rafId.current = 0
      })
    }
    window.addEventListener('mousemove', handleMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handleMove)
      if (rafId.current) cancelAnimationFrame(rafId.current)
    }
  }, [reducedMotion])

  return offset
}

/* ── Animated count-up hook ─────────────────────────── */
function useCountUp(end: number, duration = 2000, startOnView = true) {
  const reducedMotion = usePrefersReducedMotion()
  const [count, setCount] = useState(reducedMotion ? end : 0)
  const [started, setStarted] = useState(
    reducedMotion || !startOnView || typeof IntersectionObserver === 'undefined'
  )
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (reducedMotion || !startOnView || !ref.current || typeof IntersectionObserver === 'undefined') return
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
  }, [startOnView, reducedMotion])

  useEffect(() => {
    if (reducedMotion || !started) return
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
  }, [started, end, duration, reducedMotion])

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
function FaqItem({ q, a, defaultOpen = false }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
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

/* ── Stat card with odometer-style digits ─────────── */
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
  const digits = String(count).split('')

  return (
    <div
      ref={ref}
      className="group relative flex flex-col items-center gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:border-[var(--color-accent)]/30 hover:shadow-[0_8px_30px_var(--color-accent)/8] sm:p-8"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent)]/10 transition-transform duration-300 group-hover:scale-110">
        <Icon className="h-6 w-6 text-[var(--color-accent)]" />
      </div>
      <div className="flex items-baseline gap-0.5 text-3xl font-bold tracking-tight text-[var(--color-foreground)] sm:text-4xl">
        {digits.map((d, i) => (
          <span key={i} className="inline-block tabular-nums transition-transform duration-300" style={{ animationDelay: `${i * 50}ms` }}>
            {d}
          </span>
        ))}
        <span className="text-[var(--color-accent)]">{suffix}</span>
      </div>
      <p className="text-sm text-[var(--color-muted-foreground)]">{label}</p>
    </div>
  )
}

/* ── Floating geometric shape ─────────────────────── */
function FloatingShape({ size, x, y, delay, rotation, color, mouseOffset }: {
  size: number; x: string; y: string; delay: number; rotation: number; color: string; mouseOffset: { x: number; y: number }
}) {
  const reducedMotion = usePrefersReducedMotion()
  const parallaxFactor = size / 100
  return (
    <div
      className="absolute opacity-[0.07] blur-[1px]"
      style={{
        width: size, height: size, left: x, top: y,
        transform: reducedMotion
          ? `rotate(${rotation}deg)`
          : `rotate(${rotation}deg) translate(${mouseOffset.x * parallaxFactor * 12}px, ${mouseOffset.y * parallaxFactor * 12}px)`,
        transition: reducedMotion ? 'none' : 'transform 0.3s ease-out',
        animation: reducedMotion ? 'none' : `landing-float ${6 + delay}s ease-in-out ${delay}s infinite`,
      }}
    >
      <div className="h-full w-full rounded-[20%]" style={{ background: `linear-gradient(135deg, ${color}, transparent)` }} />
    </div>
  )
}

/* ── Browser frame mockup ─────────────────────────── */
function BrowserFrame() {
  const { ref, visible } = useScrollReveal<HTMLDivElement>()
  return (
    <div ref={ref} className="transition-all duration-1000" style={{ perspective: '1200px', transform: visible ? 'translateY(0)' : 'translateY(48px)', opacity: visible ? 1 : 0 }}>
      <div className="mx-auto max-w-4xl transition-transform duration-1000" style={{ transform: visible ? 'rotateX(0deg)' : 'rotateX(8deg)', transformOrigin: 'bottom center' }}>
        <div className="rounded-t-xl border border-b-0 border-[var(--color-border)] bg-[var(--color-card)] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
              <div className="h-3 w-3 rounded-full bg-[#FEBC2E]" />
              <div className="h-3 w-3 rounded-full bg-[#28C840]" />
            </div>
            <div className="flex flex-1 items-center gap-2 rounded-md bg-[var(--color-background)] px-3 py-1.5 text-xs text-[var(--color-muted-foreground)]">
              <Lock className="h-3 w-3" /><span>valrano.com/dashboard</span>
            </div>
          </div>
        </div>
        <div className="overflow-hidden rounded-b-xl border border-t-0 border-[var(--color-border)] bg-[var(--color-background)] p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between rounded-lg bg-[var(--color-card)] p-3">
            <div className="flex items-center gap-4"><div className="h-6 w-6 rounded bg-[var(--color-accent)]/20" /><div className="h-3 w-24 rounded bg-[var(--color-muted-foreground)]/20" /></div>
            <div className="flex gap-3"><div className="h-3 w-16 rounded bg-[var(--color-muted-foreground)]/15" /><div className="h-3 w-16 rounded bg-[var(--color-muted-foreground)]/15" /><div className="h-3 w-16 rounded bg-[var(--color-muted-foreground)]/15" /></div>
          </div>
          {/* Metric cards — matches real dashboard */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Pipeline Active', val: '3', color: 'var(--color-accent)' },
              { label: 'Next Report', val: 'in 5d', color: 'var(--color-signal-green)' },
              { label: 'Documents Ready', val: '4', color: 'var(--color-signal-green)' },
              { label: 'Pending Reviews', val: '1', color: 'var(--color-signal-amber)' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
                <div className="text-[10px] text-[var(--color-muted-foreground)]">{kpi.label}</div>
                <div className="mt-1 text-sm font-bold text-[var(--color-foreground)]">{kpi.val}</div>
                <div className="mt-1 h-1 w-2/3 rounded-full" style={{ backgroundColor: kpi.color, opacity: 0.6 }} />
              </div>
            ))}
          </div>
          {/* Pipeline status bar — matches real dashboard */}
          <div className="mb-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[10px] font-medium text-[var(--color-muted-foreground)]">Pipeline Status</span>
              <span className="text-[10px] text-[var(--color-accent)]">4 stages</span>
            </div>
            <div className="flex gap-1">
              {[
                { label: 'Scheduled', w: '30%', opacity: 0.25 },
                { label: 'Detected', w: '25%', opacity: 0.45 },
                { label: 'Ingested', w: '25%', opacity: 0.65 },
                { label: 'Benchmark', w: '20%', opacity: 0.85 },
              ].map((stage) => (
                <div key={stage.label} className="flex-1">
                  <div className="h-2 rounded-full" style={{ backgroundColor: 'var(--color-accent)', opacity: stage.opacity }} />
                  <div className="mt-1 text-center text-[8px] text-[var(--color-muted-foreground)]">{stage.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            {/* Upcoming publications — matches real dashboard */}
            <div className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3">
              <div className="mb-2 text-[10px] font-medium text-[var(--color-muted-foreground)]">Upcoming Publications</div>
              {[
                { name: 'Atlas Corp', type: 'Q1 2026', days: '3d', color: 'var(--color-signal-amber)' },
                { name: 'Meridian Group', type: 'Annual', days: '6d', color: 'var(--color-signal-green)' },
                { name: 'Nova Industries', type: 'Q1 2026', days: '15d', color: 'var(--color-signal-green)' },
              ].map((pub) => (
                <div key={pub.name} className="flex items-center gap-2 border-b border-[var(--color-border)] py-1.5 last:border-0">
                  <div className="h-4 w-4 rounded bg-[var(--color-accent)]/15" />
                  <span className="text-[10px] text-[var(--color-foreground)]">{pub.name}</span>
                  <span className="text-[9px] text-[var(--color-muted-foreground)]">{pub.type}</span>
                  <span className="ml-auto text-[10px] font-medium" style={{ color: pub.color }}>{pub.days}</span>
                </div>
              ))}
            </div>
            {/* Competitor comparison — matches real dashboard */}
            <div className="hidden w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-3 sm:block">
              <div className="mb-2 text-[10px] font-medium text-[var(--color-muted-foreground)]">Competitor Signals</div>
              {[
                { name: 'Atlas Corp', signal: '+3.2%', color: 'var(--color-signal-green)' },
                { name: 'Meridian Group', signal: '-1.4%', color: 'var(--color-signal-red)' },
                { name: 'Nova Industries', signal: '+0.8%', color: 'var(--color-signal-green)' },
                { name: 'Vertex Ltd', signal: '—', color: 'var(--color-muted-foreground)' },
                { name: 'Centra AG', signal: '+2.1%', color: 'var(--color-signal-green)' },
              ].map((comp) => (
                <div key={comp.name} className="flex items-center gap-2 border-b border-[var(--color-border)] py-1.5 last:border-0">
                  <div className="h-4 w-4 rounded-full bg-[var(--color-accent)]/15" />
                  <span className="text-[10px] text-[var(--color-muted-foreground)]">{comp.name}</span>
                  <span className="ml-auto text-[10px] font-medium" style={{ color: comp.color }}>{comp.signal}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Process step with animated connector ─────────── */
function ProcessStep({ step, title, desc, icon: Icon, isLast, visible, delay }: {
  step: string; title: string; desc: string; icon: React.ComponentType<{ className?: string }>; isLast: boolean; visible: boolean; delay: number
}) {
  return (
    <div className="relative flex flex-col items-center text-center">
      {!isLast && (
        <div className="absolute left-[calc(50%+32px)] top-6 hidden h-[2px] w-[calc(100%-64px)] md:block">
          <div className="h-full bg-gradient-to-r from-[var(--color-accent)] to-[var(--color-accent)]/30 transition-all duration-1000" style={{ width: visible ? '100%' : '0%', transitionDelay: `${delay + 300}ms` }} />
        </div>
      )}
      <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[var(--color-accent)]/40 bg-[var(--color-card)] shadow-[0_0_20px_var(--color-accent)/10] transition-all duration-700" style={{ transform: visible ? 'scale(1)' : 'scale(0.5)', opacity: visible ? 1 : 0, transitionDelay: `${delay}ms` }}>
        <Icon className="h-6 w-6 text-[var(--color-accent)]" />
      </div>
      <div className="mt-5 transition-all duration-700" style={{ transform: visible ? 'translateY(0)' : 'translateY(16px)', opacity: visible ? 1 : 0, transitionDelay: `${delay + 200}ms` }}>
        <div className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-xs font-bold text-[var(--color-accent)]">{step}</div>
        <h3 className="text-lg font-semibold text-[var(--color-foreground)]">{title}</h3>
        <p className="mx-auto mt-2 max-w-[280px] text-sm leading-relaxed text-[var(--color-muted-foreground)]">{desc}</p>
      </div>
    </div>
  )
}

/* ── Pain point card (hooks-safe component) ───────── */
function PainPointCard({ p, index }: {
  p: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string }; index: number
}) {
  const { ref, visible } = useScrollReveal<HTMLDivElement>()
  return (
    <div ref={ref} className="group rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 transition-all duration-500 hover:-translate-y-1 hover:border-[var(--color-signal-red)]/30 hover:shadow-lg sm:p-8"
      style={{ transform: visible ? 'translateY(0)' : 'translateY(24px)', opacity: visible ? 1 : 0, transitionDelay: `${index * 100}ms` }}>
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-signal-red)]/10 transition-transform duration-300 group-hover:scale-110">
        <p.icon className="h-5 w-5 text-[var(--color-signal-red)]" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-[var(--color-foreground)]">{p.title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-[var(--color-muted-foreground)]">{p.desc}</p>
    </div>
  )
}

/* ── Enterprise include item (hooks-safe) ────────── */
function EnterpriseItem({ item, index }: {
  item: { icon: React.ComponentType<{ className?: string }>; text: string }; index: number
}) {
  const { ref, visible } = useScrollReveal<HTMLDivElement>()
  return (
    <div ref={ref} className="flex items-start gap-3 rounded-lg p-3 transition-all hover:bg-[var(--color-accent)]/5"
      style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateX(0)' : 'translateX(-12px)', transitionDelay: `${index * 60}ms`, transitionDuration: '400ms' }}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]/10">
        <item.icon className="h-4.5 w-4.5 text-[var(--color-accent)]" aria-hidden="true" />
      </div>
      <span className="text-[15px] leading-snug text-[var(--color-foreground)]">{item.text}</span>
    </div>
  )
}

/* ── Feature card (hooks-safe component) ─────────── */
function FeatureCard({ f, index, visible }: {
  f: { icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { className?: string }>; title: string; desc: string; span: string; featured?: boolean; accent: string }; index: number; visible: boolean
}) {
  return (
    <div className={`group relative overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] p-6 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(0,0,0,0.12)] sm:p-7 ${f.span}`}
      style={{ transform: visible ? 'translateY(0)' : 'translateY(32px)', opacity: visible ? 1 : 0, transitionDelay: `${index * 80}ms` }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${f.accent}40`; e.currentTarget.style.boxShadow = `0 12px 40px ${f.accent}15, inset 0 1px 0 ${f.accent}20` }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.boxShadow = '' }}>
      {f.featured && <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-accent)]/5 to-transparent" />}
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full blur-[40px] transition-opacity duration-500 group-hover:opacity-[0.08]" style={{ backgroundColor: f.accent, opacity: 0 }} />
      <div className="relative">
        <div className={`flex items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 ${f.featured ? 'h-12 w-12' : 'h-10 w-10'}`} style={{ backgroundColor: `${f.accent}18` }}>
          <f.icon className={f.featured ? 'h-6 w-6' : 'h-5 w-5'} color={f.accent} aria-hidden="true" />
        </div>
        <h3 className={`mt-4 font-semibold text-[var(--color-foreground)] ${f.featured ? 'text-xl' : 'text-[15px]'}`}>{f.title}</h3>
        <p className={`mt-2 leading-relaxed text-[var(--color-muted-foreground)] ${f.featured ? 'text-[15px]' : 'text-sm'}`}>{f.desc}</p>
      </div>
    </div>
  )
}

/* ── Data ─────────────────────────────────────────────── */
const PAIN_POINTS = [
  { icon: Clock, title: '3-5 weeks per cycle', desc: 'Strategy teams spend weeks every quarter collecting, normalizing, and reconciling competitor data from published reports across multiple departments.' },
  { icon: AlertCircle, title: 'Definitional chaos', desc: 'One competitor reports "Recurring EBIT", another calls it "RCO", a third uses "Adjusted EBITDA" — every company uses different KPI definitions, currencies, and accounting standards.' },
  { icon: Globe, title: 'Asynchronous publications', desc: "Competitors publish at different times in different formats across SIX, NYSE, XETRA, and Euronext. By the time your team compiles the data, it's already stale." },
]

const FEATURES = [
  { icon: FileText, title: 'Vision-LLM extraction', desc: 'AI reads published PDF reports — annual, quarterly, sustainability — and extracts 50+ financial and ESG KPIs with 98% target accuracy. Every value links back to its source page.', span: 'md:col-span-2 md:row-span-2', featured: true, accent: '#3B82F6' },
  { icon: BarChart3, title: 'KPI taxonomy mapping', desc: 'Automatically maps company-specific definitions to a canonical taxonomy. Compare apples to apples across IFRS, US GAAP, and Swiss GAAP FER.', span: 'md:col-span-1 md:row-span-1', accent: '#8B5CF6' },
  { icon: Globe, title: 'Multi-currency normalization', desc: 'Point-in-time and period-average FX conversion across CHF, EUR, USD, GBP, and 10+ currencies.', span: 'md:col-span-1 md:row-span-1', accent: '#06B6D4' },
  { icon: Zap, title: 'Automated benchmark documents', desc: 'When a competitor publishes, Valrano detects it, extracts KPIs, normalizes currencies, and drafts a benchmark document — your team just reviews and approves.', span: 'md:col-span-1 md:row-span-1', accent: '#F59E0B' },
  { icon: Shield, title: 'Full audit trail', desc: 'Every extracted value carries a confidence score and links to the exact PDF page and paragraph. Your team can verify any number in one click.', span: 'md:col-span-1 md:row-span-1', accent: '#10B981' },
  { icon: Clock, title: 'Continuous monitoring', desc: 'No more quarterly scrambles. Valrano monitors your competitors across all exchanges and delivers alerts the moment a new report drops.', span: 'md:col-span-2 md:row-span-1', accent: '#EC4899' },
]

const STATS = [
  { value: 200, suffix: '+', label: 'Hours saved per year', icon: Timer },
  { value: 90, suffix: '%', label: 'Of manual collection eliminated', icon: Zap },
  { value: 98, suffix: '%', label: 'Target extraction accuracy', icon: Target },
  { value: 30, suffix: '+', label: 'Competitors supported', icon: Users },
]

const ENTERPRISE_INCLUDES = [
  { icon: Users, text: 'Unlimited users with role-based access' },
  { icon: BarChart3, text: '50+ financial and ESG KPIs per competitor' },
  { icon: Globe, text: 'Up to 30+ competitors monitored continuously' },
  { icon: Zap, text: 'Automated detect → extract → normalize → benchmark pipeline' },
  { icon: FileText, text: 'AI-generated benchmark documents with source citations' },
  { icon: Shield, text: 'Corporate template export (PPTX, XLSX, Google Workspace)' },
  { icon: TrendingUp, text: 'AI-powered insights and competitive signals' },
  { icon: Target, text: 'Dedicated Customer Success Manager + QBR' },
]

const FAQS = [
  { q: 'How accurate is AI extraction? Can we trust these numbers for board-level reporting?', a: 'Valrano uses a multi-layer accuracy architecture: vision-LLM extraction with structured schemas, confidence scoring (values below 0.85 are flagged for human review), and cross-validation against known financial relationships. Every extracted value links to its source PDF page for one-click verification. The result is more auditable than any manual process — every number traces back to its source document.' },
  { q: 'We already have Bloomberg / FactSet. Why do we need another tool?', a: 'Bloomberg and FactSet provide raw financial data for investors. They do not extract KPIs from newly published PDF reports, normalize company-specific definitions (Recurring EBIT vs. RCO vs. Adjusted EBITDA), or deliver AI-generated benchmark documents automatically, replacing the manual effort of collecting, normalizing, and comparing competitor data. Valrano replaces the 200+ hours/year your team spends turning raw data into competitor comparisons. It is a complement, not a replacement.' },
  { q: 'What about data security and compliance?', a: 'Valrano processes exclusively publicly available documents — annual reports, quarterly filings, and sustainability reports that companies publish on their IR websites. No customer internal data is ever uploaded or processed. Your competitor group configuration is confidential. Data is hosted in EU data centers with encryption at rest and in transit.' },
  { q: 'Which accounting standards and currencies do you support?', a: 'IFRS, US GAAP, and Swiss GAAP FER for accounting standards. For currencies, we support CHF, EUR, USD, GBP, INR, MXN, AUD, HKD, and more — using both point-in-time and period-average FX rates for accurate normalization.' },
  { q: 'How long does implementation take?', a: 'A typical onboarding takes 2 weeks: we configure your competitor group, run historical extraction on past reports, validate accuracy with your team, and train users. You receive your first benchmark document within 2 weeks of go-live.' },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', name: 'Valrano', url: 'https://valrano.com', logo: 'https://valrano.com/favicon.svg', description: 'Fully automated competitive benchmarking platform for listed corporations. AI-powered KPI extraction from competitor reports.', parentOrganization: { '@type': 'Organization', name: 'Predivo GmbH', url: 'https://predivo.ch' } },
    { '@type': 'SoftwareApplication', name: 'Valrano', applicationCategory: 'BusinessApplication', operatingSystem: 'Web', description: 'AI-powered competitive benchmarking: extract financial and ESG KPIs from competitor PDF reports, normalize across currencies and standards, deliver board-ready benchmark documents automatically.', offers: { '@type': 'AggregateOffer', priceCurrency: 'CHF', availability: 'https://schema.org/OnlineOnly', description: 'Contact us for enterprise pricing' } },
    { '@type': 'FAQPage', mainEntity: FAQS.map((faq) => ({ '@type': 'Question', name: faq.q, acceptedAnswer: { '@type': 'Answer', text: faq.a } })) },
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
      @keyframes landing-fade-up { 0% { opacity: 0; transform: translateY(24px); filter: blur(8px); } 100% { opacity: 1; transform: translateY(0); filter: blur(0); } }
      @keyframes landing-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      @keyframes landing-pulse-glow { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.7; } }
      @keyframes landing-gradient-shift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
      @keyframes landing-grain { 0%, 100% { transform: translate(0, 0); } 10% { transform: translate(-5%, -10%); } 30% { transform: translate(3%, -15%); } 50% { transform: translate(12%, 9%); } 70% { transform: translate(9%, 4%); } 90% { transform: translate(-1%, 7%); } }
      @keyframes landing-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
      .landing-animate-in { animation: landing-fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
      .landing-delay-1 { animation-delay: 0.1s; }
      .landing-delay-2 { animation-delay: 0.2s; }
      .landing-delay-3 { animation-delay: 0.35s; }
      .landing-delay-4 { animation-delay: 0.5s; }
      .landing-delay-5 { animation-delay: 0.65s; }
      .landing-float { animation: landing-float 6s ease-in-out infinite; }
      .landing-gradient-badge { background: linear-gradient(90deg, #3B82F6, #8B5CF6, #EC4899, #3B82F6); background-size: 300% 100%; animation: landing-gradient-shift 3s linear infinite; }
    `
    document.head.appendChild(style)
    return () => { style.remove() }
  }, [])
}

/* ── Landing Page ─────────────────────────────────────── */
export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [demoModalOpen, setDemoModalOpen] = useState(false)
  const { theme, setTheme } = useTheme()
  const mouseOffset = useMouseParallax()
  useAnimationStyles()

  const processRef = useRef<HTMLDivElement>(null)
  const [processVisible, setProcessVisible] = useState(false)
  useEffect(() => {
    if (!processRef.current || typeof IntersectionObserver === 'undefined') { setProcessVisible(true); return }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setProcessVisible(true); observer.disconnect() } }, { threshold: 0.2 })
    observer.observe(processRef.current)
    return () => observer.disconnect()
  }, [])

  const featuresRef = useRef<HTMLDivElement>(null)
  const [featuresVisible, setFeaturesVisible] = useState(false)
  useEffect(() => {
    if (!featuresRef.current || typeof IntersectionObserver === 'undefined') { setFeaturesVisible(true); return }
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setFeaturesVisible(true); observer.disconnect() } }, { threshold: 0.1 })
    observer.observe(featuresRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <Helmet>
        <title>Valrano — AI-Powered Competitive Benchmarking for Listed Corporations</title>
        <meta name="description" content="Replace 200+ hours of quarterly analyst work with AI-powered competitive benchmarking. Extract and compare financial and ESG KPIs from competitor reports automatically." />
        <meta property="og:title" content="Valrano — AI-Powered Competitive Benchmarking" />
        <meta property="og:description" content="Extract financial and ESG KPIs from competitor PDF reports, normalize across currencies and standards, deliver board-ready benchmark documents automatically." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://valrano.com" />
        <meta property="og:image" content="https://valrano.com/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:site_name" content="Valrano" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Valrano — AI-Powered Competitive Benchmarking" />
        <meta name="twitter:description" content="AI-powered competitive benchmarking. Extract and compare financial and ESG KPIs from competitor reports." />
        <meta name="twitter:image" content="https://valrano.com/og-image.png" />
        <link rel="canonical" href="https://valrano.com" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      {/* Grain overlay */}
      <div className="pointer-events-none fixed inset-0 z-[60] opacity-[0.025]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")", animation: 'landing-grain 8s steps(10) infinite' }} />

      {/* Navbar */}
      <nav className="fixed top-0 z-50 w-full border-b border-[var(--color-border)]/50 bg-[var(--color-background)]/70 backdrop-blur-2xl backdrop-saturate-150" aria-label="Landing navigation">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="text-lg font-bold tracking-tight text-[var(--color-foreground)]">Valrano</Link>
          <div className="hidden items-center gap-8 md:flex">
            <a href="#features" className="inline-flex min-h-[44px] items-center text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">Features</a>
            <a href="#pricing" className="inline-flex min-h-[44px] items-center text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">Pricing</a>
            <a href="#faq" className="inline-flex min-h-[44px] items-center text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">FAQ</a>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme" className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <Link to="/login" className="inline-flex min-h-[44px] items-center text-sm font-medium text-[var(--color-foreground)] transition-colors hover:text-[var(--color-accent)]">Sign in</Link>
            <button onClick={() => setDemoModalOpen(true)} className="inline-flex min-h-[44px] items-center rounded-full bg-[var(--color-accent)] px-5 py-2 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 cursor-pointer">Request a Demo</button>
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <Link to="/signup" className="rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-medium text-[var(--color-primary-foreground)] transition-opacity hover:opacity-90">Get Started</Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileMenuOpen} className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="border-t border-[var(--color-border)]/50 bg-[var(--color-background)]/95 px-4 sm:px-6 pb-4 pt-2 backdrop-blur-2xl md:hidden">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block min-h-[44px] py-3 text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">Features</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block min-h-[44px] py-3 text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">Pricing</a>
            <a href="#faq" onClick={() => setMobileMenuOpen(false)} className="block min-h-[44px] py-3 text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">FAQ</a>
            <Link to="/login" onClick={() => setMobileMenuOpen(false)} className="block min-h-[44px] py-3 text-sm font-medium text-[var(--color-foreground)]">Sign in</Link>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="flex min-h-[44px] items-center gap-2 py-3 text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
        )}
      </nav>

      <main>
        {/* Hero */}
        <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-16">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-accent)/8%,transparent_60%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,var(--color-accent)/5%,transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--color-accent)/4%,transparent_40%)]" />
          <div className="absolute inset-0 opacity-[0.3]" style={{ backgroundImage: 'radial-gradient(var(--color-muted-foreground) 1px, transparent 1px)', backgroundSize: '24px 24px', maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)', WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)' }} />
          <FloatingShape size={120} x="8%" y="15%" delay={0} rotation={12} color="var(--color-accent)" mouseOffset={mouseOffset} />
          <FloatingShape size={80} x="85%" y="20%" delay={1.5} rotation={-20} color="#8B5CF6" mouseOffset={mouseOffset} />
          <FloatingShape size={60} x="75%" y="65%" delay={0.8} rotation={45} color="#EC4899" mouseOffset={mouseOffset} />
          <FloatingShape size={100} x="5%" y="70%" delay={2} rotation={-8} color="#06B6D4" mouseOffset={mouseOffset} />
          <FloatingShape size={50} x="45%" y="80%" delay={1.2} rotation={30} color="#F59E0B" mouseOffset={mouseOffset} />
          <div className="absolute left-1/2 top-1/3 h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--color-accent)] opacity-[0.04] blur-[120px]" style={{ animation: 'landing-pulse-glow 4s ease-in-out infinite' }} />
          <div className="relative mx-auto max-w-5xl px-4 sm:px-6 py-24 text-center md:py-36">
            <div className="landing-animate-in landing-delay-1">
              <span className="landing-gradient-badge inline-block rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-white">AI-Powered Competitive Benchmarking</span>
            </div>
            <h1 className="landing-animate-in landing-delay-2 mt-8 text-[clamp(2.75rem,7vw,5.5rem)] font-bold leading-[1.02] tracking-[-0.035em] text-[var(--color-foreground)]">
              Board-ready competitive benchmarking<br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-[var(--color-accent)] via-[#8B5CF6] to-[#EC4899] bg-clip-text text-transparent">fully automated</span>
            </h1>
            <p className="landing-animate-in landing-delay-3 mx-auto mt-8 max-w-2xl text-base leading-relaxed text-[var(--color-muted-foreground)] sm:text-lg md:text-xl">
              Replace 200+ hours of quarterly analyst work with a single platform that extracts, normalizes, and compares financial and ESG KPIs from competitor reports &mdash; automatically.
            </p>
            <div className="landing-animate-in landing-delay-4 mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <button onClick={() => setDemoModalOpen(true)} className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-[var(--color-accent)] px-8 py-4 text-[15px] font-medium text-accent-foreground shadow-lg shadow-[var(--color-accent)]/25 transition-all hover:shadow-xl hover:shadow-[var(--color-accent)]/35 cursor-pointer">
                <div className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)', backgroundSize: '200% 100%', animation: 'landing-shimmer 1.5s infinite' }} />
                <span className="relative">Request a Demo</span>
                <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </button>
              <a href="#how-it-works" className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/50 px-8 py-4 text-[15px] font-medium text-[var(--color-foreground)] backdrop-blur-sm transition-all hover:bg-[var(--color-card)]">See How It Works</a>
            </div>
            <p className="landing-animate-in landing-delay-5 mt-8 text-xs text-[var(--color-muted-foreground)]/70">Built for corporate strategy teams at listed companies</p>
          </div>
        </section>

        {/* Product Screenshot */}
        <section className="border-t border-[var(--color-border)] bg-gradient-to-b from-[var(--color-background)] to-[var(--color-card)]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16 md:py-24"><BrowserFrame /></div>
        </section>

        {/* Stats */}
        <section className="border-t border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 md:py-24">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {STATS.map((stat) => <StatCard key={stat.label} value={stat.value} suffix={stat.suffix} label={stat.label} icon={stat.icon} />)}
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="border-t border-[var(--color-border)]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-24 md:py-28">
            <div className="text-center">
              <SectionLabel>The Problem</SectionLabel>
              <h2 className="mt-2 text-[clamp(2rem,4.5vw,3.25rem)] font-bold tracking-[-0.025em] text-[var(--color-foreground)]">Competitive benchmarking is broken</h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[var(--color-muted-foreground)]">Every quarter, strategy teams download PDFs from IR pages, collect market data from multiple sources, pull ESG from yet another, and spend weeks manually normalizing everything.</p>
            </div>
            <div className="mt-16 grid gap-8 md:grid-cols-3">
              {PAIN_POINTS.map((p, i) => <PainPointCard key={p.title} p={p} index={i} />)}
            </div>
          </div>
        </section>

        {/* Solution */}
        <section className="border-t border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-24 md:py-28">
            <div className="text-center">
              <SectionLabel>The Solution</SectionLabel>
              <h2 className="mt-2 text-[clamp(2rem,4.5vw,3.25rem)] font-bold tracking-[-0.025em] text-[var(--color-foreground)]">From publication to benchmark document &mdash; fully automated</h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[var(--color-muted-foreground)]">Valrano monitors your competitors across every exchange, automatically extracts KPIs from published reports, normalizes across currencies and accounting standards, and delivers AI-generated benchmark documents &mdash; so your board gets answers, not raw data.</p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="border-t border-[var(--color-border)]">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-24 md:py-28">
            <div className="text-center">
              <SectionLabel>How It Works</SectionLabel>
              <h2 className="mt-2 text-[clamp(2rem,4.5vw,3.25rem)] font-bold tracking-[-0.025em] text-[var(--color-foreground)]">Three steps to automated intelligence</h2>
            </div>
            <div ref={processRef} className="mt-20 grid gap-12 md:grid-cols-3 md:gap-0">
              {[
                { step: '01', title: 'Monitor', desc: 'Automatic detection when any competitor publishes a new report across SIX, NYSE, XETRA, Euronext, and more.', icon: Globe },
                { step: '02', title: 'Extract & Normalize', desc: 'Vision-LLMs extract 50+ KPIs. Multi-currency normalization, taxonomy mapping, and confidence scoring.', icon: BarChart3 },
                { step: '03', title: 'Deliver', desc: 'Board-ready benchmark documents with competitor comparisons, trend analysis, and competitive signals — ready for your team to review, approve, and share.', icon: TrendingUp },
              ].map((s, i) => <ProcessStep key={s.step} step={s.step} title={s.title} desc={s.desc} icon={s.icon} isLast={i === 2} visible={processVisible} delay={i * 300} />)}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-24 md:py-28">
            <div className="text-center">
              <SectionLabel>Features</SectionLabel>
              <h2 className="mt-2 text-[clamp(2rem,4.5vw,3.25rem)] font-bold tracking-[-0.025em] text-[var(--color-foreground)]">Built for corporate strategy teams</h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[var(--color-muted-foreground)]">Every feature designed for CFOs, strategy heads, controllers, and IR officers &mdash; not investors screening stocks.</p>
            </div>
            <div ref={featuresRef} className="mt-16 grid auto-rows-[minmax(160px,auto)] gap-4 md:grid-cols-4">
              {FEATURES.map((f, i) => <FeatureCard key={f.title} f={f} index={i} visible={featuresVisible} />)}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="border-t border-[var(--color-border)]">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 py-24 md:py-28">
            <div className="text-center">
              <SectionLabel>Enterprise Solution</SectionLabel>
              <h2 className="mt-2 text-[clamp(2rem,4.5vw,3.25rem)] font-bold tracking-[-0.025em] text-[var(--color-foreground)]">Tailored to your organization</h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[var(--color-muted-foreground)]">Every deployment is configured for your competitor group, KPI taxonomy, and reporting cadence. We work with your team to ensure Valrano fits seamlessly into your existing workflows.</p>
            </div>
            <div className="relative mt-14 rounded-2xl border border-[var(--color-accent)]/20 bg-[var(--color-card)] p-6 shadow-[0_0_60px_var(--color-accent)/6] sm:p-10">
              <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)]/40 to-transparent" />
              <div className="grid gap-4 sm:grid-cols-2">
                {ENTERPRISE_INCLUDES.map((item, i) => <EnterpriseItem key={item.text} item={item} index={i} />)}
              </div>
              <div className="mt-10 flex flex-col items-center gap-4 border-t border-[var(--color-border)] pt-8 sm:flex-row sm:justify-center">
                <button onClick={() => setDemoModalOpen(true)} className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-[var(--color-accent)] px-8 py-3.5 text-[15px] font-medium text-accent-foreground shadow-lg shadow-[var(--color-accent)]/20 transition-all hover:shadow-xl hover:shadow-[var(--color-accent)]/30 cursor-pointer">
                  <div className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)', backgroundSize: '200% 100%', animation: 'landing-shimmer 1.5s infinite' }} />
                  <span className="relative">Schedule a Consultation</span>
                  <ArrowRight className="relative h-4 w-4" aria-hidden="true" />
                </button>
                <span className="text-sm text-[var(--color-muted-foreground)]">Typical onboarding: 2 weeks</span>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="border-t border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 py-24 md:py-28">
            <div className="text-center">
              <SectionLabel>FAQ</SectionLabel>
              <h2 className="mt-2 text-[clamp(2rem,4.5vw,3.25rem)] font-bold tracking-[-0.025em] text-[var(--color-foreground)]">Frequently asked questions</h2>
            </div>
            <div className="mt-14">
              {FAQS.map((faq, i) => <FaqItem key={faq.q} q={faq.q} a={faq.a} defaultOpen={i < 2} />)}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-[var(--color-border)]">
          <div className="relative mx-auto max-w-4xl overflow-hidden px-4 sm:px-6 py-24 text-center md:py-28">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-accent)/8%,transparent_60%)]" />
            <div className="relative">
              <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold tracking-[-0.025em] text-[var(--color-foreground)]">Stop building competitor comparisons manually</h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[var(--color-muted-foreground)] sm:text-lg md:text-xl">Your team spends weeks building competitor comparisons that are outdated before the board meeting. Valrano builds them automatically and continuously — your analysts review insights instead of collecting data.</p>
              <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <button onClick={() => setDemoModalOpen(true)} className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-[var(--color-accent)] px-8 py-4 text-[15px] font-medium text-accent-foreground shadow-lg shadow-[var(--color-accent)]/25 transition-all hover:shadow-xl hover:shadow-[var(--color-accent)]/35 cursor-pointer">
                  <div className="absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)', backgroundSize: '200% 100%', animation: 'landing-shimmer 1.5s infinite' }} />
                  <span className="relative">Request a Demo</span>
                  <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </button>
                <Link to="/signup" className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-card)]/50 px-8 py-4 text-[15px] font-medium text-[var(--color-foreground)] backdrop-blur-sm transition-all hover:bg-[var(--color-card)]">Create Account</Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[var(--color-border)] bg-[var(--color-card)]">
          <div className="h-px bg-gradient-to-r from-transparent via-[var(--color-accent)]/30 to-transparent" />
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-16">
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-lg font-bold tracking-tight text-[var(--color-foreground)]">Valrano</div>
                <p className="mt-3 text-sm leading-relaxed text-[var(--color-muted-foreground)]">AI-powered competitive benchmarking for listed corporations. Automated detection, extraction, and analysis of competitor reports.</p>
                <div className="mt-4 flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]"><Shield className="h-3.5 w-3.5" /><span>Swiss-hosted &middot; GDPR compliant</span></div>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted-foreground)]">Product</h3>
                <ul className="mt-4 space-y-3">
                  <li><a href="#features" className="text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">Features</a></li>
                  <li><a href="#how-it-works" className="text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">How It Works</a></li>
                  <li><a href="#pricing" className="text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">Pricing</a></li>
                  <li><a href="#faq" className="text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">FAQ</a></li>
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted-foreground)]">Company</h3>
                <ul className="mt-4 space-y-3">
                  <li><a href="https://predivo.ch" target="_blank" rel="noopener noreferrer" className="text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">Predivo GmbH</a></li>
                  <li><a href="mailto:hello@valrano.com" className="text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">Contact</a></li>
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-[var(--color-muted-foreground)]">Access</h3>
                <ul className="mt-4 space-y-3">
                  <li><Link to="/login" className="text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">Sign in</Link></li>
                  <li><button onClick={() => setDemoModalOpen(true)} className="inline-flex items-center gap-1.5 text-sm text-[var(--color-accent)] transition-colors hover:text-[var(--color-accent)]/80 cursor-pointer"><Mail className="h-3.5 w-3.5" />Request Demo</button></li>
                </ul>
              </div>
            </div>
            <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[var(--color-border)] pt-8 sm:flex-row">
              <p className="text-xs text-[var(--color-muted-foreground)]">&copy; {new Date().getFullYear()} Valrano by Predivo GmbH. All rights reserved.</p>
              <div className="flex items-center gap-4">
                <Link to="/privacy" className="text-xs text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">Privacy Policy</Link>
                <Link to="/terms" className="text-xs text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">Terms of Service</Link>
                <Link to="/imprint" className="text-xs text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]">Imprint</Link>
              </div>
              <p className="text-xs text-[var(--color-muted-foreground)]">Swiss-made &middot; Software that Thinks Ahead</p>
            </div>
          </div>
        </footer>
      </main>

      <DemoRequestModal open={demoModalOpen} onClose={() => setDemoModalOpen(false)} />
    </>
  )
}
