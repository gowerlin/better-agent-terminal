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
import { TOWER_LAUNCH_PROMPT, towerLaunchCommandPrefix, towerLaunchPrompt } from '../tower-launch-prompt'
import { claudeResumeArgs } from '../claude-resume-args'
import { detectShellFamily, type ShellFamily } from '../../utils/shell-quote'

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
    // T0951 (BUG-231, Q-1 tower answer A): the one write goes through sendLaunchCommand (pty:launch-command)
    expect(code.match(/sendLaunchCommand\(/g)).toHaveLength(1)
    expect(code).toContain("sendLaunchCommand(terminalId, cmd + '\\r')")
    expect(code).not.toMatch(/pty\.write\([^)]*control-tower/)
  })
})

describe('Git Bash (MSYS) on Windows (T0946 / BUG-228)', () => {
  const GIT_BASH = 'C:\\Program Files\\Git\\bin\\bash.exe'
  const PREFIX = 'MSYS2_ARG_CONV_EXCL="/control-tower${MSYS2_ARG_CONV_EXCL:+;$MSYS2_ARG_CONV_EXCL}"'
  const POSIX_BASE = '\'C:\\Users\\demo\\claude.exe\' --mcp-config=C:/demo/bat-mcp.json --name=\'proj · Tower\''

  /** As startClaudeCliPty: the tower prompt pushed last, then the prefix in front of the whole command. */
  function assembleWithShell(base: string, opts: { launchRole?: 'tower'; resume?: { sessionId: string | null }; customArgs: string; shell: string | undefined }): string {
    const parts = [base]
    const resumeDecision = opts.resume ? claudeResumeArgs(opts.resume.sessionId, opts.customArgs) : null
    if (resumeDecision?.arg) parts.push(resumeDecision.arg)
    if (opts.customArgs) parts.push(opts.customArgs)
    const tower = towerLaunchPrompt({ launchRole: opts.launchRole, resume: Boolean(opts.resume), customArgs: opts.customArgs, shellFamily: detectShellFamily(opts.shell ?? '') })
    if (tower.arg) parts.push(tower.arg)
    const prefix = towerLaunchCommandPrefix(tower, opts.shell)
    if (prefix) parts.unshift(prefix)
    return parts.join(' ')
  }

  it('a tower tab in Git Bash: the assignment goes in front of the command, the prompt stays last', () => {
    expect(assembleWithShell(POSIX_BASE, { launchRole: 'tower', customArgs: '', shell: GIT_BASH })).toBe(`${PREFIX} ${POSIX_BASE} /control-tower`)
    expect(assembleWithShell(POSIX_BASE, { launchRole: 'tower', customArgs: '--add-dir /c/demo', shell: GIT_BASH })).toBe(`${PREFIX} ${POSIX_BASE} --add-dir /c/demo /control-tower`)
  })

  it('Git Bash, no prompt (resume / custom args that resume / non-tower tab): no prefix, command unchanged', () => {
    expect(assembleWithShell(POSIX_BASE, { launchRole: 'tower', customArgs: '', resume: { sessionId: null }, shell: GIT_BASH })).toBe(`${POSIX_BASE} --resume`)
    expect(assembleWithShell(POSIX_BASE, { launchRole: 'tower', customArgs: '--continue', shell: GIT_BASH })).toBe(`${POSIX_BASE} --continue`)
    expect(assembleWithShell(POSIX_BASE, { customArgs: '', shell: GIT_BASH })).toBe(POSIX_BASE)
    for (const launchRole of [undefined, 'tower'] as const) {
      expect(towerLaunchCommandPrefix(towerLaunchPrompt({ launchRole, resume: true, customArgs: '', shellFamily: 'posix' }), GIT_BASH)).toBeNull()
    }
  })

  it('pwsh / cmd / macOS / Linux / WSL / unknown shell: the T0944 command byte-for-byte', () => {
    const shells: Array<[string | undefined, string]> = [
      ['C:\\Program Files\\PowerShell\\7\\pwsh.exe', BASE],
      ['powershell.exe', BASE],
      ['cmd.exe', BASE],
      ['/bin/zsh', POSIX_BASE],
      ['/bin/bash', POSIX_BASE],
      ['/usr/local/bin/bash', POSIX_BASE],
      ['C:\\Windows\\System32\\wsl.exe', POSIX_BASE],
      ['C:\\Windows\\System32\\bash.exe', POSIX_BASE],
      [undefined, POSIX_BASE],
    ]
    for (const [shell, base] of shells) {
      expect(assembleWithShell(base, { launchRole: 'tower', customArgs: '', shell })).toBe(`${base} /control-tower`)
      expect(assembleWithShell(base, { launchRole: 'tower', customArgs: '--model opus', shell })).toBe(`${base} --model opus /control-tower`)
      expect(towerLaunchCommandPrefix(towerLaunchPrompt({ launchRole: 'tower', resume: false, customArgs: '', shellFamily: detectShellFamily(shell ?? '') }), shell)).toBeNull()
    }
  })

  it('startClaudeCliPty (source guard): prefix from towerLaunchCommandPrefix with the spawn shell, added after the prompt and before the join', () => {
    const view = fs.readFileSync(path.resolve(__dirname, '../../components/WorkspaceView.tsx'), 'utf8')
    const start = view.slice(view.indexOf('const startClaudeCliPty = useCallback('), view.indexOf('const resumeCodexCliTab = useCallback('))
    const code = start.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*\*)/.test(l)).join('\n')
    expect(code).toContain('const towerCommandPrefix = towerLaunchCommandPrefix(towerPrompt, shell)')
    const unshift = code.indexOf('if (towerCommandPrefix) cmdParts.unshift(towerCommandPrefix)')
    expect(unshift).toBeGreaterThan(code.indexOf('if (towerPrompt.arg) cmdParts.push(towerPrompt.arg)'))
    expect(unshift).toBeLessThan(code.indexOf("const cmd = cmdParts.join(' ')"))
    expect(code).not.toMatch(/MSYS2_ARG_CONV_EXCL|MSYS_NO_PATHCONV/) // no inline handling, no tab env
    expect(code).toMatch(/shell,\n\s*customEnv: \{\n\s*\.\.\.customEnv,\n\s*CLAUDE_CODE_NO_FLICKER: '1',\n\s*\},/) // the PTY env as before
  })
})
