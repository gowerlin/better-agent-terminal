import https from 'https'
import { resolveCheckForUpdates } from '../src/lib/check-for-updates-migration'

/**
 * T0863 / BUG-212 (D287): checking GitHub for a newer BAT. Only checks: nothing is downloaded or installed.
 *
 * - Startup: main checks once (`StartupUpdateCheck`); windows ask main for that result, they never call GitHub.
 *   The update dialog is handed to one window per BAT start.
 * - Help › Check for Updates…: main checks on request; the result goes to the window that asked.
 * - `/releases` (not the "latest release" endpoint, which leaves out pre-releases: BUG-212), at most
 *   `RELEASES_MAX_PAGES` × `RELEASES_PER_PAGE` releases, `UPDATE_CHECK_TIMEOUT_MS` for the whole check.
 * - Only desktop tags `v<semver>` count (`server-bundle-v*` and drafts do not); semver precedence decides.
 *
 * This module does not import electron (main passes the current version), so it is unit tested directly.
 * Logs (by main) carry versions and results only, never a release body.
 */

export const GITHUB_REPO = 'gowerlin/better-agent-terminal'
export const RELEASES_PAGE_URL_PREFIX = `https://github.com/${GITHUB_REPO}/releases/`
export const RELEASES_PER_PAGE = 100
/** 300 releases: the fork has 179 (2026-11-04), newest first, so the newest desktop tag is on page 1. */
export const RELEASES_MAX_PAGES = 3
/** The whole check (every page) ends after this. */
export const UPDATE_CHECK_TIMEOUT_MS = 10_000

export interface ReleaseInfo {
  version: string
  tagName: string
  /** The page of this release (`html_url`), not the `/releases` overview. */
  htmlUrl: string
  body: string
  publishedAt: string
  prerelease: boolean
}

export interface UpdateCheckResult {
  hasUpdate: boolean
  currentVersion: string
  /** The newest release considered (newer or not); null when there is none. */
  latestRelease: ReleaseInfo | null
  includePrerelease: boolean
}

export type UpdateCheckOutcome =
  | { status: 'update'; result: UpdateCheckResult }
  | { status: 'latest'; result: UpdateCheckResult }
  | { status: 'error'; currentVersion: string; reason: string }

// ---------------------------------------------------------------------------------------------
// semver

export interface SemVer {
  major: number
  minor: number
  patch: number
  /** Pre-release identifiers (`pre.9` → ['pre', '9']); empty for a normal version. */
  prerelease: string[]
}

const SEMVER_RE = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/
const NUMERIC_ID = /^\d+$/

export function parseSemVer(text: string): SemVer | null {
  const m = SEMVER_RE.exec(text.trim())
  if (!m) return null
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ? m[4].split('.') : [],
  }
}

function compareIdentifiers(a: string, b: string): number {
  const aNum = NUMERIC_ID.test(a)
  const bNum = NUMERIC_ID.test(b)
  if (aNum && bNum) {
    // compare as numbers of any length: without leading zeros, the longer one is larger
    const x = a.replace(/^0+(?=\d)/, '')
    const y = b.replace(/^0+(?=\d)/, '')
    if (x.length !== y.length) return x.length < y.length ? -1 : 1
    return x < y ? -1 : x > y ? 1 : 0
  }
  // semver: numeric identifiers have lower precedence than alphanumeric ones
  if (aNum) return -1
  if (bNum) return 1
  return a < b ? -1 : a > b ? 1 : 0 // ASCII: alpha < beta < pre < rc
}

/** Semver precedence: < 0 when a is older than b, > 0 when newer, 0 when equal (build metadata ignored). */
export function compareSemVer(a: SemVer, b: SemVer): number {
  for (const key of ['major', 'minor', 'patch'] as const) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1
  }
  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    // the normal version is newer than any pre-release of the same core version
    if (a.prerelease.length === b.prerelease.length) return 0
    return a.prerelease.length === 0 ? 1 : -1
  }
  const n = Math.min(a.prerelease.length, b.prerelease.length)
  for (let i = 0; i < n; i++) {
    const c = compareIdentifiers(a.prerelease[i], b.prerelease[i])
    if (c !== 0) return c
  }
  return a.prerelease.length === b.prerelease.length ? 0 : a.prerelease.length < b.prerelease.length ? -1 : 1
}

