// BUG-119 / T0480: one-time move of the data that used to land in the legacy
// `better-agent-terminal[-runtime-<N>]` userData into `BetterAgentTerminal[-runtime-<N>]`.
// Rules: T0479 report §4.
//
// Runs synchronously from app-paths-bootstrap before app ready — `Local State`
// holds the safeStorage key and must be in place before Chromium reads it.
// Pure fs: no electron import (the logger is not initialised yet, results go
// into the returned report and main.ts logs them after logger.init). Every step
// is try/catch'd; nothing here throws.
import * as fs from 'fs'
import * as path from 'path'
import { isServerRunning as defaultIsServerRunning } from './terminal-server/pid-manager'

export const LEGACY_DIR_NAME = 'better-agent-terminal'
export const TARGET_DIR_NAME = 'BetterAgentTerminal'
export const MIGRATION_MARKER = '.userdata-migration.json'

const RUNTIME_ID_PATTERN = /^[a-zA-Z0-9._-]+$/

export type MigrationLevel = 'info' | 'warn' | 'error'

export interface MigrationItem {
  name: string
  result: string
  level: MigrationLevel
  detail?: string
}

export interface MigrationReport {
  /** The directory the app must use as userData. */
  userData: string
  legacyDir: string
  targetDir: string
  /** Set when the run stopped before touching any item. */
  skipped?: 'no-legacy' | 'marker-exists' | 'target-exists' | 'invalid-runtime-id'
  items: MigrationItem[]
}

export interface MigrationOptions {
  appData: string
  /** '' for the default instance, '-runtime-<N>' for a runtime instance. */
  suffix: string
  isServerRunning?: (userDataPath: string) => boolean
  now?: () => Date
  renameSync?: (from: string, to: string) => void
}

interface SnippetLike {
  id: number
  title?: string
  content?: string
  workspaceId?: string
  createdAt?: number
  [key: string]: unknown
}

interface SnippetFile {
  snippets: SnippetLike[]
  nextId: number
}

/** `--runtime=` wins over `BAT_RUNTIME` (same rule main.ts has always used). */
export function parseRuntimeId(argv: readonly string[], env: NodeJS.ProcessEnv): string | undefined {
  const runtimeArg = argv.find(a => a.startsWith('--runtime='))
  return runtimeArg ? runtimeArg.split('=')[1] : (env.BAT_RUNTIME || undefined)
}

export function runtimeSuffix(runtimeId: string | undefined): string {
  return runtimeId ? `-runtime-${runtimeId}` : ''
}

export function legacyUserDataDir(appData: string, suffix: string): string {
  return path.join(appData, LEGACY_DIR_NAME + suffix)
}

export function targetUserDataDir(appData: string, suffix: string): string {
  return path.join(appData, TARGET_DIR_NAME + suffix)
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function stampOf(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}-${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
}

function isDir(p: string): boolean {
  try { return fs.statSync(p).isDirectory() } catch { return false }
}

function readSnippetFile(file: string): SnippetFile | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<SnippetFile>
    if (!parsed || !Array.isArray(parsed.snippets)) return null
    return { snippets: parsed.snippets, nextId: typeof parsed.nextId === 'number' ? parsed.nextId : 1 }
  } catch {
    return null
  }
}

function snippetKey(s: SnippetLike): string {
  return JSON.stringify([s.title ?? null, s.content ?? null, s.workspaceId ?? null, s.createdAt ?? null])
}

function migrateLocalState(legacy: string, target: string): MigrationItem {
  const name = 'Local State'
  const src = path.join(legacy, 'Local State')
  const dst = path.join(target, 'Local State')
  try {
    if (fs.existsSync(dst)) return { name, result: 'target-exists', level: 'info', detail: 'kept the existing Local State, not overwritten' }
    if (!fs.existsSync(src)) return { name, result: 'no-legacy', level: 'info' }
    fs.copyFileSync(src, dst, fs.constants.COPYFILE_EXCL)
    return { name, result: 'copied', level: 'info' }
  } catch (err) {
    return {
      name,
      result: 'failed',
      level: 'error',
      detail: `${errorText(err)} — the safeStorage key is not carried over: server-token.json will be regenerated and remote clients must be paired again`,
    }
  }
}

