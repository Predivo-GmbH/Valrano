/**
 * Post-build prerendering script for public pages.
 * Uses Puppeteer to render each public route and saves the HTML
 * so Googlebot gets fully rendered content without executing JS.
 *
 * Usage: node scripts/prerender.mjs (run after `vite build`)
 */
import puppeteer from 'puppeteer'
import { createServer } from 'http'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, extname, dirname } from 'path'

const DIST = join(import.meta.dirname, '..', 'dist')
const PORT = 4173
const BASE = `http://localhost:${PORT}`

// Public routes to prerender
const ROUTES = [
  { path: '/', file: 'index.html' },
  { path: '/privacy', file: 'privacy.html' },
  { path: '/terms', file: 'terms.html' },
  { path: '/imprint', file: 'imprint.html' },
]

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
}

// Simple static file server for the dist folder
function startServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let filePath = join(DIST, req.url === '/' ? 'index.html' : req.url)

      // SPA fallback: serve index.html for routes without extensions
      if (!existsSync(filePath) && !extname(req.url)) {
        filePath = join(DIST, 'index.html')
      }

      try {
        const content = readFileSync(filePath)
        const ext = extname(filePath)
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' })
        res.end(content)
      } catch {
        res.writeHead(404)
        res.end('Not found')
      }
    })
    server.listen(PORT, () => resolve(server))
  })
}

async function prerender() {
  console.log('Starting prerender...')
  const server = await startServer()

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] })

  for (const route of ROUTES) {
    const page = await browser.newPage()
    const url = `${BASE}${route.path}`
    console.log(`  Rendering ${route.path}...`)

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 })
    // Wait for React to render content
    await page.waitForSelector('h1', { timeout: 5000 }).catch(() => {})

    let html = await page.content()

    // Guard: Vite/Rolldown's runtime modulepreload helper (used to warm the cache
    // for sibling deps of a lazy-loaded route chunk, e.g. LandingPage/useWaitlist)
    // can resolve asset URLs as an ABSOLUTE `new URL(dep, importerUrl).href` instead
    // of a root-relative path. During prerender importerUrl is always this script's
    // own local server (BASE = http://localhost:4173), so if that codepath fires,
    // the <link rel="modulepreload"> it injects gets baked into the DOM as an
    // absolute http://localhost:4173/... href. page.content() captures that literally
    // into the static file we ship. Once deployed to the real domain, that becomes a
    // foreign-origin script load that script-src 'self' CSP correctly blocks (confirmed
    // root cause, local repro 2026-08-13: reproduces whenever Vite picks the absolute
    // assetsURL codepath, independent of which plugin triggers it). A prerendered file
    // must be origin-portable, so strip any leaked reference to our own local server
    // back to a root-relative path -- this closes the bug class regardless of why a
    // given build chose the absolute codepath.
    if (html.includes(BASE)) {
      console.warn(`  WARNING: ${route.path} had ${(html.split(BASE).length - 1)} baked-in prerender-origin URL(s) (${BASE}) -- rewriting to root-relative`)
      html = html.split(BASE).join('')
    }

    // Puppeteer's page.content() returns HTML without doctype -- add it back
    if (!html.toLowerCase().startsWith('<!doctype')) {
      html = '<!doctype html>\n' + html
    }

    // Remove duplicate <title> tags (Helmet injects one, index.html has another)
    const titleMatches = html.match(/<title>[^<]*<\/title>/g)
    if (titleMatches && titleMatches.length > 1) {
      html = html.replace(titleMatches[0], '')
    }

    // Remove duplicate Google Fonts <link> tags (Puppeteer may add stylesheet after preload)
    const fontLinks = html.match(/<link[^>]*fonts\.googleapis\.com\/css2[^>]*>/g)
    if (fontLinks && fontLinks.length > 1) {
      for (let i = 1; i < fontLinks.length; i++) {
        html = html.replace(fontLinks[i], '')
      }
    }

    const outPath = join(DIST, route.file)
    mkdirSync(dirname(outPath), { recursive: true })
    writeFileSync(outPath, html, 'utf-8')
    console.log(`  Done: ${route.file}`)
    await page.close()
  }

  await browser.close()
  server.close()
  console.log('Prerender complete.')
}

prerender().catch((err) => {
  console.error('Prerender failed:', err)
  process.exit(1)
})
