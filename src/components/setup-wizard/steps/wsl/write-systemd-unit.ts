import type { WizardStep } from '../../wizard-runner'

const SERVICE_NAME = 'bat-server.service'
const DATA_DIR = '~/.local/share/bat-server'
const UNIT_PATH = '~/.config/systemd/user/bat-server.service'

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

    const port = typeof ctx.state.serverPort === 'number' ? ctx.state.serverPort : (ctx.serverPort ?? 9876)
    ctx.serverPort = port

    if (ctx.wslSystemdEnabled === false) {
      ctx.systemdServiceActive = false
      ctx.fallbackStartHint = `wsl -d ${ctx.wslDistro} -- ${ctx.serverInstallPath}/bin/bat-server --port ${port}`
      ctx.remoteToken = undefined
      return
    }

    const execStart = `${ctx.serverInstallPath}/bin/bat-server`
    const writeResult = await window.electronAPI.wslSystemd.writeUnit(ctx.wslDistro, {
      path: UNIT_PATH,
      execStart,
      description: `BAT headless server for ${profileName(ctx.profileDraft.name)}`,
      environment: {
        BAT_PORT: String(port),
        BAT_SERVER_PORT: String(port),
        BAT_DATA_DIR: DATA_DIR,
        BAT_SERVER_DATA_DIR: DATA_DIR,
      },
    })

    if (!writeResult.ok) {
      throw new Error('Failed to write BAT systemd unit')
    }

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
      dataDir: DATA_DIR,
    })
    if (!startResult.ok) {
      // T0337 (BUG-072): structured errorCode so ErrorMapper Stage 1 distinguishes
      // service-start-timeout (recoverable, journalctl hint) from generic
      // service-start-failed (raw stderr fallback).
      const rawError = startResult.error ?? 'Failed to start bat-server systemd service'
      const err = new Error(rawError) as Error & { code?: string }
      err.code = /timed? out|timeout/i.test(rawError)
        ? 'wsl-service-start-timeout'
        : 'wsl-service-start-failed'
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
    await window.electronAPI.wslSystemd.removeUnit(ctx.wslDistro, SERVICE_NAME, { path: UNIT_PATH })
    ctx.systemdServiceActive = false
  },
}
