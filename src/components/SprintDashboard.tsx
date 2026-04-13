import type { SprintStatus, SprintMilestone, SprintBugSummary, SprintSummaryData, SprintPlanEntry } from '../types/sprint-status'

interface SprintDashboardProps {
  sprintStatus: SprintStatus | null
}

export function SprintDashboard({ sprintStatus }: SprintDashboardProps) {
  if (!sprintStatus) {
    return (
      <div className="sprint-empty">
        <div className="ct-empty-icon">📊</div>
        <p>未找到 sprint-status.yaml</p>
        <code className="ct-path">_ct-workorders/sprint-status.yaml</code>
      </div>
    )
  }

  return (
    <div className="sprint-dashboard">
      {sprintStatus.milestones.length > 0 && (
        <MilestoneSection milestones={sprintStatus.milestones} />
      )}

      {sprintStatus.summary && (
        <StatsCards summary={sprintStatus.summary} bugs={sprintStatus.bugs} />
      )}

      {sprintStatus.bugs && (
        <BugStatusBar bugs={sprintStatus.bugs} />
      )}

      {sprintStatus.plans.length > 0 && (
        <BacklogSummary plans={sprintStatus.plans} />
      )}

      {sprintStatus.lastUpdated && (
        <LastUpdated timestamp={sprintStatus.lastUpdated} />
      )}
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function MilestoneSection({ milestones }: { milestones: SprintMilestone[] }) {
  return (
    <div className="sprint-section">
      <div className="sprint-section-title">📊 里程碑</div>
      <div className="sprint-milestone-list">
        {milestones.map((m, i) => (
          <div key={i} className="sprint-milestone-item">
            <span className="sprint-milestone-badge">{getMilestoneBadge(m.status)}</span>
            <span className="sprint-milestone-name">{m.name}</span>
            <span className="sprint-milestone-status">{cleanStatusText(m.status)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatsCards({ summary, bugs }: { summary: SprintSummaryData; bugs: SprintBugSummary | null }) {
  const cards = [
    { value: summary.completed, label: '工單完成' },
    { value: summary.inProgress, label: 'Active' },
    { value: bugs?.closed ?? 0, label: 'Bug 關閉' },
    { value: summary.backlogPlans, label: 'PLAN' },
  ]

  return (
    <div className="sprint-section">
      <div className="sprint-section-title">🔢 統計</div>
      <div className="sprint-stats-grid">
        {cards.map((c, i) => (
          <div key={i} className="sprint-stat-card">
            <div className="sprint-stat-value">{c.value}</div>
            <div className="sprint-stat-label">{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function BugStatusBar({ bugs }: { bugs: SprintBugSummary }) {
  return (
    <div className="sprint-section">
      <div className="sprint-section-title">🐛 Bug 狀態</div>
      <div className="sprint-bug-bar">
        <span className="sprint-bug-item">Open: <strong>{bugs.open}</strong></span>
        <span className="sprint-bug-sep">|</span>
        <span className="sprint-bug-item">Closed: <strong>{bugs.closed}</strong></span>
        {bugs.wontfix > 0 && (
          <>
            <span className="sprint-bug-sep">|</span>
            <span className="sprint-bug-item">Won't Fix: <strong>{bugs.wontfix}</strong></span>
          </>
        )}
        <span className="sprint-bug-sep">|</span>
        <span className="sprint-bug-item">Total: <strong>{bugs.total}</strong></span>
      </div>
      {bugs.activeBug && (
        <div className="sprint-bug-active">⚠️ {bugs.activeBug}</div>
      )}
    </div>
  )
}

function BacklogSummary({ plans }: { plans: SprintPlanEntry[] }) {
  return (
    <div className="sprint-section">
      <div className="sprint-section-title">📋 Backlog 摘要</div>
      <div className="sprint-backlog-list">
        {plans.map((p, i) => (
          <div key={i} className="sprint-backlog-item">
            {p.id && <span className="sprint-backlog-id">{p.id}</span>}
            <span className="sprint-backlog-title">{p.title}</span>
            {p.status && <span className="sprint-backlog-status">({p.status})</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function LastUpdated({ timestamp }: { timestamp: string }) {
  return (
    <div className="sprint-last-updated">
      ⏱ 最後更新：{timestamp}
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getMilestoneBadge(status: string): string {
  const s = status.toLowerCase()
  if (s.includes('done') || s.includes('✅')) return '✅'
  if (s.includes('progress') || s.includes('🔄')) return '🔄'
  if (s.includes('planning')) return '📝'
  if (s.includes('backlog') || s.includes('📋')) return '📋'
  return '📋'
}

function cleanStatusText(status: string): string {
  // Remove emoji prefix if present (e.g. "✅ DONE" → "DONE")
  return status.replace(/^[^\w]*\s*/, '').trim()
}
