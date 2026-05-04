import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock hooks
vi.mock('@/hooks/useBenchmark', () => ({
  useBenchmarkDocuments: () => ({
    data: [
      {
        id: 'doc-1',
        title: 'CRH Annual Benchmark — FY 2024',
        fiscal_year: 2024,
        status: 'draft',
        generated_at: '2026-05-04T10:00:00Z',
        generated_by: 'system',
        trigger_company: { id: 'c-1', name: 'CRH', ticker: 'CRH' },
        customer_company: { id: 'c-2', name: 'Holcim', ticker: 'HOLN' },
        benchmark_rules: { id: 'r-1', name: 'Default Peer Benchmark', narrative_style: 'executive_brief' },
      },
    ],
    isLoading: false,
  }),
}))

vi.mock('@/hooks/useData', () => ({
  useCompanies: () => ({
    data: [
      { id: 'c-1', name: 'CRH', ticker: 'CRH', is_active: true },
      { id: 'c-2', name: 'Holcim', ticker: 'HOLN', is_active: true },
    ],
    isLoading: false,
  }),
}))

import { DocumentsPage } from '../DocumentsPage'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DocumentsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('DocumentsPage', () => {
  it('renders page title', () => {
    renderPage()
    expect(screen.getByText('Benchmark Documents')).toBeInTheDocument()
  })

  it('renders document row', () => {
    renderPage()
    expect(screen.getByText('CRH Annual Benchmark — FY 2024')).toBeInTheDocument()
  })

  it('renders competitor name', () => {
    renderPage()
    expect(screen.getByText('CRH')).toBeInTheDocument()
  })

  it('renders status badge', () => {
    renderPage()
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('renders fiscal year', () => {
    renderPage()
    expect(screen.getByText('FY 2024')).toBeInTheDocument()
  })

  it('renders view link', () => {
    renderPage()
    const viewLinks = screen.getAllByText('View')
    expect(viewLinks.length).toBeGreaterThanOrEqual(1)
  })
})
