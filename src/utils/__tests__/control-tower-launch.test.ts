/**
 * T0710: the panel's one-click CT dispatch (`resolveControlTowerWorkOrderCommand`).
 *   - claude: unchanged `claude "/ct-exec T####"`, the host is never asked
 *   - codex: the host answers `terminal:control-tower-prompt` with the prompt quoted for its
 *     dispatch shell (`$ct:ct-exec` only plugin / `$ct-exec` manual)
 *   - a host that cannot answer (older bat-server: `No handler`, ok: false) → the pre-T0710 command
 */
import { describe, expect, it, vi } from 'vitest'
import {
  buildControlTowerWorkOrderCommand,
  resolveControlTowerAgentRuntime,
  resolveControlTowerWorkOrderCommand,
  type ControlTowerCommandHost,
} from '../control-tower-launch'
import type { ControlTowerPromptRequest, ControlTowerPromptResult } from '../../types/ct-dispatch-prompt'

const codex = resolveControlTowerAgentRuntime('codex-cli')
const claude = resolveControlTowerAgentRuntime('claude-cli')

function host(answer: ControlTowerPromptResult | Error) {
  const h = {
    resolvePrompt: vi.fn(async (_request: ControlTowerPromptRequest): Promise<ControlTowerPromptResult> => {
      if (answer instanceof Error) throw answer
      return answer
    }),
    log: vi.fn((..._args: unknown[]) => {}),
  }
  return h satisfies ControlTowerCommandHost
}

describe('buildControlTowerWorkOrderCommand (pre-T0710 form kept)', () => {
  it('without a host-quoted prompt the command is unchanged', () => {
    expect(buildControlTowerWorkOrderCommand(claude, 'exec', 'T0710', ' --model opus ')).toBe('claude "/ct-exec T0710" --model opus')
    expect(buildControlTowerWorkOrderCommand(codex, 'done', ' T0710 ')).toBe('codex "$ct-done T0710"')
  })

  it('a host-quoted prompt replaces the double-quoted one', () => {
    expect(buildControlTowerWorkOrderCommand(codex, 'exec', 'T0710', '--yolo', "'$ct:ct-exec T0710'")).toBe("codex '$ct:ct-exec T0710' --yolo")
  })
})

describe('resolveControlTowerWorkOrderCommand', () => {
  it('claude: unchanged, the host is not asked', async () => {
    const h = host({ ok: true, prompt: 'x', quotedPrompt: 'x', shellFamily: 'pwsh' })
    expect(await resolveControlTowerWorkOrderCommand(claude, 'exec', 'T0710', '', { CODEX_HOME: 'C:\\Users\\demo\\codex' }, h)).toBe('claude "/ct-exec T0710"')
    expect(h.resolvePrompt).not.toHaveBeenCalled()
  })

  it.each([
    ['pwsh', "'$ct:ct-exec T0710'"],
    ['posix', "'$ct:ct-exec T0710'"],
    ['cmd', '"$ct:ct-exec T0710"'],
  ] as const)('codex, only plugin (%s): the host-quoted $ct:ct-exec', async (shellFamily, quotedPrompt) => {
    const h = host({ ok: true, prompt: '$ct:ct-exec T0710', quotedPrompt, shellFamily, skillName: { name: 'ct:ct-exec', reason: 'plugin' } })
    const env = { CODEX_HOME: 'C:\\Users\\demo\\.codex-test' }
    expect(await resolveControlTowerWorkOrderCommand(codex, 'exec', ' T0710 ', '--yolo', env, h)).toBe(`codex ${quotedPrompt} --yolo`)
    expect(h.resolvePrompt).toHaveBeenCalledWith({ agent: 'codex-cli', skill: 'ct-exec', workorder: 'T0710', customEnv: env })
    expect(h.log.mock.calls[0][0]).toBe(`[ct-launch] codex skill name=$ct:ct-exec reason=plugin shell=${shellFamily}`)
  })

  it('codex, manual install: the host answers $ct-exec (single-quoted for pwsh)', async () => {
    const h = host({ ok: true, prompt: '$ct-done T0710', quotedPrompt: "'$ct-done T0710'", shellFamily: 'pwsh', skillName: { name: 'ct-done', reason: 'manual' } })
    expect(await resolveControlTowerWorkOrderCommand(codex, 'done', 'T0710', '', undefined, h)).toBe("codex '$ct-done T0710'")
    expect(h.resolvePrompt).toHaveBeenCalledWith({ agent: 'codex-cli', skill: 'ct-done', workorder: 'T0710' })
  })

  it('older bat-server (No handler) → the pre-T0710 command, logged', async () => {
    const h = host(new Error("Error invoking remote method 'terminal:control-tower-prompt': Error: No handler for channel: terminal:control-tower-prompt"))
    expect(await resolveControlTowerWorkOrderCommand(codex, 'exec', 'T0710', '', undefined, h)).toBe('codex "$ct-exec T0710"')
    expect(h.log.mock.calls[0][0]).toContain('using $ct-exec')
  })

  it('host refuses (ok: false) → the pre-T0710 command', async () => {
    const h = host({ ok: false, error: 'invalid' })
    expect(await resolveControlTowerWorkOrderCommand(codex, 'exec', 'T0710', '', undefined, h)).toBe('codex "$ct-exec T0710"')
  })

  it('no host API (window.electronAPI without ctDispatch) → the pre-T0710 command', async () => {
    expect(await resolveControlTowerWorkOrderCommand(codex, 'exec', 'T0710', '', undefined, {})).toBe('codex "$ct-exec T0710"')
  })
})
