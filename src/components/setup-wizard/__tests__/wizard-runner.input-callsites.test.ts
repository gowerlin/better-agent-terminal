/**
 * T0330 (PLAN-032 Sprint 2) AC-5 #3: callsite snapshot tests.
 *
 * Confirms each input-kind step is properly tagged so the runner flips
 * status to awaiting-input. We do NOT execute the steps (they call
 * window.electronAPI which doesn't exist in jsdom) — we just inspect the
 * exported WizardStep object metadata.
 */
import { describe, expect, it } from 'vitest'
import { configureSshHostStep } from '../steps/ssh/configure-host'
import { pickWslDistroStep } from '../steps/wsl/pick-wsl-distro'
import { pickContainerStep } from '../steps/docker/pick-container'
import { configureMountsStep } from '../steps/docker/configure-mounts'

describe('input-step callsite tagging (T0330 AC-4)', () => {
  it('SSH configure-host is kind: input', () => {
    expect(configureSshHostStep.kind).toBe('input')
  })

  it('WSL pick-wsl-distro is kind: input', () => {
    expect(pickWslDistroStep.kind).toBe('input')
  })

  it('Docker pick-container is kind: input', () => {
    expect(pickContainerStep.kind).toBe('input')
  })

  it('Docker configure-mounts is kind: input', () => {
    expect(configureMountsStep.kind).toBe('input')
  })
})
