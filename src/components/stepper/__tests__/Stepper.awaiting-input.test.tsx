/**
 * T0330 (PLAN-032 Sprint 2): awaiting-input status tests for <Stepper>.
 *
 * Coverage:
 *  - awaiting-input renders preset icon + color (#38bdf8)
 *  - does NOT render Retry/Skip CTA (failed-only)
 *  - does NOT mount role="alert" (no error)
 *  - aria-current="step" still works for the active row
 *  - aria-describedby wires to promptRegionId only when status=awaiting-input
 *  - existing 6 statuses still render (regression guard for AC-5 #1.3)
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Stepper } from '../Stepper'
import { STATUS_PRESET } from '../status-preset'
import type { StepDescriptor } from '../types'

function makeSteps(overrides: Partial<StepDescriptor>[] = []): StepDescriptor[] {
  return overrides.map((o, i) => ({
    id: o.id ?? `s${i}`,
    label: o.label ?? `Step ${i}`,
    status: o.status ?? 'pending',
    ...o,
  }))
}

describe('<Stepper> awaiting-input (T0330)', () => {
  it('renders awaiting-input preset icon and color', () => {
    const steps = makeSteps([{ id: 'a', label: 'pick distro', status: 'awaiting-input' }])
    const { container } = render(<Stepper steps={steps} />)
    expect(screen.getByText(STATUS_PRESET['awaiting-input'].icon)).toBeInTheDocument()
    const node = container.querySelector('.bat-stepper-node') as HTMLElement
    // #38bdf8 -> rgb(56, 189, 248)
    expect(node.style.color).toBe('rgb(56, 189, 248)')
  })

  it('does NOT render Retry/Skip CTA for awaiting-input rows', () => {
    const renderFailedActions = vi.fn(() => <button>retry</button>)
    const steps = makeSteps([{ id: 'a', label: 'a', status: 'awaiting-input' }])
    render(
      <Stepper
        steps={steps}
        orientation="vertical"
        renderFailedActions={renderFailedActions}
      />,
    )
    // renderFailedActions is failed-only, so it must NOT be invoked for
    // awaiting-input rows.
    expect(renderFailedActions).not.toHaveBeenCalled()
    expect(screen.queryByText('retry')).toBeNull()
  })

  it('does NOT mount role="alert" for awaiting-input rows', () => {
    const steps = makeSteps([
      // errorMessage exists but should be ignored when status=awaiting-input
      { id: 'a', label: 'a', status: 'awaiting-input', errorMessage: 'should-not-render' },
    ])
    render(<Stepper steps={steps} orientation="vertical" />)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByText('should-not-render')).toBeNull()
  })

  it('preserves aria-current="step" on awaiting-input row', () => {
    const steps = makeSteps([
      { id: 'done', label: 'done', status: 'completed' },
      { id: 'wait', label: 'pick', status: 'awaiting-input' },
      { id: 'todo', label: 'todo', status: 'pending' },
    ])
    const { container } = render(<Stepper steps={steps} />)
    const items = container.querySelectorAll('[role="listitem"]')
    expect(items[1].getAttribute('aria-current')).toBe('step')
    expect(items[0].getAttribute('aria-current')).toBeNull()
    expect(items[2].getAttribute('aria-current')).toBeNull()
  })

  it('wires aria-describedby to promptRegionId only when status=awaiting-input', () => {
    const steps = makeSteps([
      { id: 'wait', label: 'pick', status: 'awaiting-input', promptRegionId: 'prompt-1' },
      // promptRegionId on a non-awaiting-input row must be ignored.
      { id: 'run', label: 'run', status: 'running', promptRegionId: 'prompt-2' },
    ])
    const { container } = render(<Stepper steps={steps} />)
    const items = container.querySelectorAll('[role="listitem"]')
    expect(items[0].getAttribute('aria-describedby')).toBe('prompt-1')
    expect(items[1].getAttribute('aria-describedby')).toBeNull()
  })

  it('does not set aria-describedby when promptRegionId is missing', () => {
    const steps = makeSteps([{ id: 'wait', label: 'pick', status: 'awaiting-input' }])
    const { container } = render(<Stepper steps={steps} />)
    const item = container.querySelector('[role="listitem"]') as HTMLElement
    expect(item.getAttribute('aria-describedby')).toBeNull()
  })

  it('renders all 7 statuses without regression (snapshot of icons)', () => {
    const allStatuses: StepDescriptor['status'][] = [
      'pending',
      'running',
      'awaiting-input',
      'completed',
      'failed',
      'skipped',
      'rolled-back',
    ]
    const steps = makeSteps(allStatuses.map((status, i) => ({ id: `s${i}`, label: status, status })))
    render(<Stepper steps={steps} />)
    for (const status of allStatuses) {
      expect(screen.getByText(STATUS_PRESET[status].icon)).toBeInTheDocument()
    }
  })

  it('vertical mode also wires aria-describedby on awaiting-input rows', () => {
    const steps = makeSteps([
      { id: 'wait', label: 'pick', status: 'awaiting-input', promptRegionId: 'prompt-v' },
    ])
    const { container } = render(<Stepper steps={steps} orientation="vertical" />)
    const item = container.querySelector('[role="listitem"]') as HTMLElement
    expect(item.getAttribute('aria-describedby')).toBe('prompt-v')
  })

  it('worstStatus places awaiting-input above skipped, below running', async () => {
    const { worstStatus } = await import('../status-preset')
    expect(worstStatus(['skipped', 'awaiting-input'])).toBe('awaiting-input')
    expect(worstStatus(['running', 'awaiting-input'])).toBe('running')
    expect(worstStatus(['failed', 'awaiting-input'])).toBe('failed')
  })
})
