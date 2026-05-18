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

    // Puppeteer's page.content() returns HTML without doctype -- add it back
    if (!html.toLowerCase().startsWith('<!doctype')) {
      html = '<!doctype html>\n' + html
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
