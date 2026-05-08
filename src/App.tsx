import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { HelmetProvider } from 'react-helmet-async'
import { AuthProvider } from '@/contexts/AuthContext'
import PasswordGate from '@/components/auth/PasswordGate'
import { AppLayout } from '@/components/layout/AppLayout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import { OnboardingGuard } from '@/components/auth/OnboardingGuard'
import { RedirectIfAuthenticated } from '@/components/auth/RedirectIfAuthenticated'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import LandingPage from '@/pages/LandingPage'
import { PageSkeleton } from '@/components/ui/page-skeleton'

// Route-level code splitting — each page loads on demand
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const DocumentViewerPage = lazy(() => import('@/pages/DocumentViewerPage').then(m => ({ default: m.DocumentViewerPage })))
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })))
const ReportBuilderPage = lazy(() => import('@/pages/ReportBuilderPage').then(m => ({ default: m.ReportBuilderPage })))
const ReportViewerPage = lazy(() => import('@/pages/ReportViewerPage').then(m => ({ default: m.ReportViewerPage })))
const PeersPage = lazy(() => import('@/pages/PeersPage').then(m => ({ default: m.PeersPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const AccountPage = lazy(() => import('@/pages/AccountPage').then(m => ({ default: m.AccountPage })))
const OnboardingWizard = lazy(() => import('@/components/onboarding/OnboardingWizard').then(m => ({ default: m.OnboardingWizard })))
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'))
const SignUpPage = lazy(() => import('@/pages/auth/SignUpPage'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'))
const AuthCallbackPage = lazy(() => import('@/pages/auth/AuthCallbackPage'))
const AuthVerifyPage = lazy(() => import('@/pages/auth/AuthVerifyPage'))
const AuthConfirmPage = lazy(() => import('@/pages/auth/AuthConfirmPage'))
const NewsPage = lazy(() => import('@/pages/NewsPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
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

              {/* Everything else behind PasswordGate */}
              <Route path="*" element={
                <PasswordGate>
                  <AuthProvider>
                    <Routes>
                      {/* Auth routes — no AppLayout */}
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/signup" element={<SignUpPage />} />
                      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                      <Route path="/reset-password" element={<ResetPasswordPage />} />
                      <Route path="/auth/callback" element={<AuthCallbackPage />} />
                      <Route path="/auth/verify" element={<AuthVerifyPage />} />
                      <Route path="/auth/confirm" element={<AuthConfirmPage />} />

                      {/* Protected app routes */}
                      <Route element={<ProtectedRoute />}>
                        <Route path="/onboarding" element={<OnboardingWizard />} />
                        <Route element={<OnboardingGuard />}>
                        <Route element={<AppLayout />}>
                          <Route path="/dashboard" element={<DashboardPage />} />
                          <Route path="/peers" element={<PeersPage />} />
                          <Route path="/analytics" element={<AnalyticsPage />} />
                          <Route path="/news" element={<NewsPage />} />
                          <Route path="/reports" element={<ReportBuilderPage />} />
                          <Route path="/reports/:id" element={<ReportViewerPage />} />
                          <Route path="/documents/:id" element={<DocumentViewerPage />} />
                          <Route path="/account" element={<AccountPage />} />
                          <Route path="/settings" element={<SettingsPage />} />

                          {/* Legacy routes — redirect to new structure */}
                          <Route path="/upload" element={<Navigate to="/peers" replace />} />
                          <Route path="/review" element={<Navigate to="/peers" replace />} />
                          <Route path="/calendar" element={<Navigate to="/peers" replace />} />
                          <Route path="/documents" element={<Navigate to="/reports" replace />} />
                          <Route path="/trends" element={<Navigate to="/analytics" replace />} />
                          <Route path="/my-company" element={<Navigate to="/settings?tab=company" replace />} />
                          <Route path="/my-company/benchmark" element={<Navigate to="/settings?tab=company" replace />} />
                          <Route path="/settings/benchmark-rules" element={<Navigate to="/settings?tab=rules" replace />} />
                          <Route path="/settings/approval-chains" element={<Navigate to="/settings?tab=approvals" replace />} />
                        </Route>
                        </Route>
                      </Route>

                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </AuthProvider>
                </PasswordGate>
              } />
            </Routes>
          </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'var(--color-card)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-foreground)',
                fontSize: '13px',
              },
            }}
          />
        </QueryClientProvider>
      </ThemeProvider>
    </HelmetProvider>
  )
}

export default App
