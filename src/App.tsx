import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { HelmetProvider } from 'react-helmet-async'
import { AuthProvider } from '@/contexts/AuthContext'
import PasswordGate from '@/components/auth/PasswordGate'
import { AppLayout } from '@/components/layout/AppLayout'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import LandingPage from '@/pages/LandingPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { UploadPage } from '@/pages/UploadPage'
import { ReviewPage } from '@/pages/ReviewPage'
import { DocumentsPage } from '@/pages/DocumentsPage'
import { DocumentViewerPage } from '@/pages/DocumentViewerPage'
import { BenchmarkRulesPage } from '@/pages/BenchmarkRulesPage'
import { CalendarPage } from '@/pages/CalendarPage'
import { ApprovalChainsPage } from '@/pages/ApprovalChainsPage'
import { MyCompanyPage } from '@/pages/MyCompanyPage'
import { MyBenchmarkPage } from '@/pages/MyBenchmarkPage'
import { TrendsPage } from '@/pages/TrendsPage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { ReportBuilderPage } from '@/pages/ReportBuilderPage'
import { ReportViewerPage } from '@/pages/ReportViewerPage'
import { PeersPage } from '@/pages/PeersPage'
import { SettingsPage } from '@/pages/SettingsPage'
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
              {/* Public landing page — outside PasswordGate */}
              <Route path="/" element={<LandingPage />} />

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
                        <Route element={<AppLayout />}>
                          <Route path="/dashboard" element={<DashboardPage />} />
                          <Route path="/upload" element={<UploadPage />} />
                          <Route path="/review" element={<ReviewPage />} />
                          <Route path="/documents" element={<DocumentsPage />} />
                          <Route path="/documents/:id" element={<DocumentViewerPage />} />
                          <Route path="/settings/benchmark-rules" element={<BenchmarkRulesPage />} />
                          <Route path="/settings/approval-chains" element={<ApprovalChainsPage />} />
                          <Route path="/calendar" element={<CalendarPage />} />
                          <Route path="/my-company" element={<MyCompanyPage />} />
                          <Route path="/my-company/benchmark" element={<MyBenchmarkPage />} />
                          <Route path="/trends" element={<TrendsPage />} />
                          <Route path="/analytics" element={<AnalyticsPage />} />
                          <Route path="/reports" element={<ReportBuilderPage />} />
                          <Route path="/reports/:id" element={<ReportViewerPage />} />
                          {/* New restructured routes */}
                          <Route path="/peers" element={<PeersPage />} />
                          <Route path="/settings" element={<SettingsPage />} />
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
