/**
 * T0410 (PLAN-037 D): RemoteToolsPanel + InstallConfirmDialog.
 * Fixtures: T0408's WSL Ubuntu-24.04 probe, Alpine root, macOS, everything missing, old server.
 */
import { beforeAll, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import { RemoteToolsPanel, type RemoteToolsPanelProps } from '../remote-tools/RemoteToolsPanel'
import { InstallConfirmDialog } from '../remote-tools/InstallConfirmDialog'
import { buildInstallPlan, buildUpdatePlan, isInstallPlan, type InstallPlan, type RecipeEnv } from '../../lib/remote-tools/recipes'
import {
  REMOTE_AUTH_ENV_VARS,
  REMOTE_TOOL_IDS,
  type RemoteToolId,
  type RemoteToolReport,
  type RemoteToolsDetectResult,
  type RemoteToolsEnv,
  type RemoteToolsReport,
} from '../../types/remote-tools'

const rt = en.remoteTools

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

const NO_AUTH_ENV = Object.fromEntries(REMOTE_AUTH_ENV_VARS.map((name) => [name, false])) as RemoteToolsEnv['authEnv']

function makeReport(env: Partial<RemoteToolsEnv>, tools: Partial<Record<RemoteToolId, Partial<RemoteToolReport>>>, extra: Partial<RemoteToolsReport> = {}): RemoteToolsReport {
  return {
    schemaVersion: 1,
    env: {
      osFamily: 'linux', musl: false, pkgManager: 'apt', privilege: 'passwordless', isWsl: false, hasTimeout: true,
      authEnv: NO_AUTH_ENV, ...env,
    },
    tools: REMOTE_TOOL_IDS.map((id) => ({
      id,
      status: 'missing',
      login: 'n/a',
      serverVisible: false,
      ...tools[id],
    })),
    serverViewAvailable: true,
    warnings: [],
    ...extra,
  }
}

/** T0408 回報區「WSL 實測 parse 結果」. */
const WSL_REPORT = makeReport(
  { osId: 'ubuntu', osIdLike: 'debian', osVersion: '24.04', arch: 'x86_64', isWsl: true },
  {
    claude: { credentialFilePresent: false },
    git: { status: 'ok', path: '/usr/bin/git', version: '2.43.0', serverVisible: true },
    gh: { credentialFilePresent: false },
    codex: { status: 'interop-only', path: '/mnt/c/Users/Gower/AppData/Roaming/npm/codex', credentialFilePresent: false },
    curl: { status: 'ok', path: '/usr/bin/curl', version: '8.5.0', serverVisible: true },
    bash: { status: 'ok', path: '/usr/bin/bash', version: '5.2.21', serverVisible: true },
    python3: { status: 'ok', path: '/usr/bin/python3', version: '3.12.3', serverVisible: true },
  },
)

/** Alpine container: root, no sudo, musl, apk; no bash / curl. */
const ALPINE_ROOT_REPORT = makeReport(
  { osId: 'alpine', osVersion: '3.20.0', arch: 'x86_64', musl: true, pkgManager: 'apk', privilege: 'root' },
  {
    git: { status: 'ok', path: '/usr/bin/git', version: '2.45.2', serverVisible: true },
  },
)

/** macOS over SSH: brew, claude in the Keychain (no credential file), codex logged out. */
const MAC_REPORT = makeReport(
  { osFamily: 'darwin', osId: 'macos', osVersion: '15.1', arch: 'arm64', pkgManager: 'brew', privilege: 'password-required', hasTimeout: false },
  {
    claude: { status: 'ok', path: '/Users/me/.local/bin/claude', version: '2.1.290', login: 'unknown', credentialFilePresent: false, serverVisible: false },
    git: { status: 'ok', path: '/usr/bin/git', version: '2.39.5', serverVisible: true },
    codex: { status: 'ok', path: '/Users/me/.local/bin/codex', version: '0.50.0', login: 'loggedOut', credentialFilePresent: false },
    curl: { status: 'ok', path: '/usr/bin/curl', version: '8.7.1', serverVisible: true },
    bash: { status: 'ok', path: '/bin/bash', version: '3.2.57', serverVisible: true },
    rg: { status: 'not-on-path', path: '/opt/homebrew/bin/rg' },
  },
  { serverViewAvailable: false },
)

/** Slim Debian container: root, apt, nothing installed (no curl either). */
const ALL_MISSING_REPORT = makeReport({ osId: 'debian', osVersion: '12', privilege: 'root' }, {})

const OLD_SERVER_ERROR = new Error(
  "Error invoking remote method 'remote:detect-tools': Error: No handler for channel: remote-tools:detect",
)

function ok(report: RemoteToolsReport): () => Promise<RemoteToolsDetectResult> {
  return vi.fn(async () => ({ ok: true as const, report }))
}

async function renderPanel(props: Partial<RemoteToolsPanelProps> & Pick<RemoteToolsPanelProps, 'detect'>) {
  const onInstall = vi.fn()
  const utils = render(<RemoteToolsPanel host="profile" onInstall={onInstall} {...props} />)
  await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
  return { onInstall, ...utils }
}

function row(id: RemoteToolId) {
  return within(screen.getByTestId(`remote-tool-${id}`))
}

function groupOf(id: RemoteToolId): string | null | undefined {
  return screen.getByTestId(`remote-tool-${id}`).closest('[data-tier]')?.getAttribute('data-tier')
}

function plan(result: ReturnType<typeof buildInstallPlan>): InstallPlan {
  if (!isInstallPlan(result)) throw new Error('expected an install plan')
  return result
}

describe('RemoteToolsPanel — WSL Ubuntu (T0408 probe)', () => {
  test('groups tools by tier in display order', async () => {
    await renderPanel({ detect: ok(WSL_REPORT) })
    const titles = [...document.querySelectorAll('.remote-tools-group-title')].map((el) => el.textContent)
    expect(titles).toEqual([rt.tier.required, rt.tier.recommended, rt.tier.optional, rt.tier.prerequisite])
    expect(groupOf('claude')).toBe('required')
    expect(groupOf('git')).toBe('required')
    expect(groupOf('gh')).toBe('recommended')
    expect(groupOf('codex')).toBe('recommended')
    expect(groupOf('rg')).toBe('optional')
    expect(groupOf('curl')).toBe('prerequisite')
  })

  test('row shows status, path, version and server visibility', async () => {
    await renderPanel({ detect: ok(WSL_REPORT) })
    expect(row('git').getByText(rt.status.ok)).toBeInTheDocument()
    expect(row('git').getByText('/usr/bin/git')).toBeInTheDocument()
    expect(row('git').getByText('2.43.0')).toBeInTheDocument()
    expect(row('git').getByText(rt.server.visible)).toBeInTheDocument()
    expect(row('claude').getByText(rt.status.missing)).toBeInTheDocument()
    expect(row('claude').getByText(rt.server.hidden)).toBeInTheDocument()
    expect(screen.getByTestId('remote-tools-env')).toHaveTextContent('ubuntu 24.04 · x86_64')
    expect(screen.getByTestId('remote-tools-env')).toHaveTextContent(rt.env.wsl)
  })

  test('interop-only codex: explains the Windows shadow and offers the Linux install', async () => {
    await renderPanel({ detect: ok(WSL_REPORT) })
    expect(row('codex').getByText(rt.status['interop-only'])).toBeInTheDocument()
    expect(row('codex').getByText(rt.hint.interopOnly)).toBeInTheDocument()
    expect(row('codex').getByRole('button', { name: rt.install })).toBeEnabled()
  })

  test('installed tools have no install button; missing ones do', async () => {
    await renderPanel({ detect: ok(WSL_REPORT) })
    expect(row('git').queryByRole('button', { name: rt.install })).not.toBeInTheDocument()
    expect(row('claude').getByRole('button', { name: rt.install })).toBeEnabled()
    expect(row('gh').getByRole('button', { name: rt.install })).toBeEnabled()
  })

  test('node: no recipe, reason plus docs link', async () => {
    await renderPanel({ detect: ok(WSL_REPORT) })
    expect(row('node').queryByRole('button', { name: rt.install })).not.toBeInTheDocument()
    expect(row('node').getByText(rt.unsupported['no-recipe'], { exact: false })).toBeInTheDocument()
    expect(row('node').getByRole('link', { name: rt.docsLink })).toHaveAttribute('href', 'https://nodejs.org/en/download')
  })

  test('without onInstall no install / update buttons are shown', async () => {
    await renderPanel({ detect: ok(WSL_REPORT), onInstall: undefined })
    expect(screen.queryByRole('button', { name: rt.install })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: rt.update })).not.toBeInTheDocument()
  })

  test('"Check again" runs detect again', async () => {
    const detect = ok(WSL_REPORT)
    await renderPanel({ detect })
    expect(detect).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: rt.recheck }))
    await waitFor(() => expect(screen.getByRole('button', { name: rt.recheck })).toBeEnabled())
    expect(detect).toHaveBeenCalledTimes(2)
  })
})

