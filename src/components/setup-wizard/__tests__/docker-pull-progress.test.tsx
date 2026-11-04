/**
 * T0853 (PLAN-052 W4b): while install-server-bundle pulls the base image, the
 * Shell shows the layer progress of that pull (`docker:pull-progress` events of
 * the operation id the step keeps in ctx.state); other pulls are ignored.
 */
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import i18n from '../../../i18n'
import { DockerPullProgress } from '../SetupWizardShell'
import { DOCKER_PULL_OPERATION_KEY } from '../steps/docker/install-server-bundle'
import type { WizardContext } from '../wizard-runner'

type PullEvent = { operationId?: string; layers: number; completed: number }

function installPullEvents() {
  const listeners = new Set<(event: PullEvent) => void>()
  ;(window as unknown as { electronAPI: unknown }).electronAPI = {
    docker: {
      onPullProgress: (callback: (event: PullEvent) => void) => {
        listeners.add(callback)
        return () => listeners.delete(callback)
      },
    },
  }
  return {
    emit: (event: PullEvent) => act(() => { for (const listener of listeners) listener(event) }),
    count: () => listeners.size,
  }
}

function ctxWith(state: Record<string, unknown>): WizardContext {
  return {
    targetOS: 'docker-linux',
    profileDraft: { name: 'x' },
    warnings: [],
    state,
    logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  }
}

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

afterEach(() => {
  delete (window as unknown as { electronAPI?: unknown }).electronAPI
})

describe('DockerPullProgress (T0853)', () => {
  it('shows only the running pull\'s layer counts and unsubscribes on unmount', () => {
    const events = installPullEvents()
    const ctx = ctxWith({ dockerImage: 'buildpack-deps:bookworm-scm', [DOCKER_PULL_OPERATION_KEY]: 'op-12345678' })
    const view = render(<DockerPullProgress ctx={ctx} />)
    expect(screen.queryByTestId('wizard-docker-pull-progress')).toBeNull()

    events.emit({ operationId: 'someone-else', layers: 9, completed: 9 })
    expect(screen.queryByTestId('wizard-docker-pull-progress')).toBeNull()

    events.emit({ operationId: 'op-12345678', layers: 4, completed: 1 })
    expect(screen.getByTestId('wizard-docker-pull-progress').textContent)
      .toBe(i18n.t('wizard.docker.pull.progress', { image: 'buildpack-deps:bookworm-scm', completed: 1, layers: 4 }))
    expect(screen.getByTestId('wizard-docker-pull-progress').textContent).toContain('1 of 4')

    view.unmount()
    expect(events.count()).toBe(0)
  })

  it('no pull running (no operation id) or an older preload without onPullProgress → nothing shown', () => {
    const events = installPullEvents()
    render(<DockerPullProgress ctx={ctxWith({})} />)
    events.emit({ operationId: undefined, layers: 2, completed: 1 })
    expect(screen.queryByTestId('wizard-docker-pull-progress')).toBeNull()

    ;(window as unknown as { electronAPI: unknown }).electronAPI = { docker: {} }
    expect(() => render(<DockerPullProgress ctx={ctxWith({ [DOCKER_PULL_OPERATION_KEY]: 'op-12345678' })} />)).not.toThrow()
  })
})
