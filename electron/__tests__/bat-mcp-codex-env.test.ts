// @vitest-environment node
/**
 * T0586 / BUG-148: codex starts a stdio MCP server with its default env allow-list only, so the
 * `bat` shim got no `BAT_REMOTE_PORT` / `BAT_REMOTE_TOKEN` (CONNECT_FAILED in every codex tab).
 * `mcp_servers.bat.env_vars` forwards the shim's variables by name.
 *
 *   - the list covers every `process.env.X` the shim and its `_bat-*.mjs` imports read
 *   - the injected args carry names only: no token value, no `env = { … }` table
 *   - integration (no model call, no token): the bundled codex's `app-server` with an isolated
 *     CODEX_HOME starts a fake stdio MCP server through `mcpServerStatus/list`; the fake server
 *     records the env it got. Without `env_vars` no `BAT_*` arrives (the bug); with it the listed
 *     names arrive and an unlisted `BAT_*` still does not. Skipped when the bundled codex is absent.
 */
import { spawn } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  throw new Error('bat-mcp-launch must not import electron')
})

import {
  BAT_MCP_CODEX_ENV_VARS,
  buildBatMcpLaunchArgs,
  codexMcpOverrides,
  type BatMcpHost,
} from '../bat-mcp-launch'

const ROOT = path.resolve(__dirname, '..', '..')
const TOKEN = 'batcap.T0586-SECRET-CAPABILITY-TOKEN'

let dir: string
let helperDir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 't0586-codex-env-'))
  helperDir = path.join(dir, 'scripts')
  fs.mkdirSync(helperDir, { recursive: true })
  fs.writeFileSync(path.join(helperDir, 'bat-mcp.mjs'), '// shim\n')
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 })
})

function host(): BatMcpHost {
  return {
    dataDir: () => path.join(dir, 'userData'),
    helperDir: () => helperDir,
    nodeCommand: () => 'node',
    endpointReady: () => true,
    readSettings: () => ({}),
  }
}

describe('BAT_MCP_CODEX_ENV_VARS', () => {
  it('covers every env var the shim and its helper imports read', () => {
    const files = ['bat-mcp.mjs', '_bat-cert.mjs', '_bat-logger.mjs']
    const read = new Set<string>()
    for (const file of files) {
      const source = fs.readFileSync(path.join(ROOT, 'scripts', file), 'utf8')
      for (const match of source.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)) read.add(match[1])
    }
    // the shim imports nothing else that reads env
    const shimImports = [...fs.readFileSync(path.join(ROOT, 'scripts', 'bat-mcp.mjs'), 'utf8').matchAll(/from '\.\/(_bat-[a-z-]+\.mjs)'/g)].map(m => m[1])
    expect(shimImports.sort()).toEqual(['_bat-cert.mjs', '_bat-logger.mjs'])
    expect(read.size).toBeGreaterThan(0)
    for (const name of read) expect(BAT_MCP_CODEX_ENV_VARS).toContain(name)
    for (const name of ['BAT_REMOTE_PORT', 'BAT_REMOTE_TOKEN', 'BAT_USER_DATA', 'BAT_SERVER_CERT_PATH', 'BAT_HELPER_LOG_DIR', 'BAT_RUNTIME', 'APPDATA']) {
      expect(BAT_MCP_CODEX_ENV_VARS).toContain(name)
    }
  })

  it('names only: valid env names, no value, no env table, for every shell family', () => {
    for (const name of BAT_MCP_CODEX_ENV_VARS) expect(name).toMatch(/^[A-Z_][A-Z0-9_]*$/)
    const previous = process.env.BAT_REMOTE_TOKEN
    process.env.BAT_REMOTE_TOKEN = TOKEN
    try {
      for (const shellFamily of ['pwsh', 'posix', 'cmd'] as const) {
        const r = buildBatMcpLaunchArgs(host(), { agentId: 'codex-cli', shellFamily })
        expect(r.injected).toBe(true)
        if (!r.injected) continue
        expect(r.args).toContain('mcp_servers.bat.env_vars=[')
        expect(r.args).not.toContain(TOKEN)
        expect(r.args).not.toContain('batcap.')
        expect(r.args).not.toMatch(/mcp_servers\.bat\.env[=.]/)
      }
    } finally {
      if (previous === undefined) delete process.env.BAT_REMOTE_TOKEN
      else process.env.BAT_REMOTE_TOKEN = previous
    }
  })

  it('codexMcpOverrides: command, args, env_vars, tool_timeout_sec', () => {
    expect(codexMcpOverrides({ command: 'node', args: ['/s/bat-mcp.mjs'] })).toEqual([
      "mcp_servers.bat.command='node'",
      "mcp_servers.bat.args=['/s/bat-mcp.mjs']",
      `mcp_servers.bat.env_vars=[${BAT_MCP_CODEX_ENV_VARS.map(n => `'${n}'`).join(', ')}]`,
      'mcp_servers.bat.tool_timeout_sec=60',
    ])
  })
})

// ── integration: the bundled codex really forwards the names ─────────────────────────────────

function bundledCodex(): string | null {
  const pkgDir = path.join(ROOT, 'node_modules', '@openai', `codex-${process.platform}-${process.arch}`, 'vendor')
  const exe = process.platform === 'win32' ? 'codex.exe' : 'codex'
  let triples: string[]
  try { triples = fs.readdirSync(pkgDir) } catch { return null }
  for (const triple of triples) {
    for (const rel of [['bin', exe], ['codex', exe]]) {
      const candidate = path.join(pkgDir, triple, ...rel)
      if (fs.existsSync(candidate)) return candidate
    }
  }
  return null
}

const CODEX = bundledCodex()

