#!/usr/bin/env node
/**
 * THE NIGHTLY GAUNTLET STILL HAS A CLOCK, AND THE CLOCK STILL FIRES.
 *
 * WHY THIS EXISTS. On 2026-09-12 a fleet-wide cadence tidy-up (commit c77b3bf here, 3a6ec1e on
 * ChannelMover) deleted the `schedule:` trigger from deploy.yml on the stated ground that
 * "deploy.yml already fires on every code change, so the nightly re-ran the identical commit".
 *
 * That premise was never checked against the file. `gate-integration`, `gate-security` and
 * `gate-e2e` all carry `if: github.event_name != 'push'`, so a push run executes NONE of them -
 * measured on ChannelMover push run 34719595752 and again on 34810631250: deploy-staging success,
 * all three gates SKIPPED. With the cron gone the only surviving trigger was a manual prod
 * promotion, so between promotions the integration suite, the secret/SAST/dependency scan and the
 * staging E2E suite ran nowhere at all. The 2026-09-09 security advisory that blocked five
 * products was caught by exactly this nightly run.
 *
 * Commit 97dc8f0 ("Put the nightly back - I cut it on a premise I had not checked", PR #5) put the
 * cron back. Nothing was watching to make sure it stayed, which is how it got removed the first
 * time. This is that watch.
 *
 * WHAT IT ASSERTS, and why each half is needed:
 *   1. THE CLOCK IS IN THE FILE ON main. A cron can be deleted in one line by an honest tidy-up.
 *      Read from GitHub, not from the working tree: a branch checkout proves nothing about main.
 *   2. THE CLOCK ACTUALLY FIRED, recently, AND THE GATES RAN GREEN IN IT. A cron that GitHub has
 *      disabled (60 days of repo inactivity), or a scheduled run in which the gate jobs were
 *      skipped, looks exactly like a healthy nightly if you only read the file. A workflow that
 *      stops being scheduled produces NO run, and no run is not a red run, so nothing reports it.
 *
 * The freshness window is 50 hours, not 24: GitHub demonstrably drops scheduled ticks under load,
 * so one missed night is a scheduler artefact and must not redden this. Two missed nights is the
 * job being dead, which is the thing this file is for.
 *
 * Reads through the `gh` CLI so it needs no token of its own and prints none.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

const REPO = 'Predivo-GmbH/Valrano'
const WORKFLOW = 'deploy.yml'
const GATE_JOBS = ['gate-integration', 'gate-security', 'gate-e2e']
const MAX_AGE_HOURS = 50

const gh = (args) =>
  execFileSync('gh', args, { encoding: 'utf8', timeout: 60000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })

test('deploy.yml on main still carries a schedule: trigger', () => {
  const b64 = gh(['api', `repos/${REPO}/contents/.github/workflows/${WORKFLOW}?ref=main`, '-q', '.content']).trim()
  const yml = Buffer.from(b64.replace(/\s+/g, ''), 'base64').toString('utf8')

  // Only the trigger block matters, and only uncommented lines in it. The file is heavily
  // commented and both the removal and the restore left prose containing the words "schedule"
  // and "cron" behind, so a naive substring search passes on a file with no clock at all.
  const trigger = yml.split(/\r?\n/)
  const onIdx = trigger.findIndex((l) => /^on:\s*$/.test(l))
  assert.notEqual(onIdx, -1, 'deploy.yml has no top-level `on:` block')
  const endIdx = trigger.findIndex((l, i) => i > onIdx && /^\S/.test(l))
  const block = trigger.slice(onIdx, endIdx === -1 ? trigger.length : endIdx)
  const live = block.filter((l) => l.trim() && !l.trim().startsWith('#'))

  assert.ok(
    live.some((l) => /^\s{2}schedule:\s*$/.test(l)),
    'deploy.yml `on:` block has no uncommented `schedule:` key - the nightly gauntlet clock was removed again. '
      + 'gate-integration, gate-security and gate-e2e are all `if: github.event_name != \'push\'`, so without this '
      + 'cron they run only on a manual prod promotion. See commit 97dc8f0.',
  )
  assert.ok(
    live.some((l) => /^\s*-\s*cron:\s*'[^']+'/.test(l)),
    'the `schedule:` key carries no cron expression',
  )
})

test('the schedule actually fired recently and the gates ran green in it', () => {
  const runs = JSON.parse(gh([
    'run', 'list', '--repo', REPO, '--workflow', WORKFLOW, '--event', 'schedule',
    '--limit', '10', '--json', 'databaseId,conclusion,createdAt,status',
  ]))
  assert.ok(Array.isArray(runs) && runs.length > 0, `GitHub reports no scheduled run of ${WORKFLOW} at all`)

  const completed = runs.filter((r) => r.status === 'completed')
  assert.ok(completed.length > 0, `no COMPLETED scheduled run of ${WORKFLOW} to judge`)

  const newest = completed[0]
  const ageH = (Date.now() - Date.parse(newest.createdAt)) / 3_600_000
  assert.ok(
    ageH <= MAX_AGE_HOURS,
    `newest scheduled run of ${WORKFLOW} is ${ageH.toFixed(1)}h old (${newest.createdAt}), older than the `
      + `${MAX_AGE_HOURS}h window. A nightly that stops firing produces no run, and no run is not a red run - `
      + 'so nothing else would report this.',
  )
  assert.equal(newest.conclusion, 'success', `scheduled run ${newest.databaseId} concluded "${newest.conclusion}"`)

  const jobs = JSON.parse(gh(['run', 'view', String(newest.databaseId), '--repo', REPO, '--json', 'jobs']))
  const byName = new Map((jobs.jobs || []).map((j) => [j.name, j.conclusion]))
  for (const name of GATE_JOBS) {
    assert.ok(byName.has(name), `scheduled run ${newest.databaseId} has no job named "${name}"`)
    assert.equal(
      byName.get(name),
      'success',
      `job "${name}" in scheduled run ${newest.databaseId} concluded "${byName.get(name)}" - a scheduled run in `
        + 'which the gates are skipped is the same nothing as no scheduled run.',
    )
  }
})
