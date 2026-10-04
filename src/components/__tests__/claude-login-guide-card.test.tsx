/**
 * T0402: Claude panel "not logged in" guide card — copy per window type, buttons.
 */
import { beforeAll, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import i18n from '../../i18n'
import en from '../../locales/en.json'
import { ClaudeLoginGuideCard } from '../ClaudeLoginGuideCard'

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

function renderCard(props: Partial<Parameters<typeof ClaudeLoginGuideCard>[0]> = {}) {
  const onOpenTerminal = vi.fn()
  const onRecheck = vi.fn()
  render(
    <ClaudeLoginGuideCard
      isRemote={false}
      checking={false}
      stillLoggedOut={false}
      onOpenTerminal={onOpenTerminal}
      onRecheck={onRecheck}
      {...props}
    />,
  )
  return { onOpenTerminal, onRecheck }
}

describe('ClaudeLoginGuideCard', () => {
  test('local window: local copy, says the command is not run automatically', () => {
    renderCard()
    expect(screen.getByText(en.claude.loginGuideTitle)).toBeInTheDocument()
    expect(screen.getByText(en.claude.loginGuideBodyLocal)).toBeInTheDocument()
    expect(screen.queryByText(en.claude.loginGuideBodyRemote)).not.toBeInTheDocument()
    expect(screen.getByText(en.claude.loginGuideTerminalHint)).toBeInTheDocument()
  })

  test('remote window: remote-host copy', () => {
    renderCard({ isRemote: true })
    expect(screen.getByText(en.claude.loginGuideBodyRemote)).toBeInTheDocument()
    expect(screen.queryByText(en.claude.loginGuideBodyLocal)).not.toBeInTheDocument()
  })

  test('buttons call their handlers', () => {
    const { onOpenTerminal, onRecheck } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: en.claude.loginGuideOpenTerminal }))
    expect(onOpenTerminal).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: en.claude.loginGuideRecheck }))
    expect(onRecheck).toHaveBeenCalledTimes(1)
  })

  test('checking disables re-check; a still-logged-out result is reported', () => {
    renderCard({ checking: true, stillLoggedOut: true })
    expect(screen.getByRole('button', { name: en.claude.loginGuideChecking })).toBeDisabled()
    expect(screen.queryByText(en.claude.loginGuideStillLoggedOut)).not.toBeInTheDocument()
  })

  test('still logged out after a check', () => {
    renderCard({ stillLoggedOut: true })
    expect(screen.getByText(en.claude.loginGuideStillLoggedOut)).toBeInTheDocument()
  })
})
