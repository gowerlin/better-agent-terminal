#!/usr/bin/env node

/**
 * T0391 (PLAN-036 P0-D) — local headless dev deploy.
 *
 * Rebuilds ONLY the headless server JS (same esbuild settings as
 * scripts/build-server-bundle.mjs) and copies it into an existing BAT server
 * install root, without rebuilding the tarball. Native modules in the install
 * root are left untouched.
 *
 *   node scripts/dev-deploy-headless.mjs --target wsl:Ubuntu-24.04            # dry-run
 *   node scripts/dev-deploy-headless.mjs --target wsl:Ubuntu-24.04 --yes      # deploy + restart
 *   node scripts/dev-deploy-headless.mjs --target wsl:Ubuntu-24.04 --rollback --yes
 *   node scripts/dev-deploy-headless.mjs --target dir:C:\tmp\bat-server --yes
 *
 * Without --yes nothing is written: the tool only lists the files it would
 * overwrite with their sha256. With --yes every overwritten file is first
 * backed up to `<file>.bak-<tag>` (an existing backup is never overwritten, so
 * it always holds the pre-dev-deploy original). `--rollback --yes` restores
 * from those backups.
 *
 * ⚠️ Re-running the WSL setup wizard reinstalls the baseline bundle and
 * overwrites anything deployed by this tool.
 */

import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const projectRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const BUILD_SCRIPT = path.join(projectRoot, 'scripts', 'build-server-bundle.mjs')
const STAGING_ROOT = path.join(projectRoot, 'dist-server', 'dev-deploy-headless')

export const NAME_RX = /^[A-Za-z0-9._-]+$/
// Absolute POSIX path or `~/...`; no shell metacharacters, no `..` segments.
const POSIX_INSTALL_ROOT_RX = /^(~\/|\/)[A-Za-z0-9._@/+-]*$/
export const DEFAULT_TAG = 'dev'
export const DEFAULT_WSL_INSTALL_ROOT = '~/.local/bat-server'
export const SERVICE_NAME = 'bat-server'
const REMOTE_SUBDIR = ['electron', 'remote']
const WSL_TIMEOUT_MS = 30_000
const WSL_RESTART_TIMEOUT_MS = 60_000

export const WIZARD_WARNING =
  '⚠️ Re-running the WSL setup wizard reinstalls the baseline bundle and overwrites this dev deploy.'

const USAGE = `Usage: node scripts/dev-deploy-headless.mjs --target <wsl:<distro>|dir:<path>> [options]

Options:
  --target wsl:<distro>    Deploy into a WSL distro (install root defaults to ${DEFAULT_WSL_INSTALL_ROOT})
  --target dir:<path>      Deploy into a local install root directory
  --install-root <path>    WSL only: override the install root (absolute or ~/...)
  --yes                    Actually write (default is dry-run: list files + sha256 only)
  --rollback               Restore files from <file>.bak-<tag> instead of deploying
  --tag <name>             Backup suffix tag (default: ${DEFAULT_TAG}); [A-Za-z0-9._-]+
  --no-restart             WSL only: skip 'systemctl --user restart ${SERVICE_NAME}'
  --expect-string <text>   Marker that must appear in the deployed JS (repeatable)
  -h, --help               Show this help

${WIZARD_WARNING}`

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

export function parseTarget(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Missing value for --target (expected wsl:<distro> or dir:<path>)')
  }
  if (value.startsWith('wsl:')) {
    const distro = value.slice('wsl:'.length)
    if (!NAME_RX.test(distro)) {
      throw new Error(`Invalid WSL distro name "${distro}" (allowed: [A-Za-z0-9._-]+)`)
    }
    return { kind: 'wsl', distro }
  }
  if (value.startsWith('dir:')) {
    const dir = value.slice('dir:'.length)
    if (!dir) throw new Error('Missing path for --target dir:<path>')
    return { kind: 'dir', path: path.resolve(dir) }
  }
  throw new Error(`Unsupported --target "${value}" (expected wsl:<distro> or dir:<path>)`)
}