describe('RemoteToolsPanel — Alpine root', () => {
  test('rg is required on musl', async () => {
    await renderPanel({ detect: ok(ALPINE_ROOT_REPORT) })
    expect(groupOf('rg')).toBe('required')
    expect(screen.getByTestId('remote-tools-env')).toHaveTextContent(rt.env.musl)
    expect(screen.getByTestId('remote-tools-env')).toHaveTextContent(rt.privilege.root)
  })

  test('curl missing does not block install.sh on apk (the recipe installs curl)', async () => {
    await renderPanel({ detect: ok(ALPINE_ROOT_REPORT) })
    expect(row('claude').getByRole('button', { name: rt.install })).toBeEnabled()
    expect(row('claude').queryByText(rt.hint.curlMissing)).not.toBeInTheDocument()
  })

  test('gh: confirm dialog warns that the package is unofficial', async () => {
    await renderPanel({ detect: ok(ALPINE_ROOT_REPORT) })
    fireEvent.click(row('gh').getByRole('button', { name: rt.install }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(rt.confirm.unofficial)).toBeInTheDocument()
    expect(screen.getByTestId('remote-tools-confirm-command')).toHaveTextContent('apk add github-cli')
  })
})

describe('RemoteToolsPanel — macOS', () => {
  test('claude ok: update offered, not emphasized; Keychain → no "credential file absent" hint', async () => {
    await renderPanel({ detect: ok(MAC_REPORT) })
    const update = row('claude').getByRole('button', { name: rt.update })
    expect(update).not.toHaveClass('primary')
    expect(row('claude').getByText(rt.login.unknown)).toBeInTheDocument()
    expect(row('claude').queryByText(rt.login.credentialFileAbsent)).not.toBeInTheDocument()
  })

  test('login button only with onLogin, and only for tools that are not logged in', async () => {
    const onLogin = vi.fn()
    await renderPanel({ detect: ok(MAC_REPORT), onLogin })
    expect(row('codex').getByText(rt.login.loggedOut)).toBeInTheDocument()
    fireEvent.click(row('codex').getByRole('button', { name: rt.login.button }))
    expect(onLogin).toHaveBeenCalledWith('codex')
    // gh is missing → login is n/a → no login state, no button.
    expect(row('gh').queryByRole('button', { name: rt.login.button })).not.toBeInTheDocument()
    expect(row('gh').queryByText(rt.login.loggedOut)).not.toBeInTheDocument()
  })

  test('login state without onLogin has no button', async () => {
    await renderPanel({ detect: ok(MAC_REPORT) })
    expect(screen.queryByRole('button', { name: rt.login.button })).not.toBeInTheDocument()
  })

  test('not-on-path: suggests a new terminal tab', async () => {
    await renderPanel({ detect: ok(MAC_REPORT) })
    expect(row('rg').getByText(rt.status['not-on-path'])).toBeInTheDocument()
    expect(row('rg').getByText(rt.hint.notOnPath)).toBeInTheDocument()
    expect(row('rg').queryByRole('button', { name: rt.install })).not.toBeInTheDocument()
  })

  test('server view unavailable: one panel note, no per-row server badge', async () => {
    await renderPanel({ detect: ok(MAC_REPORT) })
    expect(screen.getByText(rt.server.viewUnavailable)).toBeInTheDocument()
    expect(screen.queryByText(rt.server.visible)).not.toBeInTheDocument()
    expect(screen.queryByText(rt.server.hidden)).not.toBeInTheDocument()
  })

  test('brew install for gh', async () => {
    await renderPanel({ detect: ok(MAC_REPORT) })
    fireEvent.click(row('gh').getByRole('button', { name: rt.install }))
    expect(screen.getByTestId('remote-tools-confirm-command')).toHaveTextContent(/^brew install gh$/)
  })
})

describe('RemoteToolsPanel — everything missing (slim Debian, root)', () => {
  test('curl missing disables the install.sh tools with a hint', async () => {
    await renderPanel({ detect: ok(ALL_MISSING_REPORT) })
    for (const id of ['claude', 'codex', 'uv'] as const) {
      expect(row(id).getByRole('button', { name: rt.install })).toBeDisabled()
      expect(row(id).getByText(rt.hint.curlMissing)).toBeInTheDocument()
    }
  })

  test('package-manager tools stay installable, without sudo as root', async () => {
    await renderPanel({ detect: ok(ALL_MISSING_REPORT) })
    const git = row('git').getByRole('button', { name: rt.install })
    expect(git).toBeEnabled()
    fireEvent.click(git)
    expect(screen.getByTestId('remote-tools-confirm-command')).toHaveTextContent(/^apt-get update && apt-get install -y git$/)
    expect(screen.getByText(rt.confirm.sudoNo)).toBeInTheDocument()
  })

  test('curl / bash have no recipe', async () => {
    await renderPanel({ detect: ok(ALL_MISSING_REPORT) })
    expect(row('curl').getByText(rt.unsupported['no-recipe'])).toBeInTheDocument()
    expect(row('bash').getByText(rt.unsupported['no-recipe'])).toBeInTheDocument()
  })
})

describe('RemoteToolsPanel — other statuses and unsupported reasons', () => {
  test('claude too-old: emphasized update + hint; update plan is buildUpdatePlan', async () => {
    const report = makeReport({}, {
      claude: { status: 'too-old', path: '/home/u/.local/bin/claude', version: '2.1.113', login: 'loggedIn' },
      curl: { status: 'ok' },
    })
    const { onInstall } = await renderPanel({ detect: ok(report) })
    expect(row('claude').getByText(rt.status['too-old'])).toBeInTheDocument()
    expect(row('claude').getByText(rt.hint.tooOld)).toBeInTheDocument()
    const update = row('claude').getByRole('button', { name: rt.update })
    expect(update).toHaveClass('primary')
    fireEvent.click(update)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: rt.confirm.confirmUpdate }))
    expect(onInstall).toHaveBeenCalledWith(buildUpdatePlan('claude', report.env))
  })

  test('error status: version hint, no install', async () => {
    const report = makeReport({}, { gh: { status: 'error', path: '/usr/bin/gh' } })
    await renderPanel({ detect: ok(report) })
    expect(row('gh').getByText(rt.status.error)).toBeInTheDocument()
    expect(row('gh').getByText(rt.hint.versionError)).toBeInTheDocument()
    expect(row('gh').queryByRole('button', { name: rt.install })).not.toBeInTheDocument()
  })

  test('sudo-missing: package installs are unsupported with the reason', async () => {
    const report = makeReport({ privilege: 'sudo-missing' }, { curl: { status: 'ok' } })
    await renderPanel({ detect: ok(report) })
    expect(row('git').getByText(rt.unsupported['needs-root-no-sudo'], { exact: false })).toBeInTheDocument()
    expect(row('git').queryByRole('button', { name: rt.install })).not.toBeInTheDocument()
    // install.sh tools need no sudo.
    expect(row('claude').getByRole('button', { name: rt.install })).toBeEnabled()
  })

  test('malformed env: install actions disabled with an error', async () => {
    const report = makeReport({ pkgManager: 'apt; rm -rf ~' as never }, {})
    await renderPanel({ detect: ok(report) })
    expect(screen.getByText(rt.error.invalidReport)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: rt.install })).not.toBeInTheDocument()
  })

  test('auth env vars are listed by name only', async () => {
    const report = makeReport({ authEnv: { ...NO_AUTH_ENV, ANTHROPIC_API_KEY: true, GH_TOKEN: true } }, {})
    await renderPanel({ detect: ok(report) })
    expect(screen.getByTestId('remote-tools-env')).toHaveTextContent('ANTHROPIC_API_KEY, GH_TOKEN')
  })
})