// ---------------------------------------------------------------------------------------------
// releases → result

/** The fields of a GitHub release this module reads. */
export interface GitHubRelease {
  tag_name?: unknown
  html_url?: unknown
  body?: unknown
  published_at?: unknown
  draft?: unknown
  prerelease?: unknown
}

/** Desktop tags only: `v<semver>`. `server-bundle-v*` (and anything else) does not match. */
export function desktopReleaseVersion(tagName: unknown): SemVer | null {
  if (typeof tagName !== 'string' || !tagName.startsWith('v')) return null
  return parseSemVer(tagName)
}

/** The page of the release: GitHub's `html_url` when it is a page of this repo, otherwise built from the tag. */
export function releasePageUrl(htmlUrl: unknown, tagName: string): string {
  if (typeof htmlUrl === 'string' && htmlUrl.startsWith(RELEASES_PAGE_URL_PREFIX)) return htmlUrl
  return `${RELEASES_PAGE_URL_PREFIX}tag/${encodeURIComponent(tagName)}`
}

/**
 * Picks the newest desktop release. A release counts as a pre-release when its version has pre-release
 * identifiers or GitHub marks it so; with `includePrerelease` off only the others count. Drafts never count.
 */
export function pickLatestRelease(releases: readonly GitHubRelease[], includePrerelease: boolean): ReleaseInfo | null {
  let best: { version: SemVer; info: ReleaseInfo } | null = null
  for (const r of releases) {
    if (!r || typeof r !== 'object' || r.draft === true) continue
    const version = desktopReleaseVersion(r.tag_name)
    if (!version) continue
    const prerelease = version.prerelease.length > 0 || r.prerelease === true
    if (prerelease && !includePrerelease) continue
    if (best && compareSemVer(version, best.version) <= 0) continue
    const tagName = r.tag_name as string
    best = {
      version,
      info: {
        version: tagName.slice(1),
        tagName,
        htmlUrl: releasePageUrl(r.html_url, tagName),
        body: typeof r.body === 'string' ? r.body : '',
        publishedAt: typeof r.published_at === 'string' ? r.published_at : '',
        prerelease,
      },
    }
  }
  return best?.info ?? null
}

export function evaluateReleases(releases: readonly GitHubRelease[], currentVersion: string, includePrerelease: boolean): UpdateCheckOutcome {
  const current = parseSemVer(currentVersion)
  if (!current) return { status: 'error', currentVersion, reason: `current version is not semver: ${currentVersion}` }
  const latestRelease = pickLatestRelease(releases, includePrerelease)
  const hasUpdate = latestRelease !== null && compareSemVer(parseSemVer(latestRelease.tagName)!, current) > 0
  const result: UpdateCheckResult = { hasUpdate, currentVersion, latestRelease, includePrerelease }
  return { status: hasUpdate ? 'update' : 'latest', result }
}

// ---------------------------------------------------------------------------------------------
// GitHub

export interface HttpResponse { statusCode: number; body: string }
export type HttpGet = (path: string, signal: AbortSignal) => Promise<HttpResponse>

/** GET https://api.github.com<path> with Node `https` (no token, no `gh`). */
export const httpsGet: HttpGet = (path, signal) => new Promise((resolve, reject) => {
  const req = https.request({
    hostname: 'api.github.com',
    path,
    method: 'GET',
    headers: {
      'User-Agent': 'Better-Agent-Terminal',
      'Accept': 'application/vnd.github.v3+json',
    },
    signal,
  }, (res) => {
    let data = ''
    res.setEncoding('utf8')
    res.on('data', (chunk: string) => { data += chunk })
    res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body: data }))
    res.on('error', reject)
  })
  req.on('error', reject)
  req.end()
})

export interface CheckForUpdatesOptions {
  currentVersion: string
  includePrerelease: boolean
  /** Tests only. */
  get?: HttpGet
  timeoutMs?: number
}

