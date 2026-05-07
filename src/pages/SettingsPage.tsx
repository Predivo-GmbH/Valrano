import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { BookOpen, Building2, Settings, Shield, User } from 'lucide-react'
import { AccountPage } from './AccountPage'
import { MyCompanyPage } from './MyCompanyPage'
import { AccountingProfilePage } from './AccountingProfilePage'
import { BenchmarkRulesPage } from './BenchmarkRulesPage'
import { ApprovalChainsPage } from './ApprovalChainsPage'

const TABS = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'company', label: 'My Company', icon: Building2 },
  { id: 'accounting', label: 'Accounting Profile', icon: BookOpen },
  { id: 'rules', label: 'Benchmark Rules', icon: Settings },
  { id: 'approvals', label: 'Approval Chains', icon: Shield },
] as const

type TabId = (typeof TABS)[number]['id']

const tabCls = (isActive: boolean) =>
  `flex items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
    isActive
      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
      : 'text-muted-foreground hover:bg-[var(--color-bg-tertiary)] hover:text-foreground'
  }`

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as TabId) || 'account'

  function handleTabChange(tab: TabId) {
    setSearchParams({ tab })
  }

  return (
    <>
      <Helmet><title>Settings - BenchmarkSignal</title></Helmet>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
            Settings
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Configure your BenchmarkSignal account
          </p>
        </div>

        {/* Tab bar */}
        <div
          role="tablist"
          aria-label="Settings sections"
          className="mb-6 flex items-center gap-1 border-b border-border pb-3"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => handleTabChange(tab.id)}
              className={tabCls(activeTab === tab.id)}
            >
              <tab.icon className="h-4 w-4" aria-hidden="true" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          {activeTab === 'account' && <AccountPage />}
          {activeTab === 'company' && <MyCompanyPage />}
          {activeTab === 'accounting' && <AccountingProfilePage />}
          {activeTab === 'rules' && <BenchmarkRulesPage />}
          {activeTab === 'approvals' && <ApprovalChainsPage />}
        </div>
      </div>
    </>
  )
}
