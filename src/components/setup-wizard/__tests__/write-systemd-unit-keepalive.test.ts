/**
 * T0384 (BUG-092, D128): write-systemd-unit pins the WSL keep-alive holder
 * right after the unit is written (so the distro survives fetch-fingerprint /
 * connect-test), never fails the step over it, and releases it on rollback.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WizardContext } from '../wizard-runner'
import { writeSystemdUnitStep } from '../steps/wsl/write-systemd-unit'

let order: string[]
let keepAliveMock: ReturnType<typeof vi.fn>
let releaseKeepAliveMock: ReturnType<typeof vi.fn>
let writeUnitMock: ReturnType<typeof vi.fn>
let warn: ReturnType<typeof vi.fn<(message: string) => void>>

function makeCtx(overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: { name: 'test wsl' },
    warnings: [],
    state: {},
    logger: { info: () => undefined, warn, error: () => undefined },
    wslDistro: 'Ubuntu-24.04',
    serverInstallPath: '/opt/bat-server',
    wslSystemdEnabled: true,
    ...overrides,
  }
}

beforeEach(() => {
  order = []
  warn = vi.fn<(message: string) => void>()
  keepAliveMock = vi.fn(async () => {
    order.push('keepAlive')
    return { ok: true }
  })
  releaseKeepAliveMock = vi.fn(async () => ({ ok: true }))
  writeUnitMock = vi.fn(async () => {
    order.push('writeUnit')
    return { ok: true }
  })
  ;(globalThis as unknown as { window: unknown }).window = {
    electronAPI: {
      platform: 'win32',
      wsl: {
        resolveHome: vi.fn(async () => '/home/tester'),
        pickServerPort: vi.fn(async () => ({ ok: true, port: 9877 })),
        keepAlive: keepAliveMock,
        releaseKeepAlive: releaseKeepAliveMock,
      },
      wslSystemd: {
        writeUnit: writeUnitMock,
        enableLinger: vi.fn(async () => {
          order.push('enableLinger')
          return { ok: true }
        }),
        startService: vi.fn(async () => {
          order.push('startService')
          return { ok: true, token: 't-1' }
        }),
        removeUnit: vi.fn(async () => ({ ok: true })),
      },
    },
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (globalThis as unknown as { window?: unknown }).window
})

describe('write-systemd-unit keep-alive (T0384 / BUG-092)', () => {
  it('pins the holder for the distro right after the unit is written, before linger / start', async () => {
    const ctx = makeCtx()
    await writeSystemdUnitStep.run(ctx)

    expect(keepAliveMock).toHaveBeenCalledWith('Ubuntu-24.04')
    expect(order).toEqual(['writeUnit', 'keepAlive', 'enableLinger', 'startService'])
    expect(ctx.systemdServiceActive).toBe(true)
  })

  it('a failed pin is logged but does not fail the step', async () => {
    keepAliveMock.mockResolvedValueOnce({ ok: false, error: 'Invalid WSL distro name: x' })
    const ctx = makeCtx()
    await expect(writeSystemdUnitStep.run(ctx)).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('keep-alive'))
    expect(ctx.warnings).toEqual([])

    keepAliveMock.mockRejectedValueOnce(new Error('ipc gone'))
    await expect(writeSystemdUnitStep.run(makeCtx())).resolves.toBeUndefined()
  })

  it('does not pin when the unit write fails or systemd is disabled', async () => {
    writeUnitMock.mockResolvedValueOnce({ ok: false })
    await expect(writeSystemdUnitStep.run(makeCtx())).rejects.toThrow(/Failed to write BAT systemd unit/)
    await writeSystemdUnitStep.run(makeCtx({ wslSystemdEnabled: false }))
    expect(keepAliveMock).not.toHaveBeenCalled()
  })

  it('rollback releases the wizard pin', async () => {
    const ctx = makeCtx({ wslHome: '/home/tester' })
    await writeSystemdUnitStep.rollback?.(ctx)
    expect(releaseKeepAliveMock).toHaveBeenCalledWith('Ubuntu-24.04')
  })
})
