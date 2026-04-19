import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useMenuPosition } from '../hooks/useMenuPosition'
import { HighlightedCode } from './PathLinker'
import { ResizeHandle } from './ResizeHandle'
import { consumePendingReveal } from '../state/fileTreeRevealBus'
import { FileTreeNode } from './FileTreeNode'
import { MarkdownPreview } from './FileTreeMarkdown'
import type { FileEntry } from '../types/file'
import { toPathKey, getFileExt, canPreview, getFileIcon } from '../utils/filePathKey'

interface FileTreeProps {
  rootPath: string
}

function FilePreview({ filePath, fileName, refreshKey }: Readonly<{ filePath: string; fileName: string; refreshKey: number }>) {
  const [content, setContent] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'source' | 'rendered'>('rendered')
  const isMarkdown = getFileExt(fileName) === 'md'

  useEffect(() => {
    let cancelled = false
    setContent(null)
    setImageUrl(null)
    setError(null)
    setLoading(true)

    const type = canPreview(fileName)
    if (type === 'text') {
      window.electronAPI.fs.readFile(filePath).then(result => {
        if (cancelled) return
        if (result.error) {
          setError(result.error === 'File too large' ? `File too large (${Math.round((result.size || 0) / 1024)}KB)` : result.error)
        } else {
          setContent(result.content || '')
        }
        setLoading(false)
      })
    } else if (type === 'image') {
      window.electronAPI.image.readAsDataUrl(filePath).then(url => {
        if (cancelled) return
        setImageUrl(url)
        setLoading(false)
      }).catch(() => {
        if (cancelled) return
        setError('Failed to load image')
        setLoading(false)
      })
    } else if (type === 'pdf') {
      setLoading(false)
    } else {
      setError('Preview not available for this file type')
      setLoading(false)
    }

    return () => { cancelled = true }
  }, [filePath, fileName, refreshKey])

  if (loading) return <div className="file-preview-status">Loading...</div>
  if (error) return <div className="file-preview-status">{error}</div>

  if (imageUrl) {
    return (
      <div className="file-preview-image">
        <img src={imageUrl} alt={fileName} />
      </div>
    )
  }

  if (canPreview(fileName) === 'pdf') {
    return (
      <div className="file-preview-pdf">
        <iframe
          src={`file://${filePath}`}
          style={{ width: '100%', height: '100%', border: 'none' }}
          title={`PDF Preview: ${fileName}`}
        />
      </div>
    )
  }

  if (content !== null) {
    return (
      <>
        {isMarkdown && (
          <div className="file-preview-mode-bar">
            <button className={`git-diff-mode-btn${viewMode === 'rendered' ? ' active' : ''}`} onClick={() => setViewMode('rendered')}>Preview</button>
            <button className={`git-diff-mode-btn${viewMode === 'source' ? ' active' : ''}`} onClick={() => setViewMode('source')}>Source</button>
          </div>
        )}
        {isMarkdown && viewMode === 'rendered'
          ? <MarkdownPreview content={content} />
          : <HighlightedCode code={content} ext={getFileExt(fileName)} className="file-preview-text" />
        }
      </>
    )
  }

  return null
}

export { MarkdownPreview }

