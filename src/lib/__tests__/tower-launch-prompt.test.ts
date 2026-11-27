/**
 * T0944 / D421: "Open Claude as Tower" starts claude with `/control-tower` (src/lib/tower-launch-prompt.ts).
 *
 * - new tab / ⏻ restart / restore (no `resume`) of a tower tab → added, quoted like the helper dispatch
 * - resume, custom args that resume / continue, any non-tower tab → nothing added
 * - startClaudeCliPty (source guard): the prompt is the last argument, after the custom args; the rest
 *   of the command (BAT args, `--resume=`, custom args) is assembled exactly as before
 */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { TOWER_LAUNCH_PROMPT, towerLaunchPrompt } from '../tower-launch-prompt'
import { claudeResumeArgs } from '../claude-resume-args'
import type { ShellFamily } from '../../utils/shell-quote'

const FAMILIES: ShellFamily[] = ['pwsh', 'cmd', 'posix']

/** The command the way startClaudeCliPty assembles it (BAT args → `--resume` → custom args → tower prompt). */
function assemble(base: string, opts: { launchRole?: 'tower'; resume?: { sessionId: string | null }; customArgs: string; shellFamily: ShellFamily }): string {
  const parts = [base]
  const resumeDecision = opts.resume ? claudeResumeArgs(opts.resume.sessionId, opts.customArgs) : null
  if (resumeDecision?.arg) parts.push(resumeDecision.arg)
  if (opts.customArgs) parts.push(opts.customArgs)
  const tower = towerLaunchPrompt({ launchRole: opts.launchRole, resume: Boolean(opts.resume), customArgs: opts.customArgs, shellFamily: opts.shellFamily })
  if (tower.arg) parts.push(tower.arg)
  return parts.join(' ')
}

const BASE = '& \'C:/demo/claude.exe\' --mcp-config=C:/demo/bat-mcp.json --name=\'proj · Tower\''

describe('towerLaunchPrompt (T0944)', () => {
  it('the prompt string is the claude skill name', () => {
    expect(TOWER_LAUNCH_PROMPT).toBe('/control-tower')
  })

  it.each(FAMILIES)('a tower tab launching a new session gets /control-tower (%s; no quotes needed)', (shellFamily) => {
    expect(towerLaunchPrompt({ launchRole: 'tower', resume: false, customArgs: '', shellFamily })).toEqual({ arg: '/control-tower', reason: 'tower' })
    expect(towerLaunchPrompt({ launchRole: 'tower', resume: false, customArgs: undefined, shellFamily })).toEqual({ arg: '/control-tower', reason: 'tower' })
    expect(towerLaunchPrompt({ launchRole: 'tower', resume: false, customArgs: '--model opus --allowedTools Read', shellFamily })).toEqual({ arg: '/control-tower', reason: 'tower' })
  })

  it('a resume never carries the prompt (T0766)', () => {
    for (const shellFamily of FAMILIES) {
      expect(towerLaunchPrompt({ launchRole: 'tower', resume: true, customArgs: '', shellFamily })).toEqual({ arg: null, reason: 'resume' })
    }
  })

  it('custom args that resume / continue / pick a session → nothing added (same detection as claudeResumeArgs)', () => {
    for (const customArgs of ['--continue', '-c', '--resume', '-r', '--resume=abc', '--session-id 0000', '--from-pr 12', '--teleport', '-cr', '--model opus --continue']) {
      expect(towerLaunchPrompt({ launchRole: 'tower', resume: false, customArgs, shellFamily: 'pwsh' })).toEqual({ arg: null, reason: 'user-args' })
    }
  })

  it('non-tower tabs → nothing added', () => {
    for (const launchRole of [undefined, null]) {
      expect(towerLaunchPrompt({ launchRole, resume: false, customArgs: '', shellFamily: 'posix' })).toEqual({ arg: null, reason: 'not-tower' })
      expect(towerLaunchPrompt({ launchRole, resume: true, customArgs: '', shellFamily: 'posix' })).toEqual({ arg: null, reason: 'not-tower' })
    }
  })
})

describe('the assembled claude command (T0944)', () => {
  it.each(FAMILIES)('tower tab, new session: /control-tower is the last argument (%s)', (shellFamily) => {
    expect(assemble(BASE, { launchRole: 'tower', customArgs: '', shellFamily })).toBe(`${BASE} /control-tower`)
    expect(assemble(BASE, { launchRole: 'tower', customArgs: '--model opus', shellFamily })).toBe(`${BASE} --model opus /control-tower`)
  })

  it('a plain Claude CLI tab: byte-for-byte the command before T0944', () => {
    for (const shellFamily of FAMILIES) {
      expect(assemble(BASE, { customArgs: '', shellFamily })).toBe(BASE)
      expect(assemble(BASE, { customArgs: '--model opus', shellFamily })).toBe(`${BASE} --model opus`)
      expect(assemble(BASE, { customArgs: '', resume: { sessionId: null }, shellFamily })).toBe(`${BASE} --resume`)
    }
  })

  it('a tower tab resume: --resume only, no prompt', () => {
    const id = '0123abcd-0000-4000-8000-0123456789ab'
    expect(assemble(BASE, { launchRole: 'tower', customArgs: '--model opus', resume: { sessionId: id }, shellFamily: 'pwsh' })).toBe(`${BASE} --resume=${id} --model opus`)
    expect(assemble(BASE, { launchRole: 'tower', customArgs: '', resume: { sessionId: null }, shellFamily: 'posix' })).toBe(`${BASE} --resume`)
  })

  it('a tower tab whose custom args continue: the command is unchanged', () => {
    expect(assemble(BASE, { launchRole: 'tower', customArgs: '--continue', shellFamily: 'cmd' })).toBe(`${BASE} --continue`)
  })
})

describe('menu hint (T0944)', () => {
  it('the three locales say the tab starts with /control-tower', () => {
    for (const loc of ['en', 'zh-TW', 'zh-CN']) {
      const json = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../locales/${loc}.json`), 'utf8'))
      expect(json.terminal.openClaudeAsTowerHint).toContain(TOWER_LAUNCH_PROMPT)
    }
  })
})

describe('startClaudeCliPty wiring (T0944, source guard)', () => {
  const view = fs.readFileSync(path.resolve(__dirname, '../../components/WorkspaceView.tsx'), 'utf8')
  const start = view.slice(view.indexOf('const startClaudeCliPty = useCallback('), view.indexOf('const resumeCodexCliTab = useCallback('))
  const code = start.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).join('\n')

  it('decides with towerLaunchPrompt from the stored launchRole, the resume and the custom args', () => {
    expect(code).toContain("const towerPrompt = towerLaunchPrompt({ launchRole, resume: Boolean(resume), customArgs, shellFamily: detectShellFamily(shell ?? '') })")
  })

  it('the prompt goes last: after the custom args, right before the command is joined', () => {
    const push = code.indexOf('if (towerPrompt.arg) cmdParts.push(towerPrompt.arg)')
    expect(push).toBeGreaterThan(code.indexOf('cmdParts.push(customArgs)'))
    expect(push).toBeGreaterThan(code.indexOf('if (resumeDecision?.arg) cmdParts.push(resumeDecision.arg)'))
    expect(push).toBeLessThan(code.indexOf("const cmd = cmdParts.join(' ')"))
  })

  it('one launch write only: the prompt is never typed separately', () => {
    expect(code.match(/pty\.write\(/g)).toHaveLength(1)
    expect(code).toContain("window.electronAPI.pty.write(terminalId, cmd + '\\r')")
    expect(code).not.toMatch(/pty\.write\([^)]*control-tower/)
  })
})
