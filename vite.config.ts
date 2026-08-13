import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import path from 'path'

// Sentry source-map upload is CI-only: active when SENTRY_AUTH_TOKEN (+ org/project)
// are present in the build env. Local dev builds are unaffected. See docs/Credentials.txt.
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN
const sentryOrg = process.env.SENTRY_ORG
const sentryProject = process.env.SENTRY_PROJECT
const sentryEnabled = Boolean(sentryAuthToken && sentryOrg && sentryProject)

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Upload source maps so production stack traces are readable (real file/line,
    // not minified). Matched to the bundle via debug IDs. `errorHandler` swallows
    // upload failures — a Sentry hiccup must NEVER fail a deploy. The .map files are
    // deleted from dist after upload, so they are never served publicly.
    ...(sentryEnabled
      ? [
          sentryVitePlugin({
            authToken: sentryAuthToken,
            org: sentryOrg,
            project: sentryProject,
            errorHandler: () => {
              /* warn-not-fail: never break the deploy on a source-map upload error */
            },
            sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Generate hidden source maps only when uploading to Sentry (no sourceMappingURL
    // comment in the shipped JS; the .map files are removed post-upload above).
    sourcemap: sentryEnabled ? 'hidden' : false,
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
