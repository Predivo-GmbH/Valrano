import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

export default function ImprintPage() {
  return (
    <>
      <Helmet>
        <title>Imprint - Valrano</title>
        <meta name="description" content="Legal imprint for Valrano by Predivo GmbH." />
      </Helmet>
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <Link
          to="/"
          className="mb-10 inline-block text-sm text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)]"
        >
          &larr; Back to home
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-foreground)]">
          Imprint
        </h1>
        <div className="mt-10 space-y-6 text-sm leading-relaxed text-[var(--color-muted-foreground)]">
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">Company</h2>
            <p>Predivo GmbH</p>
            <p>Switzerland</p>
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">Contact</h2>
            <p>
              <a href="mailto:hello@valrano.com" className="text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 transition-colors">
                hello@valrano.com
              </a>
            </p>
            <p className="mt-1">
              <a href="https://predivo.ch" target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 transition-colors">
                predivo.ch
              </a>
            </p>
          </section>
          <section>
            <h2 className="mb-3 text-base font-semibold text-[var(--color-foreground)]">Disclaimer</h2>
            <p>
              The content of this website is provided for informational purposes only. Predivo GmbH makes no warranties, express or implied, regarding the accuracy or completeness of the information provided.
            </p>
          </section>
        </div>
      </div>
    </>
  )
}
