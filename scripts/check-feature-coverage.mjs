/**
 * Feature Coverage Sync Check
 *
 * Reads docs/FEATURES.md (or docs/FEATURE_REGISTRY.md), extracts every feature whose status is
 * "implemented" or "tested", and verifies that each one is actually covered by a test that RUNS.
 *
 * Exit code 1 if any feature lacks real coverage.
 * Run in CI: node scripts/check-feature-coverage.mjs   (BLOCKING — never continue-on-error)
 *
 * ── WHAT CHANGED 2026-08-21, and why ────────────────────────────────────────────────────────────
 * This check used to prove only that a test FILE EXISTS on disk (`existsSync`). Open-findings
 * register V2, raised independently by the v13.4 defect-injection auditors: a `test.describe.skip`
 * therefore kept a feature reading COVERED while nothing ran. A file that exists is not a test that
 * runs, so the file check alone made "every feature has a passing test" a convention, not a gate.
 *
 * It now also parses each referenced file and fails when the feature's coverage is entirely skipped
 * (`describe.skip`, `test.skip`, `it.skip`, `.fixme`, or `test.describe.configure({ mode: 'skip' })`).
 * A file with SOME skipped cases still passes — skipping one case is normal; skipping all of them
 * means the feature is untested.
 *
 * It also catches the bolded-prefix trap explicitly. The typed prefix must be `E2E:` UNBOLDED;
 * `**E2E:**` does not match the path regex, and the old script reported that as the generic
 * "no test files listed", which reads like a missing test rather than a formatting slip.
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// Which file holds the registry. The standard names docs/FEATURE_REGISTRY.md canonical, but
// MEASURED 2026-08-21 across the fleet: that file exists in 8 repos and carries ZERO `### F-` rows
// in every one of them, while docs/FEATURES.md carries the real 18-42 rows. Preferring the canonical
// NAME would therefore have made this gate silently check nothing — the exact failure it exists to
// prevent. So pick by CONTENT, not by name, and say which one was used.
const CANDIDATES = ['docs/FEATURE_REGISTRY.md', 'docs/FEATURES.md']
// H2 or H3. Measured across the fleet 2026-08-21: arivioo writes `## F-001:` while the other eight
// write `### F-001:`. Pinning the heading depth would have read arivioo's 27 features as zero.
const FEATURE_ROW = /^#{2,3} F-\d{3}:/m
const present = CANDIDATES.map((p) => resolve(p)).filter((p) => existsSync(p))
const populated = present.filter((p) => FEATURE_ROW.test(readFileSync(p, 'utf-8')))

if (present.length === 0) {
  console.log(`No ${CANDIDATES.join(' or ')} found — skipping feature coverage check.`)
  process.exit(0)
}
if (populated.length === 0) {
  console.error(
    `FAIL  ${present.length} feature registry file(s) exist and NONE contains a single "## F-XXX:" or "### F-XXX:" row:\n` +
      present.map((p) => `        ${p}`).join('\n') +
      `\n\nA registry with no features is not a passing check, it is an empty one. Populate it, or delete\n` +
      `the file so this check is honestly skipped rather than silently green.`
  )
  process.exit(1)
}
if (populated.length > 1) {
  console.error(
    `FAIL  two feature registries are populated at once, so neither is the source of truth:\n` +
      populated.map((p) => `        ${p}`).join('\n') +
      `\n\nMerge them into one (the standard names docs/FEATURE_REGISTRY.md canonical) and delete the other.`
  )
  process.exit(1)
}

const FEATURES_PATH = populated[0]
console.log(`Feature registry: ${FEATURES_PATH}`)
const content = readFileSync(FEATURES_PATH, 'utf-8')

// Parse feature blocks: ### F-XXX: Name ... - **Status:** ... - **Test Files:** ...
// CRLF-tolerant (audit 2026-08-12 D4#8): on a CRLF checkout `.` never matches `\r`,
// so the old regexes found 0 blocks and the gate silently no-op'd with exit 0.
// NO `m` FLAG, deliberately. The trailing `$` in the lookahead must mean END OF INPUT so the last
// feature's body runs to the end of the file. Under `/m` it means end of LINE, which truncates every
// body to its first line, so no `**Status:**` is ever found and the whole gate reports zero features
// checked and exits 0 — the same silent no-op as the CRLF bug. Anchor the heading with (?:^|\r?\n).
const featureRegex = /(?:^|\r?\n)#{2,3} (F-\d{3}):[ \t]*(.+?)\r?\n([\s\S]*?)(?=\r?\n#{2,3} F-|\r?\n---|\r?\n<!-- |$)/g
// Accepts `**Status:** x` AND `**Status**: x`. Measured 2026-08-21: arivioo puts the colon outside
// the bold and the other repos put it inside, and each had patched its own copy to match its own
// dialect. That divergence is why one "canonical" check became ten different scripts.
//
// The value is captured GENERICALLY rather than as a fixed alternation. The old
// `(planned|implemented|tested)` meant any other value — including a typo — failed to match, and an
// unmatched status made the feature `continue` out of the loop entirely: invisible, not failed.
// ChannelMover legitimately uses `retired` and `removed` (measured: 30 planned, 5 retired, 1 removed,
// 6 implemented of 42), so the inert set is explicit and anything unrecognised is now an error.
const statusRegex = /\*\*Status:?\*\*:?\s*([A-Za-z-]+)/
const MUST_BE_COVERED = new Set(['implemented', 'tested'])
const NOT_YET_OR_GONE = new Set(['planned', 'retired', 'removed', 'deprecated', 'wip', 'in-progress'])
// TOLERANT OF THE BOLD MARKERS, and that is deliberate. The known trap was that `**E2E:**` did not
// match while `E2E:` did, so bolding a heading silently emptied the file list and the feature counted
// as untested. That was carried for months as a documentation convention ("type it unbolded"), which
// is the wrong shape: a markdown formatting choice must not be able to disable a gate. SignalScore
// had already patched its own copy this way; measured 2026-08-21, its whole registry is bolded, so
// the strict regex would have reported all 23 of its features as untested. The parser bends instead.
const testFileRegex = /\*{0,2}(?:Unit|E2E|Integration|Component|A11y):\*{0,2}\s*`([^`]+)`/g
// A prefix that is present but malformed in some OTHER way (`**E2E**:`, `E2E -`) still hides paths.
const malformedPrefixRegex = /\*{0,2}(?:Unit|E2E|Integration|Component|A11y)\*{0,2}\s*[:\-–]\s*`[^`]+`/

// A file whose ENTIRE suite is skipped covers nothing. Matches describe.skip / test.skip /
// it.skip / .fixme, and Playwright's `test.describe.configure({ mode: 'skip' })`.
const SUITE_SKIP = /(?:^|\W)(?:test|it|describe)(?:\.\w+)*\.(?:skip|fixme)\s*\(|configure\s*\(\s*\{[^}]*mode\s*:\s*['"](?:skip|serial-skip)['"]/
// at least one case that actually runs
const LIVE_CASE = /(?:^|\W)(?:test|it)\s*\(|(?:^|\W)(?:test|it)\.(?:only|each|step)\s*\(|(?:^|\W)describe\s*\(/

/** null = covered; a string = the reason it is not */
function inertReason(file) {
  let src
  try { src = readFileSync(resolve(file), 'utf-8') } catch { return null }
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
  if (!SUITE_SKIP.test(stripped)) return null
  // something is skipped — is anything left that runs?
  const withoutSkipped = stripped.replace(new RegExp(SUITE_SKIP.source, 'g'), '')
  if (LIVE_CASE.test(withoutSkipped)) return null
  return 'every test in it is skipped (.skip/.fixme), so it runs nothing'
}

