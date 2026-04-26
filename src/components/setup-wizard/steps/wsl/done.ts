import type { WizardStep } from '../../wizard-runner'

export const doneStep: WizardStep = {
  id: 'done',
  title: 'Finalize setup',
  appliesTo: 'all',
  retryable: false,
  async run(ctx) {
    if (ctx.systemdServiceActive === false && ctx.fallbackStartHint) {
      const warning = `systemd is unavailable; use the fallback command: ${ctx.fallbackStartHint}`
      if (!ctx.warnings.includes(warning)) {
        ctx.warnings.push(warning)
      }
    }

    if (ctx.serverMetadata) {
      ctx.logger.info(
        `Remote server ready (${ctx.serverMetadata.serverPlatform}/${ctx.serverMetadata.serverArch}, Node ${ctx.serverMetadata.nodeVersion})`,
      )
    }
  },
}
