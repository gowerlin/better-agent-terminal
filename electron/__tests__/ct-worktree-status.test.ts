// @vitest-environment node
/**
 * PLAN-047 W1-2 / T0585: `CtWorktreeService.status` against real git in temp repos (never this
 * repo: the fixture asserts `git rev-parse --show-toplevel` is its own temp directory before it
 * writes, T0574 L155) — ahead / behind, clean / dirty, worktree deleted, changedFiles, out of scope
 * with each `affects_files` style and a missing field, the `_ct-workorders` exception, conflict /
 * no conflict, the cache, the time limit; and that a query changes nothing in either checkout.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  CT_STATUS_DIRTY_MAX,
  CtWorktreeService,
  affectsFilePatterns,
  matchesAffectsPattern,
  outOfScopeFiles,
  parsePorcelainZ,
  parseWorkorderAffectsFiles,
  type CtWorktreeRecord,
  type CtWorktreeStatusResult,
  type GitRunResult,
} from '../ct-worktree'

const repoRoot = resolve(__dirname, '..', '..')
const roots: string[] = []

afterAll(() => {
  for (const dir of roots) rmSync(dir, { recursive: true, force: true })
})

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-c', 'core.longpaths=true', '-c', 'user.email=t@example.invalid', '-c', 'user.name=t', ...args], {
    cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function same(a: string, b: string): boolean {
  const n = (p: string) => resolve(p).toLowerCase()
  return process.platform === 'win32' || process.platform === 'darwin' ? n(a) === n(b) : resolve(a) === resolve(b)
}

const WORKORDER = `---
id: T0001
affects_files:
  - "src/in.txt（範圍內）"
  - 'docs/**'
  - lib/a.ts、lib/b.ts (both)
title: x
---

# T0001
`

/** A temp `<root>/repo` with one commit and a work order; asserts git sees exactly that directory. */
function makeRepo(workorder: string | null = WORKORDER): { root: string; repo: string } {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'bat-ct-wts-')))
  roots.push(root)
  const repo = join(root, 'repo')
  mkdirSync(join(repo, 'src'), { recursive: true })
  git(repo, 'init', '-q', '-b', 'main')
  const top = git(repo, 'rev-parse', '--show-toplevel')
  if (!same(top, repo) || same(top, repoRoot)) throw new Error(`fixture repo is not isolated: ${top}`)
  writeFileSync(join(repo, 'a.txt'), 'a\n')
  writeFileSync(join(repo, 'src', 'in.txt'), 'in\n')
  if (workorder !== null) {
    mkdirSync(join(repo, '_ct-workorders'))
    writeFileSync(join(repo, '_ct-workorders', 'T0001-some-title.md'), workorder)
  }
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', 'init')
  return { root, repo }
}

const service = new CtWorktreeService()

async function isolated(repo: string): Promise<CtWorktreeRecord> {
  const prepared = await service.prepare({ cwd: repo, workorder: 'T0001' })
  if (!prepared.ok) throw new Error(prepared.error)
  return prepared.record
}

function ok(result: CtWorktreeStatusResult) {
  if (!result.ok) throw new Error(`${result.code}: ${result.error}`)
  return result
}

/** What a read-only query must not change in a checkout. */
function snapshot(dir: string) {
  return {
    status: git(dir, 'status', '--porcelain=v1', '--untracked-files=all'),
    head: git(dir, 'rev-parse', 'HEAD'),
    branch: git(dir, 'rev-parse', '--abbrev-ref', 'HEAD'),
    branches: git(dir, 'for-each-ref', '--format=%(refname) %(objectname)', 'refs/heads'),
  }
}