describe('RemoteToolsPanel — detect errors', () => {
  test('old server (thrown "No handler for channel") → redeploy message', async () => {
    await renderPanel({ detect: vi.fn(async () => { throw OLD_SERVER_ERROR }) })
    expect(screen.getByRole('alert')).toHaveTextContent(rt.error['server-too-old'])
    expect(screen.queryByTestId('remote-tools-env')).not.toBeInTheDocument()
  })

  test('old server reported as a result', async () => {
    await renderPanel({ detect: vi.fn(async () => ({ ok: false as const, errorCode: 'spawn-failed' as const, error: OLD_SERVER_ERROR.message })) })
    expect(screen.getByRole('alert')).toHaveTextContent(rt.error['server-too-old'])
  })

  test.each(['host-platform', 'spawn-failed', 'timeout', 'no-markers'] as const)('errorCode %s → its message and the raw detail', async (errorCode) => {
    await renderPanel({ detect: vi.fn(async () => ({ ok: false as const, errorCode, error: `detail-${errorCode}` })) })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(rt.error[errorCode])
    expect(alert).toHaveTextContent(`detail-${errorCode}`)
  })

  test('unknown errorCode / other thrown errors → generic failure', async () => {
    await renderPanel({ detect: vi.fn(async () => ({ ok: false, errorCode: 'from-the-future', error: 'x' }) as unknown as RemoteToolsDetectResult) })
    expect(screen.getByRole('alert')).toHaveTextContent(rt.error.detectFailed)
  })

  test('a stale probe result does not overwrite a newer one', async () => {
    let resolveFirst: (r: RemoteToolsDetectResult) => void = () => {}
    const first = vi.fn(() => new Promise<RemoteToolsDetectResult>((resolve) => { resolveFirst = resolve }))
    const second = ok(WSL_REPORT)
    const { rerender } = render(<RemoteToolsPanel host="profile" detect={first} />)
    // A new `detect` (e.g. another profile) starts a new probe while the first is still pending.
    rerender(<RemoteToolsPanel host="profile" detect={second} />)
    await waitFor(() => expect(screen.getByTestId('remote-tools-env')).toBeInTheDocument())
    await act(async () => { resolveFirst({ ok: false, errorCode: 'timeout', error: 'stale' }) })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByTestId('remote-tools-env')).toBeInTheDocument()
  })
})

