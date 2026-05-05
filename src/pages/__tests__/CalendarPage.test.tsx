import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'

vi.mock('@/hooks/useCalendar', () => ({
  usePublicationEvents: () => ({
    data: [
      {
        id: 'pe-1',
        company_id: 'c-1',
        report_type: 'annual',
        fiscal_year: 2025,
        fiscal_quarter: null,
        expected_date: '2026-02-27',
        status: 'scheduled',
        notes: null,
        companies: { id: 'c-1', name: 'CRH plc', ticker: 'CRH' },
      },
      {
        id: 'pe-2',
        company_id: 'c-2',
        report_type: 'annual',
        fiscal_year: 2025,
        fiscal_quarter: null,
        expected_date: '2026-03-13',
        status: 'detected',
        notes: null,
        companies: { id: 'c-2', name: 'HeidelbergCement AG', ticker: 'HEI' },
      },
    ],
    isLoading: false,
  }),
  useCreatePublicationEvent: () => ({ mutate: vi.fn() }),
  useDeletePublicationEvent: () => ({ mutate: vi.fn() }),
  useCheckPublication: () => ({ mutate: vi.fn(), isPending: false }),
  useCompanies: () => ({
    data: [
      { id: 'c-1', name: 'CRH plc' },
      { id: 'c-2', name: 'HeidelbergCement AG' },
    ],
    isLoading: false,
  }),
}))

import { CalendarPage } from '../CalendarPage'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <CalendarPage />
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  )
}

describe('CalendarPage', () => {
  it('renders page title', () => {
    renderPage()
    expect(screen.getByText('Publication Calendar')).toBeInTheDocument()
  })

  it('renders company names', () => {
    renderPage()
    expect(screen.getAllByText('CRH plc').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('HeidelbergCement AG').length).toBeGreaterThanOrEqual(1)
  })

  it('renders status badges', () => {
    renderPage()
    // Status labels also appear in the filter dropdown
    expect(screen.getAllByText('Scheduled').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Detected').length).toBeGreaterThanOrEqual(1)
  })

  it('renders Add Event button', () => {
    renderPage()
    expect(screen.getByText('Add Event')).toBeInTheDocument()
  })

  it('renders report type in event row', () => {
    renderPage()
    // Report type is rendered as "Annual · FY 2025"
    const rows = screen.getAllByText(/Annual/)
    expect(rows.length).toBeGreaterThanOrEqual(1)
  })
})
