import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'query-vendor'
          }
          // supabase: no manualChunk — deferred with AuthenticatedShell lazy boundary
          if (id.includes('node_modules/@radix-ui')) {
            return 'ui-vendor'
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'icons-vendor'
          }
          // sonner + recharts/victory: no manualChunk — deferred to lazy chunks, not modulepreloaded on landing
        },
      },
    },
  },
})
