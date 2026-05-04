import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { Toaster } from 'sonner'
import { HelmetProvider } from 'react-helmet-async'

const queryClient = new QueryClient()

function App() {
  return (
    <HelmetProvider>
      <ThemeProvider attribute="class" defaultTheme="dark">
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<div className="min-h-screen bg-background text-foreground flex items-center justify-center"><h1 className="text-4xl font-bold">BenchmarkSignal</h1></div>} />
            </Routes>
          </BrowserRouter>
          <Toaster />
        </QueryClientProvider>
      </ThemeProvider>
    </HelmetProvider>
  )
}

export default App