let failures = 0
let checked = 0
let match

while ((match = featureRegex.exec(content)) !== null) {
  const [, id, name, body] = match
  const statusMatch = body.match(statusRegex)
  if (!statusMatch) {
    console.error(`FAIL  ${id}: ${name} — no "**Status:**" line, so this feature was never checked at all`)
    failures++
    continue
  }
  const status = statusMatch[1].toLowerCase()
  if (NOT_YET_OR_GONE.has(status)) continue
  if (!MUST_BE_COVERED.has(status)) {
    console.error(
      `FAIL  ${id}: ${name} — unrecognised status "${statusMatch[1]}". Use one of: ` +
        `${[...MUST_BE_COVERED].join(', ')} (must be tested) or ${[...NOT_YET_OR_GONE].join(', ')} (not checked).\n` +
        `        An unknown status used to make the feature invisible to this gate rather than failing it.`
    )
    failures++
    continue
  }
  checked++

  const testFiles = []
  let tfMatch
  testFileRegex.lastIndex = 0
  while ((tfMatch = testFileRegex.exec(body)) !== null) testFiles.push(tfMatch[1])

  if (testFiles.length === 0) {
    if (malformedPrefixRegex.test(body)) {
      console.error(
        `FAIL  ${id}: ${name} — a test-file line is present but its prefix is malformed, so no path was read.\n` +
          `        Write it as  E2E: \`path/to/spec.ts\`  or  **E2E:** \`path/to/spec.ts\`  (both are accepted).`
      )
    } else {
      console.error(`FAIL  ${id}: ${name} — status is "${status}" but no test files listed`)
    }
    failures++
    continue
  }

  const missing = testFiles.filter((f) => !existsSync(resolve(f)))
  if (missing.length > 0) {
    console.error(
      `FAIL  ${id}: ${name} — test files not found on disk:\n` +
        missing.map((f) => `        ${f}`).join('\n')
    )
    failures++
    continue
  }

  // The file exists. Does it RUN? (register V2)
  const inert = testFiles.map((f) => ({ f, why: inertReason(f) })).filter((x) => x.why)
  if (inert.length === testFiles.length) {
    console.error(
      `FAIL  ${id}: ${name} — every listed test file exists but none of them run:\n` +
        inert.map((x) => `        ${x.f} — ${x.why}`).join('\n')
    )
    failures++
    continue
  }

  const note = inert.length ? ` (${inert.length} skipped, ${testFiles.length - inert.length} live)` : ''
  console.log(`PASS  ${id}: ${name} — ${testFiles.length} test file(s) verified${note}`)
}

console.log(`\n${checked} feature(s) checked, ${failures} failure(s)`)

// A check that checked NOTHING must never report success. This has already happened twice: the CRLF
// bug (audit 2026-08-12 D4#8) made the block regex match zero features on a CRLF checkout and exit 0,
// and on 2026-08-21 preferring the canonical FILENAME over the populated file did the same. Both were
// green builds proving nothing.
if (checked === 0) {
  console.error(
    `\nFAIL  ${FEATURES_PATH} parsed to ZERO implemented/tested features.\n` +
      `A gate that checks nothing is not a passing gate. Either the registry is empty, or its heading\n` +
      `format drifted from "### F-XXX: Name" + "- **Status:** implemented|tested".`
  )
  process.exit(1)
}

if (failures > 0) {
  console.error(
    '\nFeature coverage check failed. Every implemented feature must have test files that RUN.\n' +
      'Update the feature registry with test file paths, un-skip the suite, or write the missing tests.'
  )
  process.exit(1)
}
