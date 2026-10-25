/**
 * T0706: the Recovery prompt (T0578, shown when BAT reopens while the Terminal Server still has
 * PTYs) uses i18n. The zh-TW text is the same as before T0706; en / zh-CN have their own.
 * Behaviour (buttons, no Esc) is covered here for the callbacks and in dialog-escape.test.tsx.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n from '../../i18n'
import { RecoveryPrompt } from '../RecoveryPrompt'

/** The pre-T0706 hard-coded text (count rendered as 3). */
const ZH_TW = {
  title: '🔄 偵測到上次的終端 session',
  alive: 'Terminal Server 仍在運行，有 3 個終端存活。',
  question: '是否要恢復上次的工作狀態？',
  recover: '恢復 session',
  freshStart: '重新開始',
} as const

const KEYS = [
  'app.recoveryPromptTitle',
  'app.recoveryPromptQuestion',
  'app.recoveryPromptRecover',
  'app.recoveryPromptFreshStart',
] as const

const ZH_TW_LITERALS = [
  '偵測到上次的終端 session',
  'Terminal Server 仍在運行',
  '個終端存活',
  ZH_TW.question,
  ZH_TW.recover,
  ZH_TW.freshStart,
]

function renderPrompt(ptyCount = 3) {
  const onRecover = vi.fn()
  const onFreshStart = vi.fn()
  render(<RecoveryPrompt ptyCount={ptyCount} onRecover={onRecover} onFreshStart={onFreshStart} />)
  return { onRecover, onFreshStart }
}

const aliveParagraph = () => document.querySelector('.recovery-prompt-content p:not(.recovery-prompt-hint)')!

afterEach(async () => {
  await i18n.changeLanguage('en')
})

describe('RecoveryPrompt i18n', () => {
  it('zh-TW keeps the pre-T0706 text, with the count in <strong>', async () => {
    await i18n.changeLanguage('zh-TW')
    renderPrompt(3)
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(ZH_TW.title)
    expect(aliveParagraph().textContent).toBe(ZH_TW.alive)
    expect(aliveParagraph().querySelector('strong')?.textContent).toBe('3')
    expect(screen.getByText(ZH_TW.question)).toHaveClass('recovery-prompt-hint')
    expect(screen.getByRole('button', { name: ZH_TW.recover })).toHaveClass('btn-primary')
    expect(screen.getByRole('button', { name: ZH_TW.freshStart })).toHaveClass('btn-secondary')
  })

  it.each(['en', 'zh-CN'])('%s has its own text for every part', async (lng) => {
    await i18n.changeLanguage(lng)
    renderPrompt(3)
    const dialog = document.querySelector('.recovery-prompt-dialog')!
    for (const key of KEYS) {
      const text = i18n.t(key)
      expect(text).not.toBe(key)
      expect(dialog.textContent).toContain(text)
    }
    const alive = aliveParagraph()
    expect(alive.querySelector('strong')?.textContent).toBe('3')
    expect(alive.textContent).not.toContain('recoveryPrompt')
    expect(alive.textContent).not.toContain('<strong>')
    for (const literal of ZH_TW_LITERALS) expect(dialog.textContent).not.toContain(literal)
  })

  it('en uses singular / plural for the terminal count', async () => {
    await i18n.changeLanguage('en')
    renderPrompt(1)
    expect(aliveParagraph().textContent).toBe('Terminal Server is still running, with 1 terminal still alive.')
  })

  it('en plural', async () => {
    await i18n.changeLanguage('en')
    renderPrompt(2)
    expect(aliveParagraph().textContent).toBe('Terminal Server is still running, with 2 terminals still alive.')
  })

  it('follows a language switch while shown', async () => {
    await i18n.changeLanguage('zh-TW')
    renderPrompt(3)
    expect(aliveParagraph().textContent).toBe(ZH_TW.alive)
    await act(async () => { await i18n.changeLanguage('en') })
    expect(screen.getByRole('button', { name: i18n.t('app.recoveryPromptRecover') })).toBeInTheDocument()
    expect(aliveParagraph().textContent).toBe('Terminal Server is still running, with 3 terminals still alive.')
  })

  it.each(['zh-TW', 'en', 'zh-CN'])('%s: the buttons call the original callbacks', async (lng) => {
    await i18n.changeLanguage(lng)
    const { onRecover, onFreshStart } = renderPrompt(2)
    fireEvent.click(screen.getByRole('button', { name: i18n.t('app.recoveryPromptRecover') }))
    expect(onRecover).toHaveBeenCalledTimes(1)
    expect(onFreshStart).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: i18n.t('app.recoveryPromptFreshStart') }))
    expect(onFreshStart).toHaveBeenCalledTimes(1)
    expect(onRecover).toHaveBeenCalledTimes(1)
  })
})

describe('RecoveryPrompt.tsx source guard', () => {
  const src = readFileSync(join(__dirname, '../RecoveryPrompt.tsx'), 'utf8')

  it('has no hard-coded prompt text', () => {
    for (const literal of ZH_TW_LITERALS) expect(src).not.toContain(literal)
  })
})
