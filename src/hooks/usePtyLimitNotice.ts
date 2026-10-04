/**
 * T0424 (PLAN-036): the (remote) server refused `pty:create` at its PTY cap (T0404,
 * `PTY_LIMIT_REACHED`). Without this the user only sees a blank terminal.
 *
 * For the workspace's own terminals: one readable line in the terminal itself (every
 * refused terminal) plus a warning toast (a burst — restoring many tabs — shares one).
 * Nothing retries: the user closes a terminal and opens a new one.
 */
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ToastMessage } from '../components/CtToast'
import { isPtyLimitResult, onPtyCreateRefused, showPtyNotice } from '../lib/pty-replay'

type AddToast = (text: string, type?: ToastMessage['type'], duration?: number) => void

/** Refusals within this window share one toast. */
export const PTY_LIMIT_TOAST_COALESCE_MS = 5000
const PTY_LIMIT_TOAST_DURATION_MS = 10000

export function usePtyLimitNotice(workspaceId: string, addToast: AddToast): void {
  const { t } = useTranslation()
  const lastToastAt = useRef<number | null>(null)

  useEffect(() => onPtyCreateRefused((options, result) => {
    if (options.workspaceId !== workspaceId || !isPtyLimitResult(result)) return
    const limit = result.limit ?? '?'
    window.electronAPI?.debug?.log(`[T0424] pty:create refused terminal=${options.id}: PTY limit reached (max ${limit})`)
    showPtyNotice(options.id, t('terminal.ptyLimitNotice', { limit }))
    const now = Date.now()
    if (lastToastAt.current !== null && now - lastToastAt.current < PTY_LIMIT_TOAST_COALESCE_MS) return
    lastToastAt.current = now
    addToast(t('toast.ptyLimit.reached', { limit }), 'warning', PTY_LIMIT_TOAST_DURATION_MS)
  }), [workspaceId, addToast, t])
}
