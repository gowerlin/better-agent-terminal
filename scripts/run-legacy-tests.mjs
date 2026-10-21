#!/usr/bin/env node
/**
 * `npm run test:legacy`: runs the tests under tests/ that vitest does not collect
 * (T0685, BUG-168 / D177 step 2).
 *
 * Two kinds of file live there:
 *   - node:test files (`import ... from 'node:test'`): one `tsx --test --test-timeout=60000` run
 *     for all of them. The timeout is what keeps a wizard test with a missing mock from hanging
 *     forever (T0682).
 *   - self-written harness files (print "N passed, M failed", exit 1 on failure): one `tsx <file>`
 *     process each, judged by the exit code, killed after HARNESS_FILE_TIMEOUT_MS.
 *
 * Files are found automatically, so a new file under tests/ is run without touching this script.
 * Everything that must not run is listed in EXCLUDED with the reason. New tests belong where vitest
 * collects them (CLAUDE.md "Frontend unit tests"), not in tests/.
 *
 * Usage:
 *   node scripts/run-legacy-tests.mjs [--json <file>] [<file> ...]
 *     --json <file>  also write the results as JSON (tests.yml builds the job summary from it)
 *     <file> ...     run only these files instead of the discovered set
 * Exit code: 0 when every file passed, 1 otherwise.
 *
 * The same file doubles as the node:test reporter of the node:test run (default export), which
 * gives per-file counts without parsing the spec output. Durations in the summary: node:test files
 * show the sum of their tests' durations, harness files the wall time of the process.
 */

import { execFile, spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SELF = fileURLToPath(import.meta.url)
const REPO_ROOT = path.resolve(path.dirname(SELF), '..')
const TESTS_DIR = 'tests'
const SCRIPT_FILE = /\.(?:[cm]?[jt]s|tsx)$/
const NODE_TEST_IMPORT = /\bfrom\s*['"]node:test['"]|\brequire\(\s*['"]node:test['"]\s*\)/

// Per test, passed to node:test (T0682: every wizard file now ends in about 1 s).
const NODE_TEST_TIMEOUT_MS = 60_000
// Whole processes: a file that hangs outside a test (top-level await, an open handle) is not
// covered by --test-timeout.
const NODE_TEST_RUN_TIMEOUT_MS = 15 * 60_000
const HARNESS_FILE_TIMEOUT_MS = 3 * 60_000

// Globs are relative to the repo root, matched with path.matchesGlob on '/' paths.
const EXCLUDED = [
  { glob: 'tests/e2e/**', reason: 'Playwright (playwright.config.ts testMatch), run by npm run test:e2e' },
  { glob: 'tests/__mocks__/**', reason: 'shared mock, not a test' },
  { glob: 'tests/__helpers__/**', reason: 'shared test helper, not a test' },
  { glob: 'tests/testworkspace/**', reason: 'test fixture data' },
  { glob: 'tests/**/_*', reason: 'manual probe against the real machine (e.g. _windows-probe.ts)' },
  { glob: 'tests/console-test.js', reason: 'interactive (readline), needs a person; npm run test:console' },
  { glob: 'tests/console-controller.js', reason: 'library used by console-test.js, not a test' },
]

const toPosix = (p) => p.split(path.sep).join('/')
// Key of the reporter's per-file map; Windows paths compare case-insensitively (drive letter).
const fileKey = (p) => (process.platform === 'win32' ? toPosix(p).toLowerCase() : toPosix(p))

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.isFile()) out.push(full)
  }
  return out
}

// The tests/ entries of vite.config.ts `test.include`: those files belong to npm run test:unit.
function vitestGlobs() {
  const source = fs.readFileSync(path.join(REPO_ROOT, 'vite.config.ts'), 'utf8')
  return [...source.matchAll(/['"](tests\/[^'"]+)['"]/g)].map((m) => m[1])
}

function discover() {
  const vitest = vitestGlobs()
  const files = []
  const skipped = []
  for (const full of walk(path.join(REPO_ROOT, TESTS_DIR)).sort()) {
    const rel = toPosix(path.relative(REPO_ROOT, full))
    if (!SCRIPT_FILE.test(rel)) continue
    const excluded = EXCLUDED.find((e) => path.matchesGlob(rel, e.glob))
    if (excluded) { skipped.push({ file: rel, reason: excluded.reason }); continue }
    if (vitest.some((g) => path.matchesGlob(rel, g))) {
      skipped.push({ file: rel, reason: 'collected by vitest (vite.config.ts test.include), run by npm run test:unit' })
      continue
    }
    files.push(rel)
  }
  return { files, skipped }
}

