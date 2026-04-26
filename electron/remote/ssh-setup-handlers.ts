import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import { logger } from '../logger'
import { listSshHosts } from './ssh-config-parser'
import { probeSshAuth, type SshProbeOptions, type SshProbeResult } from './ssh-auth-probe'
import { uploadServerBundle, type UploadOptions } from './ssh-bundle-uploader'

interface UploadIpcRequest {
  uploadId: string
  options: UploadOptions
}

/**
 * Registers the SSH setup wizard IPC channels.
 *
 * Adds exactly 3 channels in the new `ssh:*` namespace (per T0285 守則 #6 +
 * AC8). Progress for `ssh:upload-bundle` is delivered as `ssh:upload-progress`
 * one-way events via `event.sender.send` — these are not `ipcMain.handle`
 * channels, so they don't count against the AC8 ≤3 budget.
 */
export function registerSshSetupHandlers(ipcMain: IpcMain): void {
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
}
