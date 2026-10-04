/**
 * T0412 (PLAN-037 E): runs remote-tool installs in this window (mounted once, in App).
 *
 * - A `host: 'remote-window'` tools panel fires `REMOTE_TOOL_INSTALL_HERE_EVENT`
 *   (`requestRemoteToolInstallHere`) — the install runs here, main is not involved.
 *
 * The flow itself is `runRemoteToolInstall` (src/lib/remote-tools/install-runner.ts); this hook
 * supplies the window's stores, PTY API and toasts.
 */
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ToastMessage } from '../components/CtToast'
import { createPtyThenLaunch, normalizePtyCreateResult } from '../lib/pty-replay'
import {
  parseRemoteToolInstallTarget,
  probeRemoteHome,
  REMOTE_TOOL_INSTALL_HERE_EVENT,
  runRemoteToolInstall,
  type InstallNotice,
  type InstallRunnerDeps,
  type InstallWorkspace,
  type RemoteToolInstallTarget,
} from '../lib/remote-tools/install-runner'
import { settingsStore } from '../stores/settings-store'
import { workspaceStore } from '../stores/workspace-store'
import type { EnvVariable } from '../types'

/** Workspace created at the remote `$HOME` when the window has none to host the install tab. */
export const BAT_TOOLS_WORKSPACE_NAME = 'BAT Tools'

const NOTICE_DURATION_MS = 10_000

type AddToast = (text: string, type?: ToastMessage['type'], duration?: number) => void
type Translate = (key: string, options?: Record<string, unknown>) => string

/** `fooKey: 'i18n.key'` params are translated and passed as `foo`. */
export function translateInstallNotice(notice: InstallNotice, t: Translate): string {
  const params: Record<string, string> = {}
  for (const [name, value] of Object.entries(notice.params ?? {})) {
    if (name.endsWith('Key') && name.length > 3) params[name.slice(0, -3)] = t(value)
    else params[name] = value
  }
  return t(notice.key, params)
}

// Same merge as WorkspaceView's terminals: global vars, then workspace vars override.
function mergeEnvVars(global: EnvVariable[] = [], workspace: EnvVariable[] = []): Record<string, string> {
  const result: Record<string, string> = {}
  for (const env of [...global, ...workspace]) {
    if (env.enabled && env.key) result[env.key] = env.value
  }
  return result
}

async function getShellFromSettings(): Promise<string | undefined> {
  const settings = settingsStore.getSettings()
  if (settings.shell === 'custom' && settings.customShellPath) return settings.customShellPath
  return window.electronAPI.settings.getShellPath(settings.shell)
}

/** Active workspace, else the first unarchived one, else "BAT Tools" at the remote `$HOME`. */
async function ensureInstallWorkspace(): Promise<InstallWorkspace | null> {
  const pick = (): InstallWorkspace | null => {
    const state = workspaceStore.getState()
    const active = state.workspaces.find(w => w.id === state.activeWorkspaceId && !w.archived)
    return active ?? workspaceStore.getActiveWorkspaces()[0] ?? null
  }
  const existing = pick()
  if (existing) return existing

  const pty = window.electronAPI.pty
  const home = await probeRemoteHome({
    createPty: async (options) => normalizePtyCreateResult(await pty.create(options)),
    write: (id, data) => { void pty.write(id, data) },
    kill: (id) => { void pty.kill(id) },
    onOutput: (cb) => pty.onOutput(cb),
  })
  // A workspace may have appeared while the probe ran.
  const appeared = pick()
  if (appeared) return appeared
  if (!home) return null
  const workspace = workspaceStore.addWorkspace(BAT_TOOLS_WORKSPACE_NAME, home)
  void workspaceStore.save()
  window.electronAPI?.debug?.log(`[T0412] created workspace "${BAT_TOOLS_WORKSPACE_NAME}" at ${home}`)
  return workspace
}

export function useRemoteToolInstall({ addToast }: { addToast: AddToast }): {
  runInstall(target: RemoteToolInstallTarget): void
} {
  const { t } = useTranslation()
  const tRef = useRef<Translate>(t)
  tRef.current = t
  const addToastRef = useRef(addToast)
  addToastRef.current = addToast

  const runInstall = useCallback((target: RemoteToolInstallTarget) => {
    const translate: Translate = (key, options) => tRef.current(key, options)
    const pty = window.electronAPI.pty
    const deps: InstallRunnerDeps = {
      detectHere: () => window.electronAPI.remoteTools.detectHere(),
      ensureWorkspace: ensureInstallWorkspace,
      resolveShell: getShellFromSettings,
      addTerminal: (workspaceId, plan) => {
        workspaceStore.setActiveWorkspace(workspaceId)
        // 🔴 No agentPreset: claude-cli* presets inject DISABLE_UPDATES, which blocks `claude install`.
        const terminal = workspaceStore.addTerminal(workspaceId)
        workspaceStore.renameTerminal(terminal.id, translate(`remoteToolInstall.tabTitle.${plan.kind}`, {
          tool: translate(`remoteTools.tool.${plan.toolId}.name`),
        }))
        workspaceStore.setFocusedTerminal(terminal.id)
        void workspaceStore.save()
        return terminal.id
      },
      createPty: (options, launch) => createPtyThenLaunch(options, launch),
      write: (id, data) => { void pty.write(id, data) },
      onOutput: (cb) => pty.onOutput(cb),
      onExit: (cb) => pty.onExit(cb),
      customEnv: (workspaceId) => {
        const workspace = workspaceStore.getState().workspaces.find(w => w.id === workspaceId)
        return mergeEnvVars(settingsStore.getSettings().globalEnvVars, workspace?.envVars)
      },
      notify: (notice) => addToastRef.current(translateInstallNotice(notice, translate), notice.level, NOTICE_DURATION_MS),
      log: (message) => window.electronAPI?.debug?.log(message),
    }
    runRemoteToolInstall(target, deps)
      .then(start => (start.status === 'started' ? start.done : undefined))
      .catch(err => {
        window.electronAPI?.debug?.log(`[T0412] install ${target.toolId}/${target.kind} failed: ${err instanceof Error ? err.message : String(err)}`)
      })
  }, [])

  // Range 3: the tools panel inside this (remote) window.
  useEffect(() => {
    const handler = (e: Event) => {
      const target = parseRemoteToolInstallTarget((e as CustomEvent<unknown>).detail)
      if (target) runInstall(target)
    }
    window.addEventListener(REMOTE_TOOL_INSTALL_HERE_EVENT, handler)
    return () => window.removeEventListener(REMOTE_TOOL_INSTALL_HERE_EVENT, handler)
  }, [runInstall])

  return { runInstall }
}