function isNodeTestFile(rel) {
  return NODE_TEST_IMPORT.test(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'))
}

function tsxCli() {
  const pkgPath = path.join(REPO_ROOT, 'node_modules', 'tsx', 'package.json')
  if (!fs.existsSync(pkgPath)) throw new Error('tsx is not installed (devDependency); run npm ci first')
  const bin = JSON.parse(fs.readFileSync(pkgPath, 'utf8')).bin
  return path.join(path.dirname(pkgPath), typeof bin === 'string' ? bin : bin.tsx)
}

// tsx runs the code in a child node process; on Windows child.kill() would leave it running.
function killTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  if (process.platform === 'win32') {
    execFile('taskkill', ['/F', '/T', '/PID', String(child.pid)], { timeout: 10_000 }, () => {})
  } else {
    child.kill('SIGKILL')
  }
}

// Runs node with the tsx cli; stdout / stderr are passed through, the last part kept for counts.
function runTsx(args, timeoutMs) {
  return new Promise((resolve) => {
    const started = Date.now()
    const child = spawn(process.execPath, [tsxCli(), ...args], {
      cwd: REPO_ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let tail = ''
    const keep = (chunk) => { tail = (tail + chunk.toString('utf8')).slice(-4096) }
    child.stdout.on('data', (c) => { process.stdout.write(c); keep(c) })
    child.stderr.on('data', (c) => { process.stderr.write(c); keep(c) })
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; killTree(child) }, timeoutMs)
    child.on('error', (err) => { keep(String(err)) })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      resolve({ code, signal, timedOut, tail, durationMs: Date.now() - started })
    })
  })
}

async function runHarness(rel) {
  console.log(`\n▶ ${rel} (tsx)`)
  const r = await runTsx([rel], HARNESS_FILE_TIMEOUT_MS)
  const counts = [...r.tail.matchAll(/(\d+) passed, (\d+) failed/g)].pop()
  return {
    file: rel,
    kind: 'harness',
    ok: !r.timedOut && r.code === 0,
    passed: counts ? Number(counts[1]) : null,
    failed: counts ? Number(counts[2]) : null,
    skipped: 0,
    cancelled: 0,
    durationMs: r.durationMs,
    note: r.timedOut ? `timed out after ${HARNESS_FILE_TIMEOUT_MS / 1000} s` : r.code === 0 ? '' : `exit ${r.code ?? r.signal}`,
    failures: [],
  }
}

async function runNodeTest(files) {
  console.log(`\n▶ ${files.length} node:test files (tsx --test --test-timeout=${NODE_TEST_TIMEOUT_MS})`)
  const resultFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bat-legacy-')), 'node-test.json')
  const r = await runTsx([
    '--test',
    `--test-timeout=${NODE_TEST_TIMEOUT_MS}`,
    '--test-reporter=spec', '--test-reporter-destination=stdout',
    `--test-reporter=${pathToFileURL(SELF).href}`, `--test-reporter-destination=${resultFile}`,
    ...files,
  ], NODE_TEST_RUN_TIMEOUT_MS)
  let byFile = {}
  try { byFile = JSON.parse(fs.readFileSync(resultFile, 'utf8')) } catch { /* run died before the reporter finished */ }
  fs.rmSync(path.dirname(resultFile), { recursive: true, force: true })
  return files.map((rel) => {
    const f = byFile[fileKey(path.resolve(REPO_ROOT, rel))]
    if (!f) {
      return {
        file: rel, kind: 'node:test', ok: false, passed: null, failed: null, skipped: 0, cancelled: 0, durationMs: null,
        note: r.timedOut ? `run timed out after ${NODE_TEST_RUN_TIMEOUT_MS / 60_000} min, no result` : 'no result from node:test',
        failures: [],
      }
    }
    const ok = f.failed === 0 && f.cancelled === 0 && f.passed + f.skipped > 0
    const note = f.cancelled ? `${f.cancelled} cancelled (timeout)` : f.passed + f.skipped + f.failed === 0 ? 'no tests ran' : ''
    return { file: rel, kind: 'node:test', ok, passed: f.passed, failed: f.failed, skipped: f.skipped, cancelled: f.cancelled, durationMs: f.durationMs, note, failures: f.failures }
  })
}

