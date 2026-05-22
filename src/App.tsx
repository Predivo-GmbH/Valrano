import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { HelmetProvider } from 'react-helmet-async'
import { RedirectIfAuthenticated } from '@/components/auth/RedirectIfAuthenticated'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PageSkeleton } from '@/components/ui/page-skeleton'

const LandingPage = lazy(() => import('@/pages/LandingPage'))
const PrivacyPage = lazy(() => import('@/pages/PrivacyPage'))
const TermsPage = lazy(() => import('@/pages/TermsPage'))
const ImprintPage = lazy(() => import('@/pages/ImprintPage'))
const AuthenticatedShell = lazy(() => import('@/components/AuthenticatedShell'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      staleTime: 30_000,
    },
    mutations: {
      onError: (error) => {
        if (error instanceof Error) {
          import('sonner').then(({ toast }) => toast.error(error.message))
        }
      },
    },
  },
})

function App() {
  return (
    <HelmetProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <ErrorBoundary>
            <Suspense fallback={<PageSkeleton />}>
            <Routes>
              {/* Public landing page — redirect to dashboard if logged in */}
              <Route path="/" element={<RedirectIfAuthenticated><LandingPage /></RedirectIfAuthenticated>} />

              {/* Public legal pages */}
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/imprint" element={<ImprintPage />} />

              {/* Everything else — lazy-loaded authenticated shell */}
              <Route path="*" element={<AuthenticatedShell />} />
            </Routes>
          </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </HelmetProvider>
  )
}

export default App
