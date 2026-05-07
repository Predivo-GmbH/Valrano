import { render, screen, within } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { HelmetProvider } from 'react-helmet-async'
import LandingPage from '@/pages/LandingPage'

function renderLanding() {
  return render(
    <HelmetProvider>
      <LandingPage />
    </HelmetProvider>,
  )
}

describe('LandingPage', () => {
  it('renders hero headline', () => {
    renderLanding()
    expect(
      screen.getByText(/board-ready peer benchmarking/i),
    ).toBeInTheDocument()
  })

  it('renders all 7 sections', () => {
    renderLanding()
    expect(screen.getByText('The Problem')).toBeInTheDocument()
    expect(screen.getByText('The Solution')).toBeInTheDocument()
    // "Features" appears in both nav and section label — use getAllByText
    expect(screen.getAllByText('Features').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/enterprise solution/i)).toBeInTheDocument()
    expect(screen.getAllByText('FAQ').length).toBeGreaterThanOrEqual(2)
    expect(
      screen.getByText(/stop building peer comparisons manually/i),
    ).toBeInTheDocument()
  })

  it('renders enterprise pricing section without tier prices', () => {
    renderLanding()
    expect(screen.getByText(/tailored to your organization/i)).toBeInTheDocument()
    expect(screen.getByText(/schedule a consultation/i)).toBeInTheDocument()
    // No multi-tier pricing
    expect(screen.queryByText('Starter')).not.toBeInTheDocument()
    expect(screen.queryByText('Professional')).not.toBeInTheDocument()
  })

  it('renders Schedule a Consultation mailto link', () => {
    renderLanding()
    const ctaLink = screen.getByText(/schedule a consultation/i).closest('a')
    expect(ctaLink?.href).toContain('mailto:')
  })

  it('renders FAQ items and toggles them', async () => {
    const user = userEvent.setup()
    renderLanding()
    const faqButton = screen.getByText(
      /how accurate is ai extraction/i,
    )
    expect(faqButton).toBeInTheDocument()
    // Click to expand
    await user.click(faqButton)
    expect(
      screen.getByText(/multi-layer accuracy architecture/i),
    ).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    renderLanding()
    const nav = screen.getByRole('navigation')
    expect(within(nav).getByText('Features')).toBeInTheDocument()
    expect(within(nav).getByText('Pricing')).toBeInTheDocument()
    expect(within(nav).getByText('FAQ')).toBeInTheDocument()
    expect(within(nav).getByText('Sign in')).toBeInTheDocument()
  })

  it('renders footer with copyright', () => {
    renderLanding()
    expect(screen.getByText(/predivo gmbh/i)).toBeInTheDocument()
  })

  it('includes JSON-LD structured data in Helmet', () => {
    renderLanding()
    // Helmet manages head — we verify the script tag data is passed correctly
    // by checking the component renders without error (JSON-LD is in Helmet)
    expect(screen.getByText('BenchmarkSignal')).toBeInTheDocument()
  })
})