const fmtDuration = (ms) => (ms === null ? '—' : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`)
const fmtCounts = (r) => (r.passed === null ? '—' : `${r.passed} passed, ${r.failed} failed${r.skipped ? `, ${r.skipped} skipped` : ''}`)

function printSummary(results, skipped) {
  console.log('\n──────── legacy tests (tests/, outside vitest) ────────')
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.kind.padEnd(9)} ${r.file}  ${fmtCounts(r)}  ${fmtDuration(r.durationMs)}${r.note ? `  (${r.note})` : ''}`)
    for (const f of r.failures) console.log(`        ✖ ${f}`)
  }
  console.log(`\nnot run (${skipped.length}):`)
  for (const s of skipped) console.log(`  - ${s.file}: ${s.reason}`)
  const failedFiles = results.filter((r) => !r.ok).length
  const tests = results.reduce(
    (a, r) => ({ passed: a.passed + (r.passed ?? 0), failed: a.failed + (r.failed ?? 0), cancelled: a.cancelled + r.cancelled }),
    { passed: 0, failed: 0, cancelled: 0 },
  )
  console.log(`\nlegacy tests: files ${results.length - failedFiles} passed, ${failedFiles} failed / ${results.length} total; tests ${tests.passed} passed, ${tests.failed} failed${tests.cancelled ? `, ${tests.cancelled} cancelled` : ''}`)
  return { failedFiles, tests }
}

async function main(argv) {
  let jsonOut = null
  const only = []
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--json') jsonOut = argv[++i]
    else only.push(toPosix(path.relative(REPO_ROOT, path.resolve(argv[i]))))
  }
  const found = discover()
  const files = only.length ? only : found.files
  const skipped = only.length ? [] : found.skipped

  // Helper modules write logs / data under these; never the real userData (CLAUDE.md "遠端 Tower 通知").
  for (const name of ['BAT_HELPER_LOG_DIR', 'BAT_USER_DATA']) {
    if (!process.env[name]) process.env[name] = fs.mkdtempSync(path.join(os.tmpdir(), `bat-legacy-${name.toLowerCase()}-`))
  }

  const nodeTestFiles = files.filter(isNodeTestFile)
  const harnessFiles = files.filter((f) => !nodeTestFiles.includes(f))
  const results = []
  if (nodeTestFiles.length) results.push(...await runNodeTest(nodeTestFiles))
  for (const f of harnessFiles) results.push(await runHarness(f))
  results.sort((a, b) => a.file.localeCompare(b.file))

  const { failedFiles, tests } = printSummary(results, skipped)
  if (jsonOut) {
    fs.mkdirSync(path.dirname(path.resolve(jsonOut)), { recursive: true })
    fs.writeFileSync(jsonOut, JSON.stringify({ failedFiles, totalFiles: results.length, tests, results, skipped }, null, 2))
  }
  return failedFiles === 0 && results.length > 0 ? 0 : 1
}

// node:test reporter (see the header): per-file counts, written as JSON to the reporter destination.
export default async function* legacyTestsReporter(source) {
  const byFile = {}
  const entry = (file) => (byFile[fileKey(file ?? '(unknown)')] ??= { passed: 0, failed: 0, skipped: 0, cancelled: 0, durationMs: 0, failures: [] })
  for await (const event of source) {
    if (event.type !== 'test:pass' && event.type !== 'test:fail') continue
    const { data } = event
    const f = entry(data.file)
    if (data.nesting === 0) f.durationMs += data.details?.duration_ms ?? 0
    const failureType = data.details?.error?.failureType
    if (data.details?.type === 'suite') {
      // A suite fails on its own only through a hook / setup error; subtest failures count below.
      if (event.type === 'test:fail' && failureType !== 'subtestsFailed') {
        f.failed++
        f.failures.push(`${data.name}: ${String(data.details.error?.cause?.message ?? data.details.error?.message ?? '').split('\n')[0]}`)
      }
      continue
    }
    if (event.type === 'test:pass') {
      if (data.skip !== undefined || data.todo !== undefined) f.skipped++
      else f.passed++
      continue
    }
    if (failureType === 'cancelledByParent' || failureType === 'testTimeoutFailure') {
      f.cancelled++
      f.failures.push(`${data.name} (${failureType})`)
    } else {
      f.failed++
      const message = String(data.details?.error?.cause?.message ?? data.details?.error?.message ?? '').split('\n')[0]
      f.failures.push(message ? `${data.name}: ${message}` : data.name)
    }
  }
  yield JSON.stringify(byFile)
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  main(process.argv.slice(2)).then(
    (code) => { process.exitCode = code },
    (err) => { console.error(`run-legacy-tests: ${err?.stack ?? err}`); process.exitCode = 1 },
  )
}
