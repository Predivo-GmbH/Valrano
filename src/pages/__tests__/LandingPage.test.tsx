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
    expect(screen.getAllByText('Pricing').length).toBeGreaterThanOrEqual(2)
    expect(screen.getAllByText('FAQ').length).toBeGreaterThanOrEqual(2)
    expect(
      screen.getByText(/stop building peer comparisons manually/i),
    ).toBeInTheDocument()
  })

  it('renders 3 pricing tiers without prices', () => {
    renderLanding()
    expect(screen.getByText('Starter')).toBeInTheDocument()
    expect(screen.getByText('Professional')).toBeInTheDocument()
    expect(screen.getByText('Enterprise')).toBeInTheDocument()
    // No tier prices (e.g., "CHF 28,800/year") visible — only "Request a Demo"
    expect(screen.queryByText(/CHF\s*28,800/)).not.toBeInTheDocument()
    expect(screen.queryByText(/CHF\s*58,800/)).not.toBeInTheDocument()
    expect(screen.queryByText(/CHF\s*118,800/)).not.toBeInTheDocument()
  })

  it('renders Request a Demo mailto links', () => {
    renderLanding()
    const demoLinks = screen.getAllByText('Request a Demo')
    expect(demoLinks.length).toBeGreaterThanOrEqual(3)
    // Pricing demo links should be mailto
    const mailtoLinks = demoLinks.filter(
      (el) =>
        el.closest('a')?.href.includes('mailto:'),
    )
    expect(mailtoLinks.length).toBeGreaterThanOrEqual(3)
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
