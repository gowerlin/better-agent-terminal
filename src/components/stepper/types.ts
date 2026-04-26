import type { ReactNode } from 'react'

export type StepperOrientation = 'horizontal' | 'vertical'

export type StepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'rolled-back'

export interface StepDescriptor {
  id: string
  label: string
  description?: string
  icon?: string | ReactNode
  status: StepStatus
  retryable?: boolean
  errorMessage?: string
  groupLabel?: string
}

export type StepperClickableMode = 'completed' | 'all' | 'none'
export type StepperGroupingMode = 'none' | 'compress'

export interface StepperProps {
  steps: StepDescriptor[]
  currentIndex?: number
  orientation?: StepperOrientation
  onStepClick?: (step: StepDescriptor, index: number) => void
  clickableSteps?: StepperClickableMode
  renderFailedActions?: (step: StepDescriptor, index: number) => ReactNode
  groupingMode?: StepperGroupingMode
  ariaLabel?: string
  classNamePrefix?: string
}
