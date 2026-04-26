/**
 * Unit tests for <Stepper> (T0307).
 *
 * NOTE: 本專案目前未安裝 vitest / jest 框架（package.json 僅含 @playwright/test
 * 用於 e2e）。本檔案以 vitest + @testing-library/react 標準語法撰寫，待後續工單
 * 補上 vitest config 與 dev deps 後即可執行。安裝指令：
 *
 *   npm i -D vitest @testing-library/react @testing-library/jest-dom \
 *     @testing-library/user-event jsdom
 *
 * 並在 vite.config.ts 加入 test 區塊：
 *
 *   test: { environment: 'jsdom', globals: true, setupFiles: ['./vitest.setup.ts'] }
 *
 * 涵蓋範圍（≥ 10 cases）：
 * - 6 status icon + color render
 * - horizontal vs vertical layout
 * - currentIndex 預設行為
 * - clickableSteps 三種模式
 * - onStepClick 觸發
 * - renderFailedActions slot
 * - groupLabel 連續合併（vertical）
 * - a11y attributes
 */

import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { Stepper } from '../Stepper'
import { STATUS_PRESET, worstStatus } from '../status-preset'
import type { StepDescriptor, StepStatus } from '../types'

const ALL_STATUSES: StepStatus[] = [
  'pending',
  'running',
  'completed',
  'failed',
  'skipped',
  'rolled-back',
]

function makeSteps(overrides: Partial<StepDescriptor>[] = []): StepDescriptor[] {
  return overrides.map((o, i) => ({
    id: o.id ?? `s${i}`,
    label: o.label ?? `Step ${i}`,
    status: o.status ?? 'pending',
    ...o,
  }))
}

