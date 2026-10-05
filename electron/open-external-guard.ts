/**
 * T0460 / BUG-105: shell:open-external opens a local file: URL with shell.openPath —
 * the OS "open" verb, which runs a .bat / .exe / .sh instead of showing it. Executable
 * files now need a main-side confirm (Cancel is the default); every other file still
 * opens directly.
 * T0461: a non-file URL reaches shell.openExternal only for http: / https: / mailto: —
 * openExternal hands any scheme to its Windows protocol handler (ms-msdt:, search-ms:,
 * ms-*:, ...). shell:open-path takes absolute local paths only and asks before an
 * executable, the same way.
 */
import path from 'path'

/**
 * Lower-case extensions the OS "open" verb may execute. One list for every platform:
 * a link in terminal output can name a file of any origin, and a false confirm on an
 * odd platform costs one click.
 */
export const EXECUTABLE_EXTENSIONS: ReadonlySet<string> = new Set([
  // Windows
  '.bat', '.cmd', '.com', '.exe', '.msi', '.msp', '.msc', '.ps1', '.psm1', '.vbs', '.vbe', '.vb',
  '.js', '.jse', '.wsf', '.wsh', '.ws', '.hta', '.scr', '.pif', '.cpl', '.reg', '.lnk', '.url',
  '.inf', '.scf', '.jar', '.chm', '.appref-ms', '.application', '.gadget', '.settingcontent-ms',
  // macOS
  '.app', '.command', '.pkg', '.dmg', '.terminal', '.webloc',
  // Linux / generic
  '.sh', '.run', '.appimage', '.desktop',
])

/** File type and permission bits, when the caller could read them (fs.Stats subset). */
export interface FileModeInfo {
  isFile: boolean
  mode: number
}

/**
 * The extension Windows actually resolves: an alternate data stream suffix
 * (`x.bat::$DATA`) and trailing dots / spaces (`x.bat.`) are dropped by the OS.
 */
function effectiveExtension(filePath: string, platform: NodeJS.Platform): string {
  if (platform !== 'win32') return path.posix.extname(filePath).toLowerCase()
  const name = path.win32.basename(filePath).replace(/:.*$/, '').replace(/[. ]+$/, '')
  return path.win32.extname(name).toLowerCase()
}

/**
 * True when opening `filePath` may run it: an executable extension (any case), or — on
 * POSIX, for a regular file without an extension — an execute bit in `stat.mode`.
 * Without `stat` (unreadable) an extensionless file is not flagged.
 */
export function isExecutablePath(filePath: string, platform: NodeJS.Platform, stat?: FileModeInfo | null): boolean {
  const ext = effectiveExtension(filePath, platform)
  if (ext) return EXECUTABLE_EXTENSIONS.has(ext)
  if (platform === 'win32' || !stat) return false
  return stat.isFile && (stat.mode & 0o111) !== 0
}

function decodePathname(pathname: string): string | null {
  try {
    return decodeURIComponent(pathname)
  } catch {
    return null
  }
}

/**
 * Local path for a file: URL, or null when it is not one / cannot be mapped. A host
 * other than localhost becomes a UNC path on Windows and is refused elsewhere.
 */
export function fileUrlToLocalPath(url: string, platform: NodeJS.Platform): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'file:') return null
  const filePath = decodePathname(parsed.pathname)
  if (filePath === null) return null
  const host = parsed.hostname.toLowerCase()
  if (host && host !== 'localhost') {
    return platform === 'win32' ? `\\\\${host}${filePath.replace(/\//g, '\\')}` : null
  }
  // On Windows, URL.pathname gives "/C:/foo" — strip the leading slash before
  // the drive letter so fs/shell APIs accept it.
  if (platform === 'win32' && /^\/[A-Za-z]:\//.test(filePath)) return filePath.slice(1)
  return filePath
}

