/**
 * T0453 (BUG-113): a detached workspace window has no registry entry of its own
 * (not in windowMap → windowId null), so workspace:load returned null and the window
 * showed "Workspace not found" ever since 512c118. It now reads its parent window's
 * entry, read-only; its workspace:save is a no-op so it never overwrites the parent.
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
    const divert = fn.search(/if \(!windowId && DETACHED_WORKSPACE_CHANNELS\.has\(channel\)\) \{\s*const detachedWorkspaceId = getDetachedWorkspaceIdByWebContents\(event\.sender\)\s*if \(detachedWorkspaceId !== null\) return invokeDetachedWorkspacePersistence\(channel, detachedWorkspaceId\)\s*\}/)
    const alwaysLocal = fn.search(/if \(ALWAYS_LOCAL_CHANNELS\.has\(channel\)\) \{\s*return invokeHandler\(channel, args, windowId\)/)
    expect(divert).toBeGreaterThan(fn.indexOf('const windowId = getWindowIdByWebContents(event.sender)'))
    expect(alwaysLocal).toBeGreaterThan(divert)
    // T0446 routing for every other channel is untouched and still runs after the ALWAYS_LOCAL branch.
    expect(fn.indexOf('await resolveDetachedBinding(detachedWorkspaceId)')).toBeGreaterThan(alwaysLocal)
  })

  it('load reads the parent window entry; save is a no-op that never reaches the handler', () => {
    const fn = section('async function invokeDetachedWorkspacePersistence(', 'function bindProxiedHandlersToIpc()')
    expect(fn).toMatch(/if \(channel === 'workspace:save'\) return true/)
    expect(fn.indexOf("if (channel === 'workspace:save') return true")).toBeLessThan(fn.indexOf('invokeHandler('))
    expect(fn).not.toMatch(/invokeHandler\('workspace:save'/)
    expect(fn).not.toMatch(/saveEntry\(/)
    expect(fn).toMatch(/detachedWindowRecords\.get\(workspaceId\)\?\.parentWindowId/)
    expect(fn).toMatch(/invokeHandler\('workspace:load', \[\], parentWindowId\)/)
    // No recorded parent → null (renderer: "Workspace not found"), never another window's entry.
    expect(fn).toMatch(/if \(!parentWindowId\) \{[\s\S]*?return null/)
  })

  it('the registry handlers still require a registry window (remote clients / unknown senders unchanged)', () => {
    expect(section("registerHandler('workspace:save'", "registerHandler('workspace:load'")).toMatch(/if \(!ctx\.windowId\) return false/)
    expect(section("registerHandler('workspace:load'", '// Settings persistence')).toMatch(/if \(!ctx\.windowId\) return null/)
  })
})