const FAKE_MCP_SERVER = `
import { writeFileSync } from 'fs'
import { createInterface } from 'readline'
const env = {}
for (const [k, v] of Object.entries(process.env)) env[k] = /TOKEN/i.test(k) ? 'len:' + v.length : v
writeFileSync(process.argv[2], JSON.stringify(env))
createInterface({ input: process.stdin }).on('line', line => {
  let msg
  try { msg = JSON.parse(line) } catch { return }
  if (msg.id === undefined) return
  const result = msg.method === 'initialize'
    ? { protocolVersion: msg.params?.protocolVersion ?? '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'fake-bat', version: '0.0.0' } }
    : msg.method === 'tools/list' ? { tools: [] } : null
  const reply = result ? { jsonrpc: '2.0', id: msg.id, result } : { jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'unsupported' } }
  process.stdout.write(JSON.stringify(reply) + '\\n')
})
`

/** `codex app-server`: initialize → mcpServerStatus/list (starts the MCP servers; no model call). */
async function listMcpServers(overrides: string[], env: NodeJS.ProcessEnv): Promise<unknown> {
  const args = [...overrides.flatMap(value => ['-c', value]), 'app-server']
  const child = spawn(CODEX as string, args, { env, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  let buffer = ''
  const waiters = new Map<number, (msg: { result?: unknown; error?: unknown }) => void>()
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', chunk => {
    buffer += chunk
    let nl: number
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl)
      buffer = buffer.slice(nl + 1)
      try {
        const msg = JSON.parse(line)
        if (typeof msg.id === 'number' && waiters.has(msg.id)) {
          waiters.get(msg.id)?.(msg)
          waiters.delete(msg.id)
        }
      } catch { /* not JSON */ }
    }
  })
  child.stderr.resume()
  let nextId = 1
  const call = (method: string, params: unknown) => new Promise<{ result?: unknown; error?: unknown }>(resolve => {
    const id = nextId++
    waiters.set(id, resolve)
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
  })
  try {
    const init = await call('initialize', { clientInfo: { name: 't0586', title: 't0586', version: '0.0.0' } })
    expect(init.error).toBeUndefined()
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'initialized' })}\n`)
    const list = await call('mcpServerStatus/list', {})
    expect(list.error).toBeUndefined()
    return list.result
  } finally {
    // wait for the exit: on Windows the temp CODEX_HOME stays locked while codex runs
    const exited = new Promise<void>(resolve => {
      if (child.exitCode !== null || child.signalCode !== null) resolve()
      else child.once('exit', () => resolve())
    })
    child.stdin.end()
    child.kill()
    await exited
  }
}

describe.skipIf(!CODEX)('bundled codex forwards env_vars to the stdio MCP server (no model call)', () => {
  function run(withEnvVars: boolean) {
    const codexHome = path.join(dir, `codex-home-${withEnvVars ? 'b' : 'a'}`)
    fs.mkdirSync(codexHome, { recursive: true })
    const server = path.join(dir, 'fake-bat-mcp.mjs')
    fs.writeFileSync(server, FAKE_MCP_SERVER)
    const out = path.join(dir, `env-${withEnvVars ? 'b' : 'a'}.json`)
    const overrides = codexMcpOverrides({ command: process.execPath, args: [server, out] })
      .filter(value => withEnvVars || !value.includes('.env_vars='))
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      CODEX_HOME: codexHome,
      BAT_REMOTE_PORT: '45678',
      BAT_REMOTE_TOKEN: TOKEN,
      BAT_TERMINAL_ID: 'tab-t0586',
      BAT_USER_DATA: path.join(dir, 'userData'),
      BAT_HELPER_LOG_DIR: path.join(dir, 'Logs'),
      BAT_WORKSPACE_ID: 'not-forwarded',
    }
    delete env.BAT_SERVER_CERT_PATH
    delete env.BAT_RUNTIME
    return { out, listing: listMcpServers(overrides, env) }
  }

  it('without env_vars: no BAT_* reaches the server (BUG-148)', async () => {
    const { out, listing } = run(false)
    const result = await listing as { data: Array<{ name: string; serverInfo?: { name?: string } }> }
    expect(result.data.find(s => s.name === 'bat')?.serverInfo?.name).toBe('fake-bat')
    const env = JSON.parse(fs.readFileSync(out, 'utf8')) as Record<string, string>
    expect(Object.keys(env).filter(k => k.startsWith('BAT_'))).toEqual([])
  }, 45_000)

  it('with env_vars: the listed names arrive, unset names are skipped, unlisted BAT_* does not', async () => {
    const { out, listing } = run(true)
    const result = await listing as { data: Array<{ name: string; serverInfo?: { name?: string } }> }
    expect(result.data.find(s => s.name === 'bat')?.serverInfo?.name).toBe('fake-bat')
    const env = JSON.parse(fs.readFileSync(out, 'utf8')) as Record<string, string>
    expect(env.BAT_REMOTE_PORT).toBe('45678')
    expect(env.BAT_REMOTE_TOKEN).toBe(`len:${TOKEN.length}`)
    expect(env.BAT_TERMINAL_ID).toBe('tab-t0586')
    expect(env.BAT_USER_DATA).toBe(path.join(dir, 'userData'))
    expect(env.BAT_HELPER_LOG_DIR).toBe(path.join(dir, 'Logs'))
    expect(env).not.toHaveProperty('BAT_SERVER_CERT_PATH')
    expect(env).not.toHaveProperty('BAT_RUNTIME')
    expect(env).not.toHaveProperty('BAT_WORKSPACE_ID')
    if (process.platform === 'win32') expect(env.APPDATA).toBe(process.env.APPDATA)
  }, 45_000)
})