export function FileTree({ rootPath }: Readonly<FileTreeProps>) {
  const [entries, setEntries] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => new Set())
  const restoredRef = useRef(false)
  // T0209 (CONCERN-3): tracks whether an explicit source (bus reveal or user click) has
  // already set selectedFile. Late-arriving localStorage restore callback must skip
  // setSelectedFile when this is true, so bus reveals are not clobbered.
  const bootstrapConsumedRef = useRef(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileEntry } | null>(null)
  const { pos: ctxMenuPos, menuRef: contextMenuRef } = useMenuPosition(contextMenu)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FileEntry[] | null>(null)
  const [searching, setSearching] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleToggle = useCallback((path: string, nextExpanded: boolean) => {
    const key = toPathKey(path)
    setExpandedKeys(prev => {
      const next = new Set(prev)
      if (nextExpanded) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  // Resizable split: tree width in pixels (persisted)
  const TREE_WIDTH_KEY = 'file-tree-split-width'
  const splitRef = useRef<HTMLDivElement>(null)
  const [treeWidth, setTreeWidth] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(TREE_WIDTH_KEY)
      return saved ? Number(saved) : null
    } catch { return null }
  })

  const handleSplitResize = useCallback((delta: number) => {
    setTreeWidth(prev => {
      const container = splitRef.current
      if (!container) return prev
      const total = container.clientWidth
      const current = prev ?? Math.round(total * 0.35)
      const next = Math.max(120, Math.min(total - 120, current + delta))
      try { localStorage.setItem(TREE_WIDTH_KEY, String(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const loadRoot = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI.fs.readdir(rootPath)
      setEntries(result)
    } catch {
      setEntries([])
    }
    setLoading(false)
  }, [rootPath])

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1)
    loadRoot()
  }, [loadRoot])

  useEffect(() => { loadRoot() }, [loadRoot])

  // Watch for file system changes and auto-refresh
  useEffect(() => {
    window.electronAPI.fs.watch(rootPath)
    const unsubscribe = window.electronAPI.fs.onChanged((changedPath: string) => {
      if (changedPath === rootPath) {
        setRefreshKey(k => k + 1)
        loadRoot()
      }
    })
    return () => {
      unsubscribe()
      window.electronAPI.fs.unwatch(rootPath)
    }
  }, [rootPath, loadRoot])

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return
    const handleClickOutside = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [contextMenu])

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    const q = searchQuery.trim()
    if (!q) {
      setSearchResults(null)
      setSearching(false)
      return
    }
    setSearching(true)
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await window.electronAPI.fs.search(rootPath, q)
        setSearchResults(results)
      } catch {
        setSearchResults([])
      }
      setSearching(false)
    }, 300)
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current) }
  }, [searchQuery, rootPath])

  // Restore last selected file on mount
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    const storageKey = `file-tree-selected:${rootPath}`
    const saved = localStorage.getItem(storageKey)
    if (!saved) return
    try {
      const { path, name } = JSON.parse(saved)
      // Check if file still exists
      window.electronAPI.fs.readFile(path).then(result => {
        if (result.error) {
          localStorage.removeItem(storageKey)
          return
        }
        // T0209 (CONCERN-3): if a bus reveal (or user click) already set selectedFile
        // while this async readFile was in flight, do NOT overwrite — bus intent wins.
        if (bootstrapConsumedRef.current) return
        setSelectedFile({ path, name, pathKey: toPathKey(path), isDirectory: false })
      })
    } catch {
      localStorage.removeItem(storageKey)
    }
  }, [rootPath])

  const handleSelect = useCallback((entry: FileEntry) => {
    setSelectedFile(entry)
    bootstrapConsumedRef.current = true
    localStorage.setItem(`file-tree-selected:${rootPath}`, JSON.stringify({ path: entry.path, name: entry.name }))
  }, [rootPath])

  // BUG-048 fix: programmatically expand every directory along a path and select the file.
  // Intermediate directories' children get loaded via FileTreeNode's useEffect as expansion cascades.
  // pathKey-normalized comparisons (PLAN-023) ensure expansion lookups match regardless of separator/case.
  const expandToPath = useCallback((filePath: string) => {
    const rootKey = toPathKey(rootPath)
    const targetKey = toPathKey(filePath)
    if (!targetKey.startsWith(rootKey)) return

    const rel = targetKey.slice(rootKey.length).replace(/^\/+/, '')
    const segments = rel.split('/').filter(Boolean)
    if (segments.length === 0) return

    const ancestorKeys: string[] = []
    let acc = rootKey
    for (let i = 0; i < segments.length - 1; i++) {
      acc = acc + '/' + segments[i]
      ancestorKeys.push(acc)
    }

    setExpandedKeys(prev => {
      if (ancestorKeys.every(k => prev.has(k))) return prev
      const next = new Set(prev)
      for (const k of ancestorKeys) next.add(k)
      return next
    })

    // Derive display name from the ORIGINAL filePath (preserves case/separator for UI),
    // not the normalized key.
    const nameMatch = filePath.split(/[\\/]/).filter(Boolean)
    const name = nameMatch[nameMatch.length - 1] ?? segments[segments.length - 1]
    const entry: FileEntry = { path: filePath, name, pathKey: targetKey, isDirectory: false }
    setSelectedFile(entry)
    bootstrapConsumedRef.current = true
    localStorage.setItem(`file-tree-selected:${rootPath}`, JSON.stringify({ path: filePath, name }))
  }, [rootPath])

  // Listen for external file-tree-reveal events (e.g. from Control Tower)
  useEffect(() => {
    const handler = (e: Event) => {
      const { path: filePath } = (e as CustomEvent).detail as { path: string }
      expandToPath(filePath)
    }
    window.addEventListener('file-tree-reveal', handler)
    return () => window.removeEventListener('file-tree-reveal', handler)
  }, [expandToPath])

  // BUG-048 现象 1 fix: replay pending reveal that was buffered before FileTree mounted.
  useEffect(() => {
    const pending = consumePendingReveal()
    if (pending) expandToPath(pending)
    // Intentionally run once per FileTree instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, entry })
  }, [])

  const getRelativePath = useCallback((filePath: string) => {
    const norm = (p: string) => p.replace(/\\/g, '/')
    const rel = norm(filePath).replace(norm(rootPath), '').replace(/^\//, '')
    return rel
  }, [rootPath])

  const handleCopyRelativePath = useCallback(() => {
    if (!contextMenu) return
    navigator.clipboard.writeText(getRelativePath(contextMenu.entry.path))
    setContextMenu(null)
  }, [contextMenu, getRelativePath])

  const handleCopyAbsolutePath = useCallback(() => {
    if (!contextMenu) return
    navigator.clipboard.writeText(contextMenu.entry.path)
    setContextMenu(null)
  }, [contextMenu])

  const handleOpenInExplorer = useCallback(() => {
    if (!contextMenu) return
    const target = contextMenu.entry.isDirectory
      ? contextMenu.entry.path
      : contextMenu.entry.path.replace(/[\\/][^\\/]+$/, '') // parent dir
    window.electronAPI.shell.openPath(target)
    setContextMenu(null)
  }, [contextMenu])

  if (loading && entries.length === 0) {
    return <div className="file-tree-empty">Loading...</div>
  }

  if (entries.length === 0) {
    return <div className="file-tree-empty">No files found</div>
  }

  const displayEntries = searchResults !== null ? searchResults : entries
  const selectedKey = selectedFile?.pathKey ?? null

  return (
    <div className="file-tree-split" ref={splitRef}>
      <div className="file-tree" style={treeWidth != null ? { flex: `0 0 ${treeWidth}px`, maxWidth: `${treeWidth}px` } : undefined}>
        <div className="file-tree-header">
          <input
            className="file-tree-search"
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button className="file-tree-refresh-btn" onClick={handleRefresh} title="Refresh">↻</button>
        </div>
        <div className="file-tree-list">
          {searching && <div className="file-tree-item file-tree-loading-row">Searching...</div>}
          {searchResults !== null ? (
            // Search results: flat list with relative paths
            displayEntries.map(entry => (
              <div
                key={entry.pathKey}
                className={`file-tree-item file-tree-file ${
                  selectedKey !== null && entry.pathKey === selectedKey ? 'selected' : ''
                }`}
                style={{ paddingLeft: '12px' }}
                onClick={() => {
                  if (!entry.isDirectory) handleSelect(entry)
                }}
                onContextMenu={(e) => handleContextMenu(e, entry)}
              >
                <span className="file-tree-icon">{entry.isDirectory ? '📁' : getFileIcon(entry.name)}</span>
                <span className="file-tree-name file-tree-search-path">{getRelativePath(entry.path)}</span>
              </div>
            ))
          ) : (
            entries.map(entry => (
              <FileTreeNode
                key={`${entry.pathKey}:${refreshKey}`}
                entry={entry}
                depth={0}
                selectedKey={selectedKey}
                expandedKeys={expandedKeys}
                onToggle={handleToggle}
                onSelect={handleSelect}
                onContextMenu={handleContextMenu}
              />
            ))
          )}
          {searchResults !== null && searchResults.length === 0 && !searching && (
            <div className="file-tree-empty">No matches</div>
          )}
        </div>
      </div>
      <ResizeHandle direction="horizontal" onResize={handleSplitResize} />
      <div className="file-preview">
        {selectedFile ? (
          <>
            <div className="file-preview-header">
              <span className="file-preview-filename">{selectedFile.name}</span>
              <button className="file-tree-refresh-btn" onClick={handleRefresh} title="Refresh">↻</button>
            </div>
            <div className="file-preview-body">
              <FilePreview filePath={selectedFile.path} fileName={selectedFile.name} refreshKey={refreshKey} />
            </div>
          </>
        ) : (
          <div className="file-preview-status">Select a file to preview</div>
        )}
      </div>

      {/* Context Menu — Fix BUG-002: portal to body to avoid position:fixed offset from parent transforms */}
      {contextMenu && createPortal(
        <div
          ref={contextMenuRef}
          className="workspace-context-menu"
          style={ctxMenuPos
            ? { left: ctxMenuPos.x, top: ctxMenuPos.y }
            : { left: contextMenu.x, top: contextMenu.y, visibility: 'hidden' as const }
          }
        >
          <div className="context-menu-item" onClick={handleCopyRelativePath}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </svg>
            Copy Relative Path
          </div>
          <div className="context-menu-item" onClick={handleCopyAbsolutePath}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
              <line x1="8" y1="10" x2="16" y2="10" />
              <line x1="8" y1="14" x2="12" y2="14" />
            </svg>
            Copy Absolute Path
          </div>
          <div className="context-menu-divider" />
          <div className="context-menu-item" onClick={handleOpenInExplorer}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
            Open in Explorer
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
