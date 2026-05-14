import { useState, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { Newspaper, RefreshCw, ExternalLink, TrendingUp, TrendingDown, Minus, Search, Filter } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { PremiumSelect } from '@/components/ui/premium-select'
import { useAllNews, useFetchNews } from '@/hooks/useNews'
import { useCompanies } from '@/hooks/useData'
import type { CompanyNews } from '@/types/database'
import { toast } from 'sonner'

const TOPIC_OPTIONS = [
  'earnings', 'M&A', 'ESG', 'restructuring', 'legal', 'product',
  'market', 'leadership', 'regulation', 'guidance', 'dividend',
  'credit_rating', 'partnership',
]

const SENTIMENT_ICON: Record<string, typeof TrendingUp> = {
  positive: TrendingUp,
  negative: TrendingDown,
  neutral: Minus,
  mixed: Minus,
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'text-emerald-400',
  negative: 'text-red-400',
  neutral: 'text-[var(--color-muted-foreground)]',
  mixed: 'text-amber-400',
}

const TOPIC_COLOR: Record<string, string> = {
  earnings: 'bg-blue-500/15 text-blue-400',
  'M&A': 'bg-purple-500/15 text-purple-400',
  ESG: 'bg-emerald-500/15 text-emerald-400',
  restructuring: 'bg-orange-500/15 text-orange-400',
  legal: 'bg-red-500/15 text-red-400',
  product: 'bg-cyan-500/15 text-cyan-400',
  market: 'bg-indigo-500/15 text-indigo-400',
  leadership: 'bg-amber-500/15 text-amber-400',
  regulation: 'bg-rose-500/15 text-rose-400',
  guidance: 'bg-teal-500/15 text-teal-400',
  dividend: 'bg-green-500/15 text-green-400',
  credit_rating: 'bg-yellow-500/15 text-yellow-400',
  partnership: 'bg-violet-500/15 text-violet-400',
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown'
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffH = Math.floor(diffMs / 3600000)
  if (diffH < 1) return 'Just now'
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
}

function groupByWeek(articles: CompanyNews[]): { week: string; articles: CompanyNews[] }[] {
  const groups = new Map<string, CompanyNews[]>()
  for (const a of articles) {
    const d = a.published_at ? new Date(a.published_at) : new Date(a.created_at)
    // Week start (Monday)
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const key = monday.toISOString().slice(0, 10)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(a)
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([week, articles]) => ({ week, articles }))
}

function weekLabel(weekStart: string): string {
  const d = new Date(weekStart)
  const end = new Date(d)
  end.setDate(d.getDate() + 6)
  const now = new Date()
  const mondayNow = new Date(now)
  mondayNow.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  if (weekStart === mondayNow.toISOString().slice(0, 10)) return 'This Week'
  const lastMonday = new Date(mondayNow)
  lastMonday.setDate(mondayNow.getDate() - 7)
  if (weekStart === lastMonday.toISOString().slice(0, 10)) return 'Last Week'
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

export default function NewsPage() {
  const [selectedCompany, setSelectedCompany] = useState<string>('')
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: companies } = useCompanies()
  const { data: news, isLoading } = useAllNews({
    companyIds: selectedCompany ? [selectedCompany] : undefined,
    topic: selectedTopic || undefined,
    limit: 500,
  })
  const fetchNews = useFetchNews()
  const [fetchingAll, setFetchingAll] = useState(false)

  const handleFetchAll = async () => {
    if (!companies?.length) return
    setFetchingAll(true)
    let totalNew = 0
    try {
      for (const company of companies) {
        try {
          const result = await fetchNews.mutateAsync(company.id)
          totalNew += result?.new_articles ?? 0
        } catch {
          // Skip failures for individual companies
        }
      }
      toast.success(`Fetched ${totalNew} new article${totalNew !== 1 ? 's' : ''} across ${companies.length} companies`)
    } finally {
      setFetchingAll(false)
    }
  }

  // Filter by search
  const filteredNews = useMemo(() => {
    if (!news) return []
    if (!searchQuery.trim()) return news
    const q = searchQuery.toLowerCase()
    return news.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.ai_summary?.toLowerCase().includes(q) ||
      a.snippet?.toLowerCase().includes(q)
    )
  }, [news, searchQuery])

  const weekGroups = useMemo(() => groupByWeek(filteredNews), [filteredNews])

  // Company name lookup
  const companyMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of companies ?? []) m.set(c.id, c.name)
    return m
  }, [companies])

  // Topic counts
  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of news ?? []) {
      for (const t of a.topics) {
        counts.set(t, (counts.get(t) ?? 0) + 1)
      }
    }
    return counts
  }, [news])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <Helmet><title>News Intelligence - BenchmarkSignal</title></Helmet>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-foreground)] flex items-center gap-3">
            <Newspaper className="h-6 w-6 text-[var(--color-accent)]" />
            News Intelligence
          </h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            AI-curated news feed for your peer companies
          </p>
        </div>
        <button
          onClick={() => {
            if (selectedCompany) fetchNews.mutate(selectedCompany)
            else handleFetchAll()
          }}
          disabled={fetchNews.isPending || fetchingAll || (!selectedCompany && !companies?.length)}
          className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white transition-all hover:brightness-110 disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${fetchNews.isPending || fetchingAll ? 'animate-spin' : ''}`} />
          {selectedCompany ? 'Refresh News' : 'Fetch All News'}
        </button>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap gap-3">
        {/* Company filter */}
        <PremiumSelect
          value={selectedCompany}
          onChange={setSelectedCompany}
          options={[
            { value: '', label: 'All Companies' },
            ...(companies ?? []).map(c => ({ value: c.id, label: c.name })),
          ]}
          icon={<Filter className="h-4 w-4 text-muted-foreground" />}
          triggerClassName="h-10"
        />

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted-foreground)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search news..."
            aria-label="Search news"
            className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] pl-9 pr-4 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus-visible:border-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/30"
          />
        </div>
      </div>

      {/* Topic chips */}
      <div className="mt-4 flex flex-wrap gap-2">
        {TOPIC_OPTIONS.filter(t => (topicCounts.get(t) ?? 0) > 0).map(topic => (
          <button
            key={topic}
            onClick={() => setSelectedTopic(selectedTopic === topic ? '' : topic)}
            className={`rounded-full px-3 py-1.5 min-h-[44px] flex items-center text-xs font-medium transition-all cursor-pointer ${
              selectedTopic === topic
                ? 'bg-[var(--color-accent)] text-white'
                : TOPIC_COLOR[topic] ?? 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
            }`}
          >
            {topic.replace('_', ' ')} ({topicCounts.get(topic) ?? 0})
          </button>
        ))}
      </div>

      {/* Stats bar */}
      <div className="mt-6 flex gap-6 text-sm text-[var(--color-muted-foreground)]">
        <span>{filteredNews.length} articles</span>
        <span>{weekGroups.length} weeks</span>
        {selectedCompany && <span>Company: {companyMap.get(selectedCompany)}</span>}
        {selectedTopic && <span>Topic: {selectedTopic}</span>}
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="mt-12 text-center text-[var(--color-muted-foreground)]">
          Loading news...
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredNews.length === 0 && (
        <div className="mt-12 text-center">
          <Newspaper className="mx-auto h-12 w-12 text-[var(--color-muted-foreground)] opacity-40" />
          <h3 className="mt-4 text-lg font-medium text-[var(--color-foreground)]">No news yet</h3>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            Select a company and click "Refresh News" to fetch the latest articles.
          </p>
        </div>
      )}

      {/* Timeline */}
      <div className="mt-6 space-y-8">
        {weekGroups.map(({ week, articles }) => (
          <div key={week}>
            <h2 className="sticky top-0 z-10 bg-[var(--color-background)] pb-3 pt-1 text-sm font-semibold text-[var(--color-foreground)] border-b border-[var(--color-border)]">
              {weekLabel(week)}
              <span className="ml-2 text-[var(--color-muted-foreground)] font-normal">
                ({articles.length} article{articles.length !== 1 ? 's' : ''})
              </span>
            </h2>
            <div className="mt-3 space-y-3">
              {articles.map((article) => {
                const SentimentIcon = SENTIMENT_ICON[article.sentiment ?? 'neutral']
                return (
                  <article
                    key={article.id}
                    className="group rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 transition-colors hover:border-[var(--color-accent)]/30"
                  >
                    <div className="flex items-start gap-3">
                      {/* Sentiment indicator */}
                      <TooltipProvider delay={200}>
                        <Tooltip>
                          <TooltipTrigger className={`mt-0.5 flex-shrink-0 cursor-help ${SENTIMENT_COLOR[article.sentiment ?? 'neutral']}`}>
                            <SentimentIcon className="h-4 w-4" />
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p className="text-xs capitalize">{article.sentiment ?? 'neutral'} sentiment</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <div className="flex-1 min-w-0">
                        {/* Title + link */}
                        <div className="flex items-start justify-between gap-2">
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-[var(--color-foreground)] leading-snug hover:text-[var(--color-accent)] hover:underline transition-colors"
                          >
                            {article.title}
                          </a>
                          <TooltipProvider delay={200}>
                            <Tooltip>
                              <TooltipTrigger
                                  render={<a
                                    href={article.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={`Open ${article.title} in new tab`}
                                  />}
                                  className="flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center text-[var(--color-muted-foreground)] hover:text-[var(--color-accent)] transition-colors"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                              </TooltipTrigger>
                              <TooltipContent side="left">
                                <p className="text-xs">Open article in new tab</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        {/* Source domain + author */}
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-[var(--color-muted-foreground)]">
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[var(--color-accent)] hover:underline"
                          >
                            {(() => { try { return new URL(article.url).hostname.replace('www.', '') } catch { return 'Source' } })()}
                          </a>
                          {article.author && (
                            <span>by {article.author}</span>
                          )}
                          {article.published_at && (
                            <span>{new Date(article.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                          )}
                        </div>

                        {/* AI Summary */}
                        {article.ai_summary && (
                          <p className="mt-1 text-xs text-[var(--color-muted-foreground)] leading-relaxed">
                            {article.ai_summary}
                          </p>
                        )}

                        {/* Meta row */}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {/* Company badge */}
                          <span className="rounded-md bg-[var(--color-muted)] px-2 py-0.5 text-xs text-[var(--color-foreground)]">
                            {companyMap.get(article.company_id) ?? 'Unknown'}
                          </span>

                          {/* Topics */}
                          {article.topics.slice(0, 3).map(topic => (
                            <span
                              key={topic}
                              className={`rounded-full px-2 py-0.5 text-xs ${TOPIC_COLOR[topic] ?? 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'}`}
                            >
                              {topic.replace('_', ' ')}
                            </span>
                          ))}

                          {/* Date */}
                          <span className="ml-auto text-xs text-[var(--color-muted-foreground)]">
                            {formatDate(article.published_at)}
                          </span>

                          {/* Relevance score */}
                          {article.relevance_score != null && article.relevance_score >= 0.8 && (
                            <TooltipProvider delay={200}>
                              <Tooltip>
                                <TooltipTrigger className="cursor-help text-xs text-[var(--color-accent)]">
                                  {Math.round(article.relevance_score * 100)}% relevant
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p className="text-xs">AI-assessed relevance to your benchmarking scope</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
