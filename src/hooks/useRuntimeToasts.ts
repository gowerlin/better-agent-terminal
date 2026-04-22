import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { ToastMessage } from '../components/CtToast'

type AddToast = (text: string, type?: ToastMessage['type'], duration?: number) => void

type DegradedReason = 'system-not-found' | 'system-unhealthy' | 'system-too-old' | 'detect-threw'

/**
 * Subscribes once (per mount) to the main-process runtime events fired from
 * the three agent spawn sites (PLAN-027 #2 / T0231) and surfaces them as
 * toasts. Keep this at app root to avoid duplicate subscriptions when panels
 * re-mount.
 */
export function useRuntimeToasts(addToast: AddToast): void {
  const { t } = useTranslation()

  useEffect(() => {
    const unsubDegraded = window.electronAPI.claude.onRuntimeDegraded(({ reason, detail }) => {
      const key = `toast.runtime.degraded.${reasonKey(reason)}`
      // i18n key lookup with detail interpolation when the translation supports it.
      const message = detail
        ? t(key, { detail })
        : t(key)
      const title = t('toast.runtime.degraded.title')
      addToast(`${title}: ${message}`, 'warning', 7000)
    })

    const unsubWarning = window.electronAPI.claude.onRuntimeWarning(({ version, message }) => {
      const title = t('toast.runtime.warning.title', { version })
      addToast(`${title}: ${message}`, 'info', 6000)
    })

    return () => {
      unsubDegraded()
      unsubWarning()
    }
  }, [addToast, t])
}

function reasonKey(reason: DegradedReason): string {
  switch (reason) {
    case 'system-not-found':
      return 'systemNotFound'
    case 'system-unhealthy':
      return 'systemUnhealthy'
    case 'system-too-old':
      return 'systemTooOld'
    case 'detect-threw':
      return 'detectThrew'
  }
}
