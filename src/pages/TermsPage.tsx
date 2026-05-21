import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

export default function TermsPage() {
  return (
    <>
      <Helmet>
        <title>Terms of Service - Valrano</title>
        <meta name="description" content="Terms of Service for Valrano by Predivo GmbH." />
      </Helmet>
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <Link
          to="/"
          className="mb-10 inline-block text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
        >
          &larr; Back to home
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-foreground)]">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
          Last updated: May 2026
        </p>
        <div className="mt-10 space-y-8 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">1. Acceptance</h2>
            <p>
              By accessing or using Valrano, you agree to these Terms of Service. If you do not agree, do not use the platform.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">2. Service</h2>
            <p>
              Valrano is an AI-powered competitive benchmarking platform operated by Predivo GmbH. Access is provided on a subscription basis as agreed in your enterprise contract.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">3. Permitted Use</h2>
            <p>
              You may use Valrano solely for lawful internal business purposes. You may not reverse-engineer, resell, or sublicense the platform without written consent from Predivo GmbH.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">4. Intellectual Property</h2>
            <p>
              All platform software, design, and content remain the property of Predivo GmbH. Your uploaded data and reports remain your property.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">5. Disclaimer</h2>
            <p>
              Valrano provides AI-generated analysis for informational purposes only. It does not constitute financial, legal, or investment advice. Predivo GmbH assumes no liability for decisions made based on platform output.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">6. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, Predivo GmbH is not liable for indirect, incidental, or consequential damages arising from use of the platform.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">7. Governing Law</h2>
            <p>
              These terms are governed by Swiss law. Disputes shall be subject to the exclusive jurisdiction of the courts of Zurich, Switzerland.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">8. Contact</h2>
            <p>
              For questions regarding these terms, contact{' '}
              <a href="mailto:hello@valrano.com" className="text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 transition-colors">
                hello@valrano.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </>
  )
}
