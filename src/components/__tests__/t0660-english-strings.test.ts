/**
 * T0660 (BUG-161): source guards for the thumbnail bar / context menu labels
 * and the modal `×` close buttons (aria-label = common.close).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function source(file: string): string {
  return readFileSync(resolve(__dirname, '..', file), 'utf8')
}

describe('thumbnail bar labels go through i18n (T0660)', () => {
  it('ThumbnailBar "+" menu uses profiles.addMenuSuggested', () => {
    const code = source('ThumbnailBar.tsx')
    expect(code).not.toMatch(/>suggested</)
    expect(code.match(/t\('profiles\.addMenuSuggested'\)/g)?.length).toBe(3)
  })

  it('TerminalThumbnail Supervisor items use workspace.setSupervisor / removeSupervisor', () => {
    const code = source('TerminalThumbnail.tsx')
    expect(code).not.toMatch(/Set as Supervisor|Remove Supervisor/)
    expect(code).toContain("t('workspace.setSupervisor')")
    expect(code).toContain("t('workspace.removeSupervisor')")
  })
})

// Modal close buttons: [file, the close button's class].
const MODAL_CLOSE_BUTTONS: Array<[string, string]> = [
  ['ClaudeAgentPanel.tsx', 'claude-plan-modal-close'],
  ['CodexAgentPanel.tsx', 'claude-plan-modal-close'],
  ['ProfilePanel.tsx', 'settings-close'],
  ['profiles/EditRemoteProfileModal.tsx', 'settings-close'],
  ['AboutPanel.tsx', 'close-btn'],
  ['SettingsPanel.tsx', 'close-btn'],
  ['SnippetPanel.tsx', 'close-btn'],
  ['WorkspaceEnvDialog.tsx', 'dialog-close-btn'],
  ['PathLinker.tsx', 'path-preview-close'],
]

describe('modal × close buttons carry aria-label (T0660)', () => {
  it.each(MODAL_CLOSE_BUTTONS)('%s .%s', (file, className) => {
    // One-line `<button className="…" …>&times;</button>` / `>×</button>` (not e.g. a "Clear" button sharing the class).
    const buttons = source(file).match(new RegExp(`<button className="${className}"[^\n]*>(?:&times;|×)</button>`, 'g')) ?? []
    expect(buttons.length).toBeGreaterThan(0)
    for (const button of buttons) expect(button).toContain("aria-label={t('common.close')}")
  })
})