/** Any file: URL, in whatever spelling (case, leading whitespace, host form). */
function isFileUrl(url: string): boolean {
  if (/^\s*file:/i.test(url)) return true
  try {
    return new URL(url).protocol === 'file:'
  } catch {
    return false
  }
}

/**
 * Schemes shell:open-external may hand to the OS. Every renderer caller sends http(s)
 * (terminal / chat / Markdown links, settings / About / GitHub / wizard links) or
 * mailto (chat Markdown); file: has its own branch above.
 */
export const EXTERNAL_URL_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:', 'mailto:'])

/**
 * True for an http: / https: / mailto: URL. The scheme must also open the raw string:
 * URL parsing strips leading whitespace / control characters, and the string that
 * reaches the OS is the raw one.
 */
export function isAllowedExternalUrl(url: string): boolean {
  if (typeof url !== 'string') return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  return EXTERNAL_URL_PROTOCOLS.has(parsed.protocol)
    && url.slice(0, parsed.protocol.length).toLowerCase() === parsed.protocol
}

/** The scheme alone, for logging a refused URL without its payload. */
function schemeForLog(url: string): string {
  try {
    return new URL(url).protocol
  } catch {
    return '(unparseable)'
  }
}

export type OpenExternalResult = 'opened' | 'cancelled' | 'not-found' | 'invalid' | 'blocked' | 'failed'

export interface OpenExternalDeps {
  platform: NodeJS.Platform
  openPath: (filePath: string) => Promise<string>
  openExternal: (url: string) => Promise<void>
  exists: (filePath: string) => boolean
  /** null when the file's mode cannot be read. */
  stat: (filePath: string) => FileModeInfo | null
  /** Resolves true only when the user chose Open. */
  confirmExecutable: (filePath: string) => Promise<boolean>
  notifyNotFound: (filePath: string) => void
  logError: (message: string) => void
}

/**
 * shell:open-external. file: URLs open with openPath (shell.openExternal treats file://
 * as a URL and relies on protocol handlers, which silently fails for many file types);
 * an executable asks first. Other URLs go to openExternal only for an allowed scheme.
 */
export async function handleOpenExternal(url: string, deps: OpenExternalDeps): Promise<OpenExternalResult> {
  if (typeof url !== 'string' || !isFileUrl(url)) {
    if (!isAllowedExternalUrl(url)) {
      deps.logError(`[shell:open-external] refused scheme ${typeof url === 'string' ? schemeForLog(url) : `(${typeof url})`}`)
      return 'blocked'
    }
    await deps.openExternal(url)
    return 'opened'
  }
  const filePath = fileUrlToLocalPath(url, deps.platform)
  if (filePath === null) {
    deps.logError('[shell:open-external] refused a file: URL that does not map to a local path')
    return 'invalid'
  }
  if (!deps.exists(filePath)) {
    deps.notifyNotFound(filePath)
    return 'not-found'
  }
  if (isExecutablePath(filePath, deps.platform, deps.platform === 'win32' ? null : deps.stat(filePath))) {
    if (!(await deps.confirmExecutable(filePath))) return 'cancelled'
  }
  const err = await deps.openPath(filePath)
  if (err) {
    deps.logError(`[shell:open-external] openPath failed for ${filePath}: ${err}`)
    return 'failed'
  }
  return 'opened'
}

export type OpenPathResult = 'opened' | 'cancelled' | 'invalid' | 'failed'

export interface OpenPathDeps {
  platform: NodeJS.Platform
  openPath: (filePath: string) => Promise<string>
  /** null when the path cannot be stat-ed (missing / unreadable). */
  stat: (filePath: string) => FileModeInfo | null
  /** Resolves true only when the user chose Open. */
  confirmExecutable: (filePath: string) => Promise<boolean>
  logError: (message: string) => void
}

/**
 * True when opening `targetPath` (a file, a folder, or something that cannot be
 * stat-ed) may run it. A folder opens in the file manager whatever its name — except
 * a macOS .app bundle, which the OS launches.
 */
