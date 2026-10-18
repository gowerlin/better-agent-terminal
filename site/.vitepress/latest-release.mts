// build 時取最新的桌面版 release（tag `v*`，排除 `server-bundle-v*`），產生下載連結。
// 取不到時退回 releases 列表並在 build log 警告，不讓 build 失敗。

export const REPO = 'gowerlin/better-agent-terminal'
export const RELEASES_URL = `https://github.com/${REPO}/releases`

export type DownloadPlatform = 'windows-installer' | 'windows-zip' | 'macos' | 'linux'

export interface DownloadLink {
  platform: DownloadPlatform
  label: string
  note: string
  url: string
  fileName: string | null
}

export interface LatestRelease {
  /** 例如 `v0.7.0-pre.8`；取不到時為 null */
  tag: string | null
  /** 發佈日（YYYY-MM-DD，UTC）；取不到時為 null */
  publishedAt: string | null
  /** 該版的 GitHub Release 頁；取不到時為 releases 列表 */
  pageUrl: string
  links: DownloadLink[]
}

interface GitHubAsset {
  name: string
  browser_download_url: string
}

interface GitHubRelease {
  tag_name: string
  draft: boolean
  html_url: string
  published_at: string | null
  assets: GitHubAsset[]
}

const PLATFORMS: { platform: DownloadPlatform; label: string; note: string; match: (name: string) => boolean }[] = [
  {
    platform: 'windows-installer',
    label: 'Windows 安裝檔',
    note: '.exe',
    match: name => /^BetterAgentTerminal\.Setup\..+\.exe$/.test(name)
  },
  {
    platform: 'windows-zip',
    label: 'Windows 免安裝版',
    note: '.zip',
    match: name => /-win\.zip$/.test(name)
  },
  {
    platform: 'macos',
    label: 'macOS（Apple Silicon）',
    note: '.dmg',
    match: name => /-arm64\.dmg$/.test(name)
  },
  {
    platform: 'linux',
    label: 'Linux',
    note: '.AppImage',
    match: name => /\.AppImage$/.test(name)
  }
]

function fallback(): LatestRelease {
  return {
    tag: null,
    publishedAt: null,
    pageUrl: RELEASES_URL,
    links: PLATFORMS.map(p => ({ platform: p.platform, label: p.label, note: p.note, url: RELEASES_URL, fileName: null }))
  }
}

function warn(message: string): void {
  console.warn(`\n[latest-release] WARNING: ${message}；下載連結改指向 ${RELEASES_URL}\n`)
}

async function fetchLatestRelease(): Promise<LatestRelease> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'better-agent-terminal-site'
  }
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`

  let releases: GitHubRelease[]
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, {
      headers,
      signal: AbortSignal.timeout(15000)
    })
    if (!res.ok) {
      warn(`GitHub Releases API 回應 ${res.status} ${res.statusText}`)
      return fallback()
    }
    releases = await res.json() as GitHubRelease[]
  } catch (err) {
    warn(`GitHub Releases API 呼叫失敗（${err instanceof Error ? err.message : String(err)}）`)
    return fallback()
  }

  // API 依建立時間新到舊排序；server bundle 是另一條 tag 線（server-bundle-v*）
  const release = releases.find(r => !r.draft && /^v\d/.test(r.tag_name))
  if (!release) {
    warn('找不到 v* release')
    return fallback()
  }

  const links = PLATFORMS.map(p => {
    const asset = release.assets.find(a => p.match(a.name))
    if (!asset) warn(`${release.tag_name} 沒有 ${p.label} 的資產`)
    return {
      platform: p.platform,
      label: p.label,
      note: p.note,
      url: asset ? asset.browser_download_url : release.html_url,
      fileName: asset ? asset.name : null
    }
  })

  console.log(`[latest-release] ${release.tag_name}（${token ? 'token' : '匿名'}）`)
  for (const link of links) console.log(`[latest-release]   ${link.label}: ${link.url}`)

  return {
    tag: release.tag_name,
    publishedAt: release.published_at ? release.published_at.slice(0, 10) : null,
    pageUrl: release.html_url,
    links
  }
}

let cached: Promise<LatestRelease> | undefined

export function getLatestRelease(): Promise<LatestRelease> {
  cached ??= fetchLatestRelease()
  return cached
}
