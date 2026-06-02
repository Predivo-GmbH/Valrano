import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    session: { access_token: 'test-token' },
    signOut: vi.fn(),
  }),
}))

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    data: { tier: 'pro', status: 'active' },
    isLoading: false,
  }),
}))

vi.mock('@/hooks/useAiSuggestions', () => ({
  useSuggestDates: () => ({ mutate: vi.fn(), isPending: false }),
  useSuggestIrUrl: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock('@/hooks/useCalendar', () => ({
  usePublicationEvents: () => ({
    data: [
      {
        id: 'pe-1',
        company_id: 'c-1',
        report_type: 'annual',
        fiscal_year: 2025,
        fiscal_quarter: null,
        expected_date: '2026-05-15',
        expected_time: '07:00:00',
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
        expected_date: '2026-05-20',
        expected_time: '08:30:00',
        status: 'detected',
        notes: null,
        companies: { id: 'c-2', name: 'HeidelbergCement AG', ticker: 'HEI' },
      },
    ],
    isLoading: false,
  }),
  useCreatePublicationEvent: () => ({ mutate: vi.fn() }),
  useDeletePublicationEvent: () => ({ mutate: vi.fn() }),
  useUpdatePublicationEvent: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
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

// Pin the date to May 2026 so hardcoded event dates are visible
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-05-10T12:00:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

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
  it('renders page title and month navigation', () => {
    renderPage()
    expect(screen.getByText('Publication Calendar')).toBeInTheDocument()
    expect(screen.getByLabelText('Previous month')).toBeInTheDocument()
    expect(screen.getByLabelText('Next month')).toBeInTheDocument()
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('renders weekday headers', () => {
    renderPage()
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Sun')).toBeInTheDocument()
  })

  it('renders Add Event button', () => {
    renderPage()
    expect(screen.getByText('Add Event')).toBeInTheDocument()
  })

  it('shows event details with time when day is clicked', () => {
    renderPage()
    // Click on the day cell that has the CRH event (May 15)
    const dayButton = screen.getByLabelText('2026-05-15, 1 event')
    fireEvent.click(dayButton)

    // Should show event detail with company name and time
    expect(screen.getByText('CRH plc')).toBeInTheDocument()
    expect(screen.getByText(/07:00/)).toBeInTheDocument()
    expect(screen.getAllByText('Scheduled').length).toBeGreaterThanOrEqual(1)
  })

  it('shows status colored dots on days with events', () => {
    renderPage()
    // Days with events should have aria-labels indicating event count
    expect(screen.getByLabelText('2026-05-15, 1 event')).toBeInTheDocument()
    expect(screen.getByLabelText('2026-05-20, 1 event')).toBeInTheDocument()
  })

  it('navigates months with arrow buttons', () => {
    renderPage()
    const prevBtn = screen.getByLabelText('Previous month')
    fireEvent.click(prevBtn)
    expect(screen.getByText('April 2026')).toBeInTheDocument()

    const nextBtn = screen.getByLabelText('Next month')
    fireEvent.click(nextBtn)
    fireEvent.click(nextBtn)
    expect(screen.getByText('June 2026')).toBeInTheDocument()
  })
})
