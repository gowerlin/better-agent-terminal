// PLAN-064 / T0827 (D270 / D271): Linux only — does fontconfig know any Chinese font and any emoji font?
// Chromium on Linux draws text only with the system's fontconfig fonts, so a WSL / minimal install without
// them shows the zh-TW / zh-CN interface (and the emoji icons) as boxes. The main process runs `fc-list`
// once after startup (electron/linux-font-check.ts); this file holds the pure parts shared by main and
// renderer: the queries, the result type, parsing, the log line, the "show the hint?" decision and the
// install command. No electron / DOM imports.
//
// 🔴 `unknown` (not Linux, no fc-list, timeout, failure, unparseable output) never shows anything.
// 🔴 BAT ships no fonts and changes no font-family / xterm font setting (D270): this only tells the user.
// See docs/agent-guide/linux-cjk-font-hint.md.

/** `fc-list` arguments. Each prints one line per matching font face (family names only). */
export const FC_LIST_QUERIES = {
  /** Any font fontconfig lists for Chinese (`zh-cn` / `zh-tw` / `zh-hk` … all match `zh`). */
  cjk: [':lang=zh', 'family'],
  /**
   * U+1F4E8 (📨, the notify-hold badge). Not U+1F600: DejaVu Sans, present on almost every system,
   * covers the emoticons block U+1F600–1F64F but not the other emoji BAT uses (T0827 WSL measurement).
   */
  emoji: [':charset=1f4e8', 'family'],
} as const

/** Debian / Ubuntu packages (the same as README / site install#linux-fonts, T0826). */
export const LINUX_FONT_PACKAGES = {
  cjk: 'fonts-noto-cjk',
  emoji: 'fonts-noto-color-emoji',
} as const

/** Local `ipcMain.handle` channels (not proxied, not helper channels); electron/linux-font-check.ts. */
export const LINUX_FONT_CHECK_IPC = {
  get: 'font-check:get',
  claimHint: 'font-check:claim-hint',
  changed: 'font-check:changed',
} as const

export const LINUX_FONT_HINT_URL = 'https://gowerlin.github.io/better-agent-terminal/install#linux-fonts'

export type LinuxFontUnknownReason = 'pending' | 'not-linux' | 'no-fc-list' | 'timeout' | 'failed'

export type LinuxFontCheck =
  | { state: 'ok'; cjkFamilies: number; emojiFamilies: number }
  | { state: 'missing'; cjk: boolean; emoji: boolean; cjkFamilies: number; emojiFamilies: number }
  | { state: 'unknown'; reason: LinuxFontUnknownReason; detail?: string }

export const LINUX_FONT_CHECK_PENDING: LinuxFontCheck = { state: 'unknown', reason: 'pending' }
export const LINUX_FONT_CHECK_NOT_LINUX: LinuxFontCheck = { state: 'unknown', reason: 'not-linux' }

/** One `fc-list` run as the main process saw it. */
export interface FcListRun {
  stdout: unknown
  /** 0 when it exited cleanly; a number = its exit code; null = ended by a signal. */
  exitCode?: number | null
  timedOut?: boolean
  /** A string error code from spawning (`ENOENT`, `EACCES`, …): the process never ran. */
  spawnErrorCode?: string
  spawnError?: string
}

type RunOutcome = { ok: true; families: number } | { ok: false; reason: Exclude<LinuxFontUnknownReason, 'pending' | 'not-linux'>; detail?: string }

const DETAIL_MAX_CHARS = 200

function shortDetail(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > DETAIL_MAX_CHARS ? `${t.slice(0, DETAIL_MAX_CHARS)}…` : t
}

/** Counts the non-empty lines; null when the output is not text `fc-list` would print. */
export function countFcListLines(stdout: unknown): number | null {
  if (typeof stdout !== 'string') return null
  if (stdout.includes('\u0000')) return null
  return stdout.split(/\r?\n/).filter(line => line.trim() !== '').length
}

