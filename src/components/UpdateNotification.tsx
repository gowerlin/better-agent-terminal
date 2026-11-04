import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ModalOverlay } from './common/ModalOverlay'

/** Mirrors `ReleaseInfo` in electron/update-checker.ts (T0863). */
export interface ReleaseInfo {
  version: string
  tagName: string
  /** That release's page (`html_url`), not the `/releases` overview. */
  htmlUrl: string
  body: string
  publishedAt: string
  prerelease: boolean
}

/** Mirrors `UpdateCheckResult` in electron/update-checker.ts (T0863). */
export interface UpdateCheckResult {
  hasUpdate: boolean
  currentVersion: string
  latestRelease: ReleaseInfo | null
  includePrerelease: boolean
}

/** Mirrors `UpdateCheckOutcome` in electron/update-checker.ts (T0863). */
export type UpdateCheckOutcome =
  | { status: 'update'; result: UpdateCheckResult }
  | { status: 'latest'; result: UpdateCheckResult }
  | { status: 'error'; currentVersion: string; reason: string }

/** Only https pages of the fork's releases are opened (main builds them; this is a second check). */
const RELEASE_PAGE_PREFIX = 'https://github.com/gowerlin/better-agent-terminal/releases/'

export function releasePageToOpen(release: ReleaseInfo): string {
  return release.htmlUrl.startsWith(RELEASE_PAGE_PREFIX)
    ? release.htmlUrl
    : `${RELEASE_PAGE_PREFIX}tag/${encodeURIComponent(release.tagName)}`
}

/**
 * PLAN-063 子項 1 / T0821: on Windows the NSIS installer ends every BAT process, the Terminal Server
 * included, so every tab's shell, command and agent ends with it (T0820). Only Windows says so: the
 * macOS / Linux upgrade was not studied.
 */
export function showsWindowsUpgradeWarning(platform: string | undefined): boolean {
  return platform === 'win32'
}

type Notice = { kind: 'latest'; version: string } | { kind: 'error'; reason: string }

/**
 * T0863 / BUG-212 (D287): main checks GitHub — once at startup, or on Help › Check for Updates… — and
 * this window only shows results; it never calls GitHub.
 *
 * - `claimStartup`: ask main for the startup result; main hands a newer version to one window per start.
 * - Help results for this window: newer → the update dialog; up to date / failed → a small dialog.
 * - "View on GitHub" opens that release's page.
 */
export function UpdateNotification({ claimStartup = true }: Readonly<{ claimStartup?: boolean }>) {
  const { t } = useTranslation()
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => {
    const api = window.electronAPI?.update
    if (!claimStartup || !api?.claimStartupResult) return
    let alive = true
    api.claimStartupResult()
      .then(result => { if (alive && result?.hasUpdate && result.latestRelease) setUpdateInfo(result) })
      .catch(() => { /* older main */ })
    return () => { alive = false }
  }, [claimStartup])

  useEffect(() => {
    const api = window.electronAPI?.update
    if (!api?.onManualResult) return
    return api.onManualResult(outcome => {
      if (outcome.status === 'update' && outcome.result.latestRelease) {
        setNotice(null)
        setUpdateInfo(outcome.result)
      } else if (outcome.status === 'latest') {
        setUpdateInfo(null)
        setNotice({ kind: 'latest', version: outcome.result.currentVersion })
      } else if (outcome.status === 'error') {
        setUpdateInfo(null)
        setNotice({ kind: 'error', reason: outcome.reason })
      }
    })
  }, [])

  if (notice) {
    const title = notice.kind === 'latest' ? t('update.upToDateTitle') : t('update.checkFailedTitle')
    const message = notice.kind === 'latest'
      ? t('update.upToDate', { version: notice.version })
      : t('update.checkFailed', { reason: notice.reason })
    return (
      <ModalOverlay className="update-notification-overlay" onEscape={() => setNotice(null)}>
        <div className="update-notification update-check-notice" role="dialog" aria-label={title}>
          <div className="update-header">
            <h3>{title}</h3>
            <button className="close-btn" aria-label={t('common.close')} onClick={() => setNotice(null)}>×</button>
          </div>
          <div className="update-content">
            <p style={{ margin: 0, lineHeight: 1.5 }}>{message}</p>
          </div>
          <div className="update-actions">
            <button className="btn-primary" onClick={() => setNotice(null)}>{t('common.ok')}</button>
          </div>
        </div>
      </ModalOverlay>
    )
  }

  if (!updateInfo?.hasUpdate || !updateInfo.latestRelease) {
    return null
  }

  const { latestRelease, currentVersion } = updateInfo
  const dismiss = () => setUpdateInfo(null)

  const handleViewRelease = () => {
    window.electronAPI.shell.openExternal(releasePageToOpen(latestRelease))
  }

  // Parse changelog - extract first few lines
  const changelogLines = latestRelease.body
    .split('\n')
    .filter(line => line.trim())
    .slice(0, 8)
    .join('\n')

  return (
    <ModalOverlay className="update-notification-overlay" onEscape={dismiss}>
      <div className="update-notification">
        <div className="update-header">
          <h3>{t('update.newVersionAvailable')}</h3>
          <button className="close-btn" aria-label={t('common.close')} onClick={dismiss}>×</button>
        </div>

        <div className="update-content">
          <div className="version-info">
            <span className="current-version">{t('update.currentVersion', { version: currentVersion })}</span>
            <span className="arrow">→</span>
            <span className="new-version">{t('update.newVersion', { version: latestRelease.tagName })}</span>
          </div>

          {changelogLines && (
            <div className="changelog">
              <h4>{t('update.whatsNew')}</h4>
              <pre>{changelogLines}</pre>
            </div>
          )}

          {showsWindowsUpgradeWarning(window.electronAPI?.platform) && (
            <p className="update-windows-warning" role="note" style={{ margin: '12px 0 0', color: 'var(--warning-color, #e5a50a)', fontSize: 13, lineHeight: 1.5 }}>{t('update.windowsInstallEndsTerminals')}</p>
          )}
        </div>

        <div className="update-actions">
          <button className="btn-primary" onClick={handleViewRelease}>
            {t('update.viewOnGithub')}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}
