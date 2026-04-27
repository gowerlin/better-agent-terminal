import type { WizardStep } from '../../wizard-runner'
import { getPreflightCached, type WizardPreflightResult } from '../../preflight'

/**
 * T0336 (PLAN-032 Sprint 3, BUG-073): Docker daemon down is now caught by
 * preflight (errorCode='docker-daemon-down', mapped via ErrorMapper Stage 1)
 * so users see the friendly "downloads" action instead of waiting for
 * step.run() to surface the raw pipe/docker_engine stderr. The run() docker
 * branch keeps the same throw as defensive fallback when preflight is
 * bypassed.
 */
export const detectEnvStep: WizardStep = {
  id: 'detect-env',
  title: 'Detect target environment',
  appliesTo: 'all',
  retryable: true,
  labelKey: 'wizard.shared.step.detectEnv.label',
  descriptionKey: 'wizard.shared.step.detectEnv.description',
  groupKey: 'wizard.group.detection',
  editableFromFailure: false,
  async preflight(ctx): Promise<WizardPreflightResult> {
    if (ctx.targetOS === 'docker-linux') {
      const cacheKey = 'docker-daemon-status'
      const cached = ctx.preflightCache
        ? getPreflightCached(ctx.preflightCache, cacheKey)
        : undefined
      if (cached) return cached

      const status = await window.electronAPI.docker.status()
      if (status.available) {
        return { ok: true, cacheKey, ttlMs: 30_000 }
      }
      return {
        ok: false,
        reason: status.error || 'Docker is not available on this machine.',
        errorCode: 'docker-daemon-down',
        cacheKey,
        ttlMs: 5_000,
      }
    }

    // T0337 (PLAN-032 Sprint 3, BUG-072): WSL preflight — fail-fast when WSL2
    // is not installed on a Windows host so the user sees the install link
    // instead of the wsl-cli ENOENT raw stderr from step.run(). systemd /
    // distro state checks stay in step.run() because they are cheap and need
    // wslDistro context not yet picked.
    if (ctx.targetOS === 'wsl-linux') {
      if (window.electronAPI.platform !== 'win32') {
        return {
          ok: false,
          reason: 'WSL setup is only available from the Windows BAT client.',
          errorCode: 'wsl-not-on-windows',
        }
      }

      const cacheKey = 'wsl-list-status'
      const cached = ctx.preflightCache
        ? getPreflightCached(ctx.preflightCache, cacheKey)
        : undefined
      if (cached) return cached

      try {
        await window.electronAPI.wsl.list()
        // WSL install state changes infrequently — 60s TTL.
        return { ok: true, cacheKey, ttlMs: 60_000 }
      } catch (error) {
        return {
          ok: false,
          reason: `Unable to detect WSL: ${error instanceof Error ? error.message : String(error)}`,
          errorCode: 'wsl-not-installed',
          cacheKey,
          ttlMs: 5_000,
        }
      }
    }

    return { ok: true }
  },
  async run(ctx) {
    if (ctx.targetOS === 'docker-linux') {
      const status = await window.electronAPI.docker.status()
      if (!status.available) {
        const err = new Error(
          status.error || 'Docker is not available on this machine.',
        ) as Error & { code?: string }
        err.code = 'docker-daemon-down'
        throw err
      }
      ctx.logger.info(`Docker detected (${status.version ?? 'version unknown'}).`)
      return
    }

    if (window.electronAPI.platform !== 'win32') {
      throw new Error('WSL setup is only available from the Windows BAT client.')
    }

    try {
      await window.electronAPI.wsl.list()
    } catch (error) {
      throw new Error(
        `Unable to detect WSL. Install WSL2 first, then retry. ${error instanceof Error ? error.message : String(error)}`,
      )
    }

    ctx.logger.info('WSL environment detected.')
  },
}