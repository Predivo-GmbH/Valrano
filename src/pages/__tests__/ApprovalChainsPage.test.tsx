import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'

vi.mock('@/hooks/useBenchmark', () => ({
  useApprovalChains: () => ({
    data: [
      {
        id: 'chain-1',
        name: 'Standard Review',
        steps: [
          { step_number: 1, role: 'analyst', user_id: null, is_optional: false },
          { step_number: 2, role: 'manager', user_id: null, is_optional: false },
        ],
        benchmark_rules: { id: 'r-1', name: 'Default Peer Benchmark' },
      },
    ],
    isLoading: false,
  }),
  useCreateApprovalChain: () => ({ mutate: vi.fn() }),
  useUpdateApprovalChain: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteApprovalChain: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useBenchmarkRules: () => ({
    data: [
      { id: 'r-1', name: 'Default Peer Benchmark' },
    ],
    isLoading: false,
  }),
}))

import { ApprovalChainsPage } from '../ApprovalChainsPage'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ApprovalChainsPage />
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  )
}

describe('ApprovalChainsPage', () => {
  it('renders page title', () => {
    renderPage()
    expect(screen.getByText('Approval Chains')).toBeInTheDocument()
  })

  it('renders chain name', () => {
    renderPage()
    expect(screen.getByText('Standard Review')).toBeInTheDocument()
  })

  it('renders linked rule name', () => {
    renderPage()
    expect(screen.getByText('Rule: Default Peer Benchmark')).toBeInTheDocument()
  })

  it('renders step count', () => {
    renderPage()
    expect(screen.getByText('2 steps')).toBeInTheDocument()
  })

  it('renders create button', () => {
    renderPage()
    expect(screen.getByText('Create Approval Chain')).toBeInTheDocument()
  })
})
