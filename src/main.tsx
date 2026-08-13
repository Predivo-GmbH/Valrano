import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initSentry } from '@/lib/sentry'

// Initialize error monitoring FIRST, before any other init runs, so exceptions
// thrown during startup are captured. No-ops unless VITE_SENTRY_DSN is set.
initSentry()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
