import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ModalOverlay } from './common/ModalOverlay'
import { settingsStore } from '../stores/settings-store'
import {
  LINUX_FONT_HINT_URL,
  linuxFontHintItems,
  linuxFontInstallCommand,
  type LinuxFontCheck,
  type LinuxFontHintItems,
} from '../lib/linux-font-hint'

/**
 * PLAN-064 / T0827 (D270 / D271): Linux without Chinese (or emoji) fonts shows the interface as boxes.
 * The main process checks fontconfig once after startup (electron/linux-font-check.ts); this asks for the
 * result and, when fonts the user needs are missing, shows a one-time dialog with the install command.
 *
 * - Text is English first, then the interface language: with no Chinese font the Chinese text itself is boxes.
 * - Only the local main window (App.tsx passes `enabled`): not detached windows, not remote profile windows;
 *   main hands the hint to one window per BAT start (`claimHint`).
 * - "Don't show again" persists `linuxFontHintDismissed`; installed fonts → the check says ok → no hint.
 * - `unknown` (not Linux, no fc-list, timeout, failure) never shows anything.
 * - T0563 / T0567: `ModalOverlay`, an [X], Esc = close.
 */
export function LinuxFontHint({ enabled }: Readonly<{ enabled: boolean }>) {
  const { i18n } = useTranslation()
  const [result, setResult] = useState<LinuxFontCheck | null>(null)
  const [items, setItems] = useState<LinuxFontHintItems | null>(null)
  const claimedRef = useRef(false)

  useEffect(() => {
    const api = window.electronAPI?.fontCheck
    if (!enabled || !api) return
    let alive = true
    api.get().then(r => { if (alive) setResult(r) }).catch(() => { /* older main */ })
    const unsubscribe = api.onChanged(r => { if (alive) setResult(r) })
    return () => {
      alive = false
      unsubscribe()
    }
  }, [enabled])

  useEffect(() => {
    const api = window.electronAPI?.fontCheck
    if (!enabled || !api || !result || claimedRef.current) return
    const wanted = linuxFontHintItems({
      result,
      language: i18n.language,
      dismissed: settingsStore.getSettings().linuxFontHintDismissed === true,
    })
    if (!wanted) return
    claimedRef.current = true
    api.claimHint().then(granted => {
      if (!granted) return
      window.electronAPI?.debug?.log(`[font-check] hint shown: cjk=${wanted.cjk} emoji=${wanted.emoji} language=${i18n.language}`)
      setItems(wanted)
    }).catch(() => { /* older main */ })
  }, [enabled, result, i18n.language])

  if (!items) return null
  return (
    <LinuxFontHintDialog
      items={items}
      onClose={() => setItems(null)}
      onDontShowAgain={() => {
        window.electronAPI?.debug?.log('[font-check] hint dismissed (don\'t show again)')
        settingsStore.setLinuxFontHintDismissed(true)
        setItems(null)
      }}
    />
  )
}

interface LinuxFontHintDialogProps {
  items: LinuxFontHintItems
  onClose: () => void
  onDontShowAgain: () => void
}

export function LinuxFontHintDialog({ items, onClose, onDontShowAgain }: Readonly<LinuxFontHintDialogProps>) {
  const { t, i18n } = useTranslation()
  const tEn = i18n.getFixedT('en')
  const [copied, setCopied] = useState(false)
  const command = linuxFontInstallCommand(items)
  const localized = !/^en\b/i.test(i18n.language ?? 'en')
  // buttons and title: "English / 中文" (only English when the interface is English)
  const both = (key: string) => {
    const en = tEn(`linuxFontHint.${key}`)
    const local = t(`linuxFontHint.${key}`)
    return localized && local !== en ? `${en} / ${local}` : en
  }
  const paragraphs = (tr: (key: string) => string) => (
    <>
      {items.cjk && <p className="linux-font-hint-cjk">{tr('linuxFontHint.cjk')}</p>}
      {items.emoji && <p className="linux-font-hint-emoji">{tr('linuxFontHint.emoji')}</p>}
      <p>{tr('linuxFontHint.install')}</p>
    </>
  )
  const copy = () => {
    navigator.clipboard?.writeText(command).then(() => setCopied(true), () => { /* clipboard refused */ })
  }

  return (
    <ModalOverlay className="dialog-overlay" onEscape={onClose}>
      <div className="dialog linux-font-hint-dialog" role="dialog" data-cjk={items.cjk} data-emoji={items.emoji}
        onClick={e => e.stopPropagation()} style={{ maxWidth: 620, width: '100%' }}>
        <div className="dialog-header">
          <h3 style={{ margin: 0 }}>{both('title')}</h3>
          <button className="dialog-close-btn linux-font-hint-x" aria-label={both('close')} title={both('close')} onClick={onClose}>×</button>
        </div>
        <div className="linux-font-hint-text" lang="en">{paragraphs(tEn)}</div>
        {localized && (
          <div className="linux-font-hint-text" lang={i18n.language} style={{ color: 'var(--text-secondary)' }}>{paragraphs(t)}</div>
        )}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0' }}>
          <code className="linux-font-hint-command" style={{ flex: 1, userSelect: 'all', whiteSpace: 'pre-wrap', wordBreak: 'break-all', padding: '6px 8px', background: 'var(--bg-tertiary, rgba(127,127,127,0.15))', borderRadius: 4 }}>
            {command}
          </code>
          <button className="dialog-btn cancel" data-action="copy" onClick={copy}>{both(copied ? 'copied' : 'copy')}</button>
        </div>
        <p lang="en">{tEn('linuxFontHint.restart')}</p>
        {localized && <p lang={i18n.language} style={{ color: 'var(--text-secondary)' }}>{t('linuxFontHint.restart')}</p>}
        <div className="dialog-actions">
          <button className="dialog-btn cancel" data-action="details" onClick={() => { void window.electronAPI?.shell?.openExternal(LINUX_FONT_HINT_URL) }}>
            {both('details')}
          </button>
          <button className="dialog-btn cancel" data-action="dont-show-again" onClick={onDontShowAgain}>{both('dontShowAgain')}</button>
          <button className="dialog-btn confirm" data-action="close" onClick={onClose}>{both('close')}</button>
        </div>
      </div>
    </ModalOverlay>
  )
}
