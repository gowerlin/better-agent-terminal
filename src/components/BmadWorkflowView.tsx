import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { BmadWorkflow, BmadPhase, BmadPhaseArtifact } from '../types/bmad-workflow'
import { phaseStatusColor, phaseStatusLabel } from '../types/bmad-workflow'

interface BmadWorkflowViewProps {
  workflow: BmadWorkflow | null
  loading: boolean
  bmadOutputPath: string
}

export function BmadWorkflowView({ workflow, loading, bmadOutputPath }: BmadWorkflowViewProps) {
  const { t } = useTranslation()
  const [expandedPhase, setExpandedPhase] = useState<number | null>(null)

  if (loading) {
    return <div className="ct-loading">{t('controlTower.loading')}</div>
  }

  // Empty state: no workflow or all phases NOT_STARTED
  const allEmpty = !workflow || workflow.phases.every(p => p.status === 'NOT_STARTED')

  if (allEmpty) {
    return (
      <div className="ct-workflow-empty">
        <div className="ct-empty-icon">🔄</div>
        <p>{t('controlTower.workflow.empty')}</p>
        <code className="ct-path">_bmad-output/</code>
      </div>
    )
  }

  return (
    <div className="ct-workflow">
      {/* Overall progress */}
      <div className="ct-workflow-overview">
        <span className="ct-workflow-progress-label">
          {workflow!.completedPhases}/{workflow!.totalPhases} {t('controlTower.workflow.phasesComplete')}
        </span>
        <div className="ct-workflow-progress-bar">
          <div
            className="ct-workflow-progress-fill"
            style={{ width: `${(workflow!.completedPhases / workflow!.totalPhases) * 100}%` }}
          />
        </div>
      </div>

      {/* Phase list */}
      <div className="ct-workflow-phases">
        {workflow!.phases.map(phase => (
          <PhaseCard
            key={phase.id}
            phase={phase}
            expanded={expandedPhase === phase.id}
            onToggle={() => setExpandedPhase(prev => prev === phase.id ? null : phase.id)}
            bmadOutputPath={bmadOutputPath}
            t={t}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Phase Card ─────────────────────────────────────────────────────────────

function PhaseCard({
  phase,
  expanded,
  onToggle,
  bmadOutputPath,
  t,
}: {
  phase: BmadPhase
  expanded: boolean
  onToggle: () => void
  bmadOutputPath: string
  t: (key: string) => string
}) {
  const existCount = phase.artifacts.filter(a => a.exists).length

  return (
    <div className={`ct-workflow-phase ${phaseStatusColor(phase.status)}${expanded ? ' expanded' : ''}`}>
      <div className="ct-phase-header" onClick={onToggle}>
        <span className="ct-phase-expand">{expanded ? '▼' : '▶'}</span>
        <span className="ct-phase-id">{phase.id}</span>
        <span className="ct-phase-name">
          {phase.name}
          {!phase.isRequired && (
            <span className="ct-phase-optional"> ({t('controlTower.workflow.optional')})</span>
          )}
        </span>
        <span className="ct-phase-artifact-count">
          {existCount}/{phase.artifacts.length}
        </span>
        <span className={`ct-status-badge ${phaseStatusColor(phase.status)}`}>
          {phaseStatusLabel(phase.status)}
        </span>
      </div>

      {expanded && (
        <div className="ct-phase-artifacts">
          {phase.artifacts.map(artifact => (
            <ArtifactItem
              key={artifact.name}
              artifact={artifact}
              bmadOutputPath={bmadOutputPath}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Artifact Item ──────────────────────────────────────────────────────────

function ArtifactItem({
  artifact,
  bmadOutputPath,
  t,
}: {
  artifact: BmadPhaseArtifact
  bmadOutputPath: string
  t: (key: string) => string
}) {
  const filePath = `${bmadOutputPath}/${artifact.dir}/${artifact.name}`

  return (
    <div className={`ct-artifact-item ${artifact.exists ? 'ct-artifact-exists' : 'ct-artifact-missing'}`}>
      <span className="ct-artifact-icon">{artifact.exists ? '✅' : '⬜'}</span>
      <span className="ct-artifact-name">{artifact.displayName}</span>
      <span className="ct-artifact-file">{artifact.name}</span>
      {artifact.exists && (
        <button
          className="ct-view-file-btn"
          onClick={() => {
            window.dispatchEvent(new CustomEvent('workspace-switch-tab', { detail: { tab: 'files' } }))
            window.dispatchEvent(new CustomEvent('file-tree-reveal', { detail: { path: filePath } }))
          }}
        >
          📄 {t('controlTower.viewFile')}
        </button>
      )}
    </div>
  )
}
