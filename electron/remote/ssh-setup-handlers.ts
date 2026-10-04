import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { logger } from '../logger'
import { listSshHosts } from './ssh-config-parser'
import { probeSshAuth, type SshProbeOptions, type SshProbeResult } from './ssh-auth-probe'
import { uploadServerBundle, type UploadOptions } from './ssh-bundle-uploader'
import {
  startServerOnRemote,
  stopServerOnRemote,
  uninstallBundleOnRemote,
  type SshTeardownResult,
  type StartServerOptions,
  type StartServerResult,
  type StartServerPhase,
  type StopServerOptions,
  type UninstallBundleOptions,
} from './ssh-start-server'
import {
  WizardTunnelRegistry,
  readRemoteServerIdentity,
  type RemoteServerIdentityRequest,
  type RemoteServerIdentityResult,
  type WizardTunnelOpenResult,
  type WizardTunnelRequest,
} from './ssh-wizard-verify'

interface UploadIpcRequest {
  uploadId: string
  options: UploadOptions
}

interface StartServerIpcRequest {
  startId: string
  options: StartServerOptions
}

export interface SshSetupHandlerOptions {
  /** T0387: host RemoteServer ports the wizard tunnel's local end must avoid. */
  reservedPorts?: () => number[]
}

/**
 * T0387 / BUG-093: SSH wizard verification tunnels. Module-level so main can
 * close every one of them on quit (`closeAllSshWizardTunnels`).
 */
let wizardTunnels = new WizardTunnelRegistry()
const hookedSenders = new Set<number>()

export function closeAllSshWizardTunnels(): Promise<void> {
  return wizardTunnels.closeAll()
}

/**
 * Registers the SSH setup wizard IPC channels.
 *
 * Adds exactly 3 channels in the new `ssh:*` namespace (per T0285 守則 #6 +
 * AC8). Progress for `ssh:upload-bundle` is delivered as `ssh:upload-progress`
 * one-way events via `event.sender.send` — these are not `ipcMain.handle`
 * channels, so they don't count against the AC8 ≤3 budget.
 */
export function registerSshSetupHandlers(ipcMain: IpcMain, options: SshSetupHandlerOptions = {}): void {
  wizardTunnels = new WizardTunnelRegistry({ reservedPorts: options.reservedPorts })

  ipcMain.handle('ssh:list-hosts', async (): Promise<string[]> => {
    try {
      return await listSshHosts()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(`[ssh-setup] list-hosts failed: ${message}`)
      return []
    }
  })

  ipcMain.handle('ssh:probe-auth', async (_event: IpcMainInvokeEvent, opts: SshProbeOptions): Promise<SshProbeResult> => {
    try {
      return await probeSshAuth(opts)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`[ssh-setup] probe-auth threw: ${message}`)
      return { ok: false, errorCode: 'unknown', error: message }
    }
  })

  ipcMain.handle('ssh:upload-bundle', async (event: IpcMainInvokeEvent, request: UploadIpcRequest): Promise<{ ok: true } | { ok: false; error: string }> => {
    const { uploadId, options } = request
    try {
      await uploadServerBundle(options, (bytesSent, totalBytes) => {
        try {
          event.sender.send('ssh:upload-progress', { uploadId, bytesSent, totalBytes })
        } catch {
          // renderer may have torn down — swallow to avoid double-fail
        }
      })
      return { ok: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.warn(`[ssh-setup] upload-bundle failed (${uploadId}): ${message}`)
      return { ok: false, error: message }
    }
  })

  // T0286 — ssh:start-server. Lays down the systemd unit / launchd plist,
  // enables it, and verifies the service is up. Progress is delivered via
  // `ssh:start-progress` one-way events (still in `ssh:*` namespace, so the
  // T0270/T0285 channel-set freeze isn't broken).
  ipcMain.handle('ssh:start-server', async (event: IpcMainInvokeEvent, request: StartServerIpcRequest): Promise<StartServerResult> => {
    const { startId, options } = request
    try {
      return await startServerOnRemote(options, (phase: StartServerPhase) => {
        try {
          event.sender.send('ssh:start-progress', { startId, phase })
        } catch {
          // renderer may have torn down — swallow
        }
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`[ssh-setup] start-server threw (${startId}): ${message}`)
      return {
        ok: false,
        method: 'failed',
        servicePath: '',
        error: message,
        errorCode: 'unknown',
      }
    }
  })
  // T0426 / BUG-100 — rollback teardown for start-server / install-server-bundle.
  // Remote commands are fixed strings plus validated paths (ssh-start-server);
  // both are idempotent, so the wizard may call them for a step that only got
  // halfway. Never throws to the renderer.
  ipcMain.handle('ssh:stop-server', async (_event: IpcMainInvokeEvent, request: StopServerOptions): Promise<SshTeardownResult> => {
    try {
      return await stopServerOnRemote(request ?? ({} as StopServerOptions))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`[ssh-setup] stop-server threw: ${message}`)
      return { ok: false, error: message }
    }
  })

  ipcMain.handle('ssh:uninstall-bundle', async (_event: IpcMainInvokeEvent, request: UninstallBundleOptions): Promise<SshTeardownResult> => {
    try {
      return await uninstallBundleOnRemote(request ?? ({} as UninstallBundleOptions))
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`[ssh-setup] uninstall-bundle threw: ${message}`)
      return { ok: false, error: message }
    }
  })

  // T0387 / BUG-093 — SSH wizard verification. tunnel mode: fetch-fingerprint
  // and connect-test go through a short-lived `ssh -L` (closed by the wizard,
  // when the renderer goes away, or on quit). read-server-identity reads the
  // remote certificate fingerprint + token for the cross-check.
  ipcMain.handle('ssh:verify-tunnel-open', async (event: IpcMainInvokeEvent, request: WizardTunnelRequest): Promise<WizardTunnelOpenResult> => {
    const sender = event.sender
    if (!hookedSenders.has(sender.id)) {
      hookedSenders.add(sender.id)
      const senderId = sender.id
      sender.once('destroyed', () => {
        hookedSenders.delete(senderId)
        void wizardTunnels.closeOwnedBy(senderId)
      })
    }
    try {
      return await wizardTunnels.open(request, sender.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`[ssh-setup] verify-tunnel-open threw: ${message}`)
      return { ok: false, errorCode: 'ssh-tunnel-failed', error: message }
    }
  })

  ipcMain.handle('ssh:verify-tunnel-close', async (_event: IpcMainInvokeEvent, sessionId: string): Promise<{ ok: true }> => {
    if (typeof sessionId === 'string') await wizardTunnels.close(sessionId)
    return { ok: true }
  })

  ipcMain.handle('ssh:read-server-identity', async (_event: IpcMainInvokeEvent, request: RemoteServerIdentityRequest): Promise<RemoteServerIdentityResult> => {
    try {
      const result = await readRemoteServerIdentity(request)
      if (!result.ok) logger.warn(`[ssh-setup] read-server-identity failed: ${result.error}`)
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      logger.error(`[ssh-setup] read-server-identity threw: ${message}`)
      return { ok: false, error: message }
    }
  })
}
