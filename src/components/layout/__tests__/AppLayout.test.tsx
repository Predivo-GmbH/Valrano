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
  it('renders the Valrano logo', () => {
    render(<AppLayout />)
    expect(screen.getByText('Valrano')).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    render(<AppLayout />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('My Company')).toBeInTheDocument()
    expect(screen.getByText('Competitors')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText('Reports')).toBeInTheDocument()
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

  it('competitors nav link points to /competitors', () => {
    render(<AppLayout />)
    const competitorsLink = screen.getByRole('link', { name: /competitors/i })
    expect(competitorsLink).toHaveAttribute('href', '/competitors')
  })

  it('my company nav link points to /my-company', () => {
    render(<AppLayout />)
    const myCompanyLink = screen.getByRole('link', { name: /my company/i })
    expect(myCompanyLink).toHaveAttribute('href', '/my-company')
  })
})
