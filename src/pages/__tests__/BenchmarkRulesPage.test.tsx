import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock hooks
vi.mock('@/hooks/useBenchmark', () => ({
  useBenchmarkRules: () => ({
    data: [
      {
        id: 'rule-1',
        name: 'Default Peer Benchmark',
        description: 'Standard competitive benchmark',
        customer_company_id: 'c-1',
        narrative_style: 'executive_brief',
        auto_generate: true,
        kpi_selection: [
          { kpi_definition_id: 'k1', code: 'REVENUE', weight: 1.0, threshold_pct: null },
          { kpi_definition_id: 'k2', code: 'EBITDA', weight: 1.0, threshold_pct: null },
        ],
        companies: { id: 'c-1', name: 'Holcim', ticker: 'HOLN' },
        created_by: 'user-1',
        created_at: '2026-05-04',
        updated_at: '2026-05-04',
      },
    ],
    isLoading: false,
  }),
  useCreateBenchmarkRule: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteBenchmarkRule: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateBenchmarkRule: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useData', () => ({
  useCompanies: () => ({
    data: [{ id: 'c-1', name: 'Holcim', ticker: 'HOLN', is_active: true }],
    isLoading: false,
  }),
  useKpiDefinitions: () => ({
    data: [
      { id: 'k1', code: 'REVENUE', name: 'Revenue', category: 'financial', is_active: true },
    ],
    isLoading: false,
  }),
}))

import { BenchmarkRulesPage } from '../BenchmarkRulesPage'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BenchmarkRulesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('BenchmarkRulesPage', () => {
  it('renders page title', () => {
    renderPage()
    expect(screen.getByText('Benchmark Rules')).toBeInTheDocument()
  })

  it('renders rule name', () => {
    renderPage()
    expect(screen.getByText('Default Peer Benchmark')).toBeInTheDocument()
  })

  it('renders rule description', () => {
    renderPage()
    expect(screen.getByText('Standard competitive benchmark')).toBeInTheDocument()
  })

  it('renders customer company name', () => {
    renderPage()
    expect(screen.getByText(/Holcim/)).toBeInTheDocument()
  })

  it('renders KPI count', () => {
    renderPage()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders auto-generate indicator', () => {
    renderPage()
    expect(screen.getByText('Auto-generate')).toBeInTheDocument()
  })

  it('renders create button', () => {
    renderPage()
    expect(screen.getByText('Create Rule')).toBeInTheDocument()
  })
})
