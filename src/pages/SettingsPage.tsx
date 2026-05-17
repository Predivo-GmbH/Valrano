import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { BookOpen, Building2, FileBox, Settings, Shield, ShieldCheck, User, Users } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { SUPER_ADMIN_EMAIL } from '@/hooks/useSubscription'
import { AccountPage } from './AccountPage'
import { MyCompanyPage } from './MyCompanyPage'
import { AccountingProfilePage } from './AccountingProfilePage'
import { BenchmarkRulesPage } from './BenchmarkRulesPage'
import { ApprovalChainsPage } from './ApprovalChainsPage'
import { TeamPage } from './TeamPage'
import { AdminPage } from './AdminPage'
import { CorporateTemplatesPage } from './CorporateTemplatesPage'

const BASE_TABS = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'company', label: 'My Company', icon: Building2 },
  { id: 'accounting', label: 'Accounting Profile', icon: BookOpen },
  { id: 'rules', label: 'Benchmark Rules', icon: Settings },
  { id: 'approvals', label: 'Approval Chains', icon: Shield },
  { id: 'templates', label: 'Corporate Templates', icon: FileBox },
] as const

const ADMIN_TAB = { id: 'admin' as const, label: 'Admin', icon: ShieldCheck }

type TabId = (typeof BASE_TABS)[number]['id'] | 'admin'

const tabCls = (isActive: boolean) =>
  `flex flex-shrink-0 items-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
    isActive
      ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
      : 'text-muted-foreground hover:bg-[var(--color-bg-tertiary)] hover:text-foreground'
  }`

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const isSuperAdmin = user?.email === SUPER_ADMIN_EMAIL

  const tabs = useMemo(() => {
    const list: { id: TabId; label: string; icon: typeof User }[] = [...BASE_TABS]
    if (isSuperAdmin) list.push(ADMIN_TAB)
    return list
  }, [isSuperAdmin])

  const activeTab = (searchParams.get('tab') as TabId) || 'account'

  function handleTabChange(tab: TabId) {
    setSearchParams({ tab })
  }

  return (
    <>
      <Helmet><title>Settings - Valrano</title></Helmet>
      <div className="section-fade-in mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-[24px] font-semibold leading-tight tracking-tight text-foreground">
            Settings
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Configure your Valrano account
          </p>
        </div>

        {/* Tab bar */}
        <div
          role="tablist"
          aria-label="Settings sections"
          className="mb-6 flex items-center gap-1 overflow-x-auto border-b border-border pb-3 scrollbar-thin"
        >
          {tabs.map((tab) => (
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
          {activeTab === 'account' && <AccountPage />}
          {activeTab === 'team' && <TeamPage />}
          {activeTab === 'company' && <MyCompanyPage />}
          {activeTab === 'accounting' && <AccountingProfilePage />}
          {activeTab === 'rules' && <BenchmarkRulesPage />}
          {activeTab === 'approvals' && <ApprovalChainsPage />}
          {activeTab === 'templates' && <CorporateTemplatesPage />}
          {activeTab === 'admin' && isSuperAdmin && <AdminPage />}
        </div>
      </div>
    </>
  )
}