function outcomeOf(run: FcListRun): RunOutcome {
  if (run.spawnErrorCode !== undefined || run.spawnError !== undefined) {
    if (run.spawnErrorCode === 'ENOENT') return { ok: false, reason: 'no-fc-list' }
    return { ok: false, reason: 'failed', detail: shortDetail(run.spawnError ?? run.spawnErrorCode ?? '') }
  }
  if (run.timedOut) return { ok: false, reason: 'timeout' }
  if (run.exitCode !== 0) return { ok: false, reason: 'failed', detail: run.exitCode === null ? 'signal' : `exit ${String(run.exitCode)}` }
  const families = countFcListLines(run.stdout)
  if (families === null) return { ok: false, reason: 'failed', detail: 'unparseable output' }
  return { ok: true, families }
}

const UNKNOWN_ORDER: Array<Exclude<LinuxFontUnknownReason, 'pending' | 'not-linux'>> = ['no-fc-list', 'timeout', 'failed']

/** Both runs → the result. Either run unusable → `unknown` (never a hint on half an answer). */
export function linuxFontCheckFromRuns(cjk: FcListRun, emoji: FcListRun): LinuxFontCheck {
  const a = outcomeOf(cjk)
  const b = outcomeOf(emoji)
  if (!a.ok || !b.ok) {
    const failures = [a, b].filter((o): o is Extract<RunOutcome, { ok: false }> => !o.ok)
    const first = UNKNOWN_ORDER.map(r => failures.find(f => f.reason === r)).find(Boolean)!
    return first.detail ? { state: 'unknown', reason: first.reason, detail: first.detail } : { state: 'unknown', reason: first.reason }
  }
  if (a.families > 0 && b.families > 0) return { state: 'ok', cjkFamilies: a.families, emojiFamilies: b.families }
  return { state: 'missing', cjk: a.families === 0, emoji: b.families === 0, cjkFamilies: a.families, emojiFamilies: b.families }
}

/** `[font-check] …` — result, reason, counts and time; never the font list. */
export function linuxFontCheckLogLine(result: LinuxFontCheck, ms: number): string {
  const took = `in ${Math.round(ms)} ms`
  if (result.state === 'ok') return `[font-check] ok ${took} (cjk faces=${result.cjkFamilies}, emoji faces=${result.emojiFamilies})`
  if (result.state === 'missing') {
    return `[font-check] missing cjk=${result.cjk} emoji=${result.emoji} ${took} (cjk faces=${result.cjkFamilies}, emoji faces=${result.emojiFamilies})`
  }
  return `[font-check] unknown(${result.reason}) ${took}${result.detail ? `: ${result.detail}` : ''}`
}

/** zh-TW / zh-CN (any `zh*` language code). */
export function isChineseLanguage(language: string | undefined | null): boolean {
  return typeof language === 'string' && /^zh(\b|[-_])/i.test(language)
}

export interface LinuxFontHintItems {
  cjk: boolean
  emoji: boolean
}

/**
 * What the hint lists, or null = no hint. Chinese fonts are listed only when the interface is Chinese;
 * missing emoji is listed whatever the language (BAT's icons are emoji). Dismissed ("don't show again")
 * → null for good; fonts installed → the check says `ok` → null.
 */
export function linuxFontHintItems(input: { result: LinuxFontCheck; language: string | undefined | null; dismissed: boolean }): LinuxFontHintItems | null {
  const { result, language, dismissed } = input
  if (dismissed || result.state !== 'missing') return null
  const cjk = result.cjk && isChineseLanguage(language)
  const emoji = result.emoji
  return cjk || emoji ? { cjk, emoji } : null
}

/** `sudo apt update && sudo apt install -y <packages for the listed items>`. */
export function linuxFontInstallCommand(items: LinuxFontHintItems): string {
  const packages = [
    ...(items.cjk ? [LINUX_FONT_PACKAGES.cjk] : []),
    ...(items.emoji ? [LINUX_FONT_PACKAGES.emoji] : []),
  ]
  return `sudo apt update && sudo apt install -y ${packages.join(' ')}`
}
