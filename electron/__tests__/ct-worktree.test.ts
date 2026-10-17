// @vitest-environment node
/**
 * PLAN-047 W1 / T0583: `CtWorktreeService` against real git in temp repos (never this repo: every
 * fixture asserts `git rev-parse --show-toplevel` is its own temp directory before it writes, T0574
 * L155) — create / reuse / existing branch / path taken / not a repo / sub-directory cwd / remove
 * clean and dirty / archive and its name collision / record validation.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  CtWorktreeService,
  ctWorktreeBranch,
  ctWorktreeEnv,
  ctWorktreeLocation,
  ctWorktreeWorkorder,
  normalizeIsolationMode,
  normalizeWorktreeCloseMode,
  parseCtWorktreeRecord,
  parseWorktreePorcelain,
  type CtWorktreeRecord,
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

/** A temp `<root>/repo` with one commit; asserts git sees exactly that directory as the repo. */
function makeRepo(): { root: string; repo: string; head: string } {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'bat-ct-wt-')))
  roots.push(root)
  const repo = join(root, 'repo')
  mkdirSync(join(repo, 'src', 'deep'), { recursive: true })
  git(repo, 'init', '-q', '-b', 'main')
  const top = git(repo, 'rev-parse', '--show-toplevel')
  if (!same(top, repo) || same(top, repoRoot)) throw new Error(`fixture repo is not isolated: ${top}`)
  writeFileSync(join(repo, 'a.txt'), 'a\n')
  writeFileSync(join(repo, 'src', 'deep', 'b.txt'), 'b\n')
  writeFileSync(join(repo, '.gitignore'), 'ignored/\n')
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', 'init')
  return { root, repo, head: git(repo, 'rev-parse', 'HEAD') }
}

const service = new CtWorktreeService()

describe('ct-worktree helpers', () => {
  it('normalizes isolation / close modes and work order ids', () => {
    expect(normalizeIsolationMode(' Worktree ')).toBe('worktree')
    expect(normalizeIsolationMode('copy')).toBeNull()
    expect(normalizeIsolationMode(1)).toBeNull()
    expect(normalizeWorktreeCloseMode(' ARCHIVE')).toBe('archive')
    expect(normalizeWorktreeCloseMode('delete')).toBeNull()
    expect(ctWorktreeWorkorder(' cp-t0113 ')).toBe('CP-T0113')
    expect(ctWorktreeWorkorder('T1/../x')).toBeNull()
    expect(ctWorktreeWorkorder('../T1')).toBeNull()
    expect(ctWorktreeBranch('T0583')).toBe('ct/T0583')
  })

  it('location = <parent>/.bat-worktrees/<repo dir>/<T####>', () => {
    expect(ctWorktreeLocation('D:\\src\\better-agent-terminal', 'T0583', 'win32')).toBe('D:\\src\\.bat-worktrees\\better-agent-terminal\\T0583')
    expect(ctWorktreeLocation('/home/u/proj/', 'T1', 'linux')).toBe('/home/u/.bat-worktrees/proj/T1')
  })

  it('env carries CT_HOME and the worktree fields', () => {
    const record: CtWorktreeRecord = { path: '/w/.bat-worktrees/r/T1', branch: 'ct/T1', base: 'a'.repeat(40), mainCheckout: '/w/r', workorder: 'T1' }
    expect(ctWorktreeEnv(record)).toEqual({ CT_HOME: '/w/r', CT_WORKTREE: '/w/.bat-worktrees/r/T1', CT_WORKTREE_BRANCH: 'ct/T1', CT_WORKTREE_BASE: 'a'.repeat(40) })
  })

  it('parseCtWorktreeRecord accepts only the location / branch rules', () => {
    const ok = { path: '/w/.bat-worktrees/r/T1', branch: 'ct/T1', base: 'abcdef1', mainCheckout: '/w/r', workorder: 't1' }
    expect(parseCtWorktreeRecord(ok, 'linux')).toEqual({ ...ok, workorder: 'T1' })
    expect(parseCtWorktreeRecord({ ...ok, path: '/w/elsewhere/T1' }, 'linux')).toBeNull()
    expect(parseCtWorktreeRecord({ ...ok, branch: 'main' }, 'linux')).toBeNull()
    expect(parseCtWorktreeRecord({ ...ok, base: 'not-a-sha' }, 'linux')).toBeNull()
    expect(parseCtWorktreeRecord({ ...ok, mainCheckout: 'relative/r' }, 'linux')).toBeNull()
    expect(parseCtWorktreeRecord({ ...ok, workorder: '../x' }, 'linux')).toBeNull()
    expect(parseCtWorktreeRecord(null, 'linux')).toBeNull()
    // win32 compares paths case-insensitively
    expect(parseCtWorktreeRecord({ path: 'C:\\W\\.bat-worktrees\\R\\T1', branch: 'ct/T1', base: 'abcdef1', mainCheckout: 'c:\\w\\r', workorder: 'T1' }, 'win32')).not.toBeNull()
  })

  it('parses `git worktree list --porcelain`', () => {
    const out = 'worktree /r\nHEAD 1111\nbranch refs/heads/main\n\nworktree /w/T1\nHEAD 2222\nbranch refs/heads/ct/T1\n\nworktree /w/T2\nHEAD 3333\ndetached\nprunable gitdir file points to non-existent location\n'
    expect(parseWorktreePorcelain(out)).toEqual([
      { path: '/r', head: '1111', branch: 'main' },
      { path: '/w/T1', head: '2222', branch: 'ct/T1' },
      { path: '/w/T2', head: '3333', detached: true, prunable: true },
    ])
  })
})

