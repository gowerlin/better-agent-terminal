/**
 * T0453 (BUG-113): a detached workspace window has no registry entry of its own
 * (not in windowMap → windowId null), so workspace:load returned null and the window
 * showed "Workspace not found" ever since 512c118. It now reads its parent window's
 * entry. T0491: its workspace:save merges only its own workspace's terminal list into
 * the parent's entry (window-registry-detached-terminals.test.ts covers the merge and the
 * race with the parent's autosave); it never stores its copy of the rest of the entry.
 * Behaviour is covered end to end by e2e/detached-workspace.spec.ts; this guards the
 * main.ts wiring that the e2e build exercises.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALWAYS_LOCAL_CHANNELS } from '../remote/headless-channel-status'

describe('detached workspace persistence (T0453 source guard)', () => {
  const src = readFileSync(resolve(__dirname, '../main.ts'), 'utf8')
  const section = (from: string, to: string) => {
    const at = src.indexOf(from)
    expect(at, from).toBeGreaterThan(-1)
    const end = src.indexOf(to, at)
    expect(end, to).toBeGreaterThan(at)
    return src.slice(at, end)
  }

  it('workspace:load / workspace:save stay ALWAYS_LOCAL (a remote detached window reads the local registry too)', () => {
    expect(ALWAYS_LOCAL_CHANNELS.has('workspace:load')).toBe(true)
    expect(ALWAYS_LOCAL_CHANNELS.has('workspace:save')).toBe(true)
    expect(src).toMatch(/const DETACHED_WORKSPACE_CHANNELS = new Set\(\['workspace:load', 'workspace:save'\]\)/)
  })

  it('only a detached sender is diverted, ahead of the ALWAYS_LOCAL short-circuit (which keeps its shape)', () => {
    const fn = section('function bindProxiedHandlersToIpc()', '// ── Renderer debug log')
    const divert = fn.search(/if \(!windowId && DETACHED_WORKSPACE_CHANNELS\.has\(channel\)\) \{\s*const detachedWorkspaceId = getDetachedWorkspaceIdByWebContents\(event\.sender\)\s*if \(detachedWorkspaceId !== null\) return invokeDetachedWorkspacePersistence\(channel, detachedWorkspaceId, args\)\s*\}/)
    const alwaysLocal = fn.search(/if \(ALWAYS_LOCAL_CHANNELS\.has\(channel\)\) \{\s*return invokeHandler\(channel, args, windowId\)/)
    expect(divert).toBeGreaterThan(fn.indexOf('const windowId = getWindowIdByWebContents(event.sender)'))
    expect(alwaysLocal).toBeGreaterThan(divert)
    // T0446 routing for every other channel is untouched and still runs after the ALWAYS_LOCAL branch.
    expect(fn.indexOf('await resolveDetachedBinding(detachedWorkspaceId)')).toBeGreaterThan(alwaysLocal)
  })

  it('load reads the parent window entry; save merges only its terminals and never reaches the handler', () => {
    const fn = section('function invokeDetachedWorkspacePersistence(', 'function bindProxiedHandlersToIpc()')
    expect(fn).toMatch(/if \(channel === 'workspace:save'\) return saveDetachedWorkspace\(workspaceId, args\[0\]\)/)
    expect(fn).not.toMatch(/invokeHandler\('workspace:save'/)
    expect(fn).not.toMatch(/saveEntry\(/)
    // T0491: the only write is the terminal merge into the recorded parent's entry.
    const save = section('async function saveDetachedWorkspace(', 'async function loadDetachedWorkspace(')
    const call = save.indexOf('const entry = await saveDetachedWorkspaceTerminals(windowRegistry, parentWindowId, workspaceId, ')
    expect(call).toBeGreaterThan(-1)
    expect(save).toMatch(/if \(!parentWindowId \|\| typeof data !== 'string'\) return false/)
    // Queued synchronously: no await before the registry call (main sends 'workspace:reattached' after whenIdle()).
    expect(save.slice(0, call)).not.toMatch(/await /)
    const load = section('async function loadDetachedWorkspace(', 'function bindProxiedHandlersToIpc()')
    expect(load).toMatch(/detachedWindowRecords\.get\(workspaceId\)\?\.parentWindowId/)
    expect(load).toMatch(/invokeHandler\('workspace:load', \[\], parentWindowId\)/)
    // No recorded parent → null (renderer: "Workspace not found"), never another window's entry.
    expect(load).toMatch(/if \(!parentWindowId\) \{[\s\S]*?return null/)
  })

  it('T0491: the parent keeps a detached workspace\'s terminals until it adopted them', () => {
    const save = section("registerHandler('workspace:save'", "registerHandler('workspace:load'")
    expect(save).toMatch(/saveWindowWorkspaces\(windowRegistry, windowId, parsed, \(\) => detachedTerminalOwners\.owned\(windowId\)\)/)
    expect(save).not.toMatch(/entry\.terminals = parsed\.terminals/)
    const load = section("registerHandler('workspace:load'", '// Settings persistence')
    expect(load).toMatch(/detachedTerminalOwners\.releaseUnless\(windowId, isWorkspaceDetached\)/)
    const detach = section("ipcMain.handle('workspace:detach'", "ipcMain.handle('workspace:reattach'")
    expect(detach).toMatch(/if \(record\.parentWindowId\) detachedTerminalOwners\.claim\(record\.parentWindowId, workspaceId\)/)
    // 'workspace:reattached' goes out only after the queued registry writes landed.
    expect(detach).toMatch(/void windowRegistry\.whenIdle\(\)\.then\(\(\) => \{\s*if \(parentWin && !parentWin\.isDestroyed\(\)\) parentWin\.webContents\.send\('workspace:reattached', workspaceId\)/)
    const adopt = section("ipcMain.handle('workspace:adopt-detached'", "ipcMain.handle('workspace:reattach'")
    expect(adopt).toMatch(/isWorkspaceDetached\(workspaceId\)\) return null/)
    expect(adopt).toMatch(/windowRegistry\.withEntry\(windowId, \(entry\) => \{[\s\S]*detachedTerminalOwners\.release\(windowId, workspaceId\)[\s\S]*workspaceTerminals\(entry\.terminals/)
  })

  it('T0504: a detached window flushes before it closes; it stays registered until closed; quit flushes per renderer', () => {
    const detach = section("ipcMain.handle('workspace:detach'", "ipcMain.handle('workspace:adopt-detached'")
    const flush = detach.search(/flushBeforeClose\(detachedWin, \{\s*skip: \(\) => isAppQuitting,\s*flush: \(\) => requestRendererFlush\(detachedWin\.webContents, ipcMain, DETACHED_CLOSE_FLUSH_TIMEOUT_MS\),/)
    expect(flush).toBeGreaterThan(-1)
    // Installed before the window can load (and close), and before the 'closed' → whenIdle → reattached chain.
    expect(flush).toBeLessThan(detach.indexOf('detachedWin.loadFile('))
    expect(flush).toBeLessThan(detach.indexOf("detachedWin.on('closed'"))
    // workspace:reattach must not unregister a live window: its flush-save would no longer be recognised as detached.
    const reattach = section("ipcMain.handle('workspace:reattach'", '// ── Agent Runtime IPC')
    expect(reattach).toMatch(/if \(win && !win\.isDestroyed\(\)\) \{\s*win\.close\(\)\s*return true\s*\}/)
    const lastWindowClosed = section("win.on('closed', () => {\n    windowMap.delete(windowId)", '// Rebuild tray menu')
    expect(lastWindowClosed).not.toMatch(/detachedWindows\.clear\(\)/)
    // Quit: each renderer's own ack, bounded; detached windows included.
    const quit = section('// Notify all renderer windows to flush their latest state', "// Save all open windows' profiles before quitting")
    expect(quit).toMatch(/for \(const win of \[\.\.\.windowMap\.values\(\), \.\.\.detachedWindows\.values\(\)\]\)/)
    expect(quit).toMatch(/requestRendererFlush\(win\.webContents, ipcMain, QUIT_FLUSH_TIMEOUT_MS\)/)
    expect(quit).not.toMatch(/ipcMain\.once\('workspace:flush-save-done'/)
  })

  it('the registry handlers still require a registry window (remote clients / unknown senders unchanged)', () => {
    expect(section("registerHandler('workspace:save'", "registerHandler('workspace:load'")).toMatch(/if \(!ctx\.windowId\) return false/)
    expect(section("registerHandler('workspace:load'", '// Settings persistence')).toMatch(/if \(!ctx\.windowId\) return null/)
  })
})
