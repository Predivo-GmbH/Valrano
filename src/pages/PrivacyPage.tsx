import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

export default function PrivacyPage() {
  return (
    <>
      <Helmet>
        <title>Privacy Policy - Valrano</title>
        <meta name="description" content="Privacy Policy for Valrano by Predivo GmbH." />
      </Helmet>
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <Link
          to="/"
          className="mb-10 inline-block text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
        >
          &larr; Back to home
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-foreground)]">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
          Last updated: May 2026
        </p>
        <div className="mt-10 space-y-8 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">1. Controller</h2>
            <p>
              Predivo GmbH is the data controller for Valrano. For privacy inquiries, contact us at{' '}
              <a href="mailto:hello@valrano.com" className="text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 transition-colors">
                hello@valrano.com
              </a>.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">2. Data We Collect</h2>
            <p>
              We collect account information (name, email, company), usage data, and data you upload to the platform (annual reports, KPI data). We do not sell your data to third parties.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">3. Purpose and Legal Basis</h2>
            <p>
              Your data is processed to provide the Valrano service (contract performance), improve the platform (legitimate interest), and comply with legal obligations. We process data on the basis of your consent or contractual necessity.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">4. Data Storage</h2>
            <p>
              All data is stored on Swiss-hosted infrastructure. We apply technical and organisational measures to protect your data in accordance with GDPR and Swiss nDSG.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">5. Your Rights</h2>
            <p>
              You have the right to access, correct, delete, and export your personal data. To exercise these rights, contact{' '}
              <a href="mailto:hello@valrano.com" className="text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 transition-colors">
                hello@valrano.com
              </a>.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">6. Cookies</h2>
            <p>
              We use essential cookies for authentication and session management only. No third-party tracking cookies are used.
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">7. Changes</h2>
            <p>
              We may update this policy periodically. Material changes will be communicated via the platform or email.
            </p>
          </section>
        </div>
      </div>
    </>
  )
}
