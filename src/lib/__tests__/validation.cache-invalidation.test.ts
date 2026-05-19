import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, extname } from 'path'

function walkDir(dir: string, exts: string[]): string[] {
  const results: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__' || entry === 'test') continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      results.push(...walkDir(full, exts))
    } else if (exts.includes(extname(full))) {
      results.push(full)
    }
  }
  return results
}

/**
 * Static analysis test: every file that writes to peer_group_members
 * MUST also invalidate the 'visible-company-ids' cache key.
 *
 * This test exists because the audit commit 7e34be7 extracted visible_company_ids
 * into a separate cached hook but didn't update all invalidation sites —
 * breaking peer display for new accounts.
 */
describe('Cache invalidation safety', () => {
  const srcDir = join(__dirname, '../..')

  it('every file that mutates peer_group_members also invalidates visible-company-ids', () => {
    const files = walkDir(srcDir, ['.ts', '.tsx'])
    const violations: string[] = []

    for (const file of files) {
      const content = readFileSync(file, 'utf-8')

      const mutatesPeerMembers =
        content.includes("peer_group_members'") &&
        (/\.insert\(|\.upsert\(|\.delete\(\)/.test(content))

      if (!mutatesPeerMembers) continue

      if (!content.includes("'visible-company-ids'")) {
        violations.push(file.replace(srcDir, 'src'))
      }
    }

    expect(
      violations,
      `These files mutate peer_group_members but don't invalidate 'visible-company-ids':\n${violations.join('\n')}`,
    ).toHaveLength(0)
  })

  it('every file that inserts into companies table includes created_by', () => {
    const files = walkDir(srcDir, ['.ts', '.tsx'])
    const violations: string[] = []

    for (const file of files) {
      const content = readFileSync(file, 'utf-8')

      if (!content.includes("from('companies')")) continue

      const insertPattern = /\.from\('companies'\)\s*\n?\s*\.insert\(\{([^}]+)\}/g
      let match
      while ((match = insertPattern.exec(content)) !== null) {
        const insertBody = match[1]
        if (!insertBody.includes('created_by')) {
          const lineNum = content.substring(0, match.index).split('\n').length
          violations.push(`${file.replace(srcDir, 'src')}:${lineNum}`)
        }
      }
    }

    expect(
      violations,
      `These companies INSERT calls are missing created_by:\n${violations.join('\n')}`,
    ).toHaveLength(0)
  })
})

describe('Page component safety', () => {
  const srcDir = join(__dirname, '../..')

  it('every page component has a Helmet title', () => {
    const pagesDir = join(srcDir, 'pages')
    const files = walkDir(pagesDir, ['.tsx'])
    const violations: string[] = []

    for (const file of files) {
      const content = readFileSync(file, 'utf-8')

      // Skip auth subdirectory and non-page utility files
      if (file.includes('auth/') || file.includes('NotFound')) continue

      // Page components should have Helmet for SEO
      if (content.includes('export') && content.includes('Page')) {
        if (!content.includes('Helmet')) {
          violations.push(file.replace(srcDir, 'src'))
        }
      }
    }

    expect(
      violations,
      `These page components are missing Helmet:\n${violations.join('\n')}`,
    ).toHaveLength(0)
  })
})
