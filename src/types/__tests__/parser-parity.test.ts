/**
 * PLAN-034 Sprint 5 / T0346 — Parser parity integration tests
 *
 * After T0345 frontmatter migration, the frontmatter parser path and the legacy
 * markdown parser path should agree on `id` and `status` for every migrated CT
 * document. (Title is **not** part of BUG-077 — frontmatter title is the SoT
 * and intentionally drifts from filename / H1; we only sanity-check that both
 * paths produce a non-empty string.)
 *
 * We sample a representative set across workorder / bug / plan; mismatches on
 * status imply migration normalization drift, which is the BUG-077 root cause.
 *
 * The samples live in `fixtures/ct-workorders/` next to this file: byte-for-byte
 * copies of real CT documents (T0577), so the test no longer depends on the
 * repo's `_ct-workorders/` tree — Tower may archive, rename or delete the
 * originals, and a checkout without `_ct-workorders/` (sparse worktree,
 * PLAN-047) still passes. To add or replace a sample, copy the committed file
 * as-is (`git show HEAD:<path> > fixtures/ct-workorders/<name>`) and list it in
 * SAMPLES; any file with frontmatter plus the legacy body table works, the test
 * is about parity, not specific files.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import { parseWorkOrder } from '../control-tower'
import { parseBugFile } from '../bug-tracker'
import { parsePlanFile } from '../backlog'
import { extractFrontmatterBlock } from '../../utils/ct-frontmatter'

const FIXTURE_DIR = join(__dirname, 'fixtures', 'ct-workorders')

interface Sample {
  filename: string
  kind: 'workorder' | 'bug' | 'plan'
}

// Representative samples across kinds — chosen to span time / size.
const SAMPLES: Sample[] = [
  { filename: 'T0335-fix-bug074-ssh-input-step-awaiting-input.md',             kind: 'workorder' },
  { filename: 'T0336-fix-bug073-docker-detect-env-mapping-preflight.md',       kind: 'workorder' },
  { filename: 'T0337-fix-bug072-wsl-linger-systemd-mapping.md',                kind: 'workorder' },
  { filename: 'BUG-081-bat-notify-submit-enters-multiline-instead-of-submit.md', kind: 'bug' },
  { filename: 'PLAN-033-tower-state-snapshot-archive-architecture.md',          kind: 'plan' },
]

function samplePath(sample: Sample): string {
  return join(FIXTURE_DIR, sample.filename)
}

function readSample(sample: Sample): string | null {
  const p = samplePath(sample)
  return existsSync(p) ? readFileSync(p, 'utf8') : null
}

/** Strip frontmatter from content so we can re-parse legacy-only. */
function stripFrontmatter(content: string): string {
  const { body } = extractFrontmatterBlock(content)
  return body
}

describe('PLAN-034 parser parity (frontmatter vs legacy markdown)', () => {
  for (const sample of SAMPLES) {
    it(`${sample.filename}: frontmatter and legacy parsers agree`, () => {
      const content = readSample(sample)
      if (content == null) {
        // SAMPLES lists a file that is not in fixtures/ct-workorders/.
        throw new Error(`Sample ${sample.filename} not found at ${samplePath(sample)}.`)
      }

      const body = stripFrontmatter(content)

      if (sample.kind === 'workorder') {
        const fm = parseWorkOrder(sample.filename, content)
        const legacy = parseWorkOrder(sample.filename, body)

        expect(fm.id).toBe(legacy.id)
        expect(typeof fm.title).toBe('string')
        expect(fm.title.length).toBeGreaterThan(0)
        expect(typeof legacy.title).toBe('string')
        expect(legacy.title.length).toBeGreaterThan(0)
        // Frontmatter is SoT; legacy may produce PENDING when body table is
        // missing — but for migrated files the body still has the table, so
        // statuses must match.
        expect(fm.status).toBe(legacy.status)
        expect(fm.parseSource).toBe('frontmatter')
        expect(legacy.parseSource).toBe('legacy_markdown')
      } else if (sample.kind === 'bug') {
        const fm = parseBugFile(content, sample.filename)
        const legacy = parseBugFile(body, sample.filename)

        expect(fm).not.toBeNull()
        expect(legacy).not.toBeNull()
        expect(fm!.id).toBe(legacy!.id)
        expect(typeof fm!.title).toBe('string')
        expect(fm!.title.length).toBeGreaterThan(0)
        expect(typeof legacy!.title).toBe('string')
        expect(legacy!.title.length).toBeGreaterThan(0)
        expect(fm!.status).toBe(legacy!.status)
      } else {
        const fm = parsePlanFile(content, sample.filename)
        const legacy = parsePlanFile(body, sample.filename)

        expect(fm).not.toBeNull()
        expect(legacy).not.toBeNull()
        expect(fm!.id).toBe(legacy!.id)
        expect(typeof fm!.title).toBe('string')
        expect(fm!.title.length).toBeGreaterThan(0)
        expect(typeof legacy!.title).toBe('string')
        expect(legacy!.title.length).toBeGreaterThan(0)
        expect(fm!.status).toBe(legacy!.status)
      }
    })
  }
})
