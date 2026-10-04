import type { WizardContext } from '../../wizard-runner'

/**
 * T0444 (BUG-111): Docker rollback only undoes what this wizard run did.
 *
 * Each step records ownership in `ctx.state` when it acts; rollback acts only
 * on a matching flag. A missing flag (older state, or ownership could not be
 * determined) means "not ours" — rollback does nothing and warns.
 *
 * Container flags hold the container name, not `true`, so a flag left for one
 * container never authorises touching another (e.g. after jumping back to
 * pick-container and choosing a different one).
 */
export const DOCKER_OWNERSHIP_KEYS = {
  /** Name of the container this run created (`docker run --name`). */
  containerCreated: 'dockerContainerCreatedByWizard',
  /** Name of an existing container this run started (it was stopped before). */
  containerStarted: 'dockerContainerStartedByWizard',
  /** Whether the existing container was running before start-server touched it; unset = unknown. */
  containerWasRunningBefore: 'dockerContainerWasRunningBefore',
  /** Whether install-server-bundle put files into the container itself. */
  bundleInstalled: 'dockerBundleInstalledByWizard',
} as const

export function isContainerCreatedByWizard(ctx: WizardContext, name: string): boolean {
  return Boolean(name) && ctx.state[DOCKER_OWNERSHIP_KEYS.containerCreated] === name
}

export function isContainerStartedByWizard(ctx: WizardContext, name: string): boolean {
  return Boolean(name) && ctx.state[DOCKER_OWNERSHIP_KEYS.containerStarted] === name
}

/** `docker run --name` failed because the name is taken — the container is not ours. */
export function isNameConflictError(error: string | undefined): boolean {
  return typeof error === 'string' && /is already in use/i.test(error)
}

/**
 * Remove a container only when this run created it. Clears the flag on
 * success so a second rollback (failed step + completed steps) is a no-op.
 */
export async function removeContainerIfCreatedByWizard(ctx: WizardContext, name: string): Promise<void> {
  if (!name) return
  if (!isContainerCreatedByWizard(ctx, name)) {
    ctx.logger.warn(`Not removing Docker container ${name}: it was not created by this setup run.`)
    return
  }
  const result = await window.electronAPI.docker.removeContainer(name)
  // Already gone also releases the claim: a later container with this name is
  // not ours.
  if (result && result.ok === false && !/no such container/i.test(result.error ?? '')) {
    ctx.logger.warn(`Failed to remove Docker container ${name}: ${result.error ?? 'unknown error'}`)
    return
  }
  delete ctx.state[DOCKER_OWNERSHIP_KEYS.containerCreated]
}
