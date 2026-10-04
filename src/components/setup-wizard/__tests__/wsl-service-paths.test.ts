/**
 * T0378 (BUG-087 B): the WSL wizard resolves the distro user's absolute $HOME
 * and never hands `~` to systemd — install path, ExecStart, Environment and
 * unit path are all absolute.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WizardContext } from '../wizard-runner'
import { installServerBundleStep, resolveWslHome } from '../steps/wsl/install-server-bundle'
import { buildWslServicePaths, writeSystemdUnitStep } from '../steps/wsl/write-systemd-unit'

let resolveHomeMock: ReturnType<typeof vi.fn>
let installBundleMock: ReturnType<typeof vi.fn>
let distributeMock: ReturnType<typeof vi.fn>
let writeUnitMock: ReturnType<typeof vi.fn>
let startServiceMock: ReturnType<typeof vi.fn>

function makeCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: { name: 'paths' },
    warnings: [],
    state: { networkMode: 'mirrored' },
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
    wslDistro: 'Ubuntu-24.04',
    wslSystemdEnabled: true,
    serverPort: 9876,
    ...overrides,
  }
}

beforeEach(() => {
  resolveHomeMock = vi.fn(async () => '/home/gower')
  installBundleMock = vi.fn(async () => ({ ok: true }))
  distributeMock = vi.fn(async () => ({ ok: true, tarballPath: 'C:\\cache\\bat-server.tar.gz', source: 'cache' }))
  writeUnitMock = vi.fn(async () => ({ ok: true }))
  startServiceMock = vi.fn(async () => ({ ok: true, token: 'tok' }))
  ;(globalThis as unknown as { window: unknown }).window = {
    electronAPI: {
      platform: 'win32',
      update: { getVersion: vi.fn(async () => '0.5.9') },
      remote: {
        serverBundle: {
          distribute: distributeMock,
          onDistributeProgress: vi.fn(() => () => undefined),
        },
      },
      wsl: {
        resolveHome: resolveHomeMock,
        installBundle: installBundleMock,
        uninstallBundle: vi.fn(async () => ({ ok: true })),
        detectNetworkMode: vi.fn(async () => 'mirrored'),
        // T0382: write-systemd-unit picks the port on the Windows side.
        pickServerPort: vi.fn(async () => ({ ok: true, port: 9877 })),
      },
      wslSystemd: {
        writeUnit: writeUnitMock,
        enableLinger: vi.fn(async () => ({ ok: true })),
        startService: startServiceMock,
        removeUnit: vi.fn(async () => ({ ok: true })),
      },
    },
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (globalThis as unknown as { window?: unknown }).window
})

describe('$HOME resolution (T0378 / BUG-087 B)', () => {
  it('resolves once and caches on ctx', async () => {
    const ctx = makeCtx()
    await expect(resolveWslHome(ctx, 'Ubuntu-24.04')).resolves.toBe('/home/gower')
    await expect(resolveWslHome(ctx, 'Ubuntu-24.04')).resolves.toBe('/home/gower')
    expect(resolveHomeMock).toHaveBeenCalledTimes(1)
    expect(ctx.wslHome).toBe('/home/gower')
  })

  it('fails when the IPC rejects', async () => {
    resolveHomeMock.mockRejectedValueOnce(new Error('wsl exited 1'))
    await expect(resolveWslHome(makeCtx(), 'Ubuntu-24.04')).rejects.toThrow(/wsl exited 1/)
  })

  it('rejects a non-absolute home', async () => {
    resolveHomeMock.mockResolvedValueOnce('~')
    const ctx = makeCtx()
    await expect(resolveWslHome(ctx, 'Ubuntu-24.04')).rejects.toThrow(/home directory/)
    expect(ctx.wslHome).toBeUndefined()
  })

  it('buildWslServicePaths derives absolute data dir + unit path', () => {
    expect(buildWslServicePaths('/home/gower')).toEqual({
      dataDir: '/home/gower/.local/share/bat-server',
      unitPath: '/home/gower/.config/systemd/user/bat-server.service',
    })
    expect(() => buildWslServicePaths('~')).toThrow(/absolute home/)
  })
})

describe('install-server-bundle (T0378 / BUG-087 B)', () => {
  it('installs into <home>/.local/bat-server and stores the absolute path', async () => {
    const ctx = makeCtx({ serverInstallPath: '~/.local/bat-server' })
    await installServerBundleStep.run(ctx)
    expect(installBundleMock).toHaveBeenCalledWith('Ubuntu-24.04', 'C:\\cache\\bat-server.tar.gz', '/home/gower/.local/bat-server')
    expect(ctx.serverInstallPath).toBe('/home/gower/.local/bat-server')
  })

  it('fails fast (before downloading) when $HOME cannot be resolved', async () => {
    resolveHomeMock.mockRejectedValueOnce(new Error('no home'))
    await expect(installServerBundleStep.run(makeCtx())).rejects.toThrow(/no home/)
    expect(distributeMock).not.toHaveBeenCalled()
    expect(installBundleMock).not.toHaveBeenCalled()
  })
})

describe('write-systemd-unit (T0378 / BUG-087 B)', () => {
  it('writes ExecStart / Environment / unit path as absolute paths, never `~`', async () => {
    const ctx = makeCtx({ serverInstallPath: '/home/gower/.local/bat-server' })
    await writeSystemdUnitStep.run(ctx)

    const [distro, unit] = writeUnitMock.mock.calls[0]
    expect(distro).toBe('Ubuntu-24.04')
    expect(unit.path).toBe('/home/gower/.config/systemd/user/bat-server.service')
    expect(unit.execStart).toBe('/home/gower/.local/bat-server/bin/bat-server')
    expect(unit.environment.BAT_DATA_DIR).toBe('/home/gower/.local/share/bat-server')
    expect(unit.environment.BAT_SERVER_DATA_DIR).toBe('/home/gower/.local/share/bat-server')
    expect(JSON.stringify(unit)).not.toContain('~')
    expect(startServiceMock).toHaveBeenCalledWith('Ubuntu-24.04', 'bat-server.service', {
      dataDir: '/home/gower/.local/share/bat-server',
    })
  })

  it('refuses a tilde install path instead of writing a unit systemd rejects', async () => {
    const ctx = makeCtx({ serverInstallPath: '~/.local/bat-server' })
    await expect(writeSystemdUnitStep.run(ctx)).rejects.toThrow(/must be absolute/)
    expect(writeUnitMock).not.toHaveBeenCalled()
  })
})
