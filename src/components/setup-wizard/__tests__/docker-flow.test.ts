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
    // T0853 (D283 U2): the default is a base image; the bundle goes into a volume.
    expect(ctx.state.dockerImage).toBe('buildpack-deps:bookworm-scm')
    // T0849: no token is seeded — start-server reads it from the container once healthy.
    expect(ctx.remoteToken).toBeUndefined()
    expect(ctx.state.remoteToken).toBeUndefined()
  })

  it('T0849: start-server (token read after healthy) runs before the steps that use the token', () => {
    const ids = buildDockerWizardSteps().map((step) => step.id)
    expect(ids.indexOf('start-server')).toBeLessThan(ids.indexOf('fetch-fingerprint'))
    expect(ids.indexOf('start-server')).toBeLessThan(ids.indexOf('connect-test'))
    expect(ids.indexOf('connect-test')).toBeLessThan(ids.indexOf('write-profile'))
  })

  it('T0849: start-server is retryable, so docker-token-unavailable offers Retry', () => {
    expect(buildDockerWizardSteps().find((step) => step.id === 'start-server')?.retryable).toBe(true)
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
