import { Fragment, useMemo, type KeyboardEvent, type ReactNode } from 'react'
import type {
  StepDescriptor,
  StepperClickableMode,
  StepperProps,
} from './types'
import { STATUS_PRESET } from './status-preset'

function defaultCurrentIndex(steps: StepDescriptor[]): number {
  const firstRunning = steps.findIndex((s) => s.status === 'running')
  if (firstRunning >= 0) return firstRunning
  // T0330: awaiting-input also draws focus, secondary to running.
  const firstAwaiting = steps.findIndex((s) => s.status === 'awaiting-input')
  if (firstAwaiting >= 0) return firstAwaiting
  // 最後 completed 之後的下一個（若有）
  let lastCompleted = -1
  steps.forEach((s, i) => {
    if (s.status === 'completed') lastCompleted = i
  })
  if (lastCompleted >= 0 && lastCompleted < steps.length - 1) return lastCompleted + 1
  return Math.max(lastCompleted, 0)
}

function stepIsClickable(
  step: StepDescriptor,
  mode: StepperClickableMode,
): boolean {
  if (mode === 'none') return false
  if (mode === 'all') return true
  return step.status === 'completed'
}

function renderIcon(step: StepDescriptor): ReactNode {
  if (step.icon !== undefined && step.icon !== null && step.icon !== '') return step.icon
  return STATUS_PRESET[step.status].icon
}

/**
 * T0330: awaiting-input step does NOT render Retry/Skip CTA (failed-only),
 * does NOT mount role="alert" (no error). aria-describedby wires to
 * promptRegionId so screen readers announce the prompt region.
 */
function ariaDescribedByFor(step: StepDescriptor): string | undefined {
  if (step.status === 'awaiting-input' && step.promptRegionId) {
    return step.promptRegionId
  }
  return undefined
}

interface GroupRun {
  groupLabel: string | undefined
  startIndex: number
  steps: StepDescriptor[]
}

function buildGroupRuns(steps: StepDescriptor[]): GroupRun[] {
  const runs: GroupRun[] = []
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]
    const last = runs[runs.length - 1]
    if (last && last.groupLabel === s.groupLabel && s.groupLabel !== undefined) {
      last.steps.push(s)
    } else {
      runs.push({ groupLabel: s.groupLabel, startIndex: i, steps: [s] })
    }
  }
  return runs
}