export function parseArgs(argv) {
  const opts = {
    target: null,
    installRoot: null,
    yes: false,
    rollback: false,
    restart: true,
    tag: DEFAULT_TAG,
    expectStrings: [],
    help: false,
  }

  const takeValue = (flag, index) => {
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for ${flag}`)
    }
    return value
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const eq = arg.indexOf('=')
    const flag = arg.startsWith('--') && eq > 0 ? arg.slice(0, eq) : arg
    const inline = arg.startsWith('--') && eq > 0 ? arg.slice(eq + 1) : undefined
    const value = () => {
      if (inline !== undefined) return inline
      const v = takeValue(flag, index)
      index += 1
      return v
    }

    switch (flag) {
      case '-h':
      case '--help':
        opts.help = true
        break
      case '--target':
        opts.target = parseTarget(value())
        break
      case '--install-root':
        opts.installRoot = value()
        break
      case '--yes':
        opts.yes = true
        break
      case '--rollback':
        opts.rollback = true
        break
      case '--no-restart':
        opts.restart = false
        break
      case '--tag':
        opts.tag = value()
        break
      case '--expect-string': {
        const marker = value()
        if (!marker) throw new Error('--expect-string must not be empty')
        opts.expectStrings.push(marker)
        break
      }
      default:
        throw new Error(`Unknown argument: ${arg}`)
    }
  }

  if (opts.help) return opts
  if (!opts.target) throw new Error('--target is required (wsl:<distro> or dir:<path>)')
  if (!NAME_RX.test(opts.tag)) {
    throw new Error(`Invalid --tag "${opts.tag}" (allowed: [A-Za-z0-9._-]+)`)
  }
  if (opts.installRoot !== null) {
    if (opts.target.kind !== 'wsl') {
      throw new Error('--install-root only applies to wsl:<distro> targets (use dir:<path> for local roots)')
    }
    validatePosixInstallRoot(opts.installRoot)
  }
  if (opts.target.kind === 'wsl' && opts.installRoot === null) {
    opts.installRoot = DEFAULT_WSL_INSTALL_ROOT
  }
  return opts
}

export function validatePosixInstallRoot(root) {
  if (!POSIX_INSTALL_ROOT_RX.test(root) || root.split('/').includes('..')) {
    throw new Error(`Invalid --install-root "${root}" (absolute POSIX path or ~/..., no "..")`)
  }
  return root
}

// ---------------------------------------------------------------------------
// esbuild config — parsed from scripts/build-server-bundle.mjs, never hand-copied
// ---------------------------------------------------------------------------

function extractArrayLiteral(source, startIndex, label) {
  const open = source.indexOf('[', startIndex)
  if (open < 0) throw new Error(`build-server-bundle.mjs: cannot find array for ${label}`)
  let depth = 0
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === '[') depth += 1
    else if (source[i] === ']') {
      depth -= 1
      if (depth === 0) return source.slice(open + 1, i)
    }
  }
  throw new Error(`build-server-bundle.mjs: unterminated array for ${label}`)
}

function quotedStrings(text) {
  return [...text.matchAll(/'([^'\\]*)'|"([^"\\]*)"/g)].map((m) => m[1] ?? m[2])
}

/**
 * Parse the esbuild call in build-server-bundle.mjs. Throws if the expected
 * shape is not found — the caller must not fall back to a hand-written list.
 */
export function parseBuildConfig(source) {
  const externalDecl = source.search(/const\s+externalPackages\s*=\s*\[/)
  if (externalDecl < 0) {
    throw new Error('build-server-bundle.mjs: `const externalPackages = [...]` not found')
  }
  const externals = quotedStrings(extractArrayLiteral(source, externalDecl, 'externalPackages'))
  if (externals.length === 0) throw new Error('build-server-bundle.mjs: externalPackages is empty')

  const fnStart = source.search(/async\s+function\s+bundleServerEntry\s*\(/)
  if (fnStart < 0) throw new Error('build-server-bundle.mjs: bundleServerEntry() not found')
  const buildStart = source.indexOf('build({', fnStart)
  const buildEnd = buildStart < 0 ? -1 : source.indexOf('})', buildStart)
  if (buildStart < 0 || buildEnd < 0) {
    throw new Error('build-server-bundle.mjs: build({...}) call not found in bundleServerEntry()')
  }
  const block = source.slice(buildStart, buildEnd)

  const entryIdx = block.search(/entryPoints\s*:/)
  if (entryIdx < 0) throw new Error('build-server-bundle.mjs: entryPoints not found')
  const entryText = extractArrayLiteral(block, entryIdx, 'entryPoints')
  const entryPoints = [...entryText.matchAll(/resolveProjectPath\(([^)]*)\)/g)].map((m) =>
    quotedStrings(m[1]).join('/')
  )
  if (entryPoints.length === 0) throw new Error('build-server-bundle.mjs: no entryPoints parsed')

  if (!/external\s*:\s*externalPackages\b/.test(block)) {
    throw new Error('build-server-bundle.mjs: build() no longer uses `external: externalPackages`')
  }

  const stringOption = (key) => {
    const m = block.match(new RegExp(`\\b${key}\\s*:\\s*['"]([^'"]+)['"]`))
    if (!m) throw new Error(`build-server-bundle.mjs: esbuild option "${key}" not found`)
    return m[1]
  }
  const bundleMatch = block.match(/\bbundle\s*:\s*(true|false)\b/)
  if (!bundleMatch) throw new Error('build-server-bundle.mjs: esbuild option "bundle" not found')

  return {
    entryPoints,
    externals,
    options: {
      bundle: bundleMatch[1] === 'true',
      platform: stringOption('platform'),
      target: stringOption('target'),
      format: stringOption('format'),
      sourcemap: stringOption('sourcemap'),
    },
  }
}

export function loadBuildConfig(scriptPath = BUILD_SCRIPT) {
  return parseBuildConfig(readFileSync(scriptPath, 'utf8'))
}

export function outputFileNames(entryPoints) {
  return entryPoints.map((entry) => path.posix.basename(entry).replace(/\.[cm]?tsx?$/, '.js'))
}

async function buildHeadlessJs(config, outdir) {
  const { build } = await import('esbuild')
  rmSync(outdir, { recursive: true, force: true })
  mkdirSync(outdir, { recursive: true })
  await build({
    entryPoints: config.entryPoints.map((entry) => path.join(projectRoot, ...entry.split('/'))),
    outdir,
    ...config.options,
    logLevel: 'warning',
    external: config.externals,
  })
}

// ---------------------------------------------------------------------------
// Planning (pure)
// ---------------------------------------------------------------------------

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * @param built     [{ name, sha }]
 * @param installed Map<name, { sha: string|null, backup: boolean }>
 */
export function planDeploy(built, installed) {
  return built.map(({ name, sha }) => {
    const current = installed.get(name) ?? { sha: null, backup: false, absent: false }
    let action
    if (current.sha === null) action = 'create'
    else if (current.sha === sha) action = 'unchanged'
    else action = 'overwrite'
    let backup
    if (current.backup) backup = 'keep-existing'
    else if (current.absent) backup = 'keep-absent-marker'
    else backup = current.sha === null ? 'absent-marker' : 'create'
    return { name, builtSha: sha, installedSha: current.sha, action, backup }
  })
}

export function planRollback(names, installed) {
  return names.map((name) => {
    const current = installed.get(name) ?? { sha: null, backup: false, backupSha: null, absent: false }
    let action = 'skip-no-backup'
    if (current.backup) action = current.backupSha === current.sha ? 'unchanged' : 'restore'
    else if (current.absent) action = 'remove-created'
    return { name, installedSha: current.sha, backupSha: current.backupSha ?? null, action }
  })
}

const short = (sha) => (sha ? sha.slice(0, 12) : 'MISSING')

export function formatDeployPlan(plan) {
  return plan
    .map((p) => `  ${p.name.padEnd(20)} built=${short(p.builtSha)} installed=${short(p.installedSha)} action=${p.action} backup=${p.backup}`)
    .join('\n')
}

export function formatRollbackPlan(plan) {
  return plan
    .map((p) => `  ${p.name.padEnd(20)} installed=${short(p.installedSha)} backup=${short(p.backupSha)} action=${p.action}`)
    .join('\n')
}

// ---------------------------------------------------------------------------
// WSL target: a generated bash script run via `wsl.exe -d <distro> --exec bash <file>`.
// Running a script file (instead of `bash -c '...'`) avoids the unreliable
// `$` escaping through PowerShell / wsl.exe command-line reconstruction.
// ---------------------------------------------------------------------------

export function shq(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

function bashInstallRoot(root) {
  return root.startsWith('~/') ? `"$HOME"/${shq(root.slice(2))}` : shq(root)
}

/**
 * @param mode 'inspect' | 'deploy' | 'rollback'
 * @param opts { installRoot, stagingDir, files, tag, restart, expectStrings }
 *             installRoot / stagingDir are paths native to the shell running the script.
 */
export function renderBashScript(mode, opts) {
  if (!['inspect', 'deploy', 'rollback'].includes(mode)) throw new Error(`Unknown mode ${mode}`)
  if (!NAME_RX.test(opts.tag)) throw new Error(`Invalid tag ${opts.tag}`)
  for (const f of opts.files) {
    if (!NAME_RX.test(f)) throw new Error(`Invalid file name ${f}`)
  }
  const lines = [
    '#!/usr/bin/env bash',
    '# Generated by scripts/dev-deploy-headless.mjs (T0391). Safe to delete.',
    'set -u',
    `ROOT=${bashInstallRoot(opts.installRoot)}`,
    `DEST="$ROOT/${REMOTE_SUBDIR.join('/')}"`,
    `TAG=${shq(opts.tag)}`,
    `FILES=(${opts.files.map(shq).join(' ')})`,
    'sha() { if [ -f "$1" ]; then sha256sum < "$1" | cut -d" " -f1; else echo MISSING; fi; }',
    'if [ ! -d "$DEST" ]; then echo "ERROR install-root-missing $DEST"; exit 3; fi',
    'echo "DEST $DEST"',
  ]
  if (mode === 'deploy') {
    lines.push(
      `SRC=${shq(opts.stagingDir)}`,
      'for f in "${FILES[@]}"; do',
      '  if [ ! -f "$SRC/$f" ]; then echo "ERROR staged-missing $f"; exit 4; fi',
      '  # First deploy for this tag records the original: a .bak copy, or an',
      '  # .absent marker when the file did not exist. Later deploys keep it.',
      '  if [ ! -e "$DEST/$f.bak-$TAG" ] && [ ! -e "$DEST/$f.bak-$TAG.absent" ]; then',
      '    if [ -f "$DEST/$f" ]; then cp -p "$DEST/$f" "$DEST/$f.bak-$TAG" || exit 5',
      '    else : > "$DEST/$f.bak-$TAG.absent" || exit 5; fi',
      '  fi',
      '  cp "$SRC/$f" "$DEST/$f" || exit 6',
      'done'
    )
  }
  if (mode === 'rollback') {
    lines.push(
      'for f in "${FILES[@]}"; do',
      '  if [ -f "$DEST/$f.bak-$TAG" ]; then',
      '    cp -p "$DEST/$f.bak-$TAG" "$DEST/$f" || exit 6; echo "RESTORED $f"',
      '  elif [ -e "$DEST/$f.bak-$TAG.absent" ]; then',
      '    rm -f "$DEST/$f" "$DEST/$f.bak-$TAG.absent"; echo "REMOVED $f"',
      '  else echo "SKIPPED $f"; fi',
      'done'
    )
  }
  lines.push(
    'for f in "${FILES[@]}"; do',
    '  b=MISSING; [ -f "$DEST/$f.bak-$TAG" ] && b=$(sha "$DEST/$f.bak-$TAG")',
    '  a=no; [ -e "$DEST/$f.bak-$TAG.absent" ] && a=yes',
    '  printf "FILE\\t%s\\t%s\\t%s\\t%s\\n" "$f" "$(sha "$DEST/$f")" "$b" "$a"',
    'done'
  )
  if (mode !== 'inspect') {
    for (const marker of opts.expectStrings ?? []) {
      lines.push(
        'for f in "${FILES[@]}"; do',
        `  c=$(grep -c -F -- ${shq(marker)} "$DEST/$f" 2>/dev/null || true)`,
        `  printf "EXPECT\\t%s\\t%s\\t%s\\n" "$f" ${shq(marker)} "\${c:-0}"`,
        'done'
      )
    }
    if (opts.restart) {
      lines.push(
        `systemctl --user restart ${SERVICE_NAME}; echo "RESTART_EXIT $?"`,
        'sleep 2',
        `echo "IS_ACTIVE $(systemctl --user is-active ${SERVICE_NAME})"`,
        "L=$(ss -ltnp 2>/dev/null | grep -E 'node|bat-server')",
        "if [ -n \"$L\" ]; then printf '%s\\n' \"$L\" | sed 's/^/LISTEN /'; else echo 'LISTEN (none found)'; fi",
        `journalctl --user -u ${SERVICE_NAME} -n 15 --no-pager 2>&1 | sed 's/^/JOURNAL /'`
      )
    }
  }
  return lines.join('\n') + '\n'
}

/** Parse FILE / EXPECT lines from renderBashScript output. */
export function parseScriptOutput(stdout) {
  const files = new Map()
  const expects = []
  const other = []
  for (const line of stdout.split(/\r?\n/)) {
    if (!line) continue
    const parts = line.split('\t')
    if (parts[0] === 'FILE' && parts.length === 5) {
      const nullable = (v) => (v === 'MISSING' ? null : v)
      files.set(parts[1], {
        sha: nullable(parts[2]),
        backup: parts[3] !== 'MISSING',
        backupSha: nullable(parts[3]),
        absent: parts[4] === 'yes',
      })
    } else if (parts[0] === 'EXPECT' && parts.length === 4) {
      expects.push({ name: parts[1], marker: parts[2], count: Number(parts[3]) || 0 })
    } else {
      other.push(line)
    }
  }
  return { files, expects, other }
}

function wslExec(distro, args, timeout) {
  if (!NAME_RX.test(distro)) throw new Error(`Invalid WSL distro name "${distro}"`)
  return execFileSync('wsl.exe', ['-d', distro, '--exec', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    timeout,
  })
}

function runWslScript(distro, scriptWinPath, timeout) {
  const scriptPosix = wslExec(distro, ['wslpath', '-a', scriptWinPath], WSL_TIMEOUT_MS).trim()
  try {
    return { ok: true, stdout: wslExec(distro, ['bash', scriptPosix], timeout) }
  } catch (error) {
    return { ok: false, stdout: String(error.stdout ?? ''), error }
  }
}

// ---------------------------------------------------------------------------
// dir target: plain Node fs (no shell, no service restart)
// ---------------------------------------------------------------------------

export function inspectDir(installRoot, files, tag) {
  const dest = path.join(installRoot, ...REMOTE_SUBDIR)
  if (!existsSync(dest) || !statSync(dest).isDirectory()) {
    throw new Error(`install root missing ${dest}`)
  }
  const fileSha = (p) => (existsSync(p) ? sha256(readFileSync(p)) : null)
  const result = new Map()
  for (const name of files) {
    const target = path.join(dest, name)
    const bak = `${target}.bak-${tag}`
    const backupSha = fileSha(bak)
    result.set(name, {
      sha: fileSha(target),
      backup: backupSha !== null,
      backupSha,
      absent: existsSync(`${bak}.absent`),
    })
  }
  return { dest, files: result }
}

export function deployDir(installRoot, stagingDir, files, tag) {
  const dest = path.join(installRoot, ...REMOTE_SUBDIR)
  for (const name of files) {
    const src = path.join(stagingDir, name)
    if (!existsSync(src)) throw new Error(`staged file missing ${src}`)
  }
  for (const name of files) {
    const target = path.join(dest, name)
    const bak = `${target}.bak-${tag}`
    // First deploy for this tag records the original (a .bak copy, or an
    // .absent marker when the file did not exist); later deploys keep it.
    if (!existsSync(bak) && !existsSync(`${bak}.absent`)) {
      if (existsSync(target)) copyFileSync(target, bak)
      else writeFileSync(`${bak}.absent`, '')
    }
    copyFileSync(path.join(stagingDir, name), target)
  }
}

export function rollbackDir(installRoot, files, tag) {
  const dest = path.join(installRoot, ...REMOTE_SUBDIR)
  const outcome = []
  for (const name of files) {
    const target = path.join(dest, name)
    const bak = `${target}.bak-${tag}`
    if (existsSync(bak)) {
      copyFileSync(bak, target)
      outcome.push(`RESTORED ${name}`)
    } else if (existsSync(`${bak}.absent`)) {
      rmSync(target, { force: true })
      rmSync(`${bak}.absent`, { force: true })
      outcome.push(`REMOVED ${name}`)
    } else {
      outcome.push(`SKIPPED ${name}`)
    }
  }
  return outcome
}

function grepDir(dir, files, markers) {
  const expects = []
  for (const marker of markers) {
    for (const name of files) {
      const p = path.join(dir, name)
      const text = existsSync(p) ? readFileSync(p, 'utf8') : ''
      expects.push({ name, marker, count: text.split(marker).length - 1 })
    }
  }
  return expects
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function log(message) {
  console.log(`[dev-deploy-headless] ${message}`)
}

function reportExpects(expects, label) {
  let missing = false
  const byMarker = new Map()
  for (const e of expects) {
    if (!byMarker.has(e.marker)) byMarker.set(e.marker, [])
    byMarker.get(e.marker).push(e)
  }
  for (const [marker, rows] of byMarker) {
    const total = rows.reduce((acc, r) => acc + r.count, 0)
    const where = rows.filter((r) => r.count > 0).map((r) => `${r.name}×${r.count}`).join(', ')
    log(`expect-string (${label}) ${JSON.stringify(marker)}: ${total > 0 ? `FOUND in ${where}` : 'NOT FOUND'}`)
    if (total === 0) missing = true
  }
  return !missing
}

export async function main(argv = process.argv.slice(2)) {
  const opts = parseArgs(argv)
  if (opts.help) {
    console.log(USAGE)
    return 0
  }

  const config = loadBuildConfig()
  const files = outputFileNames(config.entryPoints)
  const where = opts.target.kind === 'wsl' ? `wsl:${opts.target.distro} ${opts.installRoot}` : `dir:${opts.target.path}`
  const mode = opts.rollback ? 'rollback' : 'deploy'
  log(`target=${where} mode=${mode} tag=${opts.tag} ${opts.yes ? 'WRITE (--yes)' : 'DRY-RUN (pass --yes to write)'}`)
  log(`entryPoints (from build-server-bundle.mjs): ${config.entryPoints.join(', ')}`)
  log(`externals (from build-server-bundle.mjs): ${config.externals.length} packages`)

  let built = []
  let expectOk = true
  if (!opts.rollback) {
    await buildHeadlessJs(config, STAGING_ROOT)
    built = files.map((name) => ({ name, sha: sha256(readFileSync(path.join(STAGING_ROOT, name))) }))
    log(`built into ${path.relative(projectRoot, STAGING_ROOT)}`)
    if (opts.expectStrings.length > 0) {
      expectOk = reportExpects(grepDir(STAGING_ROOT, files, opts.expectStrings), 'built')
    }
  }

  // ---- inspect (read-only) -------------------------------------------------
  let installed
  let scriptPath = null
  if (opts.target.kind === 'dir') {
    installed = inspectDir(opts.target.path, files, opts.tag).files
  } else {
    mkdirSync(STAGING_ROOT, { recursive: true })
    scriptPath = path.join(STAGING_ROOT, 'inspect.sh')
    writeFileSync(scriptPath, renderBashScript('inspect', { installRoot: opts.installRoot, files, tag: opts.tag }))
    const res = runWslScript(opts.target.distro, scriptPath, WSL_TIMEOUT_MS)
    if (!res.ok) {
      throw new Error(`WSL inspect failed: ${(res.stdout || res.error.message).trim()}`)
    }
    installed = parseScriptOutput(res.stdout).files
  }

  const before = opts.rollback ? planRollback(files, installed) : planDeploy(built, installed)
  log(`before (${opts.rollback ? 'rollback plan' : 'deploy plan'}):`)
  console.log(opts.rollback ? formatRollbackPlan(before) : formatDeployPlan(before))

  if (!opts.yes) {
    log('dry-run: nothing written. Re-run with --yes to apply.')
    if (opts.target.kind === 'wsl') log(WIZARD_WARNING)
    return expectOk ? 0 : 2
  }

  // ---- apply ---------------------------------------------------------------
  let after
  if (opts.target.kind === 'dir') {
    if (opts.rollback) {
      for (const line of rollbackDir(opts.target.path, files, opts.tag)) log(line)
    } else {
      deployDir(opts.target.path, STAGING_ROOT, files, opts.tag)
    }
    after = inspectDir(opts.target.path, files, opts.tag).files
    if (opts.expectStrings.length > 0) {
      const dest = path.join(opts.target.path, ...REMOTE_SUBDIR)
      expectOk = reportExpects(grepDir(dest, files, opts.expectStrings), 'installed') && expectOk
    }
    if (opts.restart) log('restart: not applicable for dir: targets (restart the server yourself)')
  } else {
    const stagingPosix = wslExec(opts.target.distro, ['wslpath', '-a', STAGING_ROOT], WSL_TIMEOUT_MS).trim()
    scriptPath = path.join(STAGING_ROOT, `${mode}.sh`)
    writeFileSync(
      scriptPath,
      renderBashScript(mode, {
        installRoot: opts.installRoot,
        stagingDir: stagingPosix,
        files,
        tag: opts.tag,
        restart: opts.restart,
        expectStrings: opts.expectStrings,
      })
    )
    const res = runWslScript(opts.target.distro, scriptPath, opts.restart ? WSL_RESTART_TIMEOUT_MS : WSL_TIMEOUT_MS)
    const parsed = parseScriptOutput(res.stdout)
    for (const line of parsed.other) log(line)
    if (!res.ok) throw new Error(`WSL ${mode} failed: ${res.error.message}`)
    after = parsed.files
    if (opts.expectStrings.length > 0) expectOk = reportExpects(parsed.expects, 'installed') && expectOk
    if (!opts.restart) log(`restart skipped (--no-restart); run: systemctl --user restart ${SERVICE_NAME}`)
  }

  log('after:')
  const afterPlan = opts.rollback ? planRollback(files, after) : planDeploy(built, after)
  console.log(opts.rollback ? formatRollbackPlan(afterPlan) : formatDeployPlan(afterPlan))
  if (!opts.rollback) {
    const mismatched = afterPlan.filter((p) => p.action !== 'unchanged').map((p) => p.name)
    if (mismatched.length > 0) {
      log(`❌ sha256 mismatch after deploy: ${mismatched.join(', ')}`)
      return 1
    }
    log('✅ deployed sha256 matches built output')
  }
  if (opts.target.kind === 'wsl') log(WIZARD_WARNING)
  return expectOk ? 0 : 2
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
if (invokedDirectly) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(`[dev-deploy-headless] ❌ ${error.message}`)
      process.exit(1)
    }
  )
}