/** Never rejects: failures (HTTP status, timeout, network, bad JSON) are `status: 'error'` with a short reason. */
export async function checkForUpdates(options: CheckForUpdatesOptions): Promise<UpdateCheckOutcome> {
  const { currentVersion, includePrerelease } = options
  const get = options.get ?? httpsGet
  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? UPDATE_CHECK_TIMEOUT_MS
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const releases: GitHubRelease[] = []
    for (let page = 1; page <= RELEASES_MAX_PAGES; page++) {
      const res = await get(`/repos/${GITHUB_REPO}/releases?per_page=${RELEASES_PER_PAGE}&page=${page}`, controller.signal)
      if (res.statusCode !== 200) return { status: 'error', currentVersion, reason: `GitHub HTTP ${res.statusCode}` }
      let parsed: unknown
      try { parsed = JSON.parse(res.body) } catch { return { status: 'error', currentVersion, reason: 'GitHub response is not JSON' } }
      if (!Array.isArray(parsed)) return { status: 'error', currentVersion, reason: 'GitHub response is not a release list' }
      releases.push(...(parsed as GitHubRelease[]))
      if (parsed.length < RELEASES_PER_PAGE) break
    }
    return evaluateReleases(releases, currentVersion, includePrerelease)
  } catch (error) {
    if (controller.signal.aborted) return { status: 'error', currentVersion, reason: `timed out after ${timeoutMs / 1000} s` }
    return { status: 'error', currentVersion, reason: error instanceof Error ? error.message : String(error) }
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------------------------
// settings

export interface UpdateSettings {
  /**
   * Startup check only; Help › Check for Updates… ignores it. T0864 (D288): `resolveCheckForUpdates` —
   * without the `checkForUpdatesMigrated` marker it is on whatever the file says (the renderer writes the
   * migration back; main never writes settings.json); with the marker only an explicit false is off.
   */
  checkForUpdates: boolean
  /** Missing → true (the fork only publishes pre-releases, D287). */
  includePrereleaseUpdates: boolean
}

/** Reads the two settings from settings.json text; unreadable / malformed → the defaults. */
export function parseUpdateSettings(raw: string | null | undefined): UpdateSettings {
  const settings: UpdateSettings = { checkForUpdates: true, includePrereleaseUpdates: true }
  if (!raw) return settings
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown> | null
    if (parsed && typeof parsed === 'object') {
      settings.checkForUpdates = resolveCheckForUpdates(parsed).checkForUpdates
      if (parsed.includePrereleaseUpdates === false) settings.includePrereleaseUpdates = false
    }
  } catch { /* malformed settings: defaults */ }
  return settings
}

// ---------------------------------------------------------------------------------------------
// startup: once per BAT start, one window

/**
 * The startup check. `run` (or `skip`) is called once by main; `claim` is what windows ask. A newer
 * version goes to the first window that claims it while `checkForUpdates` is still on; every other
 * claim (and every claim after that) gets null. Claims made before `run` / `skip` wait for it.
 */
export class StartupUpdateCheck {
  private outcome: Promise<UpdateCheckOutcome | null>
  private settle!: (outcome: UpdateCheckOutcome | null) => void
  private started = false
  private claimed = false

  constructor() {
    this.outcome = new Promise(resolve => { this.settle = resolve })
  }

  /** Runs the check; a second call returns the first one's outcome without checking again. */
  run(check: () => Promise<UpdateCheckOutcome>): Promise<UpdateCheckOutcome | null> {
    if (!this.started) {
      this.started = true
      check().then(o => this.settle(o), (error: unknown) => this.settle({ status: 'error', currentVersion: '', reason: String(error) }))
    }
    return this.outcome
  }

  /** `checkForUpdates: false` at startup: no check; claims get null. */
  skip(): void {
    if (this.started) return
    this.started = true
    this.settle(null)
  }

  async claim(enabledNow: () => boolean): Promise<UpdateCheckResult | null> {
    const outcome = await this.outcome
    if (!outcome || outcome.status !== 'update' || this.claimed || !enabledNow()) return null
    this.claimed = true
    return outcome.result
  }
}
