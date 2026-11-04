/**
 * T0829: a force-killed parent leaves no orphaned keep-alive holder.
 *
 * Real processes, opt-in: runs only on Windows with `BAT_TEST_WSL_DISTRO=<distro>` set
 * (it starts that distro if it is stopped). A plain `node` parent spawns the holder exactly
 * as `holderSpawn()` defines it, then gets `taskkill /F`-ed — no exit handlers run, just as
 * when BAT is ended from Task Manager or crashes. Both `wsl.exe` processes (the System32
 * launcher we spawn and its `C:\Program Files\WSL\wsl.exe` child) must be gone shortly after.
 *
 * Electron's main process uses the same libuv `uv_spawn` (same Job Object), measured on
 * Electron 45.2.1 and on a BAT dev instance in the T0829 report.
 */
import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import { describe, expect, it } from 'vitest'
import { holderSpawn } from '../wsl-keepalive'

const execFileAsync = promisify(execFile)
const distro = process.env.BAT_TEST_WSL_DISTRO ?? ''
const enabled = process.platform === 'win32' && /^[a-zA-Z0-9._-]+$/.test(distro)

// Parent script: spawn the holder from the JSON spec in argv, print its pid, then idle.
const PARENT_SCRIPT = [
  "const { spawn } = require('child_process')",
  'const spec = JSON.parse(process.argv[1])',
  'const child = spawn(spec.command, spec.args, spec.options)',
  "process.stdout.write(String(child.pid) + '\\n')",
  'setInterval(() => {}, 1 << 30)',
].join('\n')

async function wslProcesses(): Promise<Array<{ pid: number; ppid: number }>> {
  const { stdout } = await execFileAsync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      "Get-CimInstance Win32_Process -Filter \"Name='wsl.exe'\" | ForEach-Object { \"$($_.ProcessId) $($_.ParentProcessId)\" }",
    ],
    { timeout: 30_000, windowsHide: true },
  )
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/).map(Number))
    .filter((parts) => parts.length === 2 && parts.every(Number.isFinite))
    .map(([pid, ppid]) => ({ pid, ppid }))
}

async function waitFor<T>(probe: () => Promise<T | null>, timeoutMs: number): Promise<T | null> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = await probe()
    if (value !== null || Date.now() > deadline) return value
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
}

describe.runIf(enabled)('WSL keep-alive holder after a forced parent kill (T0829, real wsl.exe)', () => {
  it('leaves no wsl.exe behind once the parent is taskkill /F-ed', async () => {
    const parent = spawn(process.execPath, ['-e', PARENT_SCRIPT, JSON.stringify(holderSpawn(distro))], {
      stdio: ['ignore', 'pipe', 'inherit'],
      windowsHide: true,
    })
    let holderPid = 0
    try {
      holderPid = await new Promise<number>((resolve, reject) => {
        parent.stdout?.once('data', (chunk: Buffer) => resolve(Number(String(chunk).trim())))
        parent.once('error', reject)
        setTimeout(() => reject(new Error('parent did not report the holder pid')), 15_000)
      })
      expect(holderPid).toBeGreaterThan(0)

      // The inner Program Files wsl.exe shows up once the distro side is running.
      const inner = await waitFor(async () => {
        const list = await wslProcesses()
        return list.find((p) => p.ppid === holderPid) ?? null
      }, 30_000)
      expect(inner, 'holder did not start its inner wsl.exe').not.toBeNull()

      await execFileAsync('taskkill.exe', ['/F', '/PID', String(parent.pid)], { timeout: 10_000, windowsHide: true })

      const leftovers = await waitFor(async () => {
        const list = await wslProcesses()
        const left = list.filter((p) => p.pid === holderPid || p.pid === inner?.pid)
        return left.length === 0 ? [] : null
      }, 10_000)
      expect(leftovers, 'wsl.exe holder survived the forced parent kill').toEqual([])
    } finally {
      // Never leave anything behind, even when an assertion failed.
      for (const pid of [parent.pid, holderPid]) {
        if (pid) await execFileAsync('taskkill.exe', ['/F', '/T', '/PID', String(pid)], { timeout: 10_000, windowsHide: true }).catch(() => undefined)
      }
    }
  }, 90_000)
})
