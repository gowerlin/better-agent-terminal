// @vitest-environment node
/**
 * T0400 (PLAN-036 P1-E): ClaudeAgentManager host DI.
 *
 * - ClaudeAgentManager no longer imports `electron`; the mock below throws on
 *   any property access, so importing / constructing fails if any module in its
 *   import graph reaches for it.
 * - Events go through `deps.emit`.
 * - Completion notifications go through `deps.notifier`, gated by
 *   `deps.getSettings()` (notifyOnComplete / notifyOnlyBackground / notifySound).
 * - `createElectronClaudeEmit` / `createElectronNotifier` keep the pre-DI
 *   window + broadcastHub fan-out and Notification + click-to-focus behaviour.
 */
import * as path from 'path'
import { build, type Plugin } from 'esbuild'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => new Proxy({}, {
  get(_target, prop) {
    throw new Error(`claude-agent-manager must not touch electron (PLAN-036 T0400): electron.${String(prop)}`)
  },
}))

import {
  ClaudeAgentManager,
  createElectronClaudeEmit,
  createElectronNotifier,
  type ClaudeAgentManagerDeps,
  type ClaudeHostWindow,
  type DesktopNotificationApi,
} from '../claude-agent-manager'
import type { HostNotification, HostNotifier } from '../handlers/types'
import { broadcastHub } from '../remote/broadcast-hub'

const PROJECT_ROOT = path.resolve(__dirname, '..', '..')

type NotifyHook = { sendCompletionNotification(session: { cwd: string }, result?: string): void }

const managers: ClaudeAgentManager[] = []
const inheritedAutoUpdater = process.env.DISABLE_AUTOUPDATER

function createManager(deps: ClaudeAgentManagerDeps): ClaudeAgentManager {
  const manager = new ClaudeAgentManager(deps)
  managers.push(manager)
  return manager
}

/** `sendCompletionNotification` is private; the SDK result paths are the only callers. */
function notifyCompletion(manager: ClaudeAgentManager, cwd: string, result?: string) {
  (manager as unknown as NotifyHook).sendCompletionNotification({ cwd }, result)
}

function fakeNotifier(focused = false) {
  const notify = vi.fn<(n: HostNotification) => void>()
  const hasFocusedWindow = vi.fn(() => focused)
  const notifier: HostNotifier = { notify, hasFocusedWindow }
  return { notifier, notify, hasFocusedWindow }
}

function fakeWindow(opts: { destroyed?: boolean; focused?: boolean } = {}) {
  return {
    isDestroyed: vi.fn(() => !!opts.destroyed),
    isFocused: vi.fn(() => !!opts.focused),
    show: vi.fn(),
    focus: vi.fn(),
    webContents: { send: vi.fn() },
  } satisfies ClaudeHostWindow
}

function fakeNotificationApi(supported = true) {
  const instances: Array<{ options: { title: string; body: string; silent?: boolean }; click?: () => void; show: ReturnType<typeof vi.fn> }> = []
  class FakeNotification {
    static isSupported = vi.fn(() => supported)
    show = vi.fn()
    private record: (typeof instances)[number]
    constructor(options: { title: string; body: string; silent?: boolean }) {
      this.record = { options, show: this.show }
      instances.push(this.record)
    }
    on(event: 'click', listener: () => void) {
      if (event === 'click') this.record.click = listener
      return this
    }
  }
  const api: DesktopNotificationApi = FakeNotification
  return { api, instances, isSupported: FakeNotification.isSupported }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  for (const manager of managers.splice(0)) {
    manager.killAll()
    manager.dispose()
  }
  if (inheritedAutoUpdater === undefined) delete process.env.DISABLE_AUTOUPDATER
  else process.env.DISABLE_AUTOUPDATER = inheritedAutoUpdater
})

