import type { WizardContext, WizardStep } from '../../wizard-runner'
import { readWslBundleInstall, resolveWslHome, WSL_SERVICE_START_AFTER_RESTORE_KEY } from './install-server-bundle'

const SERVICE_NAME = 'bat-server.service'
// T0378 (BUG-087 B): relative to the distro user's absolute $HOME. systemd
// never expands `~`, so ExecStart / Environment must be absolute paths.
const DATA_SUBDIR = '.local/share/bat-server'
const UNIT_SUBPATH = '.config/systemd/user/bat-server.service'
const LEGACY_UNIT_PATH = '~/.config/systemd/user/bat-server.service'

export interface WslServicePaths {
  dataDir: string
  unitPath: string
}

export function buildWslServicePaths(home: string): WslServicePaths {
  if (!home.startsWith('/') || home.includes('~')) {
    throw new Error(`Expected an absolute home directory, got ${JSON.stringify(home)}`)
  }
  const base = home.replace(/\/+$/, '')
  return {
    dataDir: `${base}/${DATA_SUBDIR}`,
    unitPath: `${base}/${UNIT_SUBPATH}`,
  }
}

function assertAbsoluteInstallPath(ctx: WizardContext): string {
  const installPath = ctx.serverInstallPath ?? ''
  if (!installPath.startsWith('/')) {
    // A `~/...` path here means install-server-bundle did not run with the
    // T0378 home resolution (e.g. ctx default) — systemd would reject it.
    throw new Error(`BAT server install path must be absolute for systemd, got ${JSON.stringify(installPath)}. Re-run the install step.`)
  }
  return installPath
}

/**
 * T0382 (BUG-091, D128): the WSL server port is chosen on the Windows side so
 * it never collides with the host BAT RemoteServer (Mirrored mode shares
 * localhost -> EADDRINUSE crash-loop). `ctx.state.serverPort` is a port the
 * user asked for and is validated as-is; otherwise main scans for a free one.
 * The result lands in `ctx.serverPort`, which fetch-fingerprint, connect-test
 * and write-profile all read.
 */
async function resolveServerPort(ctx: WizardContext, unitPath: string | null): Promise<number> {
  const preferred = typeof ctx.state.serverPort === 'number' ? ctx.state.serverPort : undefined
  // T0552 (BUG-138): name the unit about to be rewritten; on an upgrade main
  // keeps its port even while the old server still holds it (Mirrored mode
  // made the old server look like a conflict and the port moved).
  const existing = unitPath && ctx.wslDistro
    ? { distro: ctx.wslDistro, unitPath, serviceName: SERVICE_NAME }
    : undefined
  const result = await window.electronAPI.wsl.pickServerPort(preferred, existing)
  if (!result.ok) {
    throw Object.assign(new Error(result.error), { code: result.errorCode })
  }
  if (result.reusedExistingPort) {
    ctx.logger.info(`Keeping port ${result.port} of the existing BAT server in ${ctx.wslDistro}`)
  }
  return result.port
}

/**
 * T0384 (BUG-092, D128): WSL idle-stops a distro ~15s after its last
 * `wsl.exe` connection, taking bat-server with it, so main holds one open from
 * here on (fetch-fingerprint / connect-test run without any wsl.exe). Best
 * effort: a failed pin is logged, never fails the step.
 */
async function holdDistro(ctx: WizardContext, distro: string): Promise<void> {
  try {
    const result = await window.electronAPI.wsl.keepAlive(distro)
    if (!result.ok) {
      ctx.logger.warn(`WSL keep-alive for ${distro} not started: ${result.error}`)
    }
  } catch (err) {
    ctx.logger.warn(`WSL keep-alive for ${distro} not started: ${err instanceof Error ? err.message : String(err)}`)
  }
}

/**
 * T0554 (BUG-141): the unit and service state before this wizard run touched
 * them (taken before the port pick, which may stop the old server). Kept across
 * retries of this step; rollback restores it and drops it.
 */
export const WSL_UNIT_SNAPSHOT_KEY = 'wslUnitSnapshot'

interface WslUnitSnapshot {
  path: string
  /** null: there was no unit file. */
  content: string | null
  active: boolean
  enabled: boolean
}

