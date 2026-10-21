/**
 * Docker wizard flow shape: step order, seeded context, rollback handlers.
 * Moved from tests/docker-flow.test.ts by T0680 (BUG-168); the context presets
 * no port since T0649 (BUG-156), start-server picks the host port.
 */
import { describe, expect, it } from 'vitest'
import { buildDockerWizardSteps, createDockerWizardContext } from '../docker-flow'

describe('docker-flow', () => {
  it('buildDockerWizardSteps returns the 9-step Docker order', () => {
    expect(buildDockerWizardSteps().map((step) => step.id)).toEqual([
      'detect-env',
      'pick-container',
      'configure-mounts',
      'install-server-bundle',
      'start-server',
      'fetch-fingerprint',
      'connect-test',
      'write-profile',
      'done',
    ])
  })

  it('createDockerWizardContext seeds Docker-specific state and no port', () => {
    const ctx = createDockerWizardContext({ profileName: 'Docker Demo' })
    expect(ctx.targetOS).toBe('docker-linux')
    expect(ctx.profileDraft).toEqual({ name: 'Docker Demo' })
    expect(ctx.serverPort).toBeUndefined()
    expect(ctx.state.dockerMounts).toEqual([])
    expect(ctx.state.containerMode).toBe('unknown')
    expect(ctx.state.dockerImage).toBe('bat-server:latest')
  })

  it.each(['pick-container', 'configure-mounts', 'install-server-bundle', 'start-server'])(
    'the Docker-specific step %s has a rollback handler',
    (stepId) => {
      const step = buildDockerWizardSteps().find((entry) => entry.id === stepId)
      expect(step).toBeDefined()
      expect(typeof step?.rollback).toBe('function')
    },
  )
})
