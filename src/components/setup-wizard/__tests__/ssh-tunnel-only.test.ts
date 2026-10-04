/**
 * T0425 (BUG-098, D134): the SSH wizard's "direct" mode was removed; tunnel is
 * the only mode. Covers what the wizard produces and the defined behaviour for
 * a leftover `sshTunnelMode: 'direct'` (prefilled / older wizard state):
 * it is treated as tunnel, with a warning, never written to the profile.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WizardContext } from '../wizard-runner'
import { createSshWizardContext } from '../ssh-flow'
import * as sshSteps from '../steps/ssh'
import { configureSshHostStep, normalizeSshTunnelMode } from '../steps/ssh/configure-host'
import { writeProfileStep } from '../steps/wsl/write-profile'

function makeCtx(state: Record<string, unknown> = {}, overrides: Partial<WizardContext> = {}): WizardContext {
  return {
    targetOS: 'ssh-linux',
    profileDraft: { name: 'devbox' },
    warnings: [],
    state: { sshHost: 'devbox.example', sshUser: 'alice', ...state },
    serverPort: 9876,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  }
}

function installApi() {
  const api = {
    listHosts: vi.fn(async () => [] as string[]),
    create: vi.fn(async () => ({ id: 'profile-1' })),
    update: vi.fn(async (_profileId: string, _updates: Record<string, unknown>) => true),
  }
  ;(globalThis as unknown as { window: unknown }).window = {
    electronAPI: {
      ssh: { listHosts: api.listHosts },
      profile: { create: api.create, update: api.update },
    },
  }
  return api
}

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window
})

describe('SSH wizard is tunnel-only (T0425 / BUG-098)', () => {
  it('no longer exports tunnel-mode choices; a fresh wizard context starts in tunnel mode', () => {
    expect(sshSteps).not.toHaveProperty('sshConfigureHostTunnelModeOptions')
    expect(createSshWizardContext({ profileName: 'x' }).state.sshTunnelMode).toBe('tunnel')
  })

  it('configure-ssh-host keeps tunnel without warning', async () => {
    installApi()
    const ctx = makeCtx({ sshTunnelMode: 'tunnel' })
    await configureSshHostStep.run(ctx)
    expect(ctx.state.sshTunnelMode).toBe('tunnel')
    expect(ctx.profileDraft.sshTunnelMode).toBe('tunnel')
    expect(ctx.logger.warn).not.toHaveBeenCalled()
  })

  it('configure-ssh-host turns a legacy direct value into tunnel and warns', async () => {
    installApi()
    const ctx = makeCtx({ sshTunnelMode: 'direct' })
    await configureSshHostStep.run(ctx)
    expect(ctx.state.sshTunnelMode).toBe('tunnel')
    expect(ctx.profileDraft.sshTunnelMode).toBe('tunnel')
    expect(ctx.logger.warn).toHaveBeenCalledWith(expect.stringContaining('direct mode is no longer supported'))
  })

  it.each([undefined, '', 'bogus', 42])('normalizes %s to tunnel silently', (value) => {
    const ctx = makeCtx({ sshTunnelMode: value })
    expect(normalizeSshTunnelMode(ctx)).toBe('tunnel')
    expect(ctx.state.sshTunnelMode).toBe('tunnel')
    expect(ctx.logger.warn).not.toHaveBeenCalled()
  })

  it.each(['tunnel', 'direct'])('write-profile always persists useSshTunnel=true (state %s)', async (mode) => {
    const api = installApi()
    const ctx = makeCtx({ sshTunnelMode: mode, sshServerHome: '/home/alice' }, {
      remoteToken: 'remote-token',
      fingerprint: 'AB:CD',
    })
    await writeProfileStep.run(ctx)
    expect(api.update).toHaveBeenCalledTimes(1)
    const updates = api.update.mock.calls[0][1]
    expect(updates.useSshTunnel).toBe(true)
    expect(updates.remoteHost).toBe('localhost')
    expect(updates.remotePort).toBe(9876)
  })
})
