# Wizard Error UX Spec

## Status

- Status: draft for PLAN-032 follow-up implementation work
- Source research: `T0328`

## Goals

- Distinguish `awaiting-input` from true execution failure.
- Standardize friendly error mapping without forcing an all-at-once migration to structured exceptions.
- Add a reusable pre-flight hook for environment readiness checks.
- Replace the fixed failed-step CTA set with typed recovery actions.

## 1. Stepper Status Extension

### New status

Add `awaiting-input` to both:

- `src/components/Stepper/types.ts::StepStatus`
- `src/components/setup-wizard/wizard-runner.ts::WizardStepStatus`

### Visual contract

| Status | Icon | Color | Behavior |
|--------|------|-------|----------|
| `awaiting-input` | `●` | `#38bdf8` | blue outline, no failure alert, no Retry/Skip slot |

### A11y contract

- Keep `aria-current="step"` on the active step.
- Add `aria-describedby` from the step node to the active prompt region when an input step is waiting.
- Do not use `role="alert"` for `awaiting-input`; that remains failure-only.
- Detail panel should announce a neutral prompt such as `Waiting for required input`.

### Transition rules

- `pending -> awaiting-input`
- `awaiting-input -> running`
- `awaiting-input -> failed`
- `awaiting-input -> skipped`
- `running -> failed|completed|skipped`
- `failed -> pending` only through retry or jump-back reset

Forbidden:

- `completed -> awaiting-input`
- `failed -> awaiting-input` without an explicit retry/reset
- `skipped -> awaiting-input`

## 2. Wizard Runner Contract

### Step kind

Extend `WizardStep` with:

```ts
type WizardStepKind = 'task' | 'input'

interface WizardStep {
  kind?: WizardStepKind
  preflight?: (ctx: WizardContext) => Promise<WizardPreflightResult>
  getRecoveryActions?: (
    ctx: WizardContext,
    snapshot: WizardStepSnapshot,
    helpers: WizardRecoveryHelpers,
  ) => WizardRecoveryAction[]
}
```

`kind` defaults to `task`.

### Input-step behavior

- `kind: 'input'` steps may call `ctx.requestChoice(...)` or future form APIs before validation completes.
- While waiting, runner snapshot status becomes `awaiting-input`.
- Validation errors before the user has submitted input should stay inside the prompt model when possible, not throw terminal step errors.
- Throw only after the user has actively submitted invalid or unreachable data.

## 3. Error Mapping

### Recommended shape

```ts
interface WizardErrorMatch {
  id: string
  platforms: WizardTargetOS[] | 'all'
  stepIds?: string[]
  errorCodes?: string[]
  patterns?: RegExp[]
  messageKey: string
  detailMode?: 'append-raw' | 'hidden-by-default'
  actions?: WizardRecoveryActionTemplate[]
}
```

### Resolution order

1. Exact `errorCode` match
2. Step-scoped regex match
3. Platform-wide regex match
4. Fallback raw error

### Why this shape

- SSH already emits structured `errorCode` values (`verify-auth`, `start-server`).
- WSL and Docker still mostly throw raw strings.
- Mixed mode allows Sprint 2 framework work to ship before every step is upgraded.

## 4. Pre-flight Hook

### API

```ts
interface WizardPreflightResult {
  ok: boolean
  reason?: string
  errorCode?: string
  cacheKey?: string
  ttlMs?: number
  warningOnly?: boolean
}
```

### Runner semantics

- If `preflight` exists, run it before `step.run()`.
- Cache only when `cacheKey` is returned.
- `warningOnly` appends to `ctx.warnings` and continues.
- Hard failure goes through the same error-mapper pipeline as runtime failures.

### First target scenarios

- Docker daemon availability before container mode selection.
- WSL systemd / linger readiness before service registration.
- SSH host alias existence before auth probe.

## 5. Recovery Actions

### Recommended hybrid model

```ts
type WizardRecoveryAction =
  | { kind: 'retry'; label?: string }
  | { kind: 'fixed-and-retry'; label?: string }
  | { kind: 'open-link'; label: string; href: string }
  | { kind: 'edit-config'; label?: string; targetStepId?: string }
  | { kind: 'skip'; label?: string }
  | { kind: 'cancel'; label?: string }
  | { kind: 'custom'; label: string; run: () => Promise<void> | void }
```

### Shell behavior

- `retry`, `skip`, `cancel` map to existing `WizardRunner` commands.
- `fixed-and-retry` keeps the step failed until the user confirms remediation.
- `edit-config` jump-backs to the nearest editable predecessor or explicit target.
- `open-link` delegates to Electron shell open.

## 6. Initial Mapping Targets

| Platform | Step | Pattern / code | Friendly intent |
|----------|------|----------------|-----------------|
| Docker | `detect-env` | daemon unavailable / missing pipe / cannot connect | Docker Desktop not installed or not running |
| WSL | `write-systemd-unit` | linger enable failure | explain lingering and offer manual fix |
| WSL | `write-systemd-unit` | service start timeout | explain service startup failure and journal follow-up |
| SSH | `configure-ssh-host` | empty host before submit | awaiting-input, not failure |
| SSH | `verify-ssh-auth` | `permission-denied` | key guidance |
| SSH | `start-server` | `enable-failed`, `verify-failed`, etc. | step-specific remediation |

