import type { WizardContext, WizardStep } from '../../wizard-runner'
import { resolveWslHome } from './install-server-bundle'

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
async function resolveServerPort(ctx: WizardContext): Promise<number> {
  const preferred = typeof ctx.state.serverPort === 'number' ? ctx.state.serverPort : undefined
  const result = await window.electronAPI.wsl.pickServerPort(preferred)
  if (!result.ok) {
    throw Object.assign(new Error(result.error), { code: result.errorCode })
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
    if (!ctx.wslDistro) {
      throw new Error('Select a WSL distro before configuring the BAT service.')
    }
    if (!ctx.serverInstallPath) {
      throw new Error('Install the BAT server bundle before configuring the BAT service.')
    }

    const port = await resolveServerPort(ctx)
    ctx.serverPort = port

    if (ctx.wslSystemdEnabled === false) {
      ctx.systemdServiceActive = false
      ctx.fallbackStartHint = `wsl -d ${ctx.wslDistro} -- ${ctx.serverInstallPath}/bin/bat-server --port ${port}`
      ctx.remoteToken = undefined
      return
    }

    const installPath = assertAbsoluteInstallPath(ctx)
    const { dataDir, unitPath } = buildWslServicePaths(await resolveWslHome(ctx, ctx.wslDistro))
    const execStart = `${installPath}/bin/bat-server`
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
  async rollback(ctx) {
    if (!ctx.wslDistro) {
      return
    }
    const unitPath = ctx.wslHome ? buildWslServicePaths(ctx.wslHome).unitPath : LEGACY_UNIT_PATH
    await window.electronAPI.wslSystemd.removeUnit(ctx.wslDistro, SERVICE_NAME, { path: unitPath })
    ctx.systemdServiceActive = false
    // T0384: drop the wizard pin; main keeps holding if a profile still uses the distro.
    try {
      await window.electronAPI.wsl.releaseKeepAlive(ctx.wslDistro)
    } catch (err) {
      ctx.logger.warn(`WSL keep-alive release for ${ctx.wslDistro} failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },
}
