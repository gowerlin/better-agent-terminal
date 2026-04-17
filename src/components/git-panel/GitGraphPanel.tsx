/**
 * Phase 3 Tα2 — Git Graph panel wired to real git-scaffold IPC (T0156).
 *
 * 本工單把 T0155 的 placeholder 換成 T0154 驗證過的 SVG commit graph +
 * 自製 virtualization,配合 `git-scaffold:listCommits` 載入真實 commits。
 *
 * 載入策略(詳見 T0156 工單):
 *   - 初始載入 `INITIAL_LIMIT` commits(目前 10000,IPC cap 已同步提高)
 *   - Workspace 切換 → 自動重載
 *   - Refresh 按鈕 → 手動重載
 *   - 後續分頁(scroll 到底再載)屬 Tα3+ 範圍,本工單不實作
 *
 * Layout(簡化版):
 *   - 單 lane:所有 commits 擺同一欄,parent 線直連下一 row
 *   - 完整 branch lane assignment / edge routing 留給 Tα3
 *
 * Out of scope:
 *   - Commit 互動(點擊 / hover / 選中) → Tβ2
 *   - CT 工單反查 → Tα4
 *   - Git 操作 → Tα5
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  healthCheck,
  listCommits,
  type GitScaffoldCommit,
} from '../../lib/git-scaffold'
import { SvgCommitGraph } from './SvgCommitGraph'
import './git-graph-panel.css'

export interface GitGraphPanelProps {
  workspaceFolderPath: string
}

// 與 IPC `git-scaffold:listCommits` 的 limit cap 對齊。Tα3 起可再擴大或改真正分頁。
const INITIAL_LIMIT = 10000

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; commits: GitScaffoldCommit[]; isRepo: boolean; gitRoot: string | null }
  | { kind: 'error'; message: string }

export function GitGraphPanel({ workspaceFolderPath }: Readonly<GitGraphPanelProps>) {
  const { t } = useTranslation()
  const [state, setState] = useState<LoadState>({ kind: 'idle' })
  const bodyRef = useRef<HTMLDivElement>(null)
  const [bodyHeight, setBodyHeight] = useState(400)

  const load = useCallback(async () => {
    if (!workspaceFolderPath) {
      setState({ kind: 'idle' })
      return
    }
    setState({ kind: 'loading' })
    try {
      const health = await healthCheck(workspaceFolderPath)
      if (!health.ok) {
        setState({ kind: 'error', message: health.error ?? 'healthCheck failed' })
        return
      }
      if (!health.isRepo) {
        setState({ kind: 'ready', commits: [], isRepo: false, gitRoot: null })
        return
      }
      const result = await listCommits(workspaceFolderPath, { limit: INITIAL_LIMIT, offset: 0 })
      if (!result.ok) {
        setState({ kind: 'error', message: result.error ?? 'listCommits failed' })
        return
      }
      setState({
        kind: 'ready',
        commits: result.commits,
        isRepo: true,
        gitRoot: health.gitRoot,
      })
      window.electronAPI?.debug?.log?.(
        `[git-graph] loaded ${result.commits.length} commits from ${health.gitRoot ?? 'null'}`,
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setState({ kind: 'error', message })
      window.electronAPI?.debug?.log?.(`[git-graph] load error: ${message}`)
    }
  }, [workspaceFolderPath])

  useEffect(() => {
    load()
  }, [load])

  // Virtualization 需要實際容器高度。ResizeObserver 持續追蹤 resize / docking 變化。
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    setBodyHeight(el.clientHeight)
    const ro = new ResizeObserver(() => setBodyHeight(el.clientHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div className="git-graph-panel">
      <div className="git-graph-panel-header">
        <span className="git-graph-panel-title">{t('gitGraph.title')}</span>
        <div className="git-graph-panel-meta">
          {state.kind === 'ready' && state.isRepo && state.commits.length > 0 && (
            <span className="git-graph-panel-count">
              {state.commits.length.toLocaleString()}
            </span>
          )}
          <button
            type="button"
            className="git-graph-panel-refresh"
            onClick={load}
            title={t('gitGraph.refresh')}
            disabled={state.kind === 'loading'}
          >
            ↻
          </button>
        </div>
      </div>
      <div className="git-graph-panel-body" ref={bodyRef}>
        <GitGraphBody state={state} height={bodyHeight} />
      </div>
    </div>
  )
}

function GitGraphBody({
  state,
  height,
}: Readonly<{ state: LoadState; height: number }>) {
  const { t } = useTranslation()
  if (state.kind === 'idle') {
    return <StatusMsg text={t('gitGraph.health.idle')} />
  }
  if (state.kind === 'loading') {
    return <StatusMsg text={t('gitGraph.status.loading')} />
  }
  if (state.kind === 'error') {
    return (
      <StatusMsg
        text={t('gitGraph.health.error', { message: state.message })}
        variant="error"
      />
    )
  }
  if (!state.isRepo) {
    return <StatusMsg text={t('gitGraph.health.notARepo')} variant="warn" />
  }
  if (state.commits.length === 0) {
    return <StatusMsg text={t('gitGraph.status.empty')} variant="warn" />
  }
  return <SvgCommitGraph commits={state.commits} height={height} />
}

function StatusMsg({
  text,
  variant,
}: Readonly<{ text: string; variant?: 'error' | 'warn' }>) {
  let cls = 'git-graph-status'
  if (variant === 'error') cls += ' git-graph-status-error'
  else if (variant === 'warn') cls += ' git-graph-status-warn'
  return <div className={cls}>{text}</div>
}
