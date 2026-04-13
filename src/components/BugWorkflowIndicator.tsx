import type { BugStatus } from '../types/bug-tracker'

/** Main workflow steps in order */
const WORKFLOW_STEPS: BugStatus[] = ['OPEN', 'FIXING', 'FIXED', 'VERIFY', 'CLOSED']

/** Guidance config per status */
const STATUS_GUIDANCE: Record<BugStatus, {
  icon: string
  message: string
  requiresAction: boolean
}> = {
  OPEN:    { icon: '📋', message: '等待指揮塔開工單指派 Worker 修復', requiresAction: false },
  FIXING:  { icon: '⏳', message: 'Worker 修復中，等待 commit 完成回報', requiresAction: false },
  FIXED:   { icon: '🔔', message: '請安裝最新版本並測試，確認修復後回報指揮塔「驗收通過」', requiresAction: true },
  VERIFY:  { icon: '🔔', message: '驗收進行中，請確認後回報指揮塔「驗收通過」', requiresAction: true },
  CLOSED:  { icon: '✅', message: '已結案，無需任何動作', requiresAction: false },
  WONTFIX: { icon: '🚫', message: '已決定不修復，已銷單', requiresAction: false },
}

interface BugWorkflowIndicatorProps {
  status: BugStatus
  relatedWorkOrder?: string
}

export function BugWorkflowIndicator({ status, relatedWorkOrder }: BugWorkflowIndicatorProps) {
  const isWontfix = status === 'WONTFIX'
  const guidance = STATUS_GUIDANCE[status]
  const currentIndex = WORKFLOW_STEPS.indexOf(status)

  return (
    <div className="ct-workflow-indicator">
      {/* Progress bar */}
      <div className="ct-workflow-bar">
        {WORKFLOW_STEPS.map((step, i) => {
          const isCurrent = step === status
          const isPast = !isWontfix && currentIndex > i
          const isFuture = !isWontfix && currentIndex < i

          let nodeClass = 'ct-workflow-node'
          if (isCurrent && !isWontfix) nodeClass += ' ct-workflow-current'
          else if (isPast) nodeClass += ' ct-workflow-past'
          else if (isFuture) nodeClass += ' ct-workflow-future'
          else if (isWontfix) nodeClass += ' ct-workflow-future'

          return (
            <div key={step} className="ct-workflow-step">
              <div className={nodeClass}>
                <span className="ct-workflow-icon">{STATUS_GUIDANCE[step].icon}</span>
              </div>
              <span className={`ct-workflow-label${isCurrent && !isWontfix ? ' ct-workflow-label-current' : ''}`}>
                {step}
              </span>
              {i < WORKFLOW_STEPS.length - 1 && (
                <div className={`ct-workflow-connector${isPast ? ' ct-workflow-connector-done' : ''}`} />
              )}
            </div>
          )
        })}

        {/* WONTFIX branch node */}
        {isWontfix && (
          <div className="ct-workflow-step ct-workflow-wontfix-branch">
            <div className="ct-workflow-node ct-workflow-wontfix">
              <span className="ct-workflow-icon">🚫</span>
            </div>
            <span className="ct-workflow-label ct-workflow-label-current">WONTFIX</span>
          </div>
        )}
      </div>

      {/* Guidance message */}
      <div className={`ct-workflow-guidance${guidance.requiresAction ? ' ct-workflow-action-required' : ''}`}>
        <span className="ct-workflow-guidance-icon">{guidance.icon}</span>
        <span className="ct-workflow-guidance-text">
          {guidance.requiresAction && <strong>需要你介入：</strong>}
          {guidance.message}
        </span>
      </div>

      {/* Related work order */}
      {relatedWorkOrder && (
        <div className="ct-workflow-meta">
          相關工單：<span className="ct-bug-wo-ref">{relatedWorkOrder}</span>
        </div>
      )}
    </div>
  )
}
