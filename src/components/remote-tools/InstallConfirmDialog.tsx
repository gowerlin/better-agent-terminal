import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { InstallPlan } from '../../lib/remote-tools/recipes'
import type { RemoteToolsPanelHost } from './RemoteToolsPanel'
import { ExternalLink } from './ExternalLink'

export interface InstallConfirmDialogProps {
  plan: InstallPlan
  host: RemoteToolsPanelHost
  /** Called only from the confirm button, with the plan exactly as shown. */
  onConfirm(plan: InstallPlan): void
  onCancel(): void
  onOpenUrl?: (url: string) => void
  /** Defaults to `navigator.clipboard.writeText`. */
  copyText?: (text: string) => Promise<void> | void
}

function defaultCopyText(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

/**
 * T0410 (PLAN-037 D, spec T0407 §6): everything the user agrees to before an install / update
 * command is typed into a remote terminal tab. `plan.command` is rendered verbatim.
 */
export function InstallConfirmDialog({ plan, host, onConfirm, onCancel, onOpenUrl, copyText = defaultCopyText }: Readonly<InstallConfirmDialogProps>) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const toolName = t(`remoteTools.tool.${plan.toolId}.name`)
  const isUpdate = plan.kind === 'update'

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const copy = async () => {
    try {
      await copyText(plan.command)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div
        className="dialog remote-tools-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="remote-tools-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="remote-tools-confirm-title">
          {t(isUpdate ? 'remoteTools.confirm.titleUpdate' : 'remoteTools.confirm.titleInstall', { tool: toolName })}
        </h3>

        {plan.unofficial && (
          <div className="remote-tools-confirm-warn" role="alert">{t('remoteTools.confirm.unofficial')}</div>
        )}

        <div className="remote-tools-confirm-label">{t('remoteTools.confirm.command')}</div>
        <div className="remote-tools-confirm-command">
          <pre data-testid="remote-tools-confirm-command"><code>{plan.command}</code></pre>
          <button type="button" className="remote-tools-btn" onClick={copy}>
            {copied ? t('remoteTools.confirm.copied') : t('remoteTools.confirm.copy')}
          </button>
        </div>

        {plan.prerequisites && plan.prerequisites.length > 0 && (
          <>
            <div className="remote-tools-confirm-label">{t('remoteTools.confirm.prerequisites')}</div>
            <ul className="remote-tools-confirm-list">
              {plan.prerequisites.map((step) => <li key={step}><code>{step}</code></li>)}
            </ul>
          </>
        )}

        <dl className="remote-tools-confirm-facts">
          <dt>{t('remoteTools.confirm.sudo')}</dt>
          <dd>{t(plan.needsSudo ? 'remoteTools.confirm.sudoYes' : 'remoteTools.confirm.sudoNo')}</dd>
          <dt>{t('remoteTools.confirm.location')}</dt>
          <dd>
            {t(plan.installLocation)}
            {plan.installPath && <> — <code>{plan.installPath}</code></>}
          </dd>
          <dt>{t('remoteTools.confirm.integrity')}</dt>
          <dd>
            {t(plan.integrity)}
            {plan.scriptUrl && <div className="remote-tools-muted">{t('remoteTools.confirm.integrityScriptNote')}</div>}
          </dd>
          <dt>{t('remoteTools.confirm.sources')}</dt>
          <dd className="remote-tools-confirm-links">
            <ExternalLink href={plan.docsUrl} onOpenUrl={onOpenUrl}>{t('remoteTools.confirm.docs')}</ExternalLink>
            {plan.scriptUrl && (
              <ExternalLink href={plan.scriptUrl} onOpenUrl={onOpenUrl}>{t('remoteTools.confirm.viewScript')}</ExternalLink>
            )}
          </dd>
        </dl>

        {plan.notes && plan.notes.length > 0 && (
          <ul className="remote-tools-confirm-list remote-tools-muted">
            {plan.notes.map((note) => <li key={note}>{t(note)}</li>)}
          </ul>
        )}

        <p className="remote-tools-confirm-runs">
          {t(host === 'remote-window' ? 'remoteTools.confirm.runsHere' : 'remoteTools.confirm.runsInRemoteWindow')}
          {plan.needsSudo && <> {t('remoteTools.confirm.sudoPasswordHint')}</>}
        </p>

        <div className="dialog-actions">
          <button type="button" className="dialog-btn cancel" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="button" className="dialog-btn remote-tools-confirm-ok" onClick={() => onConfirm(plan)}>
            {t(isUpdate ? 'remoteTools.confirm.confirmUpdate' : 'remoteTools.confirm.confirmInstall')}
          </button>
        </div>
      </div>
    </div>
  )
}
