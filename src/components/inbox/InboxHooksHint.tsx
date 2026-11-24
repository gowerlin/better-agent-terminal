/**
 * PLAN-068 W9 / T0910 (T0902 §7.2): one line under the「待辦」(Inbox) header when the selected Tower has no
 * BAT hooks (`hooksStatus.state === 'none'`, the same reason as its `🪝✕` thumbnail badge) or its
 * `bat-hooks` plugin is outdated, with a「怎麼修」link to the README section. Nothing otherwise.
 *
 * The Inbox shows its body only for a Tower whose contract matches (R9′), where this line is rendered;
 * the status comes from `terminal:hooks-status` (src/stores/hooks-status-store.ts). Codes only.
 */
import { useTranslation } from 'react-i18next'
import { HOOKS_HELP_URL, hooksStatusHint } from '../../lib/hooks-status'
import { useHooksStatus } from '../../stores/hooks-status-store'

export function InboxHooksHint({ terminalId }: Readonly<{ terminalId: string | null | undefined }>) {
  const { t } = useTranslation()
  const status = useHooksStatus(terminalId)
  const hint = hooksStatusHint(status)
  if (!hint || !status) return null
  const code = status.state === 'none' ? status.reason : 'plugin-outdated'
  return (
    <div
      className="inbox-hooks-hint"
      data-inbox-hooks={code}
      role="note"
      style={{ display: 'flex', gap: 6, alignItems: 'baseline', padding: '4px 8px', fontSize: '0.9em', color: 'var(--warning-color, #e8a838)' }}
    >
      <span aria-hidden="true">{status.state === 'none' ? '🪝✕' : '🪝'}</span>
      <span style={{ flex: 1, minWidth: 0 }}>{hint.prefix ? t('hooksStatus.prefix') : ''}{t(hint.key)}</span>
      <button
        type="button"
        className="inbox-link"
        onClick={() => { void window.electronAPI?.shell?.openExternal?.(HOOKS_HELP_URL) }}
      >
        {t('hooksStatus.help')}
      </button>
    </div>
  )
}
