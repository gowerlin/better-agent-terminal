/**
 * T0552 (BUG-139): WSL `installBundle` runs the clean-install script with
 * `wsl --exec sh -c <script> sh <root> <tarball>` (argv intact; `wsl --` would
 * re-parse it in the login shell and drop the positional arguments), validates
 * the root before anything runs, and reports the script's stderr.
 * `uninstallBundle` applies the same root rule before its `rm -rf`.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { installBundle, resetExecFileImplForTests, setExecFileImplForTests, uninstallBundle } from '../wsl-detect'
import { buildWslBundleInstallScript } from '../server-bundle-install-script'

type Call = { file: string; args: string[] }

function installExec(reply: { code?: number; stderr?: string } = {}): Call[] {
  const calls: Call[] = []
  setExecFileImplForTests((file: string, args: string[], _options: unknown, callback: (...cbArgs: unknown[]) => void) => {
    calls.push({ file, args })
    const stderr = Buffer.from(reply.stderr ?? '')
    if (reply.code) callback(Object.assign(new Error('Command failed: wsl'), { code: reply.code }), Buffer.alloc(0), stderr)
    else callback(null, Buffer.alloc(0), stderr)
    return undefined
  })
  return calls
}

afterEach(() => {
  resetExecFileImplForTests()
})

describe('installBundle (T0552 / BUG-139)', () => {
  it('runs the clean-install script with the root and tarball as argv', async () => {
    const calls = installExec()
    await expect(installBundle('Ubuntu-24.04', 'C:\\Users\\me\\bundles\\bat-server-linux-x64-v0.6.1.tar.gz', '/home/me/.local/bat-server/'))
      .resolves.toEqual({ ok: true })
    expect(calls).toHaveLength(1)
    expect(calls[0].file).toBe('wsl')
    expect(calls[0].args).toEqual([
      '-d', 'Ubuntu-24.04', '--exec', 'sh', '-c', buildWslBundleInstallScript(), 'sh',
      '/home/me/.local/bat-server',
      '/mnt/c/Users/me/bundles/bat-server-linux-x64-v0.6.1.tar.gz',
    ])
  })

  it.each(['/', '/home', '~/.local/bat-server', '/home/me/../x', ''])('refuses root %p without running anything', async (root) => {
    const calls = installExec()
    const result = await installBundle('Ubuntu-24.04', 'C:\\b.tar.gz', root)
    expect(result.ok).toBe(false)
    expect(calls).toEqual([])
  })

  it('surfaces the script stderr on failure', async () => {
    installExec({ code: 1, stderr: 'server bundle layout unexpected: bin/bat-server missing after extract\n' })
    const result = await installBundle('Ubuntu-24.04', 'C:\\b.tar.gz', '/home/me/.local/bat-server')
    expect(result.ok).toBe(false)
    expect(!result.ok && result.error).toMatch(/bin\/bat-server missing after extract/)
  })
})

describe('uninstallBundle (T0552)', () => {
  it('removes a valid root', async () => {
    const calls = installExec()
    await uninstallBundle('Ubuntu-24.04', '/home/me/.local/bat-server')
    expect(calls[0].args).toEqual(['-d', 'Ubuntu-24.04', '--', 'rm', '-rf', '/home/me/.local/bat-server'])
  })

  it.each(['/', '/home', '~/.local/bat-server'])('refuses %p', async (root) => {
    const calls = installExec()
    await expect(uninstallBundle('Ubuntu-24.04', root)).rejects.toThrow()
    expect(calls).toEqual([])
  })
})
