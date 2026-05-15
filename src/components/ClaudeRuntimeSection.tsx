import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { ClaudeRuntimeMode, ClaudeRuntimeSettings } from '../types'
import { settingsStore } from '../stores/settings-store'

// Shape mirrors preload.ts `claude.detectRuntime` return type.
type HealthStatus = 'healthy' | 'version-warning' | 'version-too-old' | 'spawn-failed'

interface RuntimeInfo {
  path: string
  version: string
  versionRaw: string
  healthStatus: HealthStatus
  source?: 'path' | 'common-location' | 'custom'
}

interface DetectResult {
  embedded: RuntimeInfo
  system: RuntimeInfo | null
}

const DEBOUNCE_MS = 500

function isSafeClaudeCustomPath(candidate: string): boolean {
  if (!candidate || candidate.length > 4096) return false
  if (/[\x00-\x1F\x7F]/.test(candidate)) return false
  const isAbsolute =
    candidate.startsWith('/') ||
    /^[a-zA-Z]:[\\/]/.test(candidate) ||
    /^\\\\[^\\/]+\\[^\\/]+/.test(candidate)
  if (!isAbsolute) return false
  return /^[A-Za-z0-9 ._\-:()+/\\@]+$/.test(candidate)
}

function badgeClassName(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'claude-runtime-badge healthy'
    case 'version-warning':
      return 'claude-runtime-badge warning'
    case 'version-too-old':
      return 'claude-runtime-badge error'
    case 'spawn-failed':
      return 'claude-runtime-badge error'
  }
}

