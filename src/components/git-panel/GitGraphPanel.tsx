/**
 * Phase 3 Tα1 — Git Graph panel scaffold (T0155).
 *
 * MVP intent:
 *  - Header with title + refresh placeholder.
 *  - Body is an empty placeholder — graph/virtualization lands in Tα2.
 *  - On mount (and whenever `workspaceFolderPath` changes) call `healthCheck`
 *    to prove the simple-git IPC pipeline is wired up end to end.
 *
 * Out of scope for this work order:
 *  - Commit graph rendering (Tα2)
 *  - Layout chrome (Tα3)
 *  - Indexing (Tα4)
 *  - Git operations (Tα5)
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { healthCheck, type GitScaffoldHealth } from '../../lib/git-scaffold'

export interface GitGraphPanelProps {
  workspaceFolderPath: string
}

type HealthState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; data: GitScaffoldHealth }
  | { kind: 'error'; message: string }

export function GitGraphPanel({ workspaceFolderPath }: Readonly<GitGraphPanelProps>) {
  const { t } = useTranslation()
  const [health, setHealth] = useState<HealthState>({ kind: 'idle' })

  const runHealthCheck = useCallback(async () => {
    if (!workspaceFolderPath) {
      setHealth({ kind: 'idle' })
      return
    }
    setHealth({ kind: 'loading' })
    try {
      const data = await healthCheck(workspaceFolderPath)
      setHealth({ kind: 'ready', data })
      window.electronAPI?.debug?.log?.(
        `[git-graph] healthCheck(${workspaceFolderPath}) → ok=${data.ok} isRepo=${data.isRepo} root=${data.gitRoot ?? 'null'}`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setHealth({ kind: 'error', message })
      window.electronAPI?.debug?.log?.(`[git-graph] healthCheck error: ${message}`)
    }
  }, [workspaceFolderPath])

  useEffect(() => {
    runHealthCheck()
  }, [runHealthCheck])

  return (
    <div className="git-graph-panel" style={containerStyle}>
      <div className="git-graph-panel-header" style={headerStyle}>
        <span style={titleStyle}>{t('gitGraph.title')}</span>
        <button
          type="button"
          onClick={runHealthCheck}
          title={t('gitGraph.refresh')}
          style={refreshButtonStyle}
        >
          ↻
        </button>
      </div>
      <div className="git-graph-panel-body" style={bodyStyle}>
        <div style={placeholderStyle}>{t('gitGraph.graphComingSoon')}</div>
        <HealthStatus state={health} />
      </div>
    </div>
  )
}

function HealthStatus({ state }: Readonly<{ state: HealthState }>) {
  const { t } = useTranslation()
  let text: string
  let color = 'var(--text-secondary)'
  if (state.kind === 'idle') {
    text = t('gitGraph.health.idle')
  } else if (state.kind === 'loading') {
    text = t('gitGraph.health.loading')
  } else if (state.kind === 'error') {
    text = t('gitGraph.health.error', { message: state.message })
    color = '#f44336'
  } else if (!state.data.ok) {
    text = t('gitGraph.health.error', { message: state.data.error ?? 'unknown' })
    color = '#f44336'
  } else if (!state.data.isRepo) {
    text = t('gitGraph.health.notARepo')
    color = '#d97706'
  } else {
    text = t('gitGraph.health.ok', { root: state.data.gitRoot ?? '' })
    color = '#4ec9b0'
  }
  return (
    <div className="git-graph-health" style={{ ...healthStyle, color }}>
      {text}
    </div>
  )
}

// Inline styles — intentionally minimal; full styling arrives with Tα3 (layout).
const containerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  width: '100%',
  background: 'var(--bg-primary)',
  color: 'var(--text-primary)',
}
const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  borderBottom: '1px solid var(--border-color, #333)',
  fontSize: 12,
  fontWeight: 600,
}
const titleStyle: React.CSSProperties = {
  letterSpacing: 0.5,
}
const refreshButtonStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-secondary)',
  fontSize: 14,
  padding: '2px 6px',
}
const bodyStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 16,
  overflow: 'auto',
}
const placeholderStyle: React.CSSProperties = {
  padding: '24px 16px',
  textAlign: 'center',
  border: '1px dashed var(--border-color, #333)',
  borderRadius: 4,
  color: 'var(--text-secondary)',
  fontSize: 12,
}
const healthStyle: React.CSSProperties = {
  fontSize: 11,
  fontFamily: 'var(--font-mono, monospace)',
  padding: '6px 10px',
  borderRadius: 4,
  background: 'var(--bg-secondary, #1e1e1e)',
}
