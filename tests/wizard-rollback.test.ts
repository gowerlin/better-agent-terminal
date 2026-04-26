import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  WizardRunner,
  WizardStepStatus,
  type WizardContext,
  type WizardStep,
} from '../src/components/setup-wizard/wizard-runner'

interface RollbackErrors {
  rollbackErrors?: Array<{ stepId: string; message: string }>
}

function makeContext(): WizardContext & RollbackErrors {
  const ctx: WizardContext & RollbackErrors = {
    targetOS: 'wsl-linux',
    profileDraft: {},
    warnings: [],
    state: {},
    logger: {
      info: () => undefined,
      warn: (message) => {
        ctx.warnings.push(`warn:${message}`)
      },
      error: () => undefined,
    },
  }
  return ctx
}

// PLAN-007 T0289 AC6 — best-effort rollback chain (RFC C-3) unit tests.
// These exercise WizardRunner directly with synthetic steps so the contract
// is provable without dragging WSL/Docker/SSH wiring into the assertion path.

test('T0289 case1: all steps succeed → no rollback called', async () => {
  const calls: string[] = []
  const steps: WizardStep[] = ['one', 'two', 'three'].map((id) => ({
    id,
    title: id,
    appliesTo: 'all' as const,
    retryable: false,
    async run() {
      calls.push(`run:${id}`)
    },
    async rollback() {
      calls.push(`rollback:${id}`)
    },
  }))

  const runner = new WizardRunner(steps, makeContext())
  await runner.run()

  assert.deepEqual(calls, ['run:one', 'run:two', 'run:three'])
  assert.ok(runner.getSnapshots().every((s) => s.status === WizardStepStatus.Succeeded))
})

test('T0289 case2: step 2 fails → step 1 rollback called, step 3 not run', async () => {
  const calls: string[] = []
  const steps: WizardStep[] = [
    {
      id: 'one',
      title: 'one',
      appliesTo: 'all',
      retryable: false,
      async run() {
        calls.push('run:one')
      },
      async rollback() {
        calls.push('rollback:one')
      },
    },
    {
      id: 'two',
      title: 'two',
      appliesTo: 'all',
      retryable: false,
      async run() {
        calls.push('run:two')
        throw new Error('two-failed')
      },
      async rollback() {
        calls.push('rollback:two')
      },
    },
    {
      id: 'three',
      title: 'three',
      appliesTo: 'all',
      retryable: false,
      async run() {
        calls.push('run:three')
      },
      async rollback() {
        calls.push('rollback:three')
      },
    },
  ]

  const runner = new WizardRunner(steps, makeContext())
  await assert.rejects(() => runner.run(), /two-failed/)

  // Failed step 2 also gets its own rollback shot (rollbackFailedStep)
  // before the chain unwinds completed steps.
  assert.deepEqual(calls, ['run:one', 'run:two', 'rollback:two', 'rollback:one'])
  assert.equal(calls.includes('run:three'), false)
  assert.equal(calls.includes('rollback:three'), false)

  const snapshots = runner.getSnapshots()
  assert.equal(snapshots[0].status, WizardStepStatus.RolledBack)
  assert.equal(snapshots[1].status, WizardStepStatus.Failed)
  assert.equal(snapshots[2].status, WizardStepStatus.Pending)
})

test('T0289 case3: step 3 fails → step 1 + step 2 rollback called in reverse', async () => {
  const calls: string[] = []
  const steps: WizardStep[] = [
    {
      id: 'one',
      title: 'one',
      appliesTo: 'all',
      retryable: false,
      async run() {
        calls.push('run:one')
      },
      async rollback() {
        calls.push('rollback:one')
      },
    },
    {
      id: 'two',
      title: 'two',
      appliesTo: 'all',
      retryable: false,
      async run() {
        calls.push('run:two')
      },
      async rollback() {
        calls.push('rollback:two')
      },
    },
    {
      id: 'three',
      title: 'three',
      appliesTo: 'all',
      retryable: false,
      async run() {
        calls.push('run:three')
        throw new Error('three-failed')
      },
    },
  ]

  const runner = new WizardRunner(steps, makeContext())
  await assert.rejects(() => runner.run(), /three-failed/)

  // Reverse order: step 3 has no rollback so chain only touches step 2 then 1.
  assert.deepEqual(calls, ['run:one', 'run:two', 'run:three', 'rollback:two', 'rollback:one'])
})