function migrateSnippets(legacy: string, target: string, now: Date): MigrationItem {
  const name = 'snippets.json'
  const src = path.join(legacy, 'snippets.json')
  const dst = path.join(target, 'snippets.json')
  try {
    if (!fs.existsSync(src)) return { name, result: 'no-legacy', level: 'info' }
    const legacyData = readSnippetFile(src)
    if (!legacyData) return { name, result: 'legacy-unparseable', level: 'warn', detail: `left ${src} as is` }
    if (!fs.existsSync(dst)) {
      fs.copyFileSync(src, dst, fs.constants.COPYFILE_EXCL)
      return { name, result: 'copied', level: 'info', detail: `${legacyData.snippets.length} snippet(s)` }
    }
    const targetData = readSnippetFile(dst)
    if (!targetData) return { name, result: 'target-unparseable', level: 'warn', detail: `not merged, ${dst} left as is` }

    const seen = new Set(targetData.snippets.map(snippetKey))
    let nextId = Math.max(targetData.nextId, ...targetData.snippets.map(s => (typeof s.id === 'number' ? s.id + 1 : 1)))
    const added: SnippetLike[] = []
    for (const s of legacyData.snippets) {
      const key = snippetKey(s)
      if (seen.has(key)) continue
      seen.add(key)
      added.push({ ...s, id: nextId++ })
    }
    if (added.length === 0) return { name, result: 'merged-nothing-new', level: 'info' }

    const merged: SnippetFile = { snippets: [...targetData.snippets, ...added], nextId: 1 }
    merged.nextId = Math.max(...merged.snippets.map(s => (typeof s.id === 'number' ? s.id : 0))) + 1
    const backup = `${dst}.pre-merge-${stampOf(now)}.bak`
    fs.copyFileSync(dst, backup)
    const tmp = `${dst}.tmp-${process.pid}`
    fs.writeFileSync(tmp, JSON.stringify(merged, null, 2), 'utf-8')
    fs.renameSync(tmp, dst)
    return { name, result: 'merged', level: 'info', detail: `appended ${added.length} snippet(s), backup ${path.basename(backup)}` }
  } catch (err) {
    return { name, result: 'failed', level: 'error', detail: errorText(err) }
  }
}

function migrateMessageArchives(legacy: string, target: string, renameSync: (from: string, to: string) => void): MigrationItem {
  const name = 'message-archives'
  const srcDir = path.join(legacy, 'message-archives')
  try {
    if (!isDir(srcDir)) return { name, result: 'no-legacy', level: 'info' }
    const dstDir = path.join(target, 'message-archives')
    fs.mkdirSync(dstDir, { recursive: true })
    let moved = 0
    let kept = 0
    let failed = 0
    for (const file of fs.readdirSync(srcDir)) {
      if (!file.endsWith('.jsonl')) continue
      const dst = path.join(dstDir, file)
      if (fs.existsSync(dst)) { kept++; continue }
      try {
        renameSync(path.join(srcDir, file), dst)
        moved++
      } catch {
        failed++
      }
    }
    return {
      name,
      result: failed > 0 ? 'partial' : 'moved',
      level: failed > 0 ? 'warn' : 'info',
      detail: `moved ${moved}, same name kept in legacy ${kept}, failed ${failed}`,
    }
  } catch (err) {
    return { name, result: 'failed', level: 'error', detail: errorText(err) }
  }
}

function noteLeftBehind(legacy: string, dirName: 'Logs' | 'Crashes'): MigrationItem {
  const dir = path.join(legacy, dirName)
  return isDir(dir)
    ? { name: dirName, result: 'not-moved', level: 'info', detail: `legacy ${dirName.toLowerCase()} remain at ${dir}` }
    : { name: dirName, result: 'no-legacy', level: 'info' }
}

function writeMarker(target: string, legacy: string, now: Date, items: MigrationItem[]): MigrationItem {
  const name = 'marker'
  try {
    const marker = {
      v: 1,
      from: legacy,
      at: now.toISOString(),
      items: Object.fromEntries(items.map(i => [i.name, i.result])),
    }
    fs.writeFileSync(path.join(target, MIGRATION_MARKER), JSON.stringify(marker, null, 2), 'utf-8')
    return { name, result: 'written', level: 'info' }
  } catch (err) {
    return { name, result: 'failed', level: 'warn', detail: `${errorText(err)} — migration runs again on next start` }
  }
}

