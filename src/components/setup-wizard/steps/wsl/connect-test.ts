import type { WizardStep } from '../../wizard-runner'

export const connectTestStep: WizardStep = {
  id: 'connect-test',
  title: 'Verify remote connection',
  appliesTo: 'all',
  retryable: true,
  async run(ctx) {
    if (ctx.systemdServiceActive === false || !ctx.fingerprint) {
      ctx.connectTestSkipped = true
      ctx.serverMetadata = null
      return
    }

    if (!ctx.remoteToken) {
      throw new Error('Remote server token was not available after starting the BAT service.')
    }

    let lastError: string | null = null
    const port = ctx.serverPort ?? 9876
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