test('T0289 case4: rollback throws → log warning, subsequent rollbacks still run', async () => {
  const ctx = makeContext()
  const calls: string[] = []
  const steps: WizardStep[] = [
    {
      id: 'one',
      title: 'one',
      appliesTo: 'all',
      retryable: false,
      async run() {
        calls.push('run:one')
      },
      async rollback() {
        calls.push('rollback:one')
      },
    },
    {
      id: 'two',
      title: 'two',
      appliesTo: 'all',
      retryable: false,
      async run() {
        calls.push('run:two')
      },
      async rollback() {
        calls.push('rollback:two')
        throw new Error('rollback-two-broke')
      },
    },
    {
      id: 'three',
      title: 'three',
      appliesTo: 'all',
      retryable: false,
      async run() {
        calls.push('run:three')
        throw new Error('three-failed')
      },
    },
  ]

  const runner = new WizardRunner(steps, ctx)
  await assert.rejects(() => runner.run(), /three-failed/)

  // rollback:two threw but rollback:one still ran (best-effort, not atomic).
  assert.deepEqual(calls, ['run:one', 'run:two', 'run:three', 'rollback:two', 'rollback:one'])
  const warned = ctx.warnings.some((w) => w.startsWith('warn:Rollback failed for two'))
  assert.equal(warned, true, 'logger.warn should fire for the failing rollback')
})

test('T0289 case5: step without rollback property is skipped but reverse order preserved', async () => {
  const calls: string[] = []
  const steps: WizardStep[] = [
    {
      id: 'one',
      title: 'one',
      appliesTo: 'all',
      retryable: false,
      async run() {
        calls.push('run:one')
      },
      async rollback() {
        calls.push('rollback:one')
      },
    },
    {
      id: 'two-no-rollback',
      title: 'two',
      appliesTo: 'all',
      retryable: false,
      async run() {
        calls.push('run:two')
      },
      // intentionally no rollback fn
    },
    {
      id: 'three',
      title: 'three',
      appliesTo: 'all',
      retryable: false,
      async run() {
        calls.push('run:three')
      },
      async rollback() {
        calls.push('rollback:three')
      },
    },
    {
      id: 'four',
      title: 'four',
      appliesTo: 'all',
      retryable: false,
      async run() {
        calls.push('run:four')
        throw new Error('four-failed')
      },
    },
  ]

  const runner = new WizardRunner(steps, makeContext())
  await assert.rejects(() => runner.run(), /four-failed/)

  // step 2 has no rollback so it is silently skipped; step 3 then step 1 still
  // unwind in reverse.
  assert.deepEqual(calls, [
    'run:one',
    'run:two',
    'run:three',
    'run:four',
    'rollback:three',
    'rollback:one',
  ])
})

test('T0289 case6: rollback failures accumulate as warn entries on the logger', async () => {
  const ctx = makeContext()
  const steps: WizardStep[] = [
    {
      id: 'one',
      title: 'one',
      appliesTo: 'all',
      retryable: false,
      async run() {},
      async rollback() {
        throw new Error('one-rollback-broke')
      },
    },
    {
      id: 'two',
      title: 'two',
      appliesTo: 'all',
      retryable: false,
      async run() {},
      async rollback() {
        throw new Error('two-rollback-broke')
      },
    },
    {
      id: 'three',
      title: 'three',
      appliesTo: 'all',
      retryable: false,
      async run() {
        throw new Error('three-failed')
      },
    },
  ]

  const runner = new WizardRunner(steps, ctx)
  await assert.rejects(() => runner.run(), /three-failed/)

  const oneWarn = ctx.warnings.some((w) => w.includes('Rollback failed for one') && w.includes('one-rollback-broke'))
  const twoWarn = ctx.warnings.some((w) => w.includes('Rollback failed for two') && w.includes('two-rollback-broke'))
  assert.equal(oneWarn, true, 'rollback failure for "one" should warn-log')
  assert.equal(twoWarn, true, 'rollback failure for "two" should warn-log')
})
