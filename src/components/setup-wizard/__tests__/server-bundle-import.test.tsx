/**
 * D146 / T0547: installers no longer ship the server bundle baseline. When the
 * WSL / SSH install step cannot download it, the failed step offers
 * "Import local tarball…" (server-bundle:import-local), then retries the step,
 * which finds the imported tarball in the cache.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, waitFor } from '@testing-library/react'
import i18n from '../../../i18n'
import en from '../../../locales/en.json'
import zhCN from '../../../locales/zh-CN.json'
import zhTW from '../../../locales/zh-TW.json'
import { SetupWizardShell } from '../SetupWizardShell'
import { DEFAULT_WIZARD_ERROR_REGISTRY, resolveWizardError } from '../error-mapper'
import {
  distributeFailureError,
  importServerBundleForRetry,
  SERVER_BUNDLE_IMPORT_TARGET_KEY,
  SERVER_BUNDLE_UNAVAILABLE_CODE,
} from '../server-bundle-import'
import { installServerBundleStep } from '../steps/wsl/install-server-bundle'
import { installSshServerBundleStep } from '../steps/ssh/install-server-bundle'
import type { WizardContext } from '../wizard-runner'

const VERSION = '0.6.1-pre.4'
const FILE = `bat-server-linux-x64-v${VERSION}.tar.gz`

const downloadFailed = {
  ok: false as const,
  errorCode: 'download-failed' as const,
  error: `Download fallback failed: manifest-fetch-failed: fetch failed Import a local tarball instead (${FILE} with ${FILE}.sha256, from the server-bundle-v${VERSION} release), or point BAT_SERVER_BUNDLE_BASE_URL at a mirror.`,
  arch: 'linux-x64' as const,
  version: VERSION,
}
const cacheHit = {
  ok: true as const,
  tarballPath: `C:\\bat\\bat-server-bundles\\${FILE}`,
  sha256: 'a'.repeat(64),
  sizeBytes: 10,
  source: 'cache' as const,
  arch: 'linux-x64' as const,
}

function installApi(overrides: { importLocal?: ReturnType<typeof vi.fn>; distribute?: ReturnType<typeof vi.fn> } = {}) {
  const api = {
    distribute: overrides.distribute ?? vi.fn().mockResolvedValueOnce(downloadFailed).mockResolvedValue(cacheHit),
    onDistributeProgress: vi.fn(() => () => undefined),
    importLocal: overrides.importLocal ?? vi.fn(async () => ({
      ok: true, tarballPath: cacheHit.tarballPath, sha256: cacheHit.sha256, sizeBytes: 10, arch: 'linux-x64', version: VERSION,
    })),
  }
  const installBundle = vi.fn(async () => ({ ok: true }))
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    shell: { openExternal: vi.fn() },
    update: { getVersion: vi.fn(async () => VERSION) },
    remote: { serverBundle: api },
    wsl: {
      resolveHome: vi.fn(async () => '/home/u'),
      installBundle,
      uninstallBundle: vi.fn(async () => ({ ok: true })),
      detectNetworkMode: vi.fn(async () => ({ actual: 'mirrored', declared: null, mirroredSupported: null })),
    },
  }
  return { api, installBundle }
}

function makeCtx(): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: { name: 't0547' },
    warnings: [],
    state: {},
    wslDistro: 'Ubuntu-24.04',
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  } as WizardContext
}

beforeAll(async () => {
  await i18n.changeLanguage('zh-TW')
})

afterAll(async () => {
  await i18n.changeLanguage('en')
})

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
  vi.restoreAllMocks()
})

async function failedActions(container: HTMLElement): Promise<HTMLButtonElement[]> {
  let actions: Element | null = null
  await waitFor(() => {
    actions = container.querySelector('.bat-stepper-failed-actions')
    expect(actions).not.toBeNull()
  })
  return Array.from(actions!.querySelectorAll('button'))
}

describe('install-server-bundle download failure → import (T0547)', () => {
  it('importable failures carry the code and record the target; others do not', () => {
    const ctx = makeCtx()
    const err = distributeFailureError(ctx, downloadFailed) as Error & { code?: string }
    expect(err.code).toBe(SERVER_BUNDLE_UNAVAILABLE_CODE)
    expect(err.message).toBe(`[download-failed] ${downloadFailed.error}`)
    expect(ctx.state[SERVER_BUNDLE_IMPORT_TARGET_KEY]).toEqual({ arch: 'linux-x64', version: VERSION })

    const arch = distributeFailureError(ctx, { ok: false, errorCode: 'arch-detection-failed', error: 'x', version: VERSION }) as Error & { code?: string }
    expect(arch.code).toBeUndefined()
    expect(ctx.state[SERVER_BUNDLE_IMPORT_TARGET_KEY]).toBeUndefined()
    const corrupted = distributeFailureError(ctx, { ok: false, errorCode: 'baseline-corrupted', error: 'x', arch: 'linux-x64', version: VERSION }) as Error & { code?: string }
    expect(corrupted.code).toBeUndefined()
  })

  it('the registry maps it to import / retry / cancel for WSL and SSH only', () => {
    for (const platform of ['wsl', 'ssh'] as const) {
      const mapped = resolveWizardError(
        { platform, stepId: 'install-server-bundle', errorCode: SERVER_BUNDLE_UNAVAILABLE_CODE, error: new Error('[download-failed] x') },
        DEFAULT_WIZARD_ERROR_REGISTRY,
      )
      expect(mapped.matchId).toBe('server-bundle-unavailable')
      expect(mapped.actions.map((a) => a.kind)).toEqual(['import-server-bundle', 'retry', 'cancel'])
      expect(mapped.title).toBe('無法下載 BAT 伺服器套件')
      expect(mapped.body).toContain('匯入本機 tarball')
      expect(mapped.body).toContain('BAT_SERVER_BUNDLE_BASE_URL')
      expect(mapped.rawError).toBe('[download-failed] x')
    }
    const docker = resolveWizardError(
      { platform: 'docker', stepId: 'install-server-bundle', errorCode: SERVER_BUNDLE_UNAVAILABLE_CODE, error: new Error('x') },
      DEFAULT_WIZARD_ERROR_REGISTRY,
    )
    expect(docker.matchId).toBeNull()
  })

  it('the SSH step throws the same importable error', async () => {
    installApi({ distribute: vi.fn(async () => downloadFailed) })
    const ctx = makeCtx()
    ctx.targetOS = 'ssh-linux'
    ctx.state = { sshHost: 'h', sshUser: '', sshInstallPath: '/opt/bat', sshServerHome: '/home/u', sshServerArch: 'x86_64' }
    const err = await installSshServerBundleStep.run(ctx).then(() => null, (e: unknown) => e as Error & { code?: string })
    expect(err?.code).toBe(SERVER_BUNDLE_UNAVAILABLE_CODE)
    expect(ctx.state[SERVER_BUNDLE_IMPORT_TARGET_KEY]).toEqual({ arch: 'linux-x64', version: VERSION })
  })

  it('Shell: "Import local tarball…" imports, then the retried step installs from the cache', async () => {
    const { api, installBundle } = installApi()
    const { container } = render(<SetupWizardShell steps={[installServerBundleStep]} ctx={makeCtx()} />)

    const buttons = await failedActions(container)
    expect(buttons.map((b) => b.getAttribute('data-action-kind'))).toEqual(['import-server-bundle', 'retry', 'cancel'])
    expect(buttons[0].textContent).toBe('匯入本機 tarball…')
    expect(installBundle).not.toHaveBeenCalled()

    fireEvent.click(buttons[0])

    await waitFor(() => expect(installBundle).toHaveBeenCalledWith('Ubuntu-24.04', cacheHit.tarballPath, '/home/u/.local/bat-server'))
    expect(api.importLocal).toHaveBeenCalledWith({
      arch: 'linux-x64',
      version: VERSION,
      dialogTitle: `選取 ${FILE}`,
      sidecarDialogTitle: `選取 ${FILE}.sha256（SHA-256 檢查碼）`,
    })
    expect(api.distribute).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(container.textContent).toContain(zhTW.wizard.progress.complete))
  })

  it('Shell: a rejected import shows the localized reason and does not retry', async () => {
    const importLocal = vi.fn(async () => ({
      ok: false, errorCode: 'version-mismatch', error: 'x', details: { file: 'bat-server-linux-x64-v0.6.0.tar.gz', expected: VERSION, actual: '0.6.0' },
    }))
    const { api } = installApi({ importLocal })
    const { container } = render(<SetupWizardShell steps={[installServerBundleStep]} ctx={makeCtx()} />)
    fireEvent.click((await failedActions(container))[0])

    await waitFor(() => {
      const notice = container.querySelector('.bat-wizard-action-notice')
      expect(notice?.getAttribute('data-tone')).toBe('error')
      expect(notice?.textContent).toBe(`bat-server-linux-x64-v0.6.0.tar.gz 的版號是 0.6.0，這個 BAT 需要 ${VERSION}。`)
    })
    expect(api.distribute).toHaveBeenCalledTimes(1)
  })

  it('Shell: a cancelled dialog leaves the failed step as it was', async () => {
    const importLocal = vi.fn(async () => ({ ok: false, errorCode: 'cancelled', error: 'Import cancelled.' }))
    const { api } = installApi({ importLocal })
    const { container } = render(<SetupWizardShell steps={[installServerBundleStep]} ctx={makeCtx()} />)
    fireEvent.click((await failedActions(container))[0])
    await waitFor(() => expect(importLocal).toHaveBeenCalledOnce())
    await waitFor(() => expect(container.querySelector('.bat-wizard-action-notice')).toBeNull())
    expect(api.distribute).toHaveBeenCalledTimes(1)
  })

  it('importServerBundleForRetry without a recorded target asks for a retry first', async () => {
    const importLocal = vi.fn()
    const outcome = await importServerBundleForRetry({}, i18n.t.bind(i18n), { importLocal })
    expect(outcome).toEqual({ status: 'error', message: zhTW.wizard.shared.bundleImport.noTarget })
    expect(importLocal).not.toHaveBeenCalled()
  })

  it('every import error code has a message in all three locales, with the same placeholders', () => {
    const codes = ['invalidArguments', 'invalidFilename', 'archMismatch', 'versionMismatch', 'sidecarMissing', 'sidecarInvalid', 'shaMismatch', 'readFailed', 'cacheWriteFailed'] as const
    const placeholders = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort()
    for (const code of codes) {
      const ref = placeholders(en.wizard.shared.bundleImport.error[code])
      expect(placeholders(zhTW.wizard.shared.bundleImport.error[code])).toEqual(ref)
      expect(placeholders(zhCN.wizard.shared.bundleImport.error[code])).toEqual(ref)
    }
    for (const locale of [en, zhTW, zhCN]) {
      expect(locale.wizard.action.importServerBundle).toBeTruthy()
      expect(locale.wizard.shared.error.serverBundleUnavailable.title).toBeTruthy()
      expect(locale.wizard.shared.error.serverBundleUnavailable.body).toContain('BAT_SERVER_BUNDLE_BASE_URL')
      expect(locale.wizard.shared.bundleImport.dialogTitle).toContain('{{file}}')
    }
  })
})
