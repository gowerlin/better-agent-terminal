// File path / type utilities used by FileTree and adjacent code (PLAN-023 階段 3).
// Centralized here so renderer + preload share one canonicalization rule.

import type { FileEntry, RawFileEntry } from '../types/file'

// Normalize path to a canonical lookup key.
// - Collapses mixed separators (\ vs /) — fixes Windows rootPath uses /, readdir returns \.
// - Lowercases — fixes Windows/macOS case-insensitive fs where paths differ in case.
// - Strips trailing slashes — keeps `C:/foo` and `C:/foo/` identical.
// Linux is technically case-sensitive, but treating workspace paths as case-insensitive is
// accepted (per T0209) since workspaces rarely contain same-name case-variant siblings.
export function toPathKey(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

// Promote a raw IPC entry to a full FileEntry by computing pathKey.
export function withPathKey(raw: RawFileEntry): FileEntry {
  return { ...raw, pathKey: toPathKey(raw.path) }
}

export function withPathKeys(raws: RawFileEntry[]): FileEntry[] {
  return raws.map(withPathKey)
}

// File-type helpers shared by FileTreeNode (icons) and FilePreview (preview routing).

const TEXT_EXTS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'json', 'css', 'scss', 'less', 'html', 'htm',
  'md', 'txt', 'yml', 'yaml', 'toml', 'xml', 'svg', 'sh', 'bash', 'zsh',
  'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp', 'cs',
  'env', 'gitignore', 'editorconfig', 'prettierrc', 'eslintrc',
  'dockerfile', 'makefile', 'cfg', 'ini', 'conf', 'log',
])

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico'])

export function getFileExt(name: string): string {
  const lower = name.toLowerCase()
  // Handle dotfiles like .gitignore, .env
  if (lower.startsWith('.') && !lower.includes('.', 1)) {
    return lower.substring(1)
  }
  return lower.split('.').pop() || ''
}

export function canPreview(name: string): 'text' | 'image' | 'pdf' | null {
  const ext = getFileExt(name)
  if (TEXT_EXTS.has(ext)) return 'text'
  if (IMAGE_EXTS.has(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  return null
}

export function getFileIcon(name: string): string {
  const ext = getFileExt(name)
  switch (ext) {
    case 'ts': case 'tsx': return '🔷'
    case 'js': case 'jsx': return '🟡'
    case 'json': return '📋'
    case 'css': case 'scss': case 'less': return '🎨'
    case 'html': case 'htm': return '🌐'
    case 'md': return '📝'
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'webp': return '🖼️'
    case 'sh': case 'bash': case 'zsh': return '⚙️'
    case 'yml': case 'yaml': case 'toml': return '⚙️'
    case 'lock': return '🔒'
    case 'py': return '🐍'
    case 'go': return '🔵'
    case 'rs': return '🦀'
    default: return '📄'
  }
}
