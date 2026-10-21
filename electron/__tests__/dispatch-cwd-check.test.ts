// @vitest-environment node
/**
 * T0527 / BUG-132: the dispatch cwd against the landing workspace's folderPath
 * (electron/dispatch-workspace.ts `checkDispatchCwd`), and the `--agent` shorthand
 * (`normalizeAgentAlias`) including the headless tower capability's registry check.
 * The handler side (warn / refuse in yolo) is in terminal-handlers.test.ts.
 */
import { describe, expect, it } from 'vitest'
import {
  checkDispatchCwd,
  isDispatchPathInside,
  normalizeDispatchPath,
  resolveDispatchWorkspaceFromEntries,
  type DispatchRegistryEntry,
} from '../dispatch-workspace'
import { normalizeAgentAlias } from '../terminal-command-handlers'
import { agentRegistry } from '../agent-runtime/agent-registry'
import { authorizeHelperInvoke, type HelperCapability } from '../remote/helper-capability'

describe('normalizeDispatchPath', () => {
  it('win32: separators, drive letter case, trailing slash, duplicate separators', () => {
    expect(normalizeDispatchPath('D:\\Repo\\Bank\\', 'win32')).toBe('d:/repo/bank')
    expect(normalizeDispatchPath('d:/repo//bank/./src/..', 'win32')).toBe('d:/repo/bank')
    expect(normalizeDispatchPath('D:\\', 'win32')).toBe('d:/')
    expect(normalizeDispatchPath('D:', 'win32')).toBe('d:/')
  })

  it('win32: Git Bash /d/repo and UNC paths', () => {
    expect(normalizeDispatchPath('/d/Repo/Bank', 'win32')).toBe('d:/repo/bank')
    expect(normalizeDispatchPath('\\\\Server\\Share\\Repo', 'win32')).toBe('//server/share/repo')
  })

  it('darwin is case-insensitive, linux is not', () => {
    expect(normalizeDispatchPath('/Users/tester/Bank/', 'darwin')).toBe('/users/tester/bank')
    expect(normalizeDispatchPath('/home/tester/Bank/', 'linux')).toBe('/home/tester/Bank')
  })

  it('relative or empty → null', () => {
    expect(normalizeDispatchPath('repo/bank', 'linux')).toBeNull()
    expect(normalizeDispatchPath('repo\\bank', 'win32')).toBeNull()
    expect(normalizeDispatchPath('  ', 'linux')).toBeNull()
  })

  it('isDispatchPathInside: same, below, sibling with a shared prefix, root', () => {
    expect(isDispatchPathInside('/a/bank', '/a/bank')).toBe(true)
    expect(isDispatchPathInside('/a/bank/src', '/a/bank')).toBe(true)
    expect(isDispatchPathInside('/a/bank2', '/a/bank')).toBe(false)
    expect(isDispatchPathInside('d:/x', 'd:/')).toBe(true)
  })
})

