import { render, screen } from '@/test/test-utils'
import NewsPage from '../NewsPage'

// F-021: News Source Visibility
// Article titles link to the source URL, source domain shown, author + date inline,
// external-link icon present.

const ARTICLE = {
  id: 'n1',
  company_id: 'c1',
  title: 'Holcim reports record annual earnings',
  url: 'https://www.reuters.com/business/holcim-earnings-2026',
  snippet: 'Strong cement demand lifted results.',
  ai_summary: 'Holcim beat consensus on revenue and EBITDA.',
  author: 'Jane Doe',
  published_at: '2026-05-01T09:00:00Z',
  sentiment: 'positive',
  topics: ['earnings'],
  relevance_score: 0.91,
  is_relevant: true,
  created_at: '2026-05-01T09:00:00Z',
}

vi.mock('@/hooks/useNews', () => ({
  useAllNews: () => ({ data: [ARTICLE], isLoading: false }),
  useFetchNews: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useData', () => ({
  useCompanies: () => ({ data: [{ id: 'c1', name: 'Holcim Ltd', ticker: 'HOLN' }], isLoading: false }),
}))

describe('NewsPage (F-021 source visibility)', () => {
  it('renders without crashing', () => {
    expect(() => render(<NewsPage />)).not.toThrow()
  })

  it('renders the article title as a clickable link to the source URL', () => {
    render(<NewsPage />)
    const titleLink = screen.getByRole('link', { name: ARTICLE.title })
    expect(titleLink).toHaveAttribute('href', ARTICLE.url)
    expect(titleLink).toHaveAttribute('target', '_blank')
    expect(titleLink).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('shows the extracted source domain', () => {
    render(<NewsPage />)
    // hostname with "www." stripped
    const domainLink = screen.getByRole('link', { name: 'reuters.com' })
    expect(domainLink).toHaveAttribute('href', ARTICLE.url)
  })

  it('shows the author inline', () => {
    render(<NewsPage />)
    expect(screen.getByText(/by Jane Doe/)).toBeInTheDocument()
  })

  it('shows the published date inline', () => {
    render(<NewsPage />)
    // toLocaleDateString('en-US', { year, month, day }) -> "May 1, 2026"
    expect(screen.getByText(/May 1, 2026/)).toBeInTheDocument()
  })

  it('renders an external-link affordance for opening the article in a new tab', () => {
    render(<NewsPage />)
    const extLink = screen.getByRole('link', { name: /open .* in new tab/i })
    expect(extLink).toHaveAttribute('href', ARTICLE.url)
  })
})
