import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildDockerWizardSteps, createDockerWizardContext } from '../src/components/setup-wizard/docker-flow'

test('buildDockerWizardSteps returns the expected 9-step Docker order', () => {
  const steps = buildDockerWizardSteps()
  assert.deepEqual(steps.map((step) => step.id), [
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

test('createDockerWizardContext seeds Docker-specific state', () => {
  const ctx = createDockerWizardContext({ profileName: 'Docker Dev' })
  assert.equal(ctx.targetOS, 'docker-linux')
  assert.equal(ctx.serverPort, 9876)
  assert.deepEqual(ctx.state.dockerMounts, [])
  assert.equal(ctx.state.containerMode, 'unknown')
  assert.equal(ctx.state.dockerImage, 'bat-server:latest')
})

test('Docker-specific steps expose rollback handlers', () => {
  const steps = buildDockerWizardSteps()
  for (const stepId of ['pick-container', 'configure-mounts', 'install-server-bundle', 'start-server']) {
    const step = steps.find((entry) => entry.id === stepId)
    assert.ok(step)
    assert.equal(typeof step?.rollback, 'function')
  }
})
