/**
 * D146 / T0547: installers no longer ship the server bundle baseline, so the
 * WSL / SSH `install-server-bundle` step downloads it. When that fails (offline,
 * intranet, rate limit) the step throws `server-bundle-unavailable`, the error
 * registry maps it to an "Import local tarball…" action, and the Shell runs
 * `importServerBundleForRetry` → main `server-bundle:import-local` (file dialog,
 * SHA-256 verify, copy into the cache) → retry the step, which then hits the cache.
 */

import type { TFunction } from 'i18next'
import type { WizardContext } from './wizard-runner'

export const SERVER_BUNDLE_UNAVAILABLE_CODE = 'server-bundle-unavailable'

/** ctx.state key: what the failed step needed (read by the import action). */
export const SERVER_BUNDLE_IMPORT_TARGET_KEY = 'serverBundleImportTarget'

export type ServerBundleTargetArch = 'linux-x64' | 'linux-arm64' | 'darwin-arm64'

export interface ServerBundleImportTarget {
  arch: ServerBundleTargetArch
  version: string
}

type DistributeResult = Awaited<ReturnType<typeof window.electronAPI.remote.serverBundle.distribute>>
type DistributeFailure = Extract<DistributeResult, { ok: false }>
type ImportResult = Awaited<ReturnType<typeof window.electronAPI.remote.serverBundle.importLocal>>
type ImportFailure = Extract<ImportResult, { ok: false }>

/** Distributor failures a local tarball can fix (not arch detection / abort / corrupted baseline). */
export function isImportableDistributeFailure(errorCode: DistributeFailure['errorCode']): boolean {
  return errorCode === 'download-failed' || errorCode === 'no-source-available'
}

/**
 * Build the error an install step throws for a failed distribute call. Importable
 * failures carry `code = server-bundle-unavailable` and record the import target
 * on ctx.state; the message keeps the `[errorCode] error` shape used since T0321.
 */
export function distributeFailureError(ctx: WizardContext, result: DistributeFailure): Error {
  const error = new Error(`[${result.errorCode}] ${result.error}`) as Error & { code?: string }
  if (isImportableDistributeFailure(result.errorCode) && result.arch && result.version) {
    error.code = SERVER_BUNDLE_UNAVAILABLE_CODE
    ctx.state[SERVER_BUNDLE_IMPORT_TARGET_KEY] = { arch: result.arch, version: result.version } satisfies ServerBundleImportTarget
  } else {
    delete ctx.state[SERVER_BUNDLE_IMPORT_TARGET_KEY]
  }
  return error
}

export function readImportTarget(state: Record<string, unknown>): ServerBundleImportTarget | null {
  const value = state[SERVER_BUNDLE_IMPORT_TARGET_KEY] as Partial<ServerBundleImportTarget> | undefined
  if (!value || typeof value.arch !== 'string' || typeof value.version !== 'string') return null
  if (!['linux-x64', 'linux-arm64', 'darwin-arm64'].includes(value.arch)) return null
  return { arch: value.arch as ServerBundleTargetArch, version: value.version }
}

const IMPORT_ERROR_KEYS: Record<Exclude<ImportFailure['errorCode'], 'cancelled'>, string> = {
  'invalid-arguments': 'invalidArguments',
  'invalid-filename': 'invalidFilename',
  'arch-mismatch': 'archMismatch',
  'version-mismatch': 'versionMismatch',
  'sidecar-missing': 'sidecarMissing',
  'sidecar-invalid': 'sidecarInvalid',
  'sha-mismatch': 'shaMismatch',
  'read-failed': 'readFailed',
  'cache-write-failed': 'cacheWriteFailed',
}

export function describeImportFailure(result: ImportFailure, t: TFunction): string {
  if (result.errorCode === 'cancelled') return ''
  const key = IMPORT_ERROR_KEYS[result.errorCode]
  if (!key) return result.error
  return t(`wizard.shared.bundleImport.error.${key}`, {
    file: result.details?.file ?? '',
    expected: result.details?.expected ?? '',
    actual: result.details?.actual ?? '',
    error: result.error,
    defaultValue: result.error,
  })
}

export type ImportForRetryOutcome =
  | { status: 'imported'; message: string }
  | { status: 'cancelled' }
  | { status: 'error'; message: string }

/** Run the import for the target the failed step recorded. Never throws. */
export async function importServerBundleForRetry(
  state: Record<string, unknown>,
  t: TFunction,
  api: Pick<typeof window.electronAPI.remote.serverBundle, 'importLocal'> = window.electronAPI.remote.serverBundle,
): Promise<ImportForRetryOutcome> {
  const target = readImportTarget(state)
  if (!target) return { status: 'error', message: t('wizard.shared.bundleImport.noTarget') }
  const file = `bat-server-${target.arch}-v${target.version}.tar.gz`
  let result: ImportResult
  try {
    result = await api.importLocal({
      arch: target.arch,
      version: target.version,
      dialogTitle: t('wizard.shared.bundleImport.dialogTitle', { file }),
      sidecarDialogTitle: t('wizard.shared.bundleImport.sidecarDialogTitle', { file }),
    })
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) }
  }
  if (result.ok) {
    return { status: 'imported', message: t('wizard.shared.bundleImport.imported', { file }) }
  }
  if (result.errorCode === 'cancelled') return { status: 'cancelled' }
  return { status: 'error', message: describeImportFailure(result, t) }
}
