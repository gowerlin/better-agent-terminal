// T0682 (BUG-168 G4): steps put i18next.t() text into ctx.warnings (T0383);
// without the app's i18n they push `undefined`. Same init as the renderer.
import '../../src/i18n'
import {
  WizardRunner,
  WizardStepStatus,
  type WizardContext,
  type WizardStep,
  type WizardStepSnapshot,
} from '../../src/components/setup-wizard/wizard-runner'

export interface TestWizardRunnerOptions {
  /** Called on every progress emit, before the fail-fast check. */
  onProgress?: (snapshots: WizardStepSnapshot[], runner: WizardRunner) => void
  /**
   * Return true for a failure the test answers itself (retry / skip / jump /
   * cancel from `onProgress`). Every other failure cancels the run.
   */
  expectFailure?: (snapshot: WizardStepSnapshot) => boolean
}

/**
 * T0682 (BUG-168 G4): a retryable step that fails makes WizardRunner wait for
 * retry / skip / cancel (T0274). Tests have no user to answer, so a step that
 * failed on a missing mock IPC used to hang until the test timed out. This
 * runner cancels on the first failure the test does not expect; the failure
 * emit comes before the runner starts waiting, so run() rejects with the
 * step's own error (e.g. `window.electronAPI.docker.pickServerPort is not a
 * function`) after rolling back, the same as a non-retryable step.
 */
export function createTestWizardRunner(
  steps: WizardStep[],
  ctx: WizardContext,
  options: TestWizardRunnerOptions = {},
): WizardRunner {
  let runner: WizardRunner | undefined
  const cancelled = new Set<string>()
  runner = new WizardRunner(steps, ctx, (snapshots) => {
    // The constructor emits once before `runner` is assigned; nothing can
    // have failed yet.
    if (!runner) return
    options.onProgress?.(snapshots, runner)
    for (const snapshot of snapshots) {
      // A non-retryable failure never waits; the runner rolls back and throws.
      if (snapshot.status !== WizardStepStatus.Failed || !snapshot.retryable || cancelled.has(snapshot.id)) continue
      if (options.expectFailure?.(snapshot)) continue
      cancelled.add(snapshot.id)
      ctx.logger?.error(`[test] step ${snapshot.id} failed, cancelling: ${snapshot.error ?? 'unknown error'}`)
      void runner.cancel()
    }
  })
  return runner
}