export function Stepper(props: StepperProps) {
  const {
    steps,
    currentIndex,
    orientation = 'horizontal',
    onStepClick,
    clickableSteps = 'none',
    renderFailedActions,
    groupingMode = 'none',
    ariaLabel = 'Stepper',
    classNamePrefix = 'bat-stepper',
  } = props

  const cx = (suffix: string) => `${classNamePrefix}-${suffix}`

  const resolvedCurrentIndex = useMemo(() => {
    if (typeof currentIndex === 'number') return currentIndex
    return defaultCurrentIndex(steps)
  }, [currentIndex, steps])

  const handleStepActivate = (
    step: StepDescriptor,
    index: number,
  ): void => {
    if (!onStepClick) return
    if (!stepIsClickable(step, clickableSteps)) return
    onStepClick(step, index)
  }

  const handleKeyDown = (
    e: KeyboardEvent<HTMLDivElement>,
    step: StepDescriptor,
    index: number,
  ): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleStepActivate(step, index)
    }
  }

  if (orientation === 'vertical') {
    const runs = buildGroupRuns(steps)
    return (
      <ol
        className={`${cx('root')} ${cx('vertical')}`}
        role="list"
        aria-label={ariaLabel}
      >
        {runs.map((run, runIdx) => {
          const headerKey = `${run.groupLabel ?? '__nogroup__'}-${runIdx}`
          return (
            <Fragment key={headerKey}>
              {run.groupLabel && (
                <li
                  className={cx('group-header')}
                  role="presentation"
                  aria-hidden="true"
                >
                  {run.groupLabel}
                </li>
              )}
              {run.steps.map((step, localIdx) => {
                const index = run.startIndex + localIdx
                const isCurrent = index === resolvedCurrentIndex
                const preset = STATUS_PRESET[step.status]
                const clickable = stepIsClickable(step, clickableSteps) && !!onStepClick
                const describedBy = ariaDescribedByFor(step)
                return (
                  <li
                    key={step.id}
                    className={`${cx('step')} ${cx(`status-${step.status}`)}${isCurrent ? ' ' + cx('current') : ''}${clickable ? ' ' + cx('clickable') : ''}`}
                    role="listitem"
                    aria-current={isCurrent ? 'step' : undefined}
                    aria-describedby={describedBy}
                  >
                    <div
                      className={cx('node-col')}
                      onClick={clickable ? () => handleStepActivate(step, index) : undefined}
                      onKeyDown={clickable ? (e) => handleKeyDown(e, step, index) : undefined}
                      role={clickable ? 'button' : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      aria-label={clickable ? `${step.label} (${preset.label})` : undefined}
                    >
                      <span
                        className={cx('node')}
                        style={{ color: preset.color, borderColor: preset.color }}
                        aria-hidden="true"
                      >
                        {renderIcon(step)}
                      </span>
                      {index < steps.length - 1 && (
                        <span
                          className={`${cx('connector')} ${cx('connector-vertical')}${step.status === 'completed' ? ' ' + cx('connector-done') : ''}`}
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <div className={cx('content-col')}>
                      <div className={cx('label')}>{step.label}</div>
                      {step.description && (
                        <div className={cx('description')}>{step.description}</div>
                      )}
                      {step.status === 'failed' && step.errorMessage && (
                        <div
                          className={cx('error-message')}
                          role="alert"
                          aria-live="polite"
                        >
                          {step.errorMessage}
                        </div>
                      )}
                      {step.status === 'failed' && renderFailedActions && (
                        <div className={cx('failed-actions')}>
                          {renderFailedActions(step, index)}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </Fragment>
          )
        })}
      </ol>
    )
  }

  // Horizontal
  // groupingMode === 'compress' 為 follow-up（保留 prop 與 type，但不渲染 pill）。
  // 連續相同 groupLabel 仍照 step 個別渲染。
  // TODO: grouping mode (compress) — pill + tooltip 完整實作 deferred to follow-up workorder
  return (
    <ol
      className={`${cx('root')} ${cx('horizontal')}${groupingMode === 'compress' ? ' ' + cx('compress-pending') : ''}`}
      role="list"
      aria-label={ariaLabel}
    >
      {steps.map((step, index) => {
        const isCurrent = index === resolvedCurrentIndex
        const preset = STATUS_PRESET[step.status]
        const clickable = stepIsClickable(step, clickableSteps) && !!onStepClick
        const describedBy = ariaDescribedByFor(step)
        return (
          <li
            key={step.id}
            className={`${cx('step')} ${cx(`status-${step.status}`)}${isCurrent ? ' ' + cx('current') : ''}${clickable ? ' ' + cx('clickable') : ''}`}
            role="listitem"
            aria-current={isCurrent ? 'step' : undefined}
            aria-describedby={describedBy}
          >
            <div
              className={cx('node-row')}
              onClick={clickable ? () => handleStepActivate(step, index) : undefined}
              onKeyDown={clickable ? (e) => handleKeyDown(e, step, index) : undefined}
              role={clickable ? 'button' : undefined}
              tabIndex={clickable ? 0 : undefined}
              aria-label={clickable ? `${step.label} (${preset.label})` : undefined}
            >
              <span
                className={cx('node')}
                style={{ color: preset.color, borderColor: preset.color }}
                aria-hidden="true"
              >
                {renderIcon(step)}
              </span>
              <span className={cx('label')}>{step.label}</span>
            </div>
            {index < steps.length - 1 && (
              <span
                className={`${cx('connector')} ${cx('connector-horizontal')}${step.status === 'completed' ? ' ' + cx('connector-done') : ''}`}
                aria-hidden="true"
              />
            )}
            {step.status === 'failed' && step.errorMessage && (
              <div
                className={cx('error-message')}
                role="alert"
                aria-live="polite"
              >
                {step.errorMessage}
              </div>
            )}
          </li>
        )
      })}
    </ol>
  )
}

export type { StepperProps, StepDescriptor, StepStatus } from './types'
export { STATUS_PRESET, worstStatus } from './status-preset'

export default Stepper
