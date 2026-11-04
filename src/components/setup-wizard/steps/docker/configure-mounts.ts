import i18next from 'i18next'
import type { WizardContext, WizardStep } from '../../wizard-runner'
import { wizardError } from '../../error-mapper'

type DockerMountRow = { host: string; container: string }

function basename(filePath: string): string {
  const parts = filePath.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || 'workspace'
}

function defaultContainerPath(hostPath: string): string {
  return `/workspace/${basename(hostPath)}`
}

/** T0500: set by resetForEdit; the next run opens the folder picker even if mounts are stored. */
const EDIT_REQUESTED_KEY = 'dockerMountsEditRequested'

/** T0851: answers of the "use the container's mounts" prompt. */
export const DOCKER_MOUNTS_USE_CONTAINER = 'use-container-mounts'
export const DOCKER_MOUNTS_PICK_FOLDER = 'pick-folder'

/**
 * T0851: the host path BAT can open for a bind-mount `Source`. Docker Desktop
 * reports Windows drives as `/run/desktop/mnt/host/<drive>/…` (WSL 2 backend)
 * or `/host_mnt/<drive>/…`, and macOS paths as `/host_mnt/Users/…`. Anything
 * else is returned unchanged.
 */
export function dockerBindSourceToHostPath(source: string, platform: string | undefined): string {
  if (platform === 'win32') {
    const match = /^\/(?:run\/desktop\/mnt\/host|host_mnt)\/([a-zA-Z])(?:\/(.*))?$/.exec(source)
    if (match) return `${match[1].toUpperCase()}:\\${(match[2] ?? '').split('/').filter(Boolean).join('\\')}`
  }
  if (platform === 'darwin' && source.startsWith('/host_mnt/')) return source.slice('/host_mnt'.length)
  return source
}

/**
 * T0851 (PLAN-052 W2): host ↔ container rows of a container's bind mounts
 * (`docker inspect` `Mounts`, `Type: bind`). Volumes, sockets and rows with
 * no source / no absolute destination are left out.
 */
export function bindMountsFromInspect(
  mounts: ReadonlyArray<{ source?: string; destination?: string; type?: string }> | undefined,
  platform: string | undefined,
): DockerMountRow[] {
  const rows: DockerMountRow[] = []
  for (const mount of mounts ?? []) {
    if (mount?.type !== 'bind') continue
    const source = typeof mount.source === 'string' ? mount.source : ''
    const destination = typeof mount.destination === 'string' ? mount.destination : ''
    if (!source || !destination.startsWith('/')) continue
    if (source.endsWith('.sock') || destination.endsWith('.sock')) continue
    rows.push({ host: dockerBindSourceToHostPath(source, platform), container: destination })
  }
  return rows
}

/**
 * T0851: an existing container's own bind mounts, or [] (inspect failed, none,
 * or not usable on this machine — the folder picker then runs as before).
 * Read only: `docker inspect`.
 */
async function readContainerBindMounts(ctx: WizardContext, container: string): Promise<DockerMountRow[]> {
  let rows: DockerMountRow[]
  try {
    const inspected = await window.electronAPI.docker.inspectContainer(container)
    rows = bindMountsFromInspect(inspected?.mounts, window.electronAPI.platform)
  } catch (error) {
    ctx.logger.warn(`Could not read the bind mounts of Docker container ${container}: ${error instanceof Error ? error.message : String(error)}`)
    return []
  }
  if (rows.length === 0) return []
  const validation = await window.electronAPI.docker.validateMounts(rows)
  if (!validation.ok) {
    ctx.logger.warn(`The bind mounts of Docker container ${container} cannot be used on this machine: ${validation.errors.join('; ')}`)
    const warning = i18next.t('wizard.docker.warning.containerMountsUnusable', { name: container })
    if (!ctx.warnings.includes(warning)) ctx.warnings.push(warning)
    return []
  }
  return rows
}

export const configureMountsStep: WizardStep = {
  id: 'configure-mounts',
  title: 'Configure bind mounts',
  appliesTo: ['docker-linux'],
  // T0330 (PLAN-032 Sprint 2): folder picker dialog blocks for user input.
  // T0851: "Use existing" confirms the container's own mounts with ctx.requestChoice.
  kind: 'input',
  retryable: true,
  labelKey: 'wizard.docker.step.configureMounts.label',
  descriptionKey: 'wizard.docker.step.configureMounts.description',
  groupKey: 'wizard.group.detection',
  editableFromFailure: true,
  async run(ctx) {
    let mounts = Array.isArray(ctx.state.dockerMounts)
      ? ctx.state.dockerMounts as DockerMountRow[]
      : []
    const editRequested = ctx.state[EDIT_REQUESTED_KEY] === true

    if (mounts.length === 0 || editRequested) {
      // T0851: an existing container already has its mounts; the folder picked
      // here would not be mounted into it, so its own bind mounts come first.
      const container = ctx.state.containerMode === 'existing' && typeof ctx.state.dockerContainer === 'string'
        ? ctx.state.dockerContainer
        : ''
      const fromContainer = container ? await readContainerBindMounts(ctx, container) : []
      let useContainerMounts = fromContainer.length > 0
      if (useContainerMounts && ctx.requestChoice) {
        const answer = await ctx.requestChoice({
          stepId: 'configure-mounts',
          title: i18next.t('wizard.docker.configureMounts.fromContainer.title', { name: container }),
          description: i18next.t('wizard.docker.configureMounts.fromContainer.description', {
            name: container,
            mounts: fromContainer.map((row) => `${row.host} → ${row.container}`).join(', '),
          }),
          options: [
            {
              value: DOCKER_MOUNTS_USE_CONTAINER,
              label: 'Use these folders',
              labelKey: 'wizard.docker.configureMounts.fromContainer.use',
            },
            {
              value: DOCKER_MOUNTS_PICK_FOLDER,
              label: 'Choose a folder instead',
              labelKey: 'wizard.docker.configureMounts.fromContainer.pick',
              description: i18next.t('wizard.docker.configureMounts.fromContainer.pickDescription'),
            },
          ],
        })
        useContainerMounts = answer !== DOCKER_MOUNTS_PICK_FOLDER
      }

      if (useContainerMounts) {
        mounts = fromContainer
        ctx.logger.info(`Using the ${fromContainer.length} bind mount(s) of Docker container ${container}.`)
      } else {
        const selected = await window.electronAPI.dialog.selectFolder()
        const hostPath = selected?.[0]
        if (hostPath) {
          mounts = [{ host: hostPath, container: defaultContainerPath(hostPath) }]
        } else if (mounts.length === 0) {
          throw wizardError('Select at least one host folder to mount into the Docker container.', 'docker-mounts-none')
        } else {
          // T0500: the folder dialog has no default path, so closing it after a
          // jump back keeps the previous mounts instead of failing.
          ctx.logger.info('No folder selected; keeping the previous bind mounts.')
        }
      }
    }

    const validation = await window.electronAPI.docker.validateMounts(mounts)
    if (!validation.ok) throw wizardError(validation.errors.join('\n'), 'docker-mounts-invalid')

    ctx.state.dockerMounts = mounts
    ctx.profileDraft.dockerMounts = mounts
    delete ctx.state[EDIT_REQUESTED_KEY]
  },
  // T0500: jumped back to -> open the folder picker again even though mounts
  // are stored. Cleared once the step succeeds, so a retry asks again.
  resetForEdit(ctx) {
    ctx.state[EDIT_REQUESTED_KEY] = true
  },
  async rollback(ctx) {
    ctx.state.dockerMounts = []
    delete ctx.profileDraft.dockerMounts
  },
}
