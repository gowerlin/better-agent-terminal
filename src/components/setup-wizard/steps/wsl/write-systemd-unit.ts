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
      const warning = `Unable to enable linger automatically: ${lingerResult.error}`
      if (!ctx.warnings.includes(warning)) {
        ctx.warnings.push(warning)
      }
    }

    const startResult = await window.electronAPI.wslSystemd.startService(ctx.wslDistro, SERVICE_NAME, {
      dataDir: DATA_DIR,
    })
    if (!startResult.ok) {
      throw new Error(startResult.error)
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
