import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Building2, FileText, Target } from 'lucide-react'
import { CardSkeleton } from '@/components/ui/page-skeleton'

const MyCompanyPage = lazy(() => import('./MyCompanyPage').then(m => ({ default: m.MyCompanyPage })))
const AccountingProfilePage = lazy(() => import('./AccountingProfilePage').then(m => ({ default: m.AccountingProfilePage })))
const MyBenchmarkPage = lazy(() => import('./MyBenchmarkPage').then(m => ({ default: m.MyBenchmarkPage })))

const TABS = [
  { id: 'profile', label: 'Profile', icon: Building2 },
  { id: 'kpis', label: 'KPIs & Reports', icon: FileText },
  { id: 'benchmark', label: 'Benchmark', icon: Target },
] as const

type TabId = (typeof TABS)[number]['id']

const tabCls = (isActive: boolean) =>
  `flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
    isActive
      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
      : 'text-muted-foreground hover:bg-[var(--color-bg-tertiary)] hover:text-foreground'
  }`

export function MyCompanyTabsPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab = (searchParams.get('tab') as TabId) || 'profile'

  const activeLabel = TABS.find((t) => t.id === activeTab)?.label ?? 'My Company'

  function handleTabChange(tab: TabId) {
    setSearchParams({ tab })
  }

  return (
    <>
      <Helmet><title>{activeLabel} - My Company - Valrano</title><meta name="robots" content="noindex" /></Helmet>
      <div className="section-fade-in mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
            My Company
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Your company profile, KPIs, and benchmark position
          </p>
        </div>

        {/* Tab bar */}
        <div
          role="tablist"
          aria-label="My Company sections"
          className="mb-6 flex items-center gap-1 overflow-x-auto border-b border-border pb-3 scrollbar-thin"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => handleTabChange(tab.id)}
              className={tabCls(activeTab === tab.id)}
            >
              <tab.icon className="h-4 w-4" aria-hidden="true" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab panels */}
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          <Suspense fallback={<CardSkeleton />}>
            {activeTab === 'profile' && <MyCompanyPage />}
            {activeTab === 'kpis' && <AccountingProfilePage />}
            {activeTab === 'benchmark' && <MyBenchmarkPage />}
          </Suspense>
        </div>
      </div>
    </>
  )
}
