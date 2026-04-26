import assert from 'node:assert/strict'
import { test } from 'node:test'
import { WizardRunner, WizardStepStatus, type WizardContext, type WizardStep } from '../src/components/setup-wizard/wizard-runner'

function makeContext(): WizardContext {
  return {
    targetOS: 'wsl-linux',
    profileDraft: {},
    warnings: [],
    state: {},
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
  }
}

test('WizardRunner rolls back completed steps in reverse order', async () => {
  const calls: string[] = []
  const steps: WizardStep[] = [
    {
      id: 'one',
      title: 'Step one',
      appliesTo: 'all',
      async run() {
        calls.push('run:one')
      },
      async rollback() {
        calls.push('rollback:one')
      },
    },
    {
      id: 'two',
      title: 'Step two',
      appliesTo: 'all',
      async run() {
        calls.push('run:two')
      },
      async rollback() {
        calls.push('rollback:two')
      },
    },
    {
      id: 'three',
      title: 'Step three',
      appliesTo: 'all',
      retryable: false,
      async run() {
        calls.push('run:three')
        throw new Error('boom')
      },
    },
  ]

  const runner = new WizardRunner(steps, makeContext())

  await assert.rejects(() => runner.run(), /boom/)
  assert.deepEqual(calls, ['run:one', 'run:two', 'run:three', 'rollback:two', 'rollback:one'])

  const snapshots = runner.getSnapshots()
  assert.equal(snapshots[0].status, WizardStepStatus.RolledBack)
  assert.equal(snapshots[1].status, WizardStepStatus.RolledBack)
  assert.equal(snapshots[2].status, WizardStepStatus.Failed)
})