describe('affects_files parsing (pure)', () => {
  it('reads block lists (quoted or not), flow lists, an empty list, and no field / no frontmatter', () => {
    expect(parseWorkorderAffectsFiles(WORKORDER)).toEqual(['src/in.txt（範圍內）', 'docs/**', 'lib/a.ts、lib/b.ts (both)'])
    expect(parseWorkorderAffectsFiles('---\naffects_files: ["a.ts", \'b/**\', c.md]\n---\n')).toEqual(['a.ts', 'b/**', 'c.md'])
    expect(parseWorkorderAffectsFiles('---\naffects_files: [\n  "a.ts",\n  b.ts\n]\n---\n')).toEqual(['a.ts', 'b.ts'])
    expect(parseWorkorderAffectsFiles('---\naffects_files: []\n---\n')).toEqual([])
    expect(parseWorkorderAffectsFiles('---\naffects_files:\nother: 1\n---\n')).toBeNull()
    expect(parseWorkorderAffectsFiles('---\naffects_files: ~\n---\n')).toBeNull()
    expect(parseWorkorderAffectsFiles('---\nid: T1\n---\naffects_files:\n  - a\n')).toBeNull()
    expect(parseWorkorderAffectsFiles('# no frontmatter\naffects_files:\n  - a\n')).toBeNull()
    expect(parseWorkorderAffectsFiles('---\naffects_files:\n  - a\n')).toBeNull() // never closed
    // CRLF, BOM, comments, an escaped quote, a plain scalar folded onto the next line
    expect(parseWorkorderAffectsFiles('﻿---\r\naffects_files:\r\n  # note\r\n  - "x\\"y.ts"\r\n  - long/path.ts\r\n    more words\r\n  - plain.ts # comment\r\n---\r\n'))
      .toEqual(['x"y.ts', 'long/path.ts more words', 'plain.ts'])
  })

  it('the path part: notes in （） / () and quotes dropped, the first token, 、 / ， / , lists', () => {
    expect(affectsFilePatterns('electron/ct-worktree.ts（加唯讀查詢）')).toEqual(['electron/ct-worktree.ts'])
    expect(affectsFilePatterns('electron/terminal-query-handlers.ts 或新檔（註冊 channel；本機與 headless 共用）')).toEqual(['electron/terminal-query-handlers.ts'])
    expect(affectsFilePatterns('electron/main.ts、electron/remote/headless-entry.ts（接線）')).toEqual(['electron/main.ts', 'electron/remote/headless-entry.ts'])
    expect(affectsFilePatterns('electron/__tests__/**、electron/remote/__tests__/**（含 `x.test.ts` 清單）、e2e（擴充）')).toEqual(['electron/__tests__/**', 'electron/remote/__tests__/**', 'e2e'])
    expect(affectsFilePatterns('`src/a.ts` (note)')).toEqual(['src/a.ts'])
    expect(affectsFilePatterns('"./scripts\\bat.mjs"')).toEqual(['scripts/bat.mjs'])
    expect(affectsFilePatterns('a.ts,b.ts；c.ts')).toEqual(['a.ts', 'b.ts', 'c.ts'])
    expect(affectsFilePatterns('（only a note）')).toEqual([])
    expect(affectsFilePatterns('src/x.ts（unclosed note')).toEqual(['src/x.ts'])
  })

  it('matching: ** / * / ? globs, a plain path is the file or a directory containing it', () => {
    expect(matchesAffectsPattern('docs/a/b.md', 'docs/**')).toBe(true)
    expect(matchesAffectsPattern('docs', 'docs/**')).toBe(false)
    expect(matchesAffectsPattern('src/x/y/z.test.ts', 'src/**/*.test.ts')).toBe(true)
    expect(matchesAffectsPattern('src/z.test.ts', 'src/**/*.test.ts')).toBe(true)
    expect(matchesAffectsPattern('src/z.ts', 'src/**/*.test.ts')).toBe(false)
    expect(matchesAffectsPattern('src/a.ts', 'src/*.ts')).toBe(true)
    expect(matchesAffectsPattern('src/d/a.ts', 'src/*.ts')).toBe(false)
    expect(matchesAffectsPattern('src/a1.ts', 'src/a?.ts')).toBe(true)
    expect(matchesAffectsPattern('e2e/t.spec.ts', 'e2e')).toBe(true)
    expect(matchesAffectsPattern('e2e/t.spec.ts', 'e2e/')).toBe(true)
    expect(matchesAffectsPattern('e2e2/t.ts', 'e2e')).toBe(false)
    expect(matchesAffectsPattern('a.b', 'a.b')).toBe(true)
    expect(matchesAffectsPattern('axb', 'a.b')).toBe(false)
    expect(matchesAffectsPattern('SRC/A.ts', 'src/a.ts')).toBe(false)
    expect(matchesAffectsPattern('SRC/A.ts', 'src/a.ts', true)).toBe(true)
  })

  it('out of scope: null without items, _ct-workorders never', () => {
    const files = ['src/in.txt', 'src/out.txt', 'docs/x/y.md', 'lib/b.ts', '_ct-workorders/T0001-x.md']
    const items = parseWorkorderAffectsFiles(WORKORDER)
    expect(outOfScopeFiles(files, items)).toEqual(['src/out.txt'])
    expect(outOfScopeFiles(files, null)).toBeNull()
    expect(outOfScopeFiles(files, [])).toEqual(['src/in.txt', 'src/out.txt', 'docs/x/y.md', 'lib/b.ts'])
  })

  it('porcelain -z: a rename gives its new path and skips the original', () => {
    expect(parsePorcelainZ(' M a.txt\0R  new.txt\0old.txt\0?? dir/\0')).toEqual(['a.txt', 'new.txt', 'dir/'])
    expect(parsePorcelainZ('')).toEqual([])
  })
})

