import type { WizardStep } from '../../wizard-runner'

export const connectTestStep: WizardStep = {
  id: 'connect-test',
  title: 'Verify remote connection',
  appliesTo: 'all',
  retryable: true,
  labelKey: 'wizard.shared.step.connectTest.label',
  descriptionKey: 'wizard.shared.step.connectTest.description',
  groupKey: 'wizard.group.verification',
  editableFromFailure: false,
  async run(ctx) {
    if (ctx.systemdServiceActive === false || !ctx.fingerprint) {
      ctx.connectTestSkipped = true
      ctx.serverMetadata = null
      return
    }

    if (!ctx.remoteToken) {
      throw new Error('Remote server token was not available after starting the BAT service.')
    }

    if (ctx.networkMode === 'nat') {
      const warning = 'connect-test is running against localhost while WSL reports NAT mode; mirrored mode is recommended for the best BAT experience.'
      if (!ctx.warnings.includes(warning)) {
        ctx.warnings.push(warning)
      }
    }

    // T0382 (BUG-091): same ctx.serverPort the unit and the profile use. No
    // 9876 fallback — that is the host RemoteServer's default port.
    const port = ctx.serverPort
    if (typeof port !== 'number') {
      throw new Error('Server port was not resolved before the connection test; re-run the service step.')
    }
    let lastError: string | null = null
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await window.electronAPI.remote.testConnection('localhost', port, ctx.remoteToken, ctx.fingerprint)
      if (result.ok) {
        ctx.connectTestSkipped = false
        ctx.serverMetadata = result.metadata ?? null
        return
      }
      lastError = result.error ?? 'Connection test failed'
      await new Promise((resolve) => setTimeout(resolve, 500))
    }

    throw new Error(lastError ?? 'Connection test failed')
  },
}