function migrateDefaultInstance(legacy: string, target: string, opts: Required<Pick<MigrationOptions, 'now' | 'renameSync'>>): MigrationReport {
  const report: MigrationReport = { userData: target, legacyDir: legacy, targetDir: target, items: [] }
  if (!isDir(legacy)) {
    report.skipped = 'no-legacy'
    return report
  }
  if (fs.existsSync(path.join(target, MIGRATION_MARKER))) {
    report.skipped = 'marker-exists'
    return report
  }
  try {
    fs.mkdirSync(target, { recursive: true })
  } catch (err) {
    report.items.push({ name: 'target', result: 'mkdir-failed', level: 'error', detail: errorText(err) })
    return report
  }
  const now = opts.now()
  report.items.push(migrateLocalState(legacy, target))
  report.items.push(migrateSnippets(legacy, target, now))
  report.items.push(migrateMessageArchives(legacy, target, opts.renameSync))
  report.items.push(noteLeftBehind(legacy, 'Logs'))
  report.items.push(noteLeftBehind(legacy, 'Crashes'))
  report.items.push(writeMarker(target, legacy, now, report.items))
  return report
}

// A runtime instance kept *all* its data in the legacy directory (only snippets
// went to the default one), so the whole directory is renamed. Its snippets are
// not seeded from the default instance — runtime instances keep their own.
function migrateRuntimeInstance(
  legacy: string,
  target: string,
  opts: Required<Pick<MigrationOptions, 'now' | 'renameSync' | 'isServerRunning'>>,
): MigrationReport {
  const report: MigrationReport = { userData: target, legacyDir: legacy, targetDir: target, items: [] }
  const legacyExists = isDir(legacy)
  if (fs.existsSync(target)) {
    report.skipped = 'target-exists'
    if (legacyExists) {
      report.items.push({ name: 'runtime-dir', result: 'both-exist', level: 'warn', detail: `using ${target}; ${legacy} left as is, not merged` })
    }
    return report
  }
  if (!legacyExists) {
    report.skipped = 'no-legacy'
    return report
  }
  let serverRunning = false
  try {
    serverRunning = opts.isServerRunning(legacy)
  } catch {
    serverRunning = false
  }
  if (serverRunning) {
    report.userData = legacy
    report.items.push({ name: 'runtime-dir', result: 'server-running', level: 'warn', detail: `terminal server still uses ${legacy}; keeping it for this start, retry on next start` })
    return report
  }
  try {
    opts.renameSync(legacy, target)
  } catch (err) {
    report.userData = legacy
    report.items.push({ name: 'runtime-dir', result: 'rename-failed', level: 'warn', detail: `${errorText(err)}; keeping ${legacy} for this start, retry on next start` })
    return report
  }
  report.items.push({ name: 'runtime-dir', result: 'renamed', level: 'info', detail: `${legacy} -> ${target}` })
  report.items.push(writeMarker(target, legacy, opts.now(), report.items))
  return report
}

export function migrateUserData(options: MigrationOptions): MigrationReport {
  const legacy = legacyUserDataDir(options.appData, options.suffix)
  const target = targetUserDataDir(options.appData, options.suffix)
  try {
    const now = options.now ?? (() => new Date())
    const renameSync = options.renameSync ?? fs.renameSync
    if (!options.suffix) return migrateDefaultInstance(legacy, target, { now, renameSync })
    const runtimeId = options.suffix.replace(/^-runtime-/, '')
    if (!RUNTIME_ID_PATTERN.test(runtimeId)) {
      return {
        userData: target,
        legacyDir: legacy,
        targetDir: target,
        skipped: 'invalid-runtime-id',
        items: [{ name: 'runtime-dir', result: 'invalid-runtime-id', level: 'warn', detail: `runtime id ${JSON.stringify(runtimeId)} is not [a-zA-Z0-9._-]+, nothing migrated` }],
      }
    }
    return migrateRuntimeInstance(legacy, target, {
      now,
      renameSync,
      isServerRunning: options.isServerRunning ?? defaultIsServerRunning,
    })
  } catch (err) {
    return {
      userData: target,
      legacyDir: legacy,
      targetDir: target,
      items: [{ name: 'migration', result: 'failed', level: 'error', detail: errorText(err) }],
    }
  }
}

/** Log lines for main.ts to write once the logger is initialised. */
export function describeMigrationReport(report: MigrationReport): Array<{ level: MigrationLevel; message: string }> {
  const lines: Array<{ level: MigrationLevel; message: string }> = [{
    level: 'info',
    message: `userData=${report.userData} (legacy ${report.legacyDir})${report.skipped ? ` skipped=${report.skipped}` : ''}`,
  }]
  for (const item of report.items) {
    lines.push({ level: item.level, message: `${item.name}: ${item.result}${item.detail ? ` — ${item.detail}` : ''}` })
  }
  return lines
}