describe('CtWorktreeService.status (real git)', () => {
  it('a fresh worktree: 0 / 0, clean, nothing changed; a query changes nothing', async () => {
    const { repo } = makeRepo()
    const record = await isolated(repo)
    const before = [snapshot(repo), snapshot(record.path)]
    const status = ok(await service.status(record))
    expect(status).toMatchObject({
      isolated: true, workorder: 'T0001', branch: 'ct/T0001', ahead: 0, behind: 0,
      dirty: [], dirtyCount: 0, changedFiles: [], changedCount: 0, outOfScopeFiles: [], outOfScopeCount: 0,
      conflicts: [], touchesCtWorkorders: false, workorderFile: '_ct-workorders/T0001-some-title.md', cached: false,
    })
    expect(status.head).toBe(status.mainHead)
    expect(status.worktreeMissing).toBeUndefined()
    expect([snapshot(repo), snapshot(record.path)]).toEqual(before)
  })

  it('ahead / behind, changed files, out of scope, _ct-workorders and a predicted conflict', async () => {
    const { repo } = makeRepo()
    const record = await isolated(repo)
    const wt = record.path
    writeFileSync(join(wt, 'src', 'in.txt'), 'worker\n')
    writeFileSync(join(wt, 'out.txt'), 'out of scope\n')
    writeFileSync(join(wt, 'a.txt'), 'worker a\n')
    writeFileSync(join(wt, '_ct-workorders', 'T0001-some-title.md'), `${WORKORDER}\nreport\n`)
    git(wt, 'add', '-A')
    git(wt, 'commit', '-q', '-m', 'worker')
    writeFileSync(join(repo, 'a.txt'), 'main a\n')
    git(repo, 'commit', '-q', '-am', 'main 1')
    writeFileSync(join(repo, 'm.txt'), 'm\n')
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', 'main 2')

    const before = [snapshot(repo), snapshot(wt)]
    const status = ok(await service.status(record))
    expect(status.ahead).toBe(1)
    expect(status.behind).toBe(2)
    expect(status.head).toBe(git(repo, 'rev-parse', 'ct/T0001'))
    expect(status.mainHead).toBe(git(repo, 'rev-parse', 'HEAD'))
    expect([...status.changedFiles].sort()).toEqual(['_ct-workorders/T0001-some-title.md', 'a.txt', 'out.txt', 'src/in.txt'])
    expect(status.changedCount).toBe(4)
    expect([...(status.outOfScopeFiles ?? [])].sort()).toEqual(['a.txt', 'out.txt'])
    expect(status.touchesCtWorkorders).toBe(true)
    expect(status.conflicts).toEqual(['a.txt'])
    expect(status.dirty).toEqual([])
    expect([snapshot(repo), snapshot(wt)]).toEqual(before)
  })

  it('both sides moved without overlap → no conflict; main only moved → behind, nothing changed', async () => {
    const { repo } = makeRepo()
    const record = await isolated(repo)
    writeFileSync(join(repo, 'm.txt'), 'm\n')
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', 'main')
    expect(ok(await service.status(record))).toMatchObject({ ahead: 0, behind: 1, changedFiles: [], conflicts: [] })
    writeFileSync(join(record.path, 'src', 'in.txt'), 'w\n')
    git(record.path, 'commit', '-q', '-am', 'w')
    expect(ok(await service.status(record))).toMatchObject({ ahead: 1, behind: 1, changedFiles: ['src/in.txt'], outOfScopeFiles: [], conflicts: [] })
  })

  it('dirty: modified and untracked files are listed every call; the cache keeps the rest', async () => {
    const { repo } = makeRepo()
    const record = await isolated(repo)
    const first = ok(await service.status(record))
    writeFileSync(join(record.path, 'src', 'in.txt'), 'edited\n')
    writeFileSync(join(record.path, 'new.txt'), 'new\n')
    const second = ok(await service.status(record))
    expect(second.cached).toBe(true)
    expect(second.computedAt).toBe(first.computedAt)
    expect([...(second.dirty ?? [])].sort()).toEqual(['new.txt', 'src/in.txt'])
    expect(second.dirtyCount).toBe(2)
    git(record.path, 'add', '-A')
    git(record.path, 'commit', '-q', '-m', 'w')
    const third = ok(await service.status(record))
    expect(third.cached).toBe(false)
    expect(third).toMatchObject({ ahead: 1, dirty: [], dirtyCount: 0 })
  })

  it(`dirty lists at most ${CT_STATUS_DIRTY_MAX} paths, dirtyCount all`, async () => {
    const { repo } = makeRepo()
    const record = await isolated(repo)
    for (let n = 0; n < CT_STATUS_DIRTY_MAX + 5; n++) writeFileSync(join(record.path, `u${n}.txt`), 'u\n')
    const status = ok(await service.status(record))
    expect(status.dirty).toHaveLength(CT_STATUS_DIRTY_MAX)
    expect(status.dirtyCount).toBe(CT_STATUS_DIRTY_MAX + 5)
  })

  it('the worktree directory is gone → dirty null + worktreeMissing; the branch still answers', async () => {
    const { repo } = makeRepo()
    const record = await isolated(repo)
    writeFileSync(join(record.path, 'out.txt'), 'x\n')
    git(record.path, 'add', '-A')
    git(record.path, 'commit', '-q', '-m', 'w')
    rmSync(record.path, { recursive: true, force: true })
    const status = ok(await service.status(record))
    expect(status).toMatchObject({ dirty: null, dirtyCount: null, worktreeMissing: true, ahead: 1, changedFiles: ['out.txt'], outOfScopeFiles: ['out.txt'] })
  })

  it('no work order file, or no affects_files → outOfScopeFiles null', async () => {
    const none = makeRepo(null)
    const r1 = await isolated(none.repo)
    expect(ok(await service.status(r1))).toMatchObject({ outOfScopeFiles: null })
    expect(ok(await service.status(r1)).workorderFile).toBeUndefined()
    const noField = makeRepo('---\nid: T0001\n---\n')
    const r2 = await isolated(noField.repo)
    expect(ok(await service.status(r2)).outOfScopeFiles).toBeNull()
  })

  it('the branch is gone → GIT_FAILED; a record outside the rules → INVALID', async () => {
    const { repo } = makeRepo()
    const record = await isolated(repo)
    git(repo, 'worktree', 'remove', '--force', record.path)
    git(repo, 'branch', '-D', 'ct/T0001')
    expect(await service.status(record)).toMatchObject({ ok: false, code: 'GIT_FAILED' })
    expect(await service.status({ ...record, path: join(repo, 'elsewhere') })).toMatchObject({ ok: false, code: 'INVALID' })
    expect(await service.status(null)).toMatchObject({ ok: false, code: 'INVALID' })
  })
})