describe('InstallConfirmDialog', () => {
  const ubuntuEnv: RecipeEnv = { osFamily: 'linux', pkgManager: 'apt', privilege: 'password-required', musl: false }

  test('panel → dialog shows exactly the buildInstallPlan command; confirm passes that plan', async () => {
    const { onInstall } = await renderPanel({ detect: ok(WSL_REPORT) })
    fireEvent.click(row('claude').getByRole('button', { name: rt.install }))
    const expected = plan(buildInstallPlan('claude', WSL_REPORT.env))
    expect(screen.getByTestId('remote-tools-confirm-command').textContent).toBe(expected.command)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: rt.confirm.confirmInstall }))
    expect(onInstall).toHaveBeenCalledTimes(1)
    expect(onInstall).toHaveBeenCalledWith(expected)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('the gh apt command is rendered verbatim', async () => {
    await renderPanel({ detect: ok(WSL_REPORT) })
    fireEvent.click(row('gh').getByRole('button', { name: rt.install }))
    expect(screen.getByTestId('remote-tools-confirm-command').textContent).toBe(plan(buildInstallPlan('gh', WSL_REPORT.env)).command)
  })

  test('cancel, Escape and overlay click do not call onInstall', async () => {
    const { onInstall } = await renderPanel({ detect: ok(WSL_REPORT) })
    fireEvent.click(row('claude').getByRole('button', { name: rt.install }))
    fireEvent.click(screen.getByRole('button', { name: en.common.cancel }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(row('claude').getByRole('button', { name: rt.install }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(row('claude').getByRole('button', { name: rt.install }))
    fireEvent.click(document.querySelector('.dialog-overlay')!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    expect(onInstall).not.toHaveBeenCalled()
  })

  test('install.sh plan: docs + script links, integrity, location, no sudo, notes', () => {
    const p = plan(buildInstallPlan('claude', ubuntuEnv))
    const onOpenUrl = vi.fn()
    render(<InstallConfirmDialog plan={p} host="profile" onConfirm={vi.fn()} onCancel={vi.fn()} onOpenUrl={onOpenUrl} />)
    expect(screen.getByRole('heading')).toHaveTextContent('Install Claude Code')
    expect(screen.getByRole('link', { name: rt.confirm.docs })).toHaveAttribute('href', p.docsUrl)
    const script = screen.getByRole('link', { name: rt.confirm.viewScript })
    expect(script).toHaveAttribute('href', 'https://claude.ai/install.sh')
    fireEvent.click(script)
    expect(onOpenUrl).toHaveBeenCalledWith('https://claude.ai/install.sh')
    expect(screen.getByText(rt.integrity.claudeManifestSha256)).toBeInTheDocument()
    expect(screen.getByText(rt.confirm.integrityScriptNote)).toBeInTheDocument()
    expect(screen.getByText(rt.location.userLocalBin, { exact: false })).toBeInTheDocument()
    expect(screen.getByText('~/.local/bin/claude')).toBeInTheDocument()
    expect(screen.getByText(rt.confirm.sudoNo)).toBeInTheDocument()
    expect(screen.getByText(rt.note.reopenTerminalForPath)).toBeInTheDocument()
    expect(screen.queryByText(rt.confirm.unofficial)).not.toBeInTheDocument()
    expect(screen.getByText(rt.confirm.runsInRemoteWindow, { exact: false })).toBeInTheDocument()
  })

  test('without onOpenUrl links open in a new window (routed to the browser)', () => {
    const p = plan(buildInstallPlan('uv', ubuntuEnv))
    render(<InstallConfirmDialog plan={p} host="wizard" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const docs = screen.getByRole('link', { name: rt.confirm.docs })
    expect(docs).toHaveAttribute('target', '_blank')
    expect(docs).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('sudo plan: sudo yes + password hint; remote-window host copy', () => {
    const p = plan(buildInstallPlan('git', ubuntuEnv))
    render(<InstallConfirmDialog plan={p} host="remote-window" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText(rt.confirm.sudoYes)).toBeInTheDocument()
    expect(screen.getByText(rt.confirm.runsHere, { exact: false })).toHaveTextContent(rt.confirm.sudoPasswordHint)
    expect(screen.queryByRole('link', { name: rt.confirm.viewScript })).not.toBeInTheDocument()
    expect(screen.queryByText(rt.confirm.integrityScriptNote)).not.toBeInTheDocument()
  })

  test('Alpine claude: prerequisites listed, Alpine note shown', () => {
    const p = plan(buildInstallPlan('claude', { osFamily: 'linux', pkgManager: 'apk', privilege: 'root', musl: true }))
    render(<InstallConfirmDialog plan={p} host="profile" onConfirm={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText(rt.confirm.prerequisites)).toBeInTheDocument()
    expect(screen.getByText('apk add bash curl libgcc libstdc++ ripgrep')).toBeInTheDocument()
    expect(screen.getByText(rt.note.alpineUseSystemRipgrep)).toBeInTheDocument()
  })

  test('copy button copies the command', async () => {
    const p = plan(buildInstallPlan('codex', ubuntuEnv))
    const copyText = vi.fn(async () => {})
    render(<InstallConfirmDialog plan={p} host="profile" onConfirm={vi.fn()} onCancel={vi.fn()} copyText={copyText} />)
    fireEvent.click(screen.getByRole('button', { name: rt.confirm.copy }))
    expect(copyText).toHaveBeenCalledWith(p.command)
    await screen.findByRole('button', { name: rt.confirm.copied })
  })

  test('confirm hands over the plan object; cancel never confirms', () => {
    const p = plan(buildInstallPlan('rg', ubuntuEnv))
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(<InstallConfirmDialog plan={p} host="profile" onConfirm={onConfirm} onCancel={onCancel} />)
    fireEvent.click(screen.getByRole('button', { name: en.common.cancel }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: rt.confirm.confirmInstall }))
    expect(onConfirm).toHaveBeenCalledWith(p)
  })
})