describe('ClaudeAgentManager without electron (T0400)', () => {
  it('imports and constructs while electron throws on any access', () => {
    const emit = vi.fn()
    const manager = createManager({ emit, getSettings: () => ({}) })
    expect(manager).toBeInstanceOf(ClaudeAgentManager)
    // Pre-DI constructor side effect kept (BUG-059).
    expect(process.env.DISABLE_AUTOUPDATER).toBe('1')
    expect(emit).not.toHaveBeenCalled()
  })

  it('sends events through deps.emit', async () => {
    const emit = vi.fn()
    const hub = vi.spyOn(broadcastHub, 'broadcast')
    const manager = createManager({ emit, getSettings: () => ({}) })

    expect(await manager.sendMessage('missing-session', 'hi')).toBe(false)

    expect(emit).toHaveBeenCalledTimes(1)
    expect(emit).toHaveBeenCalledWith('claude:error', 'missing-session', 'Session not found')
    // The manager no longer broadcasts on its own; mirroring is the emit's job.
    expect(hub).not.toHaveBeenCalled()
  })
})

describe('completion notification via deps (T0400)', () => {
  const cwd = path.join(PROJECT_ROOT, 'some-workspace')

  it('notifies with workspace title, truncated body and silent from notifySound', () => {
    const { notifier, notify } = fakeNotifier()
    const manager = createManager({ emit: vi.fn(), notifier, getSettings: () => ({ notifySound: false }) })

    notifyCompletion(manager, cwd, 'x'.repeat(150))

    expect(notify).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledWith({ title: '✅ some-workspace', body: `${'x'.repeat(100)}...`, silent: true })
  })

  it('defaults the body to "Task completed" and keeps sound on', () => {
    const { notifier, notify } = fakeNotifier()
    const manager = createManager({ emit: vi.fn(), notifier, getSettings: () => ({}) })

    notifyCompletion(manager, cwd)

    expect(notify).toHaveBeenCalledWith({ title: '✅ some-workspace', body: 'Task completed', silent: false })
  })

  it('sends nothing when settings turn notifications off', () => {
    const { notifier, notify, hasFocusedWindow } = fakeNotifier()
    const manager = createManager({ emit: vi.fn(), notifier, getSettings: () => ({ notifyOnComplete: false }) })

    notifyCompletion(manager, cwd, 'done')

    expect(notify).not.toHaveBeenCalled()
    expect(hasFocusedWindow).not.toHaveBeenCalled()
  })

  it('skips while a window is focused unless notifyOnlyBackground is false', () => {
    const background = fakeNotifier(true)
    notifyCompletion(createManager({ emit: vi.fn(), notifier: background.notifier, getSettings: () => ({}) }), cwd, 'done')
    expect(background.hasFocusedWindow).toHaveBeenCalled()
    expect(background.notify).not.toHaveBeenCalled()

    const always = fakeNotifier(true)
    notifyCompletion(createManager({ emit: vi.fn(), notifier: always.notifier, getSettings: () => ({ notifyOnlyBackground: false }) }), cwd, 'done')
    expect(always.hasFocusedWindow).not.toHaveBeenCalled()
    expect(always.notify).toHaveBeenCalledTimes(1)
  })

  it('does nothing (and reads no settings) on a host without a notifier', () => {
    const getSettings = vi.fn(() => ({}))
    const manager = createManager({ emit: vi.fn(), getSettings })

    expect(() => notifyCompletion(manager, cwd, 'done')).not.toThrow()
    expect(getSettings).not.toHaveBeenCalled()
  })

  it('swallows notifier failures', () => {
    const notifier: HostNotifier = { notify: () => { throw new Error('boom') } }
    const manager = createManager({ emit: vi.fn(), notifier, getSettings: () => ({}) })

    expect(() => notifyCompletion(manager, cwd, 'done')).not.toThrow()
  })
})

describe('createElectronClaudeEmit (Electron emit)', () => {
  it('sends to live windows, skips destroyed ones, then mirrors to broadcastHub once', () => {
    const hub = vi.spyOn(broadcastHub, 'broadcast')
    const live = fakeWindow()
    const destroyed = fakeWindow({ destroyed: true })

    const emit = createElectronClaudeEmit(() => [live, destroyed])
    emit('claude:status', 'session-1', { model: 'm' })

    expect(live.webContents.send).toHaveBeenCalledWith('claude:status', 'session-1', { model: 'm' })
    expect(destroyed.webContents.send).not.toHaveBeenCalled()
    expect(hub).toHaveBeenCalledTimes(1)
    expect(hub).toHaveBeenCalledWith('claude:status', 'session-1', { model: 'm' })
  })
})

