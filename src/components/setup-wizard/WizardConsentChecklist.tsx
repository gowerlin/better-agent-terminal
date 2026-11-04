import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { WizardConsentItem, WizardConsentRequest } from './wizard-runner'
import type { WslAppliedChange } from './steps/wsl/apply-wsl-environment'

/**
 * T0840 (PLAN-043 W3): the "consent once" checklist (T0831 〈調查結論〉2) shown
 * inside the wizard's detail pane — not a Dialog, so no ModalOverlay. Each item
 * shows its scope tag (whole machine / this distro / this user) and side
 * effects; when an item ends the distro's programs or every distro, one summary
 * line above the confirm button lists the distros Running right now. Fixed
 * items have no checkbox; an item with `disabledReasonKey` cannot be checked.
 * A required item left unchecked shows a note; confirming then stops the step
 * with an explanation (the step decides, not this component).
 */

const SCOPE_KEYS: Record<WizardConsentItem['scope'], string> = {
  machine: 'wizard.wsl.plan.scope.machine',
  distro: 'wizard.wsl.plan.scope.distro',
  user: 'wizard.wsl.plan.scope.user',
}

const EFFECT_KEYS: Record<WizardConsentItem['effects'][number], string> = {
  elevation: 'wizard.wsl.plan.effect.elevation',
  reboot: 'wizard.wsl.plan.effect.reboot',
  'shutdown-all-distros': 'wizard.wsl.plan.effect.shutdownAllDistros',
  'terminate-distro': 'wizard.wsl.plan.effect.terminateDistro',
  'long-running': 'wizard.wsl.plan.effect.longRunning',
}

const tagStyle = {
  display: 'inline-block',
  fontSize: '0.8em',
  padding: '0 6px',
  marginRight: 6,
  borderRadius: 4,
  border: '1px solid currentColor',
  opacity: 0.85,
} as const

export interface WizardConsentChecklistProps {
  request: WizardConsentRequest
  regionId: string
  onSubmit: (checkedIds: string[]) => void
}

export function WizardConsentChecklist({ request, regionId, onSubmit }: WizardConsentChecklistProps) {
  const { t } = useTranslation()
  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(request.items.filter((item) => item.fixed || (item.defaultChecked && !item.disabledReasonKey)).map((item) => item.id)),
  )
  const params = request.params ?? {}
  const title = t(request.titleKey, params)
  const description = request.descriptionKey ? t(request.descriptionKey, params) : undefined

  const isChecked = (item: WizardConsentItem) => item.fixed === true || (!item.disabledReasonKey && checked.has(item.id))
  const missingRequired = request.items.some((item) => item.required && !isChecked(item))
  const checkedItems = request.items.filter(isChecked)
  const terminates = checkedItems.some((item) => item.effects.includes('terminate-distro'))
  const shutsDownAll = checkedItems.some((item) => item.effects.includes('shutdown-all-distros'))
  const running = request.runningDistros ?? []

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <form
      id={regionId}
      className="bat-wizard-prompt bat-wizard-consent"
      aria-label={title}
      data-testid="wizard-consent"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(request.items.filter(isChecked).map((item) => item.id))
      }}
    >
      <h4 className="bat-wizard-prompt-title">{title}</h4>
      {description && <p className="bat-wizard-prompt-description">{description}</p>}
      <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0' }}>
        {request.items.map((item) => {
          const itemParams = { ...params, ...(item.params ?? {}) }
          const inputId = `${regionId}-item-${item.id}`
          const detailId = `${inputId}-detail`
          const disabled = item.fixed === true || item.disabledReasonKey !== undefined
          return (
            <li key={item.id} data-item-id={item.id} style={{ marginBottom: 10 }}>
              <label htmlFor={inputId} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <input
                  id={inputId}
                  type="checkbox"
                  checked={isChecked(item)}
                  disabled={disabled}
                  onChange={() => toggle(item.id)}
                  aria-describedby={detailId}
                />
                <span>
                  <strong>{t(item.labelKey, itemParams)}</strong>
                  <span style={{ display: 'block', marginTop: 2 }}>
                    <span style={tagStyle} data-tag="scope">{t(SCOPE_KEYS[item.scope])}</span>
                    <span style={tagStyle} data-tag="required">
                      {t(item.required ? 'wizard.wsl.plan.tag.required' : 'wizard.wsl.plan.tag.optional')}
                    </span>
                    {item.fixed && <span style={tagStyle} data-tag="fixed">{t('wizard.wsl.plan.tag.fixed')}</span>}
                  </span>
                </span>
              </label>
              <div id={detailId} className="bat-wizard-prompt-description" style={{ marginLeft: 24 }}>
                {item.detailKey && <p style={{ margin: '2px 0' }}>{t(item.detailKey, itemParams)}</p>}
                {item.effects.map((effect) => (
                  <p key={effect} style={{ margin: '2px 0' }} data-effect={effect}>⚠ {t(EFFECT_KEYS[effect], itemParams)}</p>
                ))}
                {item.disabledReasonKey && (
                  <p style={{ margin: '2px 0' }} role="note" data-testid="wizard-consent-disabled-reason">
                    {t(item.disabledReasonKey, itemParams)}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {(terminates || shutsDownAll) && (
        <p className="bat-wizard-prompt-description" data-testid="wizard-consent-summary">
          {t(shutsDownAll ? 'wizard.wsl.plan.summaryShutdownAll' : 'wizard.wsl.plan.summaryTerminate', params)}{' '}
          {running.length > 0
            ? t('wizard.wsl.plan.runningDistros', { list: running.join(', ') })
            : t('wizard.wsl.plan.runningNone')}
        </p>
      )}
      {missingRequired && (
        <p className="bat-wizard-field-error" role="alert" data-testid="wizard-consent-required-missing">
          {t('wizard.wsl.plan.requiredMissing')}
        </p>
      )}
      <div className="bat-wizard-actions">
        <button className="profile-action-btn primary" type="submit" data-testid="wizard-consent-confirm">
          {t('wizard.wsl.plan.confirm')}
        </button>
      </div>
    </form>
  )
}

/**
 * T0840 (D272): what the WSL environment fixes changed, shown on the done and
 * cancel / failure screens — fixes are never undone, backups are kept.
 */
export function WslAppliedChangesBox({ changes }: { changes: WslAppliedChange[] }) {
  const { t } = useTranslation()
  if (changes.length === 0) return null
  return (
    <div className="bat-wizard-box bat-wizard-warnings" data-testid="wizard-wsl-applied-changes">
      <div className="bat-wizard-box-header">{t('wizard.wsl.apply.changes.header')}</div>
      {changes.map((change) => {
        const key = `${change.distro}:${change.item}:${change.kind}:${change.path ?? ''}`
        if (change.kind === 'wsl-version') {
          return <p key={key}>{t('wizard.wsl.apply.changes.wsl2Convert', { distro: change.distro })}</p>
        }
        return (
          <p key={key}>
            {t('wizard.wsl.apply.changes.file', { distro: change.distro, path: change.path ?? '' })}{' '}
            {change.backupPath
              ? t('wizard.wsl.apply.changes.backup', { path: change.backupPath })
              : t('wizard.wsl.apply.changes.newFile')}
          </p>
        )
      })}
      <p>{t('wizard.wsl.apply.changes.note')}</p>
    </div>
  )
}