export function ClaudeRuntimeSection({
  runtime,
  onRuntimeChange,
}: {
  runtime: ClaudeRuntimeSettings
  onRuntimeChange: (updates: Partial<ClaudeRuntimeSettings>) => void
}) {
  const { t } = useTranslation()

  const [detect, setDetect] = useState<DetectResult | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [useCustomPath, setUseCustomPath] = useState<boolean>(
    Boolean(runtime.customPath && runtime.customPath.trim())
  )
  // Local buffer for the path input so typing does not re-fire detect every keystroke.
  const [customPathInput, setCustomPathInput] = useState<string>(runtime.customPath ?? '')

  // Sync local input if store mutates externally (profile switch, reset).
  useEffect(() => {
    setCustomPathInput(runtime.customPath ?? '')
    setUseCustomPath(Boolean(runtime.customPath && runtime.customPath.trim()))
  }, [runtime.customPath])

  const runDetect = useCallback(async (pathOverride?: string) => {
    setDetecting(true)
    try {
      const result = await window.electronAPI.claude.detectRuntime(pathOverride)
      setDetect(result)
    } catch (err) {
      window.electronAPI.debug?.log?.('[ClaudeRuntimeSection] detectRuntime failed:', err)
    } finally {
      setDetecting(false)
    }
  }, [])

  // Initial detect on mount (and when the effective custom path changes).
  useEffect(() => {
    void runDetect(runtime.customPath?.trim() || undefined)
  }, [runDetect, runtime.customPath])

  const customPathError = useMemo(() => {
    if (!useCustomPath) return null
    const trimmed = customPathInput.trim()
    if (!trimmed) return null
    return isSafeClaudeCustomPath(trimmed)
      ? null
      : t('settings.claudeRuntime.customPath.unsafe')
  }, [customPathInput, useCustomPath, t])

  // Debounced write-back + redetect for the custom-path text field.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!useCustomPath) return
    const trimmed = customPathInput.trim()
    if (customPathError) return
    if (trimmed === (runtime.customPath ?? '')) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onRuntimeChange({ customPath: trimmed })
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [customPathInput, customPathError, useCustomPath, runtime.customPath, onRuntimeChange])

  const handleModeChange = useCallback(
    (mode: ClaudeRuntimeMode) => {
      if (runtime.mode === mode) return
      onRuntimeChange({ mode })
    },
    [runtime.mode, onRuntimeChange]
  )

  const handleUseCustomPathToggle = useCallback(
    (enabled: boolean) => {
      setUseCustomPath(enabled)
      if (!enabled) {
        setCustomPathInput('')
        onRuntimeChange({ customPath: '' })
      }
    },
    [onRuntimeChange]
  )

  const handleBrowse = useCallback(async () => {
    try {
      const files = await window.electronAPI.dialog.selectFiles()
      if (files && files.length > 0) {
        const picked = files[0]
        setUseCustomPath(true)
        setCustomPathInput(picked)
        if (isSafeClaudeCustomPath(picked.trim())) {
          onRuntimeChange({ customPath: picked.trim() })
        }
      }
    } catch (err) {
      window.electronAPI.debug?.log?.('[ClaudeRuntimeSection] selectFiles failed:', err)
    }
  }, [onRuntimeChange])

  const handleFallbackChange = useCallback(
    (checked: boolean) => {
      onRuntimeChange({ fallbackToEmbedded: checked })
    },
    [onRuntimeChange]
  )

  const systemInfo = detect?.system ?? null
  const embeddedInfo = detect?.embedded ?? null

  const systemDisabled = useMemo(() => {
    if (!systemInfo) return true
    return systemInfo.healthStatus === 'version-too-old' || systemInfo.healthStatus === 'spawn-failed'
  }, [systemInfo])

  const statusLabel = (status: HealthStatus): string => {
    switch (status) {
      case 'healthy':
        return t('settings.claudeRuntime.status.healthy')
      case 'version-warning':
        return t('settings.claudeRuntime.status.warning')
      case 'version-too-old':
        return t('settings.claudeRuntime.status.tooOld')
      case 'spawn-failed':
        return t('settings.claudeRuntime.status.notFound')
    }
  }

  return (
    <div className="settings-section">
      <h3>{t('settings.claudeRuntime.title')}</h3>
      <p className="settings-hint" style={{ marginBottom: 12 }}>
        {t('settings.claudeRuntime.description')}
      </p>

      <div
        role="radiogroup"
        aria-labelledby="claude-runtime-mode-label"
        className="settings-group"
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        <span id="claude-runtime-mode-label" className="sr-only" style={{ position: 'absolute', left: -9999 }}>
          {t('settings.claudeRuntime.title')}
        </span>

        {/* Embedded option */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="radio"
              name="claude-runtime-mode"
              value="embedded"
              checked={runtime.mode === 'embedded'}
              onChange={() => handleModeChange('embedded')}
              aria-label={t('settings.claudeRuntime.mode.embedded')}
            />
            <span style={{ fontWeight: 500 }}>{t('settings.claudeRuntime.mode.embedded')}</span>
            {embeddedInfo && (
              <span className={badgeClassName(embeddedInfo.healthStatus)}>
                {statusLabel(embeddedInfo.healthStatus)}
                {embeddedInfo.version ? ` v${embeddedInfo.version}` : ''}
              </span>
            )}
          </span>
        </label>

        {/* System option */}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, cursor: systemDisabled ? 'not-allowed' : 'pointer', opacity: systemDisabled ? 0.65 : 1 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="radio"
              name="claude-runtime-mode"
              value="system"
              checked={runtime.mode === 'system'}
              disabled={systemDisabled}
              onChange={() => handleModeChange('system')}
              aria-label={t('settings.claudeRuntime.mode.system')}
            />
            <span style={{ fontWeight: 500 }}>{t('settings.claudeRuntime.mode.system')}</span>
            {systemInfo ? (
              <span className={badgeClassName(systemInfo.healthStatus)}>
                {statusLabel(systemInfo.healthStatus)}
                {systemInfo.version ? ` v${systemInfo.version}` : ''}
              </span>
            ) : (
              <span className={badgeClassName('spawn-failed')}>{statusLabel('spawn-failed')}</span>
            )}
            {detecting && (
              <span style={{ fontSize: 11, color: 'var(--text-secondary, #8b949e)' }}>
                {t('common.loading')}
              </span>
            )}
          </span>

          {systemInfo?.path && (
            <span style={{ fontSize: 11, color: 'var(--text-secondary, #8b949e)', fontFamily: 'monospace', wordBreak: 'break-all', paddingLeft: 24 }}>
              {systemInfo.path}
            </span>
          )}
        </label>

        {/* Custom path block (only rendered when system mode allowed) */}
        <div style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={useCustomPath}
              onChange={e => handleUseCustomPathToggle(e.target.checked)}
            />
            <span>{t('settings.claudeRuntime.customPath.toggle')}</span>
          </label>

          {useCustomPath && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={customPathInput}
                  onChange={e => setCustomPathInput(e.target.value)}
                  placeholder={t('settings.claudeRuntime.customPath.placeholder')}
                  aria-invalid={customPathError ? true : undefined}
                  aria-describedby={customPathError ? 'claude-custom-path-error' : undefined}
                  style={{ flex: 1, minWidth: 240, fontFamily: 'monospace', fontSize: 12 }}
                />
                <button
                  type="button"
                  className="profile-action-btn"
                  onClick={handleBrowse}
                >
                  {t('settings.claudeRuntime.customPath.browse')}
                </button>
              </div>
              {customPathError && (
                <span id="claude-custom-path-error" style={{ color: 'var(--error-color, #f85149)', fontSize: 12 }}>
                  {customPathError}
                </span>
              )}
            </div>
          )}
        </div>

        <label className="settings-group checkbox-group" style={{ marginTop: 4 }}>
          <input
            type="checkbox"
            checked={runtime.fallbackToEmbedded}
            onChange={e => handleFallbackChange(e.target.checked)}
          />
          {t('settings.claudeRuntime.fallbackToEmbedded')}
        </label>

        <p className="settings-hint">{t('settings.claudeRuntime.hint')}</p>
      </div>
    </div>
  )
}

// Re-export store accessor so SettingsPanel can feed current value without directly importing again.
// Kept here to centralise the write path (settingsStore.setClaudeRuntime) in one place.
export function setClaudeRuntimeUpdate(updates: Partial<ClaudeRuntimeSettings>) {
  settingsStore.setClaudeRuntime(updates)
}