describe('createElectronNotifier (Electron notifier)', () => {
  it('shows a Notification and focuses the first live window on click', () => {
    const { api, instances } = fakeNotificationApi()
    const destroyed = fakeWindow({ destroyed: true })
    const first = fakeWindow()
    const second = fakeWindow()
    const notifier = createElectronNotifier(api, () => [destroyed, first, second])

    notifier.notify({ title: '✅ ws', body: 'done', silent: true })

    expect(instances).toHaveLength(1)
    expect(instances[0].options).toEqual({ title: '✅ ws', body: 'done', silent: true })
    expect(instances[0].show).toHaveBeenCalledTimes(1)
    expect(first.focus).not.toHaveBeenCalled()

    instances[0].click?.()

    expect(destroyed.show).not.toHaveBeenCalled()
    expect(first.show).toHaveBeenCalledTimes(1)
    expect(first.focus).toHaveBeenCalledTimes(1)
    expect(second.show).not.toHaveBeenCalled()
    expect(second.focus).not.toHaveBeenCalled()
  })

  it('does nothing when the OS has no notification support', () => {
    const { api, instances, isSupported } = fakeNotificationApi(false)
    createElectronNotifier(api, () => [fakeWindow()]).notify({ title: 't', body: 'b' })

    expect(isSupported).toHaveBeenCalled()
    expect(instances).toHaveLength(0)
  })

  it('reports focus only for live focused windows', () => {
    const { api } = fakeNotificationApi()
    const windows: ClaudeHostWindow[] = [fakeWindow(), fakeWindow({ destroyed: true, focused: true })]
    const notifier = createElectronNotifier(api, () => windows)
    expect(notifier.hasFocusedWindow?.()).toBe(false)

    windows.push(fakeWindow({ focused: true }))
    expect(notifier.hasFocusedWindow?.()).toBe(true)
  })

  it('end to end: manager + Electron notifier respects the focused-window gate', () => {
    const { api, instances } = fakeNotificationApi()
    const win = fakeWindow({ focused: true })
    const manager = createManager({
      emit: vi.fn(),
      notifier: createElectronNotifier(api, () => [win]),
      getSettings: () => ({}),
    })

    notifyCompletion(manager, PROJECT_ROOT, 'done')
    expect(instances).toHaveLength(0)

    win.isFocused.mockReturnValue(false)
    notifyCompletion(manager, PROJECT_ROOT, 'done')
    expect(instances).toHaveLength(1)
    instances[0].click?.()
    expect(win.focus).toHaveBeenCalledTimes(1)
  })
})

describe('electron-free import graph', () => {
  // Bundle-level check: inside the repo `import 'electron'` does not throw at
  // import time, so only a resolve-time scan proves the module is headless-safe.
  it('electron/claude-agent-manager.ts never resolves electron', { timeout: 30_000 }, async () => {
    const electronImporters: string[] = []
    const scan: Plugin = {
      name: 't0400-electron-scan',
      setup(b) {
        b.onResolve({ filter: /^electron(\/.*)?$/ }, args => {
          electronImporters.push(path.relative(PROJECT_ROOT, args.importer))
          return { path: args.path, external: true }
        })
        // Third-party packages are not under test; keep native addons out of the bundle.
        b.onResolve({ filter: /^[^./]/ }, args => (
          args.kind === 'entry-point' || path.isAbsolute(args.path) ? undefined : { path: args.path, external: true }
        ))
      },
    }
    await build({
      absWorkingDir: PROJECT_ROOT,
      entryPoints: [path.join(PROJECT_ROOT, 'electron/claude-agent-manager.ts')],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      write: false,
      logLevel: 'silent',
      plugins: [scan],
    })
    expect(electronImporters).toEqual([])
  })
})
