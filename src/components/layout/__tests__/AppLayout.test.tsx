import { render, screen } from '@/test/test-utils'
import { AppLayout } from '../AppLayout'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet">Content</div>,
  }
})

describe('AppLayout', () => {
  it('renders the BenchmarkSignal logo', () => {
    render(<AppLayout />)
    expect(screen.getByText('BenchmarkSignal')).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    render(<AppLayout />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Peers')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText('Reports')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders the outlet for child routes', () => {
    render(<AppLayout />)
    expect(screen.getByTestId('outlet')).toBeInTheDocument()
  })

  it('renders theme toggle button', () => {
    render(<AppLayout />)
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('renders nav links as anchor elements', () => {
    render(<AppLayout />)
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i })
    expect(dashboardLink).toBeInTheDocument()
  })

  it('dashboard nav link points to /dashboard', () => {
    render(<AppLayout />)
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i })
    expect(dashboardLink).toHaveAttribute('href', '/dashboard')
  })

  it('peers nav link points to /peers', () => {
    render(<AppLayout />)
    const peersLink = screen.getByRole('link', { name: /peers/i })
    expect(peersLink).toHaveAttribute('href', '/peers')
  })

  it('settings nav link points to /settings', () => {
    render(<AppLayout />)
    const settingsLink = screen.getByRole('link', { name: /settings/i })
    expect(settingsLink).toHaveAttribute('href', '/settings')
  })
})
