import { render, screen, waitFor } from '@/test/test-utils'
import { PeersPage } from '../PeersPage'

vi.mock('@/hooks/useData', () => ({
  useCompanies: () => ({ data: [], isLoading: false }),
  useReports: () => ({ data: [], isLoading: false }),
}))

vi.mock('@/hooks/useCalendar', () => ({
  usePublicationEvents: () => ({ data: [], isLoading: false }),
  useCheckPublication: () => ({ mutateAsync: vi.fn() }),
}))

vi.mock('@/hooks/useExtraction', () => ({
  useUploadReport: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useExtractKpis: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

describe('PeersPage', () => {
  it('renders without crashing', () => {
    expect(() => render(<PeersPage />)).not.toThrow()
  })

  it('shows the Peers heading', async () => {
    render(<PeersPage />)
    await waitFor(() => {
      expect(screen.getAllByRole('heading', { name: /peers/i }).length).toBeGreaterThan(0)
    })
  })

  it('shows tab navigation', async () => {
    render(<PeersPage />)
    await waitFor(() => {
      // PeersPage renders tabs for Companies, Calendar, Review
      const tabs = screen.getAllByRole('tab').length > 0
        ? screen.getAllByRole('tab')
        : screen.getAllByRole('button')
      expect(tabs.length).toBeGreaterThan(0)
    })
  })
})
