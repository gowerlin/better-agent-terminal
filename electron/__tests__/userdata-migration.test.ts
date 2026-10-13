// @vitest-environment node
/**
 * BUG-119 / T0480: userdata-migration rules (T0479 report §4). Everything runs
 * against a temporary appData; the real %APPDATA% directories are never touched.
 */
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  describeMigrationReport,
  migrateUserData,
  MIGRATION_MARKER,
  parseRuntimeId,
  runtimeSuffix,
  type MigrationReport,
} from '../userdata-migration'

const FIXED_NOW = () => new Date(2026, 9, 13, 22, 40, 5)

let appData: string
let L: string
let T: string

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf-8')
}

function read(file: string): string {
  return fs.readFileSync(file, 'utf-8')
}

function item(report: MigrationReport, name: string) {
  return report.items.find(i => i.name === name)
}

function snippet(id: number, title: string, extra: Record<string, unknown> = {}) {
  return { id, title, content: `content-${title}`, format: 'plaintext', action: 'terminal', isFavorite: false, createdAt: 1000 + id, updatedAt: 1000 + id, ...extra }
}

function runDefault(opts: Partial<Parameters<typeof migrateUserData>[0]> = {}): MigrationReport {
  return migrateUserData({ appData, suffix: '', now: FIXED_NOW, isServerRunning: () => false, ...opts })
}

beforeEach(() => {
  appData = fs.mkdtempSync(path.join(os.tmpdir(), 'bat-t0480-appdata-'))
  L = path.join(appData, 'better-agent-terminal')
  T = path.join(appData, 'BetterAgentTerminal')
})

afterEach(() => {
  fs.rmSync(appData, { recursive: true, force: true })
})

describe('parseRuntimeId / runtimeSuffix', () => {
  it('--runtime= wins over BAT_RUNTIME', () => {
    expect(parseRuntimeId(['electron', '.', '--runtime=7'], { BAT_RUNTIME: '9' })).toBe('7')
    expect(parseRuntimeId(['electron', '.'], { BAT_RUNTIME: '9' })).toBe('9')
    expect(parseRuntimeId(['electron', '.'], {})).toBeUndefined()
    expect(parseRuntimeId(['electron', '.'], { BAT_RUNTIME: '' })).toBeUndefined()
  })

  it('builds the directory suffix', () => {
    expect(runtimeSuffix(undefined)).toBe('')
    expect(runtimeSuffix('7')).toBe('-runtime-7')
  })
})

