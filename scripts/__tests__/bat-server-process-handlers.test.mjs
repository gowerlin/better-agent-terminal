// @vitest-environment node
// T0447 (T0445 #3, defence in depth): scripts/bat-server.mjs process-level handlers.
// A fake server-entry (BAT_SERVER_ENTRY) raises the error after start():
//   - unhandledRejection → logged, the server keeps running (one bad frame must not kill
//     every PTY / agent of the headless server)
//   - uncaughtException  → logged, server.stop() attempted, exit code 1 (process state is
//     undefined after an uncaught exception; the supervisor restarts it)

import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const BAT_SERVER = path.join(__dirname, '..', 'bat-server.mjs')

const FAKE_ENTRY = `
module.exports = {
  resolveDefaultDataDir: () => require('os').tmpdir(),
  createHeadlessServer: async () => ({
    async start() {
      const mode = process.env.T0447_FAKE_MODE
      setTimeout(() => {
        if (mode === 'reject') Promise.reject(new Error('T0447 fake rejection'))
        if (mode === 'throw') throw new Error('T0447 fake exception')
      }, 50)
      if (mode === 'reject') setTimeout(() => console.log('T0447 still alive'), 400)
      return { bindAddress: '127.0.0.1', port: 1, fingerprint: 'AA:BB:CC:DD:EE:FF:00:11' }
    },
    async stop() { console.log('T0447 fake stop') },
  }),
}
`

let dir

beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'bat-server-t0447-'))
  writeFileSync(path.join(dir, 'server-entry.js'), FAKE_ENTRY)
})

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
})

function runServer(mode, { waitFor, timeoutMs = 10_000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BAT_SERVER, '--data-dir', dir, '--port', '0'], {
      env: { ...process.env, BAT_SERVER_ENTRY: path.join(dir, 'server-entry.js'), T0447_FAKE_MODE: mode },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let exitCode
    const finish = () => {
      clearTimeout(timer)
      resolve({ stdout, stderr, exitCode, child })
    }
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`bat-server (${mode}) timed out; stdout=${stdout} stderr=${stderr}`))
    }, timeoutMs)
    child.stdout.on('data', chunk => {
      stdout += chunk
      if (waitFor && stdout.includes(waitFor)) finish()
    })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('exit', code => {
      exitCode = code
      finish()
    })
  })
}

describe('bat-server.mjs process-level handlers (T0447)', () => {
  it('unhandledRejection is logged and the server keeps running', async () => {
    const { stdout, stderr, exitCode, child } = await runServer('reject', { waitFor: 'T0447 still alive' })
    try {
      expect(exitCode).toBeUndefined()
      expect(stdout).toContain('T0447 still alive')
      expect(stderr).toContain('[bat-server] unhandledRejection')
      expect(stderr).toContain('T0447 fake rejection')
    } finally {
      child.kill()
    }
  })

  it('uncaughtException is logged, the server is stopped, the process exits 1', async () => {
    const { stdout, stderr, exitCode } = await runServer('throw', {})
    expect(stderr).toContain('[bat-server] uncaughtException')
    expect(stderr).toContain('T0447 fake exception')
    expect(stdout).toContain('T0447 fake stop')
    expect(exitCode).toBe(1)
  })
})
