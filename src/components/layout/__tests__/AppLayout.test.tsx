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
    expect(screen.getByText('Upload')).toBeInTheDocument()
    expect(screen.getByText('Review')).toBeInTheDocument()
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

  it('upload nav link points to /upload', () => {
    render(<AppLayout />)
    const uploadLink = screen.getByRole('link', { name: /upload/i })
    expect(uploadLink).toHaveAttribute('href', '/upload')
  })

  it('review nav link points to /review', () => {
    render(<AppLayout />)
    const reviewLink = screen.getByRole('link', { name: /review/i })
    expect(reviewLink).toHaveAttribute('href', '/review')
  })
})