describe('checkDispatchCwd', () => {
  const ENTRIES: DispatchRegistryEntry[] = [{
    workspaces: [
      { id: 'ws-bank', name: '專案B', folderPath: 'D:\\Work\\Bank' },
      { id: 'ws-scb', name: 'SCB', alias: 'SCB專案', folderPath: 'D:\\Work\\SCB' },
      { id: 'ws-scb-sub', name: 'SCB sub', folderPath: 'D:\\Work\\SCB\\packages\\api' },
      { id: 'ws-nofolder', name: 'No folder' },
    ],
    terminals: [],
  }, {
    // a second window
    workspaces: [{ id: 'ws-other-window', name: 'Other', folderPath: 'E:/Other' }],
  }]
  const win = { platform: 'win32' as const }
  const landing = (workspaceId: string) => resolveDispatchWorkspaceFromEntries(ENTRIES, { requestedWorkspaceId: workspaceId })

  it('cwd under the landing workspace (case / separators differ) → inside', async () => {
    expect(await checkDispatchCwd(ENTRIES, landing('ws-bank'), 'd:/work/bank/src', win)).toEqual({ status: 'inside', cwd: 'd:/work/bank/src', folderPath: 'D:\\Work\\Bank' })
    expect((await checkDispatchCwd(ENTRIES, landing('ws-bank'), 'D:\\Work\\Bank\\', win)).status).toBe('inside')
  })

  it('cwd under another workspace → other-workspace, the deepest one (nested workspaces)', async () => {
    expect(await checkDispatchCwd(ENTRIES, landing('ws-bank'), 'D:\\Work\\SCB\\docs', win)).toEqual({
      status: 'other-workspace',
      cwd: 'D:\\Work\\SCB\\docs',
      folderPath: 'D:\\Work\\Bank',
      cwdWorkspace: { id: 'ws-scb', name: 'SCB專案', folderPath: 'D:\\Work\\SCB' },
    })
    const nested = await checkDispatchCwd(ENTRIES, landing('ws-bank'), 'D:\\Work\\SCB\\packages\\api\\src', win)
    expect(nested.cwdWorkspace?.id).toBe('ws-scb-sub')
  })

  it('a workspace of another window counts too', async () => {
    const check = await checkDispatchCwd(ENTRIES, landing('ws-bank'), 'E:\\Other\\x', win)
    expect(check).toMatchObject({ status: 'other-workspace', cwdWorkspace: { id: 'ws-other-window' } })
  })

  it('cwd under no workspace → outside (cross-project dispatch)', async () => {
    expect(await checkDispatchCwd(ENTRIES, landing('ws-bank'), 'C:\\Temp', win)).toEqual({ status: 'outside', cwd: 'C:\\Temp', folderPath: 'D:\\Work\\Bank' })
  })

  it('nested landing workspace: cwd inside the landing one wins over its parent', async () => {
    expect((await checkDispatchCwd(ENTRIES, landing('ws-scb-sub'), 'D:\\Work\\SCB\\packages\\api', win)).status).toBe('inside')
    // landing = the parent, cwd in the nested child: still inside the landing folder
    expect((await checkDispatchCwd(ENTRIES, landing('ws-scb'), 'D:\\Work\\SCB\\packages\\api', win)).status).toBe('inside')
  })

  it('skipped: no folderPath, landing unknown / active, no cwd, relative cwd', async () => {
    expect(await checkDispatchCwd(ENTRIES, landing('ws-nofolder'), 'D:\\Work\\SCB', win)).toEqual({ status: 'skipped', reason: 'no-folder-path', cwd: 'D:\\Work\\SCB' })
    expect((await checkDispatchCwd(ENTRIES, landing('ws-gone'), 'D:\\Work\\SCB', win)).reason).toBe('landing-unknown')
    expect((await checkDispatchCwd(ENTRIES, resolveDispatchWorkspaceFromEntries(ENTRIES, {}), 'D:\\Work\\SCB', win)).reason).toBe('landing-unknown')
    expect((await checkDispatchCwd(ENTRIES, landing('ws-bank'), undefined, win)).reason).toBe('no-cwd')
    expect((await checkDispatchCwd(ENTRIES, landing('ws-bank'), 'Work\\SCB', win)).reason).toBe('cwd-not-absolute')
  })

  it('linux is case-sensitive', async () => {
    const entries: DispatchRegistryEntry[] = [{ workspaces: [{ id: 'a', folderPath: '/home/g/Bank' }, { id: 'b', folderPath: '/home/g/bank' }] }]
    const check = await checkDispatchCwd(entries, resolveDispatchWorkspaceFromEntries(entries, { requestedWorkspaceId: 'a' }), '/home/g/bank/x', { platform: 'linux' })
    expect(check).toMatchObject({ status: 'other-workspace', cwdWorkspace: { id: 'b' } })
  })

  it('realpath: a folderPath through a symlink matches the physical cwd', async () => {
    const entries: DispatchRegistryEntry[] = [{ workspaces: [{ id: 'a', folderPath: '/tmp/bank' }, { id: 'b', folderPath: '/tmp/scb' }] }]
    const realpath = async (p: string) => p.replace(/^\/tmp\//, '/private/tmp/')
    const resolution = resolveDispatchWorkspaceFromEntries(entries, { requestedWorkspaceId: 'a' })
    expect((await checkDispatchCwd(entries, resolution, '/private/tmp/bank/src', { platform: 'darwin', realpath })).status).toBe('inside')
    expect(await checkDispatchCwd(entries, resolution, '/private/tmp/scb', { platform: 'darwin', realpath })).toMatchObject({ status: 'other-workspace', cwdWorkspace: { id: 'b' } })
    // a failing realpath falls back to the path as given
    const failing = async () => { throw new Error('ENOENT') }
    expect((await checkDispatchCwd(entries, resolution, '/private/tmp/bank', { platform: 'darwin', realpath: failing })).status).toBe('outside')
  })
})

describe('--agent shorthand (normalizeAgentAlias)', () => {
  it('maps common shorthands to registry ids, keeps known ids, leaves unknown ones', () => {
    expect(normalizeAgentAlias('codex')).toBe('codex-cli')
    expect(normalizeAgentAlias('claude')).toBe('claude-cli')
    expect(normalizeAgentAlias('Codex')).toBe('codex-cli')
    expect(normalizeAgentAlias('gemini')).toBe('gemini-cli')
    expect(normalizeAgentAlias('codex-cli')).toBe('codex-cli')
    expect(normalizeAgentAlias('claude-code')).toBe('claude-code')
    expect(normalizeAgentAlias('codx')).toBe('codx')
    expect(normalizeAgentAlias('constructor')).toBe('constructor')
    expect(normalizeAgentAlias('../codex')).toBe('../codex')
  })

  it('only maps to an id the given registry knows', () => {
    const known = new Set(['codex-cli'])
    expect(normalizeAgentAlias('codex', id => known.has(id))).toBe('codex-cli')
    expect(normalizeAgentAlias('claude', id => known.has(id))).toBe('claude')
  })

  it('headless tower capability: a shorthand passes once normalized, unknown ids stay denied (T0450)', () => {
    // The wiring in electron/remote/headless-entry.ts.
    const isKnownAgent = (agent: string) => agentRegistry.getDefinition(normalizeAgentAlias(agent)) !== undefined
    const tower: HelperCapability = { role: 'tower', terminalId: 'tower-1' }
    const create = (agent: string) => authorizeHelperInvoke(tower, 'terminal:create-agent-command', [{ id: 'new-1', prompt: 'p', agent }], {
      isTerminalAlive: () => false,
      isKnownAgent,
    })
    expect(create('codex')).toEqual({ ok: true })
    expect(create('codex-cli')).toEqual({ ok: true })
    expect(create('codx')).toEqual({ ok: false, reason: 'agent-not-allowed' })
    expect(create('constructor')).toEqual({ ok: false, reason: 'agent-not-allowed' })
  })
})
