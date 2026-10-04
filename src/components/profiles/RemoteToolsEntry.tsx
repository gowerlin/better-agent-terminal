// T0413 (PLAN-037 F) — RemoteToolsPanel entry for windows NOT bound to the profile
// (setup wizard completion block, ProfilePanel expanded card). Detection goes through
// T0411's local short connection; installs are handed to T0412's cross-window queue.
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RemoteToolsPanel, type RemoteToolsPanelHost } from '../remote-tools/RemoteToolsPanel'
import type { InstallPlan } from '../../lib/remote-tools/recipes'
import type { RemoteToolId } from '../../types/remote-tools'

/** T0412 contract: `remote-tools:request-install` (local-only). Not in electron.d.ts until T0412 lands. */
export interface RemoteToolInstallRequest {
  profileId: string
  toolId: RemoteToolId
  kind: InstallPlan['kind']
}
export type RemoteToolInstallResult = { ok: true } | { ok: false; error: string }
type RequestInstallApi = { requestInstall?: (req: RemoteToolInstallRequest) => Promise<RemoteToolInstallResult> }

function requestInstallApi(): RequestInstallApi | null {
  const api = window.electronAPI?.remoteTools as RequestInstallApi | undefined
  return typeof api?.requestInstall === 'function' ? api : null
}

export interface RemoteToolsEntryProps {
  profileId: string
  host: Extract<RemoteToolsPanelHost, 'wizard' | 'profile'>
}

export function RemoteToolsEntry({ profileId, host }: Readonly<RemoteToolsEntryProps>) {
  const { t } = useTranslation()
  const [installError, setInstallError] = useState<string | null>(null)

  // Stable identity: the panel re-detects whenever `detect` changes.
  const detect = useCallback(() => window.electronAPI.remoteTools.detect(profileId), [profileId])

  const installApi = requestInstallApi()
  const onInstall = useMemo(() => {
    if (!installApi) return undefined
    return (plan: InstallPlan) => {
      setInstallError(null)
      // Only toolId + kind cross the window boundary; the remote window rebuilds the command.
      installApi.requestInstall!({ profileId, toolId: plan.toolId, kind: plan.kind }).then(
        (result) => {
          if (!result.ok) setInstallError(result.error)
        },
        (err: unknown) => setInstallError(err instanceof Error ? err.message : String(err)),
      )
    }
  }, [installApi, profileId])

  return (
    <div className="remote-tools-entry" data-testid={`remote-tools-entry-${host}`}>
      <RemoteToolsPanel host={host} detect={detect} onInstall={onInstall} />
      {installError && (
        <div className="remote-tools-error" role="alert" data-testid="remote-tools-install-error">
          <div>{t('remoteTools.installRequestFailed', 'Could not start the install in the remote window.')}</div>
          <div className="remote-tools-muted remote-tools-error-detail">{installError}</div>
        </div>
      )}
    </div>
  )
}