describe('CtWorktreeService.status (git stubbed)', () => {
  const record: CtWorktreeRecord = { path: '/w/.bat-worktrees/r/T1', branch: 'ct/T1', base: 'a'.repeat(40), mainCheckout: '/w/r', workorder: 'T1' }

  function stub(handler: (args: string[]) => Promise<GitRunResult>, timeoutMs?: number): { svc: CtWorktreeService; calls: string[][] } {
    const calls: string[][] = []
    const svc = new CtWorktreeService({
      platform: 'linux',
      existsSync: () => true,
      ...(timeoutMs !== undefined ? { statusTimeoutMs: timeoutMs } : {}),
      runGit: async args => { calls.push(args); return handler(args) },
    })
    return { svc, calls }
  }

  const answer = (args: string[]): Promise<GitRunResult> => {
    const out = (stdout: string) => Promise.resolve({ stdout, stderr: '' })
    if (args[0] === 'rev-parse') return out(args[2].startsWith('refs/heads/') ? 'b'.repeat(40) : 'c'.repeat(40))
    if (args.includes('status')) return out('')
    if (args[0] === 'rev-list') return out('2\t3\n')
    if (args[0] === 'diff') return out('x.ts\0')
    return Promise.reject(Object.assign(new Error('Command failed'), { code: 128, stdout: '', stderr: 'fatal: refusing to merge unrelated histories' }))
  }

  it('merge-tree failing other than exit 1 → conflicts null + conflictsError', async () => {
    const { svc } = stub(answer)
    const status = ok(await svc.status(record))
    expect(status).toMatchObject({ ahead: 3, behind: 2, changedFiles: ['x.ts'], conflicts: null, conflictsError: 'fatal: refusing to merge unrelated histories' })
  })

  it('git status runs with --no-optional-locks (no index refresh written)', async () => {
    const { svc, calls } = stub(answer)
    await svc.status(record)
    expect(calls.find(c => c.includes('status'))).toEqual(['--no-optional-locks', 'status', '--porcelain=v1', '-z'])
    expect(calls.find(c => c[0] === 'merge-tree')).toEqual(['merge-tree', '--write-tree', '--name-only', '--no-messages', '-z', 'c'.repeat(40), 'b'.repeat(40)])
  })

  it('the cache is per (worktree, head, mainHead)', async () => {
    const { svc, calls } = stub(answer)
    await svc.status(record)
    await svc.status(record)
    expect(calls.filter(c => c[0] === 'rev-list')).toHaveLength(1)
    expect(calls.filter(c => c.includes('status'))).toHaveLength(2)
  })

  it('a query that takes longer than the limit → TIMEOUT', async () => {
    const { svc } = stub(() => new Promise<GitRunResult>(() => {}), 50)
    expect(await svc.status(record)).toMatchObject({ ok: false, code: 'TIMEOUT' })
  })
})