function openPathMayExecute(targetPath: string, platform: NodeJS.Platform, stat: FileModeInfo | null): boolean {
  if (stat && !stat.isFile) {
    return platform === 'darwin' && effectiveExtension(targetPath, platform) === '.app'
  }
  return isExecutablePath(targetPath, platform, platform === 'win32' ? null : stat)
}

/**
 * shell:open-path (open a folder / file with the OS default app). Only an absolute
 * local path is accepted — ShellExecute would hand a `scheme:` string to its protocol
 * handler — and an executable asks first, as shell:open-external does.
 */
export async function handleOpenPath(targetPath: string, deps: OpenPathDeps): Promise<OpenPathResult> {
  const pathApi = deps.platform === 'win32' ? path.win32 : path.posix
  if (typeof targetPath !== 'string' || !pathApi.isAbsolute(targetPath)) {
    deps.logError('[shell:open-path] refused a path that is not absolute')
    return 'invalid'
  }
  if (openPathMayExecute(targetPath, deps.platform, deps.stat(targetPath))) {
    if (!(await deps.confirmExecutable(targetPath))) return 'cancelled'
  }
  const err = await deps.openPath(targetPath)
  if (err) {
    deps.logError(`[shell:open-path] openPath failed for ${targetPath}: ${err}`)
    return 'failed'
  }
  return 'opened'
}

/**
 * Executable-confirm strings. Electron main has no i18next instance (same as the quit
 * dialog, PLAN-012 / T0144), so they live here; keep them in sync with
 * src/locales/{en,zh-TW,zh-CN}.json `openExecutableConfirm.*` (a unit test checks).
 */
export function getExecutableConfirmStrings(lang: string | undefined) {
  const code = (lang || '').toLowerCase()
  if (code.startsWith('zh-tw') || code === 'zh' || code.startsWith('zh-hant')) {
    return {
      title: '開啟可執行檔',
      message: '要開啟「{{name}}」嗎？',
      detail: '這個檔案可能會被當成程式執行。只開啟你信任的檔案。\n\n{{path}}',
      open: '開啟',
      cancel: '取消',
    }
  }
  if (code.startsWith('zh-cn') || code.startsWith('zh-hans')) {
    return {
      title: '打开可执行文件',
      message: '要打开“{{name}}”吗？',
      detail: '此文件可能会被当作程序运行。请只打开你信任的文件。\n\n{{path}}',
      open: '打开',
      cancel: '取消',
    }
  }
  return {
    title: 'Open executable file',
    message: 'Open "{{name}}"?',
    detail: 'This file may run as a program. Only open files you trust.\n\n{{path}}',
    open: 'Open',
    cancel: 'Cancel',
  }
}

export const EXECUTABLE_CONFIRM_CANCEL_INDEX = 0
export const EXECUTABLE_CONFIRM_OPEN_INDEX = 1

/** dialog.showMessageBox options: Cancel is both the default button and the Esc result. */
export function buildExecutableConfirmDialog(filePath: string, platform: NodeJS.Platform, lang: string | undefined) {
  const s = getExecutableConfirmStrings(lang)
  const name = platform === 'win32' ? path.win32.basename(filePath) : path.posix.basename(filePath)
  const buttons: string[] = []
  buttons[EXECUTABLE_CONFIRM_CANCEL_INDEX] = s.cancel
  buttons[EXECUTABLE_CONFIRM_OPEN_INDEX] = s.open
  return {
    type: 'warning' as const,
    title: s.title,
    message: s.message.replace('{{name}}', () => name),
    detail: s.detail.replace('{{path}}', () => filePath),
    buttons,
    defaultId: EXECUTABLE_CONFIRM_CANCEL_INDEX,
    cancelId: EXECUTABLE_CONFIRM_CANCEL_INDEX,
    noLink: true,
  }
}