describe('default instance', () => {
  it('does nothing and writes no marker when the legacy directory does not exist', () => {
    const report = runDefault()
    expect(report.userData).toBe(T)
    expect(report.skipped).toBe('no-legacy')
    expect(report.items).toEqual([])
    expect(fs.existsSync(path.join(T, MIGRATION_MARKER))).toBe(false)
  })

  it('copies Local State only when the target has none, and keeps the legacy copy', () => {
    write(path.join(L, 'Local State'), 'legacy-key')
    const report = runDefault()
    expect(report.userData).toBe(T)
    expect(item(report, 'Local State')?.result).toBe('copied')
    expect(read(path.join(T, 'Local State'))).toBe('legacy-key')
    expect(read(path.join(L, 'Local State'))).toBe('legacy-key')
  })

  it('never overwrites an existing target Local State', () => {
    write(path.join(L, 'Local State'), 'legacy-key')
    write(path.join(T, 'Local State'), 'target-key')
    const report = runDefault()
    expect(item(report, 'Local State')?.result).toBe('target-exists')
    expect(read(path.join(T, 'Local State'))).toBe('target-key')
  })

  it('reports a Local State copy failure as error with the server-token consequence, without throwing', () => {
    // A directory in place of the legacy file makes copyFileSync fail.
    fs.mkdirSync(path.join(L, 'Local State'), { recursive: true })
    const report = runDefault()
    const ls = item(report, 'Local State')
    expect(ls?.result).toBe('failed')
    expect(ls?.level).toBe('error')
    expect(ls?.detail).toMatch(/server-token\.json will be regenerated/)
  })

  it('copies snippets.json when only the legacy one exists', () => {
    const data = { snippets: [snippet(1, 'a')], nextId: 2 }
    write(path.join(L, 'snippets.json'), JSON.stringify(data))
    const report = runDefault()
    expect(item(report, 'snippets.json')?.result).toBe('copied')
    expect(JSON.parse(read(path.join(T, 'snippets.json')))).toEqual(data)
    expect(fs.existsSync(path.join(L, 'snippets.json'))).toBe(true)
  })

  it('merges snippets: target first, de-duplicated, legacy ids renumbered, backup written', () => {
    write(path.join(T, 'snippets.json'), JSON.stringify({ snippets: [snippet(1, 'a'), snippet(4, 'b')], nextId: 6 }))
    write(path.join(L, 'snippets.json'), JSON.stringify({
      // id 1 'a' duplicates the target (same title/content/workspaceId/createdAt);
      // 'c' and 'd' are new; 'a' with another workspaceId is new as well.
      snippets: [snippet(1, 'a'), snippet(2, 'c'), snippet(3, 'd'), snippet(1, 'a', { workspaceId: 'ws1' })],
      nextId: 4,
    }))
    const report = runDefault()
    expect(item(report, 'snippets.json')?.result).toBe('merged')
    const merged = JSON.parse(read(path.join(T, 'snippets.json')))
    expect(merged.snippets.map((s: { id: number; title: string }) => [s.id, s.title])).toEqual([
      [1, 'a'], [4, 'b'], [6, 'c'], [7, 'd'], [8, 'a'],
    ])
    expect(merged.snippets[4].workspaceId).toBe('ws1')
    expect(merged.nextId).toBe(9)
    const backup = path.join(T, 'snippets.json.pre-merge-20261013-224005.bak')
    expect(JSON.parse(read(backup)).snippets).toHaveLength(2)
    expect(fs.readdirSync(T).filter(f => f.includes('.tmp-'))).toEqual([])
  })

  it('does not rewrite the target when the legacy snippets add nothing new', () => {
    const data = JSON.stringify({ snippets: [snippet(1, 'a')], nextId: 2 })
    write(path.join(T, 'snippets.json'), data)
    write(path.join(L, 'snippets.json'), data)
    const report = runDefault()
    expect(item(report, 'snippets.json')?.result).toBe('merged-nothing-new')
    expect(read(path.join(T, 'snippets.json'))).toBe(data)
    expect(fs.readdirSync(T).filter(f => f.endsWith('.bak'))).toEqual([])
  })

  it('skips an unparseable legacy snippets.json and leaves it untouched', () => {
    write(path.join(L, 'snippets.json'), '{ broken')
    const report = runDefault()
    expect(item(report, 'snippets.json')?.result).toBe('legacy-unparseable')
    expect(fs.existsSync(path.join(T, 'snippets.json'))).toBe(false)
    expect(read(path.join(L, 'snippets.json'))).toBe('{ broken')
  })

  it('does not merge into or overwrite an unparseable target snippets.json', () => {
    write(path.join(L, 'snippets.json'), JSON.stringify({ snippets: [snippet(1, 'a')], nextId: 2 }))
    write(path.join(T, 'snippets.json'), 'not json')
    const report = runDefault()
    expect(item(report, 'snippets.json')?.result).toBe('target-unparseable')
    expect(read(path.join(T, 'snippets.json'))).toBe('not json')
  })

  it('moves message-archives files only when the target has no file of the same name', () => {
    write(path.join(L, 'message-archives', 'a.jsonl'), 'legacy-a')
    write(path.join(L, 'message-archives', 'b.jsonl'), 'legacy-b')
    write(path.join(L, 'message-archives', 'notes.txt'), 'other')
    write(path.join(T, 'message-archives', 'b.jsonl'), 'target-b')
    const report = runDefault()
    expect(item(report, 'message-archives')?.result).toBe('moved')
    expect(read(path.join(T, 'message-archives', 'a.jsonl'))).toBe('legacy-a')
    expect(fs.existsSync(path.join(L, 'message-archives', 'a.jsonl'))).toBe(false)
    expect(read(path.join(T, 'message-archives', 'b.jsonl'))).toBe('target-b')
    expect(read(path.join(L, 'message-archives', 'b.jsonl'))).toBe('legacy-b')
    expect(fs.existsSync(path.join(L, 'message-archives', 'notes.txt'))).toBe(true)
  })

  it('leaves an archive in the legacy directory when its rename fails', () => {
    write(path.join(L, 'message-archives', 'a.jsonl'), 'legacy-a')
    const report = runDefault({ renameSync: () => { throw new Error('EBUSY') } })
    expect(item(report, 'message-archives')?.result).toBe('partial')
    expect(item(report, 'message-archives')?.level).toBe('warn')
    expect(read(path.join(L, 'message-archives', 'a.jsonl'))).toBe('legacy-a')
  })

  it('does not touch Logs / Crashes / lockfile / unknown files and never deletes the legacy directory', () => {
    write(path.join(L, 'Logs', 'debug-1.log'), 'log')
    write(path.join(L, 'Crashes', 'x.dmp'), 'dmp')
    write(path.join(L, 'lockfile'), '')
    write(path.join(L, 'other.json'), '{}')
    const report = runDefault()
    expect(item(report, 'Logs')?.result).toBe('not-moved')
    expect(item(report, 'Logs')?.detail).toContain(path.join(L, 'Logs'))
    expect(item(report, 'Crashes')?.result).toBe('not-moved')
    for (const f of ['Logs', 'Crashes', 'lockfile', 'other.json']) {
      expect(fs.existsSync(path.join(T, f))).toBe(false)
      expect(fs.existsSync(path.join(L, f))).toBe(true)
    }
  })

  it('writes the marker and runs only once', () => {
    write(path.join(L, 'snippets.json'), JSON.stringify({ snippets: [snippet(1, 'a')], nextId: 2 }))
    const first = runDefault()
    expect(item(first, 'marker')?.result).toBe('written')
    const marker = JSON.parse(read(path.join(T, MIGRATION_MARKER)))
    expect(marker).toMatchObject({ v: 1, from: L, items: { 'snippets.json': 'copied', 'Local State': 'no-legacy' } })
    expect(marker.at).toBe(FIXED_NOW().toISOString())

    // A snippet added to the legacy file after the first run is not picked up again.
    write(path.join(L, 'snippets.json'), JSON.stringify({ snippets: [snippet(1, 'a'), snippet(2, 'late')], nextId: 3 }))
    const second = runDefault()
    expect(second.skipped).toBe('marker-exists')
    expect(second.items).toEqual([])
    expect(JSON.parse(read(path.join(T, 'snippets.json'))).snippets).toHaveLength(1)
  })
})

