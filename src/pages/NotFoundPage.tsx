import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { Home } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <>
      <Helmet>
        <title>Page Not Found - Valrano</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <h1 className="text-[72px] font-bold leading-none tracking-tight text-foreground">404</h1>
        <p className="mt-4 text-[16px] text-muted-foreground">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          to="/"
          className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:bg-[var(--color-accent)]/90"
        >
          <Home className="h-4 w-4" />
          Back to home
        </Link>
      </div>
    </>
  )
}
