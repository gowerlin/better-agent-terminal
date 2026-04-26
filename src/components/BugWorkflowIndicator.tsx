import { useMemo } from 'react'
import type { BugStatus } from '../types/bug-tracker'
import { Stepper } from './stepper/Stepper'
import type { StepDescriptor, StepStatus } from './stepper/types'

const WORKFLOW_STEPS: BugStatus[] = ['OPEN', 'FIXING', 'FIXED', 'VERIFY', 'CLOSED']

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

const STEP_ICONS: Record<BugStatus, string> = {
  OPEN: '📋',
  FIXING: '⏳',
  FIXED: '🔔',
  VERIFY: '🔔',
  CLOSED: '✅',
  WONTFIX: '🚫',
}

function buildStepsFromBugStatus(status: BugStatus): StepDescriptor[] {
  const isWontfix = status === 'WONTFIX'
  const currentIndex = WORKFLOW_STEPS.indexOf(status)

  return WORKFLOW_STEPS.map((step, i) => {
    let stepStatus: StepStatus
    if (isWontfix) {
      // 銷單分支：所有主流程節點視為 pending（faded gray），實際 WONTFIX 由額外節點呈現
      stepStatus = 'pending'
    } else if (i < currentIndex) {
      stepStatus = 'completed'
    } else if (i === currentIndex) {
      stepStatus = 'running'
    } else {
      stepStatus = 'pending'
    }
    return {
      id: step,
      label: step,
      icon: STEP_ICONS[step],
      status: stepStatus,
    }
  })
}

function findCurrentIndex(status: BugStatus): number {
  if (status === 'WONTFIX') return -1
  return WORKFLOW_STEPS.indexOf(status)
}

function BugGuidanceBanner({ status }: { status: BugStatus }) {
  const guidance = STATUS_GUIDANCE[status]
  return (
    <div className={`ct-workflow-guidance${guidance.requiresAction ? ' ct-workflow-action-required' : ''}`}>
      <span className="ct-workflow-guidance-icon">{guidance.icon}</span>
      <span className="ct-workflow-guidance-text">
        {guidance.requiresAction && <strong>需要你介入：</strong>}
        {guidance.message}
      </span>
    </div>
  )
}

function BugMetaLink({ wo }: { wo: string }) {
  return (
    <div className="ct-workflow-meta">
      相關工單：<span className="ct-bug-wo-ref">{wo}</span>
    </div>
  )
}

interface BugWorkflowIndicatorProps {
  status: BugStatus
  relatedWorkOrder?: string
}

export function BugWorkflowIndicator({ status, relatedWorkOrder }: BugWorkflowIndicatorProps) {
  const isWontfix = status === 'WONTFIX'
  const steps = useMemo(() => buildStepsFromBugStatus(status), [status])
  const currentIndex = useMemo(() => findCurrentIndex(status), [status])

  return (
    <div className="ct-workflow-indicator">
      <div className="ct-workflow-bar">
        <Stepper
          steps={steps}
          orientation="horizontal"
          currentIndex={currentIndex}
          ariaLabel={`Bug workflow status: ${status}`}
          classNamePrefix="ct-workflow"
        />
        {isWontfix && (
          <div className="ct-workflow-step ct-workflow-wontfix-branch">
            <div className="ct-workflow-node ct-workflow-wontfix">
              <span className="ct-workflow-icon">🚫</span>
            </div>
            <span className="ct-workflow-label ct-workflow-label-current">WONTFIX</span>
          </div>
        )}
      </div>

      <BugGuidanceBanner status={status} />
      {relatedWorkOrder && <BugMetaLink wo={relatedWorkOrder} />}
    </div>
  )
}