function readUnitSnapshot(ctx: WizardContext): WslUnitSnapshot | null {
  const snapshot = ctx.state[WSL_UNIT_SNAPSHOT_KEY] as WslUnitSnapshot | undefined
  return snapshot && typeof snapshot.path === 'string' ? snapshot : null
}

async function takeUnitSnapshot(ctx: WizardContext, distro: string, unitPath: string): Promise<void> {
  if (readUnitSnapshot(ctx)) return
  const result = await window.electronAPI.wslSystemd.snapshotUnit(distro, SERVICE_NAME, { path: unitPath })
  if (!result.ok) {
    throw new Error(`Could not read the current BAT service in ${distro} before changing it: ${result.error}`)
  }
  ctx.state[WSL_UNIT_SNAPSHOT_KEY] = {
    path: unitPath,
    content: result.content,
    active: result.active,
    enabled: result.enabled,
  } satisfies WslUnitSnapshot
  if (result.content !== null) {
    ctx.logger.info(`Existing ${SERVICE_NAME} in ${distro}: ${result.active ? 'running' : 'not running'}, ${result.enabled ? 'enabled' : 'disabled'}`)
  }
}

/**
 * T0554: start the previous server again, or leave that to install-server-bundle's
 * rollback when the previous bundle still has to be put back first.
 */
async function startPreviousService(ctx: WizardContext, distro: string, bundleRestorePending: boolean): Promise<void> {
  if (bundleRestorePending) {
    ctx.state[WSL_SERVICE_START_AFTER_RESTORE_KEY] = true
    return
  }
  const result = await window.electronAPI.wslSystemd.restartService(distro, SERVICE_NAME)
  if (!result.ok) ctx.logger.warn(`Failed to start the previous ${SERVICE_NAME} again: ${result.error}`)
}

function profileName(ctxName: unknown): string {
  return typeof ctxName === 'string' && ctxName.trim() ? ctxName.trim() : 'WSL BAT Server'
}

