// @vitest-environment node
/**
 * T0863 / BUG-212 (D287): the update check — semver precedence, desktop tags only, pre-releases on / off,
 * GitHub failures, the settings, once per start / one window — and main.ts source guards (startup once,
 * Help › Check for Updates…, the release page, no renderer-side GitHub call, no auto update).
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'
import {
  checkForUpdates,
  compareSemVer,
  desktopReleaseVersion,
  evaluateReleases,
  GITHUB_REPO,
  type GitHubRelease,
  type HttpGet,
  parseSemVer,
  parseUpdateSettings,
  pickLatestRelease,
  releasePageUrl,
  RELEASES_MAX_PAGES,
  RELEASES_PER_PAGE,
  StartupUpdateCheck,
  UPDATE_CHECK_TIMEOUT_MS,
  type UpdateCheckOutcome,
} from '../update-checker'

const PAGE = `https://github.com/${GITHUB_REPO}/releases/tag/`

function release(tag: string, extra: Partial<GitHubRelease> = {}): GitHubRelease {
  return { tag_name: tag, html_url: `${PAGE}${tag}`, body: `notes of ${tag}`, published_at: '2026-11-04T00:00:00Z', draft: false, prerelease: tag.includes('-'), ...extra }
}

function cmp(a: string, b: string): number {
  return compareSemVer(parseSemVer(a)!, parseSemVer(b)!)
}

describe('semver precedence', () => {
  it('the work order order: 0.7.4-pre.9 < 0.7.5-pre.1 < 0.7.5-rc.1 < 0.7.5', () => {
    const ordered = ['0.7.4-pre.9', '0.7.5-pre.1', '0.7.5-rc.1', '0.7.5']
    for (let i = 0; i < ordered.length - 1; i++) {
      expect(cmp(ordered[i], ordered[i + 1])).toBeLessThan(0)
      expect(cmp(ordered[i + 1], ordered[i])).toBeGreaterThan(0)
    }
  })

  it('alpha < beta < pre < rc (strings), numbers compare as numbers', () => {
    expect(cmp('1.0.0-alpha.1', '1.0.0-beta.1')).toBeLessThan(0)
    expect(cmp('1.0.0-beta.9', '1.0.0-pre.1')).toBeLessThan(0)
    expect(cmp('1.0.0-pre.9', '1.0.0-rc.1')).toBeLessThan(0)
    expect(cmp('0.7.4-pre.9', '0.7.4-pre.10')).toBeLessThan(0) // not '10' < '9'
    expect(cmp('0.7.4-pre.10', '0.7.4-pre.9')).toBeGreaterThan(0)
    expect(cmp('0.10.0', '0.9.9')).toBeGreaterThan(0)
  })

  it('a normal version is newer than a pre-release of the same core version', () => {
    expect(cmp('0.7.5', '0.7.5-rc.9')).toBeGreaterThan(0)
    expect(cmp('0.7.5-rc.9', '0.7.5')).toBeLessThan(0)
    expect(cmp('0.7.4', '0.7.5-pre.1')).toBeLessThan(0)
  })

  it('semver details: numeric < alphanumeric identifier, fewer identifiers first, build metadata ignored', () => {
    expect(cmp('1.0.0-1', '1.0.0-alpha')).toBeLessThan(0)
    expect(cmp('1.0.0-pre', '1.0.0-pre.1')).toBeLessThan(0)
    expect(cmp('1.0.0+build.1', '1.0.0+build.2')).toBe(0)
    expect(cmp('v0.7.4-pre.9', '0.7.4-pre.9')).toBe(0)
  })

  it('invalid versions do not parse', () => {
    for (const v of ['', '0.7', '0.7.4.1', '0.7.x', '01.2.3', '0.7.4-', 'server-bundle-v0.7.4-pre.9', 'latest']) {
      expect(parseSemVer(v), v).toBeNull()
    }
    expect(parseSemVer('0.7.4-pre.9')).toEqual({ major: 0, minor: 7, patch: 4, prerelease: ['pre', '9'] })
  })
})

describe('releases', () => {
  it('desktop tags only: v<semver>; server-bundle-v* and other tags do not count', () => {
    expect(desktopReleaseVersion('v0.7.4-pre.9')).not.toBeNull()
    expect(desktopReleaseVersion('server-bundle-v0.7.5-pre.1')).toBeNull()
    expect(desktopReleaseVersion('0.7.5')).toBeNull() // no v
    expect(desktopReleaseVersion('vnext')).toBeNull()
    expect(desktopReleaseVersion(42)).toBeNull()
  })

  const list = [
    release('server-bundle-v0.9.0-pre.1'),
    release('v0.7.4-pre.8'),
    release('v0.7.5-pre.1', { draft: true }),
    release('v0.7.4-pre.10'),
    release('v0.7.4-pre.9'),
    release('nightly'),
    release('v0.7.3'),
    { tag_name: undefined } as GitHubRelease,
  ]

  it('with pre-releases: the newest desktop release; drafts and server bundles skipped', () => {
    const latest = pickLatestRelease(list, true)
    expect(latest).toMatchObject({ tagName: 'v0.7.4-pre.10', version: '0.7.4-pre.10', prerelease: true, htmlUrl: `${PAGE}v0.7.4-pre.10`, body: 'notes of v0.7.4-pre.10' })
  })

  it('without pre-releases: only normal releases (a GitHub pre-release flag also counts as pre-release)', () => {
    expect(pickLatestRelease(list, false)?.tagName).toBe('v0.7.3')
    expect(pickLatestRelease([release('v0.8.0', { prerelease: true }), release('v0.7.3')], false)?.tagName).toBe('v0.7.3')
    expect(pickLatestRelease([release('v0.7.4-pre.9')], false)).toBeNull()
  })

  it('the page is that release (html_url), not /releases; a foreign html_url is rebuilt from the tag', () => {
    expect(releasePageUrl(`${PAGE}v0.7.4-pre.9`, 'v0.7.4-pre.9')).toBe(`${PAGE}v0.7.4-pre.9`)
    expect(releasePageUrl('https://evil.invalid/x', 'v0.7.4-pre.9')).toBe(`${PAGE}v0.7.4-pre.9`)
    expect(releasePageUrl(undefined, 'v0.7.4-pre.9')).toBe(`${PAGE}v0.7.4-pre.9`)
    expect(releasePageUrl(`https://github.com/${GITHUB_REPO}/releases`, 'v1.0.0')).toBe(`${PAGE}v1.0.0`)
  })

  it('current 0.7.4-pre.8: finds v0.7.4-pre.9 with pre-releases, nothing without', () => {
    const releases = [release('server-bundle-v0.7.4-pre.9'), release('v0.7.4-pre.9'), release('v0.7.4-pre.8')]
    const on = evaluateReleases(releases, '0.7.4-pre.8', true)
    expect(on.status).toBe('update')
    expect(on.status === 'update' && on.result.latestRelease?.htmlUrl).toBe(`${PAGE}v0.7.4-pre.9`)
    const off = evaluateReleases(releases, '0.7.4-pre.8', false)
    expect(off).toEqual({ status: 'latest', result: { hasUpdate: false, currentVersion: '0.7.4-pre.8', latestRelease: null, includePrerelease: false } })
  })

  it('same or older newest release → latest; current newer than every release → latest', () => {
    expect(evaluateReleases([release('v0.7.4-pre.9')], '0.7.4-pre.9', true).status).toBe('latest')
    expect(evaluateReleases([release('v0.7.4-pre.9')], '0.7.5', true).status).toBe('latest')
    expect(evaluateReleases([], '0.7.4-pre.9', true).status).toBe('latest')
  })

  it('an unparsable current version is an error, not an update', () => {
    expect(evaluateReleases([release('v9.9.9')], 'dev', true)).toMatchObject({ status: 'error', currentVersion: 'dev' })
  })
})

describe('checkForUpdates (fake GitHub)', () => {
  const ok = (items: unknown[]) => ({ statusCode: 200, body: JSON.stringify(items) })

  it('asks /releases (not /releases/latest), per_page 100; stops on a short page', async () => {
    const get = vi.fn<HttpGet>().mockResolvedValue(ok([release('v0.7.4-pre.9')]))
    const outcome = await checkForUpdates({ currentVersion: '0.7.4-pre.8', includePrerelease: true, get })
    expect(outcome.status).toBe('update')
    expect(get).toHaveBeenCalledTimes(1)
    expect(get.mock.calls[0][0]).toBe(`/repos/${GITHUB_REPO}/releases?per_page=${RELEASES_PER_PAGE}&page=1`)
    expect(get.mock.calls[0][0]).not.toContain('/latest')
  })

  it(`pages: full pages continue, at most ${RELEASES_MAX_PAGES}`, async () => {
    const full = Array.from({ length: RELEASES_PER_PAGE }, (_, i) => release(`v0.1.${i}`))
    const get = vi.fn<HttpGet>()
      .mockResolvedValueOnce(ok(full))
      .mockResolvedValueOnce(ok([release('v0.7.4-pre.9'), ...full.slice(1)]))
      .mockResolvedValueOnce(ok(full))
      .mockResolvedValue(ok([release('v9.0.0')]))
    const outcome = await checkForUpdates({ currentVersion: '0.7.4-pre.8', includePrerelease: true, get })
    expect(get).toHaveBeenCalledTimes(RELEASES_MAX_PAGES)
    expect(outcome.status === 'update' && outcome.result.latestRelease?.tagName).toBe('v0.7.4-pre.9')
  })

  it.each([404, 403, 500])('HTTP %i → error with the status', async (status) => {
    const get = vi.fn<HttpGet>().mockResolvedValue({ statusCode: status, body: '{"message":"Not Found"}' })
    expect(await checkForUpdates({ currentVersion: '0.7.4-pre.8', includePrerelease: true, get }))
      .toEqual({ status: 'error', currentVersion: '0.7.4-pre.8', reason: `GitHub HTTP ${status}` })
  })

  it('not JSON / not a list → error', async () => {
    const bad = vi.fn<HttpGet>().mockResolvedValue({ statusCode: 200, body: '<html>' })
    expect(await checkForUpdates({ currentVersion: '0.7.4', includePrerelease: true, get: bad })).toMatchObject({ status: 'error', reason: 'GitHub response is not JSON' })
    const obj = vi.fn<HttpGet>().mockResolvedValue({ statusCode: 200, body: '{}' })
    expect(await checkForUpdates({ currentVersion: '0.7.4', includePrerelease: true, get: obj })).toMatchObject({ status: 'error', reason: 'GitHub response is not a release list' })
  })

  it('network error → error with the message (never rejects)', async () => {
    const get = vi.fn<HttpGet>().mockRejectedValue(new Error('getaddrinfo ENOTFOUND api.github.com'))
    expect(await checkForUpdates({ currentVersion: '0.7.4', includePrerelease: true, get })).toMatchObject({ status: 'error', reason: 'getaddrinfo ENOTFOUND api.github.com' })
  })

  it(`timeout (default ${UPDATE_CHECK_TIMEOUT_MS} ms): aborts the request → error`, async () => {
    expect(UPDATE_CHECK_TIMEOUT_MS).toBe(10_000)
    const get: HttpGet = (_path, signal) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('aborted')))
    })
    expect(await checkForUpdates({ currentVersion: '0.7.4', includePrerelease: true, get, timeoutMs: 20 }))
      .toEqual({ status: 'error', currentVersion: '0.7.4', reason: 'timed out after 0.02 s' })
  })
})

describe('parseUpdateSettings', () => {
  it('missing / unreadable / malformed → both on', () => {
    for (const raw of [null, undefined, '', '{', 'null', '[]', '{}']) {
      expect(parseUpdateSettings(raw)).toEqual({ checkForUpdates: true, includePrereleaseUpdates: true })
    }
  })

  it('only an explicit false turns one off', () => {
    expect(parseUpdateSettings('{"checkForUpdates":false}')).toEqual({ checkForUpdates: false, includePrereleaseUpdates: true })
    expect(parseUpdateSettings('{"includePrereleaseUpdates":false}')).toEqual({ checkForUpdates: true, includePrereleaseUpdates: false })
    expect(parseUpdateSettings('{"checkForUpdates":"no","includePrereleaseUpdates":0}')).toEqual({ checkForUpdates: true, includePrereleaseUpdates: true })
  })
})

describe('StartupUpdateCheck: once per start, one window', () => {
  const update: UpdateCheckOutcome = {
    status: 'update',
    result: { hasUpdate: true, currentVersion: '0.7.4-pre.8', includePrerelease: true, latestRelease: { version: '0.7.4-pre.9', tagName: 'v0.7.4-pre.9', htmlUrl: `${PAGE}v0.7.4-pre.9`, body: '', publishedAt: '', prerelease: true } },
  }

  it('checks GitHub once however many windows ask; the first window gets the update, the others null', async () => {
    const startup = new StartupUpdateCheck()
    const check = vi.fn().mockResolvedValue(update)
    const early = startup.claim(() => true) // a window asking before the check starts waits for it
    await startup.run(check)
    await startup.run(check)
    expect(check).toHaveBeenCalledTimes(1)
    const later = await Promise.all([startup.claim(() => true), startup.claim(() => true)])
    expect(await early).toEqual(update.result)
    expect(later).toEqual([null, null])
    expect(check).toHaveBeenCalledTimes(1)
  })

  it('checkForUpdates off now (e2e saves it, then reloads) → null, and the update stays unclaimed', async () => {
    const startup = new StartupUpdateCheck()
    await startup.run(async () => update)
    expect(await startup.claim(() => false)).toBeNull()
    expect(await startup.claim(() => true)).toEqual(update.result)
  })

  it('skip (off at startup) → no check, every claim null', async () => {
    const startup = new StartupUpdateCheck()
    const claim = startup.claim(() => true)
    startup.skip()
    const check = vi.fn()
    await startup.run(check)
    expect(check).not.toHaveBeenCalled()
    expect(await claim).toBeNull()
  })

  it('latest / error / a rejecting check → null', async () => {
    for (const outcome of [{ ...update, status: 'latest' }, { status: 'error', currentVersion: '0.7.4', reason: 'x' }] as UpdateCheckOutcome[]) {
      const startup = new StartupUpdateCheck()
      await startup.run(async () => outcome)
      expect(await startup.claim(() => true)).toBeNull()
    }
    const startup = new StartupUpdateCheck()
    await startup.run(() => Promise.reject(new Error('boom')))
    expect(await startup.claim(() => true)).toBeNull()
  })
})

describe('source guards', () => {
  const main = readFileSync(join(__dirname, '..', 'main.ts'), 'utf8')
  const checker = readFileSync(join(__dirname, '..', 'update-checker.ts'), 'utf8')
  const preload = readFileSync(join(__dirname, '..', 'preload.ts'), 'utf8')
  const notification = readFileSync(join(__dirname, '..', '..', 'src', 'components', 'UpdateNotification.tsx'), 'utf8')

  it('the checker does not import electron, ask /releases/latest, or carry a token', () => {
    expect(checker).not.toMatch(/from 'electron'/)
    expect(checker).not.toContain('releases/latest')
    expect(checker).not.toMatch(/Authorization|GITHUB_TOKEN|\bgh\b api/)
  })

  it('no auto update: no electron-updater, nothing downloaded', () => {
    expect(main).not.toMatch(/electron-updater|autoUpdater/)
    expect(checker).not.toMatch(/electron-updater|autoUpdater|browser_download_url/)
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf8')) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
    expect({ ...pkg.dependencies, ...pkg.devDependencies }).not.toHaveProperty('electron-updater')
  })

  it('startup: one check through StartupUpdateCheck, no periodic check; windows claim it', () => {
    expect(main.match(/startupUpdateCheck\.run\(/g)).toHaveLength(1)
    expect(main).toContain("ipcMain.handle('update:claim-startup-result'")
    expect(main).not.toContain("'update:check'")
    expect(preload).not.toContain("'update:check'")
    expect(main).not.toMatch(/setInterval\([^)]*checkForUpdates/)
  })

  it('Help › Check for Updates… sends the result to the window that asked', () => {
    expect(main).toContain("label: 'Check for Updates…'")
    expect(main).toMatch(/runManualUpdateCheck\(\(win instanceof BrowserWindow/)
    expect(main).toContain("target.webContents.send('update:manual-result', outcome)")
  })

  it('the menu item and the dialog open that release page, not /releases', () => {
    expect(main).toContain('click: () => shell.openExternal(release.htmlUrl)')
    expect(notification).toContain('openExternal(releasePageToOpen(latestRelease))')
    expect(notification).not.toMatch(/openExternal\('https:\/\/github\.com\/gowerlin\/better-agent-terminal\/releases'\)/)
  })

  it('the renderer never calls GitHub', () => {
    expect(notification).not.toMatch(/api\.github\.com|update\.check\(/)
  })
})
