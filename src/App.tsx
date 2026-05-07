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
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'
import LandingPage from '@/pages/LandingPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { DocumentViewerPage } from '@/pages/DocumentViewerPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { ReportBuilderPage } from '@/pages/ReportBuilderPage'
import { ReportViewerPage } from '@/pages/ReportViewerPage'
import { PeersPage } from '@/pages/PeersPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { AccountPage } from '@/pages/AccountPage'
import { RedirectIfAuthenticated } from '@/components/auth/RedirectIfAuthenticated'
import LoginPage from '@/pages/auth/LoginPage'
import SignUpPage from '@/pages/auth/SignUpPage'
import ForgotPasswordPage from '@/pages/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/auth/ResetPasswordPage'
import AuthCallbackPage from '@/pages/auth/AuthCallbackPage'
import AuthVerifyPage from '@/pages/auth/AuthVerifyPage'

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

                      {/* Protected app routes */}
                      <Route element={<ProtectedRoute />}>
                        <Route path="/onboarding" element={<OnboardingWizard />} />
                        <Route element={<OnboardingGuard />}>
                        <Route element={<AppLayout />}>
                          <Route path="/dashboard" element={<DashboardPage />} />
                          <Route path="/peers" element={<PeersPage />} />
                          <Route path="/analytics" element={<AnalyticsPage />} />
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
