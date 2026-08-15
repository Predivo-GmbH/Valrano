/**
 * Feature Coverage Sync Check -- CANONICAL (source of truth).
 *
 * Reads docs/FEATURES.md, extracts every feature with status "implemented" or
 * "tested", and verifies each has at least one test file that exists on disk.
 *
 * Exits 1 if any implemented feature lacks a test file, OR if the file contains
 * feature blocks but the parser matched none (format drift = silent theater).
 * Run in CI: node scripts/check-feature-coverage.mjs
 *
 * Home: C:\Business\Templates\scripts\check-feature-coverage.canonical.mjs
 * Propagate changes from here; do not edit per-product copies in isolation.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

const FEATURES_PATH = resolve('docs/FEATURES.md')

if (!existsSync(FEATURES_PATH)) {
  console.log('No docs/FEATURES.md found -- skipping feature coverage check.')
  process.exit(0)
}

// normalize CRLF (Windows-saved files) so the block regex matches
const content = readFileSync(FEATURES_PATH, 'utf-8').replace(/\r\n/g, '\n')

const featureRegex = /### (F-\d{3}): (.+)\n([\s\S]*?)(?=\n### F-|\n---|\n<!-- |$)/g
const statusRegex = /\*\*Status:\*\*\s*(planned|implemented|tested)/
// \*{0,2} on both sides of the label accepts BOTH "**Unit:** `path`" (bold) and
// "- Unit: `path`" styles, so a bold-label registry does not silently fail.
const testFileRegex = /\*{0,2}(?:Unit|E2E|Integration|Component|A11y):\*{0,2}\s*`([^`]+)`/g

let failures = 0
let checked = 0
let parsedBlocks = 0
let match

while ((match = featureRegex.exec(content)) !== null) {
  const [, id, name, body] = match
  parsedBlocks++
  const statusMatch = body.match(statusRegex)

  if (!statusMatch) continue

  const status = statusMatch[1]

  // Only check features that are implemented or tested
  if (status === 'planned') continue

  checked++

  const testFiles = []
  let tfMatch
  while ((tfMatch = testFileRegex.exec(body)) !== null) {
    testFiles.push(tfMatch[1])
  }

  if (testFiles.length === 0) {
    console.error(`FAIL  ${id}: ${name} -- status is "${status}" but no test files listed`)
    failures++
    continue
  }

  const missing = testFiles.filter((f) => !existsSync(resolve(f)))

  if (missing.length > 0) {
    console.error(
      `FAIL  ${id}: ${name} -- test files not found on disk:\n` +
        missing.map((f) => `        ${f}`).join('\n')
    )
    failures++
  } else {
    console.log(`PASS  ${id}: ${name} -- ${testFiles.length} test file(s) verified`)
  }
}

// Anti-theater guard: if the file clearly contains feature blocks but the parser
// matched none, the format has drifted (CRLF endings or wrong test-line syntax)
// and this gate would otherwise pass while protecting nothing.
const rawBlocks = (content.match(/^### F-\d{3}:/gm) || []).length
if (rawBlocks > 0 && parsedBlocks === 0) {
  console.error(
    `\n::error::FEATURES.md has ${rawBlocks} feature block(s) but the parser matched 0 -- ` +
      'format drift (CRLF or wrong test-line syntax). The coverage gate would pass ' +
      'while protecting nothing. Aborting.'
  )
  process.exit(1)
}

console.log(`\n${checked} feature(s) checked, ${failures} failure(s)`)

if (failures > 0) {
  console.error(
    '\nFeature coverage check failed. Every implemented feature must have test files.\n' +
      'Update docs/FEATURES.md with test file paths, or write the missing tests.'
  )
  process.exit(1)
}
