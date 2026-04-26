import { describe, test, expect } from 'vitest'
import { render } from '@testing-library/react'
import { BugWorkflowIndicator } from '../BugWorkflowIndicator'
import type { BugStatus } from '../../types/bug-tracker'

describe('BugWorkflowIndicator', () => {
  const allStatuses: BugStatus[] = ['OPEN', 'FIXING', 'FIXED', 'VERIFY', 'CLOSED', 'WONTFIX']

  test.each(allStatuses)('renders %s status snapshot', (status) => {
    const { container } = render(<BugWorkflowIndicator status={status} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  test('renders relatedWorkOrder link when provided', () => {
    const { getByText } = render(
      <BugWorkflowIndicator status="FIXED" relatedWorkOrder="T0306" />,
    )
    expect(getByText(/T0306/)).toBeInTheDocument()
  })

  test('OPEN status marks first step as running', () => {
    const { container } = render(<BugWorkflowIndicator status="OPEN" />)
    const runningSteps = container.querySelectorAll('.ct-workflow-status-running')
    expect(runningSteps).toHaveLength(1)
    expect(runningSteps[0]).toHaveAttribute('aria-current', 'step')
  })

  test('FIXED status: 2 completed + 1 running + 2 pending', () => {
    const { container } = render(<BugWorkflowIndicator status="FIXED" />)
    expect(container.querySelectorAll('.ct-workflow-status-completed')).toHaveLength(2)
    expect(container.querySelectorAll('.ct-workflow-status-running')).toHaveLength(1)
    expect(container.querySelectorAll('.ct-workflow-status-pending')).toHaveLength(2)
  })

  test('CLOSED status: 4 completed + last step running (preserves legacy amber on CLOSED node)', () => {
    const { container } = render(<BugWorkflowIndicator status="CLOSED" />)
    expect(container.querySelectorAll('.ct-workflow-status-completed')).toHaveLength(4)
    expect(container.querySelectorAll('.ct-workflow-status-running')).toHaveLength(1)
  })

  test('WONTFIX status renders branch node alongside main flow', () => {
    const { container } = render(<BugWorkflowIndicator status="WONTFIX" />)
    // 主流程 5 步全部 pending（faded）
    expect(container.querySelectorAll('.ct-workflow-status-pending')).toHaveLength(5)
    // 額外 WONTFIX 分支節點
    const branch = container.querySelector('.ct-workflow-wontfix-branch')
    expect(branch).toBeInTheDocument()
    expect(branch?.textContent).toMatch(/WONTFIX/)
  })

  test('guidance message shows action-required for FIXED', () => {
    const { container } = render(<BugWorkflowIndicator status="FIXED" />)
    const guidance = container.querySelector('.ct-workflow-guidance')
    expect(guidance).toHaveClass('ct-workflow-action-required')
    expect(guidance?.textContent).toMatch(/需要你介入/)
  })

  test('guidance message no action-required for OPEN', () => {
    const { container } = render(<BugWorkflowIndicator status="OPEN" />)
    const guidance = container.querySelector('.ct-workflow-guidance')
    expect(guidance).not.toHaveClass('ct-workflow-action-required')
  })
})