describe('CtWorktreeService.prepare (real git)', () => {
  it('creates the worktree outside the repo on ct/<T####> from HEAD', async () => {
    const { root, repo, head } = makeRepo()
    const r = await service.prepare({ cwd: repo, workorder: 't0001' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const expected = join(root, '.bat-worktrees', 'repo', 'T0001')
    expect(same(r.record.path, expected)).toBe(true)
    expect(same(r.record.mainCheckout, repo)).toBe(true)
    expect(r.record).toMatchObject({ branch: 'ct/T0001', base: head, workorder: 'T0001' })
    expect(r).toMatchObject({ reused: false, createdBranch: true })
    expect(same(r.cwd, expected)).toBe(true)
    expect(existsSync(join(expected, 'a.txt'))).toBe(true)
    expect(git(expected, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('ct/T0001')
    // the main checkout did not move
    expect(git(repo, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('main')
    expect(git(repo, 'status', '--porcelain')).toBe('')
  })

  it('keeps the sub-directory of the dispatch cwd', async () => {
    const { repo } = makeRepo()
    const r = await service.prepare({ cwd: join(repo, 'src', 'deep'), workorder: 'T0002' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(same(r.cwd, join(r.record.path, 'src', 'deep'))).toBe(true)
    expect(same(r.record.mainCheckout, repo)).toBe(true)
  })

  it('a sub-directory that is not in the commit → the worktree root', async () => {
    const { repo } = makeRepo()
    mkdirSync(join(repo, 'untracked-dir'))
    const r = await service.prepare({ cwd: join(repo, 'untracked-dir'), workorder: 'T0003' })
    expect(r.ok && same(r.cwd, r.record.path)).toBe(true)
  })

  it('dispatch again → reused, not rebuilt; base = fork point', async () => {
    const { repo, head } = makeRepo()
    const first = await service.prepare({ cwd: repo, workorder: 'T0004' })
    if (!first.ok) throw new Error(first.error)
    writeFileSync(join(first.record.path, 'work.txt'), 'w\n')
    git(first.record.path, 'add', '-A')
    git(first.record.path, 'commit', '-q', '-m', 'work')
    writeFileSync(join(repo, 'main2.txt'), 'm\n')
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', 'main moves on')
    const again = await service.prepare({ cwd: repo, workorder: 'T0004' })
    expect(again).toMatchObject({ ok: true, reused: true, createdBranch: false })
    if (!again.ok) return
    expect(same(again.record.path, first.record.path)).toBe(true)
    expect(again.record.base).toBe(head)
    expect(existsSync(join(again.record.path, 'work.txt'))).toBe(true)
  })

  it('branch exists, worktree does not → a worktree on that branch', async () => {
    const { repo, head } = makeRepo()
    git(repo, 'branch', 'ct/T0005', head)
    const r = await service.prepare({ cwd: repo, workorder: 'T0005' })
    expect(r).toMatchObject({ ok: true, reused: false, createdBranch: false })
    if (!r.ok) return
    expect(git(r.record.path, 'rev-parse', '--abbrev-ref', 'HEAD')).toBe('ct/T0005')
    expect(r.record.base).toBe(head)
  })

  it('location taken by a plain directory → failure, nothing created', async () => {
    const { root, repo } = makeRepo()
    mkdirSync(join(root, '.bat-worktrees', 'repo', 'T0006'), { recursive: true })
    const r = await service.prepare({ cwd: repo, workorder: 'T0006' })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toMatch(/already exists and is not a worktree of ct\/T0006/)
    expect(git(repo, 'branch', '--list', 'ct/T0006')).toBe('')
  })

  it('location registered on another branch → failure', async () => {
    const { root, repo } = makeRepo()
    git(repo, 'worktree', 'add', '-q', '-b', 'other', join(root, '.bat-worktrees', 'repo', 'T0007'))
    const r = await service.prepare({ cwd: repo, workorder: 'T0007' })
    expect(r.ok === false && /branch other, not ct\/T0007/.test(r.error)).toBe(true)
  })

  it('ct/<T####> checked out elsewhere → failure', async () => {
    const { root, repo } = makeRepo()
    git(repo, 'worktree', 'add', '-q', '-b', 'ct/T0008', join(root, 'elsewhere'))
    const r = await service.prepare({ cwd: repo, workorder: 'T0008' })
    expect(r.ok === false && /already checked out at/.test(r.error)).toBe(true)
  })

  it('stale registration (directory deleted) → pruned and created again', async () => {
    const { repo } = makeRepo()
    const first = await service.prepare({ cwd: repo, workorder: 'T0009' })
    if (!first.ok) throw new Error(first.error)
    rmSync(first.record.path, { recursive: true, force: true })
    const again = await service.prepare({ cwd: repo, workorder: 'T0009' })
    expect(again).toMatchObject({ ok: true, reused: false, createdBranch: false })
    if (again.ok) expect(existsSync(join(again.record.path, 'a.txt'))).toBe(true)
  })

  it('not a git repository / missing cwd / no commit / bad work order → failure', async () => {
    const plain = realpathSync(mkdtempSync(join(tmpdir(), 'bat-ct-wt-plain-')))
    roots.push(plain)
    // a ceiling keeps git from finding a repo above the temp dir
    const noRepo = new CtWorktreeService({ env: () => ({ ...process.env, GIT_CEILING_DIRECTORIES: resolve(plain, '..') }) })
    const r1 = await noRepo.prepare({ cwd: plain, workorder: 'T0010' })
    expect(r1.ok === false && /is not a git repository/.test(r1.error)).toBe(true)
    expect(existsSync(join(plain, '..', '.bat-worktrees'))).toBe(false)

    const r2 = await service.prepare({ cwd: join(plain, 'nope'), workorder: 'T0010' })
    expect(r2.ok === false && /does not exist/.test(r2.error)).toBe(true)

    const empty = join(plain, 'empty')
    mkdirSync(empty)
    git(empty, 'init', '-q')
    if (!same(git(empty, 'rev-parse', '--show-toplevel'), empty)) throw new Error('fixture repo is not isolated')
    const r3 = await service.prepare({ cwd: empty, workorder: 'T0010' })
    expect(r3.ok === false && /has no commit yet/.test(r3.error)).toBe(true)

    const r4 = await service.prepare({ cwd: plain, workorder: 'T0010; rm -rf /' })
    expect(r4.ok === false && /invalid work order id/.test(r4.error)).toBe(true)
  })

  it('git missing → failure with "git not found"', async () => {
    const { repo } = makeRepo()
    const noGit = new CtWorktreeService({ gitBinary: () => join(repo, 'no-such-git') })
    const r = await noGit.prepare({ cwd: repo, workorder: 'T0011' })
    expect(r.ok === false && /git not found/.test(r.error)).toBe(true)
  })

  it('Windows passes -c core.longpaths=true to every git call', async () => {
    const calls: string[][] = []
    const fake = new CtWorktreeService({
      platform: 'win32',
      existsSync: () => true,
      runGit: async (args) => { calls.push(args); throw Object.assign(new Error('x'), { stderr: 'fatal: not a git repository' }) },
    })
    await fake.prepare({ cwd: 'C:\\r', workorder: 'T1' })
    expect(calls[0].slice(0, 2)).toEqual(['-c', 'core.longpaths=true'])
  })
})

describe('CtWorktreeService.cleanup (real git)', () => {
  async function prepared(workorder: string) {
    const fixture = makeRepo()
    const r = await service.prepare({ cwd: fixture.repo, workorder })
    if (!r.ok) throw new Error(r.error)
    return { ...fixture, record: r.record }
  }

  it('remove: clean worktree removed (ignored files too), branch kept', async () => {
    const { repo, record } = await prepared('T0020')
    mkdirSync(join(record.path, 'ignored'))
    writeFileSync(join(record.path, 'ignored', 'big.bin'), 'x')
    expect(await service.cleanup(record, 'remove')).toEqual({ status: 'removed' })
    expect(existsSync(record.path)).toBe(false)
    expect(git(repo, 'branch', '--list', 'ct/T0020')).toContain('ct/T0020')
    expect(git(repo, 'worktree', 'list')).not.toContain('T0020')
  })

  it('remove: uncommitted / untracked changes → kept', async () => {
    const { record } = await prepared('T0021')
    writeFileSync(join(record.path, 'a.txt'), 'changed\n')
    expect(await service.cleanup(record, 'remove')).toEqual({ status: 'kept-dirty', detail: 'uncommitted changes' })
    expect(existsSync(record.path)).toBe(true)

    const second = await prepared('T0022')
    writeFileSync(join(second.record.path, 'new.txt'), 'n\n')
    expect((await service.cleanup(second.record, 'remove')).status).toBe('kept-dirty')
    expect(existsSync(second.record.path)).toBe(true)
  })

  it('archive: removed + branch renamed; a taken name gets a time suffix', async () => {
    const { repo, record } = await prepared('T0023')
    git(repo, 'branch', 'ct-archive/T0023', 'HEAD')
    const fixed = new CtWorktreeService({ now: () => new Date(2026, 9, 17, 21, 54, 7) })
    const r = await fixed.cleanup(record, 'archive')
    expect(r).toEqual({ status: 'archived', archivedBranch: 'ct-archive/T0023-20261017-215407' })
    expect(existsSync(record.path)).toBe(false)
    expect(git(repo, 'branch', '--list', 'ct/T0023')).toBe('')
    expect(git(repo, 'branch', '--list', 'ct-archive/T0023-20261017-215407')).toContain('ct-archive/T0023-20261017-215407')
  })

  it('archive without a collision → ct-archive/<T####>', async () => {
    const { repo, record } = await prepared('T0024')
    expect(await service.cleanup(record, 'archive')).toEqual({ status: 'archived', archivedBranch: 'ct-archive/T0024' })
    expect(git(repo, 'branch', '--list', 'ct-archive/T0024')).toContain('ct-archive/T0024')
  })

  it('already removed → missing; a record off the rules → invalid, nothing touched', async () => {
    const { repo, record } = await prepared('T0025')
    git(repo, 'worktree', 'remove', record.path)
    expect((await service.cleanup(record, 'remove')).status).toBe('missing')
    expect((await service.cleanup({ ...record, branch: 'main' }, 'remove')).status).toBe('invalid')
    expect((await service.cleanup({ ...record, path: repo }, 'remove')).status).toBe('invalid')
    expect(existsSync(join(repo, 'a.txt'))).toBe(true)
  })

  it('location now a worktree of another branch → invalid, kept', async () => {
    const { repo, record } = await prepared('T0026')
    git(repo, 'worktree', 'remove', record.path)
    git(repo, 'worktree', 'add', '-q', '-b', 'someone-else', record.path)
    expect((await service.cleanup(record, 'remove')).status).toBe('invalid')
    expect(existsSync(record.path)).toBe(true)
  })
})