describe('runtime instance', () => {
  const suffix = '-runtime-97'
  let Lrt: string
  let Trt: string

  beforeEach(() => {
    Lrt = path.join(appData, `better-agent-terminal${suffix}`)
    Trt = path.join(appData, `BetterAgentTerminal${suffix}`)
  })

  function runRuntime(opts: Partial<Parameters<typeof migrateUserData>[0]> = {}): MigrationReport {
    return migrateUserData({ appData, suffix, now: FIXED_NOW, isServerRunning: () => false, ...opts })
  }

  it('uses the new directory when neither exists', () => {
    const report = runRuntime()
    expect(report.userData).toBe(Trt)
    expect(report.skipped).toBe('no-legacy')
    expect(fs.existsSync(Trt)).toBe(false)
  })

  it('renames the whole legacy runtime directory and writes the marker', () => {
    write(path.join(Lrt, 'settings.json'), '{"marker":1}')
    write(path.join(Lrt, 'snippets.json'), '{"snippets":[],"nextId":1}')
    const report = runRuntime()
    expect(report.userData).toBe(Trt)
    expect(item(report, 'runtime-dir')?.result).toBe('renamed')
    expect(fs.existsSync(Lrt)).toBe(false)
    expect(read(path.join(Trt, 'settings.json'))).toBe('{"marker":1}')
    expect(fs.existsSync(path.join(Trt, MIGRATION_MARKER))).toBe(true)
  })

  it('keeps the legacy directory for this start while its terminal server is running', () => {
    write(path.join(Lrt, 'bat-pty-server.pid'), '123')
    const seen: string[] = []
    const report = runRuntime({ isServerRunning: (dir) => { seen.push(dir); return true } })
    expect(seen).toEqual([Lrt])
    expect(report.userData).toBe(Lrt)
    expect(item(report, 'runtime-dir')).toMatchObject({ result: 'server-running', level: 'warn' })
    expect(fs.existsSync(Lrt)).toBe(true)
    expect(fs.existsSync(Trt)).toBe(false)
  })

  it('keeps the legacy directory for this start when the rename fails', () => {
    write(path.join(Lrt, 'settings.json'), '{}')
    const report = runRuntime({ renameSync: () => { throw Object.assign(new Error('EPERM: operation not permitted'), { code: 'EPERM' }) } })
    expect(report.userData).toBe(Lrt)
    expect(item(report, 'runtime-dir')).toMatchObject({ result: 'rename-failed', level: 'warn' })
    expect(fs.existsSync(Lrt)).toBe(true)
  })

  it('treats an isServerRunning failure as not running and still renames', () => {
    write(path.join(Lrt, 'settings.json'), '{}')
    const report = runRuntime({ isServerRunning: () => { throw new Error('boom') } })
    expect(report.userData).toBe(Trt)
    expect(item(report, 'runtime-dir')?.result).toBe('renamed')
  })

  it('uses the existing new directory and only warns when both exist', () => {
    write(path.join(Lrt, 'settings.json'), '{"old":1}')
    write(path.join(Trt, 'settings.json'), '{"new":1}')
    const report = runRuntime()
    expect(report.userData).toBe(Trt)
    expect(item(report, 'runtime-dir')).toMatchObject({ result: 'both-exist', level: 'warn' })
    expect(read(path.join(Lrt, 'settings.json'))).toBe('{"old":1}')
    expect(read(path.join(Trt, 'settings.json'))).toBe('{"new":1}')
  })

  it('does not seed runtime snippets from the default instance', () => {
    write(path.join(L, 'snippets.json'), JSON.stringify({ snippets: [snippet(1, 'shared')], nextId: 2 }))
    const report = runRuntime()
    expect(report.userData).toBe(Trt)
    expect(fs.existsSync(path.join(Trt, 'snippets.json'))).toBe(false)
    expect(fs.existsSync(T)).toBe(false)
  })

  it('refuses to migrate an unsafe runtime id', () => {
    const report = migrateUserData({ appData, suffix: '-runtime-../evil', now: FIXED_NOW, isServerRunning: () => false })
    expect(report.skipped).toBe('invalid-runtime-id')
    expect(item(report, 'runtime-dir')?.level).toBe('warn')
  })
})

describe('failures never throw', () => {
  it('returns a report when appData is not usable', () => {
    const file = path.join(appData, 'not-a-dir')
    write(file, 'x')
    // appData points at a regular file: every fs call under it fails.
    expect(() => migrateUserData({ appData: file, suffix: '' })).not.toThrow()
    expect(() => migrateUserData({ appData: file, suffix: '-runtime-1' })).not.toThrow()
  })

  it('reports a target that cannot be created', () => {
    write(path.join(L, 'Local State'), 'k')
    write(T, 'a file where the target directory should be')
    const report = runDefault()
    expect(report.userData).toBe(T)
    expect(item(report, 'target')).toMatchObject({ result: 'mkdir-failed', level: 'error' })
  })

  it('describes the report for the logger', () => {
    write(path.join(L, 'Local State'), 'k')
    const lines = describeMigrationReport(runDefault())
    expect(lines[0]).toEqual({ level: 'info', message: `userData=${T} (legacy ${L})` })
    expect(lines).toContainEqual({ level: 'info', message: 'Local State: copied' })
  })
})