describe('<Stepper>', () => {
  it('renders all 6 statuses with their preset icons', () => {
    const steps = makeSteps(
      ALL_STATUSES.map((status, i) => ({ id: `s${i}`, label: status, status })),
    )
    render(<Stepper steps={steps} ariaLabel="all-statuses" />)
    for (const status of ALL_STATUSES) {
      expect(screen.getByText(STATUS_PRESET[status].icon)).toBeInTheDocument()
    }
  })

  it('applies preset color to each status node', () => {
    const steps = makeSteps([{ id: 'a', label: 'Done', status: 'completed' }])
    const { container } = render(<Stepper steps={steps} />)
    const node = container.querySelector('.bat-stepper-node') as HTMLElement
    expect(node.style.color).toBe('rgb(16, 185, 129)') // #10b981
  })

  it('renders horizontal orientation by default', () => {
    const steps = makeSteps([{ id: 'a', label: 'A' }])
    const { container } = render(<Stepper steps={steps} />)
    expect(container.querySelector('.bat-stepper-horizontal')).not.toBeNull()
    expect(container.querySelector('.bat-stepper-vertical')).toBeNull()
  })

  it('renders vertical orientation when prop set', () => {
    const steps = makeSteps([{ id: 'a', label: 'A' }])
    const { container } = render(<Stepper steps={steps} orientation="vertical" />)
    expect(container.querySelector('.bat-stepper-vertical')).not.toBeNull()
  })

  it('defaults currentIndex to first running step', () => {
    const steps = makeSteps([
      { id: '1', label: 'one', status: 'completed' },
      { id: '2', label: 'two', status: 'running' },
      { id: '3', label: 'three', status: 'pending' },
    ])
    const { container } = render(<Stepper steps={steps} />)
    const items = container.querySelectorAll('[role="listitem"]')
    expect(items[1].getAttribute('aria-current')).toBe('step')
    expect(items[0].getAttribute('aria-current')).toBeNull()
  })

  it('honors explicit currentIndex prop', () => {
    const steps = makeSteps([
      { id: '1', label: 'one', status: 'completed' },
      { id: '2', label: 'two', status: 'running' },
    ])
    const { container } = render(<Stepper steps={steps} currentIndex={0} />)
    const items = container.querySelectorAll('[role="listitem"]')
    expect(items[0].getAttribute('aria-current')).toBe('step')
  })

  it('clickableSteps="completed" only allows completed steps to fire onStepClick', () => {
    const onClick = vi.fn()
    const steps = makeSteps([
      { id: '1', label: 'done', status: 'completed' },
      { id: '2', label: 'running', status: 'running' },
    ])
    const { container } = render(
      <Stepper steps={steps} onStepClick={onClick} clickableSteps="completed" />,
    )
    const buttons = container.querySelectorAll('[role="button"]')
    expect(buttons.length).toBe(1)
    fireEvent.click(buttons[0])
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onClick.mock.calls[0][0].id).toBe('1')
  })

  it('clickableSteps="all" makes every step clickable', () => {
    const onClick = vi.fn()
    const steps = makeSteps([
      { id: '1', label: 'a', status: 'pending' },
      { id: '2', label: 'b', status: 'running' },
    ])
    const { container } = render(
      <Stepper steps={steps} onStepClick={onClick} clickableSteps="all" />,
    )
    expect(container.querySelectorAll('[role="button"]').length).toBe(2)
  })

  it('clickableSteps="none" (default) disables interactivity', () => {
    const onClick = vi.fn()
    const steps = makeSteps([{ id: '1', label: 'a', status: 'completed' }])
    const { container } = render(<Stepper steps={steps} onStepClick={onClick} />)
    expect(container.querySelectorAll('[role="button"]').length).toBe(0)
  })

  it('onStepClick fires on Enter key (a11y keyboard support)', () => {
    const onClick = vi.fn()
    const steps = makeSteps([{ id: '1', label: 'go', status: 'completed' }])
    const { container } = render(
      <Stepper steps={steps} onStepClick={onClick} clickableSteps="all" />,
    )
    const btn = container.querySelector('[role="button"]') as HTMLElement
    fireEvent.keyDown(btn, { key: 'Enter' })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renderFailedActions slot renders custom actions for failed steps only', () => {
    const steps = makeSteps([
      { id: '1', label: 'ok', status: 'completed' },
      { id: '2', label: 'oops', status: 'failed', errorMessage: 'boom' },
    ])
    render(
      <Stepper
        steps={steps}
        orientation="vertical"
        renderFailedActions={(s) => <button>retry-{s.id}</button>}
      />,
    )
    expect(screen.getByText('retry-2')).toBeInTheDocument()
    expect(screen.queryByText('retry-1')).toBeNull()
  })

  it('renders failed errorMessage with role=alert', () => {
    const steps = makeSteps([
      { id: '1', label: 'oops', status: 'failed', errorMessage: 'boom' },
    ])
    render(<Stepper steps={steps} orientation="vertical" />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toBe('boom')
  })

  it('vertical mode merges consecutive groupLabel into a single header', () => {
    const steps = makeSteps([
      { id: '1', label: 'a', status: 'completed', groupLabel: 'Connect' },
      { id: '2', label: 'b', status: 'completed', groupLabel: 'Connect' },
      { id: '3', label: 'c', status: 'pending', groupLabel: 'Configure' },
    ])
    const { container } = render(<Stepper steps={steps} orientation="vertical" />)
    const headers = container.querySelectorAll('.bat-stepper-group-header')
    expect(headers.length).toBe(2)
    expect(headers[0].textContent).toBe('Connect')
    expect(headers[1].textContent).toBe('Configure')
  })

  it('exposes ariaLabel on the list root', () => {
    const steps = makeSteps([{ id: '1', label: 'a' }])
    render(<Stepper steps={steps} ariaLabel="setup wizard" />)
    expect(screen.getByRole('list', { name: 'setup wizard' })).toBeInTheDocument()
  })

  it('classNamePrefix prop swaps the class namespace', () => {
    const steps = makeSteps([{ id: '1', label: 'a' }])
    const { container } = render(
      <Stepper steps={steps} classNamePrefix="custom-prefix" />,
    )
    expect(container.querySelector('.custom-prefix-root')).not.toBeNull()
    expect(container.querySelector('.bat-stepper-root')).toBeNull()
  })
})

describe('worstStatus()', () => {
  it('returns failed when any step failed', () => {
    expect(worstStatus(['completed', 'failed', 'running'])).toBe('failed')
  })
  it('returns running when no failed but any running', () => {
    expect(worstStatus(['completed', 'running', 'pending'])).toBe('running')
  })
  it('falls back to pending for empty input', () => {
    expect(worstStatus([])).toBe('pending')
  })
})

// Avoid unused import lint warning when test runner not yet wired.
void within
