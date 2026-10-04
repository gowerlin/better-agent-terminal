import type { WizardStep } from '../../wizard-runner'
import { DOCKER_OWNERSHIP_KEYS } from './ownership'

/**
 * Docker install-bundle step：image-based distribution（PLAN-031 D096）
 *
 * Docker server bundle 由 image build pipeline 內建（image 路徑 `/opt/bat-server`），
 * 不走 PLAN-031 distributor（cache → baseline → download）。
 *
 * v1 不做 distributor fallback；image build 時若失敗即 image 不可用，
 * 使用者透過 docker pull / docker build 重新取得。
 *
 * 對齊 WSL/SSH source 標記：本 step 標 `ctx.state.bundleSource = 'image-baked'`
 * 方便後續 e2e 與診斷一致。
 */
export const installDockerServerBundleStep: WizardStep = {
  id: 'install-server-bundle',
  title: 'Verify BAT server bundle',
  appliesTo: ['docker-linux'],
  retryable: true,
  labelKey: 'wizard.docker.step.installBundle.label',
  descriptionKey: 'wizard.docker.step.installBundle.description',
  groupKey: 'wizard.group.deployment',
  editableFromFailure: false,
  async run(ctx) {
    // T0426 (BUG-099): serverInstallPath is this step's own output and gates
    // rollback. Clear it so a failed re-run (e.g. after a jump back) is not
    // rolled back with the path from an earlier attempt.
    ctx.serverInstallPath = undefined
    // T0444 (BUG-111): the bundle is baked into the image — this step only
    // verifies it and never writes into the container, so it owns nothing
    // that rollback could remove.
    ctx.state[DOCKER_OWNERSHIP_KEYS.bundleInstalled] = false
    const mode = ctx.state.containerMode
    const image = typeof ctx.state.dockerImage === 'string' ? ctx.state.dockerImage : 'bat-server:latest'
    if (mode === 'new') {
      ctx.serverInstallPath = '/opt/bat-server'
      ctx.logger.info(`Docker image ${image} will provide the BAT server bundle.`)
      ctx.state.bundleSource = 'image-baked'
      return
    }

    if (mode !== 'existing' || typeof ctx.state.dockerContainer !== 'string') {
      throw new Error('Choose a Docker container before validating the BAT server bundle.')
    }

    const inspection = await window.electronAPI.docker.inspectContainer(ctx.state.dockerContainer)
    if (!inspection.image) throw new Error(`Unable to inspect Docker container ${ctx.state.dockerContainer}.`)

    ctx.serverInstallPath = '/opt/bat-server'
    const warning = `Existing container ${ctx.state.dockerContainer} must already contain /opt/bat-server.`
    if (!ctx.warnings.includes(warning)) ctx.warnings.push(warning)
    ctx.state.bundleSource = 'image-baked'
  },
  // PLAN-007 T0289 — RFC C-3 best-effort rollback, narrowed by T0444
  // (BUG-111): remove the install path only when this run installed it
  // (`dockerBundleInstalledByWizard === true`). run() never does today — the
  // bundle comes from the image — so /opt/bat-server inside a user's existing
  // container is never deleted. "new" mode needs nothing here: the container
  // this run created is removed by start-server / pick-container rollback.
  async rollback(ctx) {
    const installed = ctx.state[DOCKER_OWNERSHIP_KEYS.bundleInstalled]
    if (installed !== true) {
      if (installed === undefined && ctx.state.containerMode === 'existing') {
        ctx.logger.warn('Not removing the BAT install path: this setup run did not record installing it.')
      }
      return
    }
    if (typeof ctx.state.dockerContainer !== 'string' || !ctx.serverInstallPath) return
    const result = await window.electronAPI.docker.execCommand(ctx.state.dockerContainer, [
      'rm',
      '-rf',
      ctx.serverInstallPath,
    ])
    if (!result.ok) {
      ctx.logger.warn(`Failed to clean BAT install path inside container ${ctx.state.dockerContainer}: ${result.error}`)
      return
    }
    ctx.serverInstallPath = undefined
    ctx.state[DOCKER_OWNERSHIP_KEYS.bundleInstalled] = false
  },
}
