/**
 * T0334 (PLAN-032 Sprint 2): Visual contract snapshot for awaiting-input.
 *
 * Locks the rendered DOM structure (icon + color + a11y attrs) for the
 * canonical mixed-state Stepper layout. Granular ARIA + preset assertions
 * are covered by Stepper.awaiting-input.test.tsx; this file adds:
 *   - inline snapshot of an awaiting-input row in isolation
 *   - inline snapshot of [completed, running, awaiting-input, pending] mix
 *
 * Snapshot scope is intentionally narrow (single row outerHTML / data attrs)
 * to keep the contract robust against className tweaks.
 */
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { Stepper } from '../Stepper'
import type { StepDescriptor } from '../types'

function makeSteps(overrides: Partial<StepDescriptor>[]): StepDescriptor[] {
  return overrides.map((o, i) => ({
    id: o.id ?? `s${i}`,
    label: o.label ?? `Step ${i}`,
    status: o.status ?? 'pending',
    ...o,
  }))
}

describe('<Stepper> awaiting-input visual snapshot (T0334)', () => {
  it('locks the awaiting-input row icon + color + a11y attrs', () => {
    const steps = makeSteps([
      { id: 'pick', label: 'pick distro', status: 'awaiting-input', promptRegionId: 'prompt-1' },
    ])
    const { container } = render(<Stepper steps={steps} />)
    const item = container.querySelector('[role="listitem"]') as HTMLElement
    const node = container.querySelector('.bat-stepper-node') as HTMLElement

    // Visual contract — locked separately so each property reports clearly on
    // mismatch (full outerHTML inline snapshot would be brittle to className
    // shuffles; see workorder risk section).
    expect(node.textContent).toBe('●')
    expect(node.style.color).toBe('rgb(56, 189, 248)') // #38bdf8
    expect(item.getAttribute('aria-current')).toBe('step')
    expect(item.getAttribute('aria-describedby')).toBe('prompt-1')
    expect(item.querySelector('[role="alert"]')).toBeNull()

    // Lock the status class so designers can refactor markup but not break the
    // status-class hook used by tests / CSS.
    expect(item.className).toContain('bat-stepper-status-awaiting-input')
  })

  it('locks the [completed, running, awaiting-input, pending] mix order and statuses', () => {
    const steps = makeSteps([
      { id: 'a', label: 'detect', status: 'completed' },
      { id: 'b', label: 'install', status: 'running' },
      { id: 'c', label: 'pick', status: 'awaiting-input', promptRegionId: 'prompt-c' },
      { id: 'd', label: 'verify', status: 'pending' },
    ])
    const { container } = render(<Stepper steps={steps} orientation="vertical" />)
    const items = Array.from(container.querySelectorAll('[role="listitem"]'))
    expect(items).toHaveLength(4)

    // Snapshot a stable subset: ordered status-class fingerprint. Surfaces any
    // future regression that swaps status order or drops a row, without coupling
    // to className/markup churn.
    const fingerprint = items.map((el) => {
      const cls = el.className.split(/\s+/).find((c) => c.startsWith('bat-stepper-status-'))
      return cls ?? '<missing>'
    })
    expect(fingerprint).toMatchInlineSnapshot(`
      [
        "bat-stepper-status-completed",
        "bat-stepper-status-running",
        "bat-stepper-status-awaiting-input",
        "bat-stepper-status-pending",
      ]
    `)

    // The awaiting-input row (idx 2) is the only one that should expose
    // aria-describedby + the prompt id.
    expect(items[2].getAttribute('aria-describedby')).toBe('prompt-c')
    expect(items[0].getAttribute('aria-describedby')).toBeNull()
    expect(items[1].getAttribute('aria-describedby')).toBeNull()
    expect(items[3].getAttribute('aria-describedby')).toBeNull()
  })
})
