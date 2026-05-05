import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/hooks/useNotifications', () => ({
  useNotifications: () => ({
    data: [
      {
        id: 'n-1',
        type: 'report_detected',
        title: 'CRH Report detected',
        body: 'Annual report for FY2025 was found.',
        is_read: false,
        link: '/review/r-1',
        created_at: '2026-05-05T10:00:00Z',
      },
      {
        id: 'n-2',
        type: 'document_generated',
        title: 'Benchmark generated',
        body: null,
        is_read: true,
        link: null,
        created_at: '2026-05-04T08:00:00Z',
      },
    ],
  }),
  useUnreadCount: () => ({ data: 1 }),
  useMarkAsRead: () => ({ mutate: vi.fn() }),
  useMarkAllAsRead: () => ({ mutate: vi.fn() }),
}))

import { NotificationBell } from '../NotificationBell'

function renderBell() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('NotificationBell', () => {
  it('renders bell button with unread count', () => {
    renderBell()
    expect(screen.getByLabelText('Notifications (1 unread)')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('shows dropdown on click', () => {
    renderBell()
    fireEvent.click(screen.getByLabelText('Notifications (1 unread)'))
    expect(screen.getByText('CRH Report detected')).toBeInTheDocument()
  })

  it('shows notification type labels', () => {
    renderBell()
    fireEvent.click(screen.getByLabelText('Notifications (1 unread)'))
    expect(screen.getByText('Report Detected')).toBeInTheDocument()
    expect(screen.getByText('Document Generated')).toBeInTheDocument()
  })

  it('shows mark all read button when there are unread', () => {
    renderBell()
    fireEvent.click(screen.getByLabelText('Notifications (1 unread)'))
    expect(screen.getByText('Mark all read')).toBeInTheDocument()
  })

  it('shows View link for notifications with link', () => {
    renderBell()
    fireEvent.click(screen.getByLabelText('Notifications (1 unread)'))
    expect(screen.getByText('View →')).toBeInTheDocument()
  })
})