export const writeSystemdUnitStep: WizardStep = {
  id: 'write-systemd-unit',
  title: 'Write BAT systemd user service',
  appliesTo: ['wsl-linux'],
  retryable: true,
  labelKey: 'wizard.wsl.step.writeSystemdUnit.label',
  descriptionKey: 'wizard.wsl.step.writeSystemdUnit.description',
  groupKey: 'wizard.group.deployment',
  editableFromFailure: false,
  async run(ctx) {
    // T0426 (BUG-099): rollback skips while this is false, so a failure before
    // the unit is written never disables a bat-server from an earlier setup.
    // T0554: sticky across retries (an earlier attempt may have written the
    // unit); rollback resets it.
    if (ctx.state.wslUnitWriteStarted !== true) ctx.state.wslUnitWriteStarted = false
    if (!ctx.wslDistro) {
      throw new Error('Select a WSL distro before configuring the BAT service.')
    }
    if (!ctx.serverInstallPath) {
      throw new Error('Install the BAT server bundle before configuring the BAT service.')
    }

    const servicePaths = ctx.wslSystemdEnabled === false
      ? null
      : buildWslServicePaths(await resolveWslHome(ctx, ctx.wslDistro))
    if (servicePaths) await takeUnitSnapshot(ctx, ctx.wslDistro, servicePaths.unitPath)
    const port = await resolveServerPort(ctx, servicePaths?.unitPath ?? null)
    ctx.serverPort = port

    if (!servicePaths) {
      ctx.systemdServiceActive = false
      ctx.fallbackStartHint = `wsl -d ${ctx.wslDistro} -- ${ctx.serverInstallPath}/bin/bat-server --port ${port}`
      ctx.remoteToken = undefined
      return
    }

    const installPath = assertAbsoluteInstallPath(ctx)
    const { dataDir, unitPath } = servicePaths
    const execStart = `${installPath}/bin/bat-server`
    ctx.state.wslUnitWriteStarted = true
    const writeResult = await window.electronAPI.wslSystemd.writeUnit(ctx.wslDistro, {
      path: unitPath,
      execStart,
      description: `BAT headless server for ${profileName(ctx.profileDraft.name)}`,
      environment: {
        BAT_PORT: String(port),
        BAT_SERVER_PORT: String(port),
        BAT_DATA_DIR: dataDir,
        BAT_SERVER_DATA_DIR: dataDir,
      },
    })

    if (!writeResult.ok) {
      throw new Error('Failed to write BAT systemd unit')
    }
    await holdDistro(ctx, ctx.wslDistro)

    const lingerResult = await window.electronAPI.wslSystemd.enableLinger(ctx.wslDistro)
    if (!lingerResult.ok && lingerResult.error) {
      // T0337 (BUG-072): keep ctx.warnings push for debug log, but also throw a
      // structured error so ErrorMapper Stage 1 hits 'wsl-linger-failure' and
      // surfaces the fixed-and-retry / skip / cancel action set. Spec D106:
      // "try linger, fail with manual fix hint + optional fallback".
      const warning = `Unable to enable linger automatically: ${lingerResult.error}`
      if (!ctx.warnings.includes(warning)) {
        ctx.warnings.push(warning)
      }
      const err = new Error(`Could not enable linger: ${lingerResult.error}`) as Error & { code?: string }
      err.code = 'wsl-linger-failed'
      throw err
    }

    const startResult = await window.electronAPI.wslSystemd.startService(ctx.wslDistro, SERVICE_NAME, {
      dataDir,
    })
    if (!startResult.ok) {
      // T0337 (BUG-072): structured errorCode so ErrorMapper Stage 1 distinguishes
      // service-start-timeout (recoverable, journalctl hint) from generic
      // service-start-failed (raw stderr fallback).
      // T0382 (BUG-091): main now classifies the failure itself (journal
      // EADDRINUSE -> wsl-port-in-use); the regex stays as a fallback.
      const rawError = startResult.error ?? 'Failed to start bat-server systemd service'
      const err = new Error(rawError) as Error & { code?: string }
      err.code = startResult.errorCode ?? (/timed? out|timeout/i.test(rawError)
        ? 'wsl-service-start-timeout'
        : 'wsl-service-start-failed')
      throw err
    }

    ctx.systemdServiceActive = true
    if (startResult.token) {
      ctx.remoteToken = startResult.token
    }
  },
  // T0554 (BUG-141): an upgrade puts the previous unit back (content and enabled
  // state) and leaves the service running when it was running before; a first
  // setup removes the unit as before.
  async rollback(ctx) {
    if (!ctx.wslDistro) {
      return
    }
    const snapshot = readUnitSnapshot(ctx)
    delete ctx.state[WSL_UNIT_SNAPSHOT_KEY]
    const bundleRestorePending = readWslBundleInstall(ctx)?.previous === 'kept'
    if (ctx.state.wslUnitWriteStarted === false) {
      // Nothing written, but the port pick may have stopped the previous server.
      if (snapshot?.active) await startPreviousService(ctx, ctx.wslDistro, bundleRestorePending)
      return
    }
    if (snapshot && snapshot.content !== null) {
      const result = await window.electronAPI.wslSystemd.restoreUnit(ctx.wslDistro, SERVICE_NAME, {
        path: snapshot.path,
        content: snapshot.content,
        enabled: snapshot.enabled,
        start: snapshot.active && !bundleRestorePending,
      })
      if (result.ok) {
        ctx.logger.info(`Restored the previous ${SERVICE_NAME} unit`)
        if (snapshot.active && bundleRestorePending) ctx.state[WSL_SERVICE_START_AFTER_RESTORE_KEY] = true
      } else {
        ctx.logger.warn(`Failed to restore the previous ${SERVICE_NAME} unit: ${result.error}`)
      }
    } else {
      const unitPath = ctx.wslHome ? buildWslServicePaths(ctx.wslHome).unitPath : LEGACY_UNIT_PATH
      await window.electronAPI.wslSystemd.removeUnit(ctx.wslDistro, SERVICE_NAME, { path: unitPath })
    }
    ctx.state.wslUnitWriteStarted = false
    ctx.systemdServiceActive = false
    // T0384: drop the wizard pin; main keeps holding if a profile still uses the distro.
    try {
      await window.electronAPI.wsl.releaseKeepAlive(ctx.wslDistro)
    } catch (err) {
      ctx.logger.warn(`WSL keep-alive release for ${ctx.wslDistro} failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
}
