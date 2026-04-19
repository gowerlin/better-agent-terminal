import { useState, useEffect, useCallback, useRef } from 'react'
import type { FileEntry } from '../types/file'
import { getFileIcon } from '../utils/filePathKey'

interface FileTreeNodeProps {
  entry: FileEntry
  depth: number
  selectedKey: string | null
  expandedKeys: Set<string>
  onToggle: (path: string, nextExpanded: boolean) => void
  onSelect: (entry: FileEntry) => void
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void
}

// Recursive tree row. `expanded` is parent-controlled via expandedKeys; children cache stays local
// (per-node lazy readdir). pathKey-based comparisons avoid separator/case mismatches (T0209/PLAN-023).
export function FileTreeNode({
  entry, depth, selectedKey, expandedKeys, onToggle, onSelect, onContextMenu,
}: Readonly<FileTreeNodeProps>) {
  const expanded = entry.isDirectory && expandedKeys.has(entry.pathKey)
  const [children, setChildren] = useState<FileEntry[] | null>(null)
  const [loading, setLoading] = useState(false)

  // Auto-load children when expanded turns true and cache is empty.
  // Enables expandToPath() to cascade top-down.
  // T0213 fix (BUG-048 follow-up 3): `loading` must NOT be in deps AND must NOT be in the
  // guard — otherwise setLoading(true) self-triggers the effect, cleanup marks cancelled=true,
  // and when readdir resolves the setState is skipped, leaving `loading` stuck true forever.
  useEffect(() => {
    if (!entry.isDirectory || !expanded || children !== null) return
    let cancelled = false
    setLoading(true)
    window.electronAPI.fs.readdir(entry.path).then(entries => {
      if (cancelled) return
      setChildren(entries)
      setLoading(false)
    }).catch(() => {
      if (cancelled) return
      setChildren([])
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [expanded, entry.isDirectory, entry.path, children])

  const handleClick = useCallback(() => {
    if (entry.isDirectory) {
      onToggle(entry.path, !expanded)
    } else {
      onSelect(entry)
    }
  }, [entry, expanded, onToggle, onSelect])

  const icon = entry.isDirectory
    ? (expanded ? '📂' : '📁')
    : getFileIcon(entry.name)

  const isSelected = !entry.isDirectory
    && selectedKey !== null
    && entry.pathKey === selectedKey
  const rowRef = useRef<HTMLDivElement>(null)

  // Scroll selected row into view (useful after expandToPath reveal).
  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
  }, [isSelected])

  return (
    <>
      <div
        ref={rowRef}
        className={`file-tree-item ${entry.isDirectory ? 'file-tree-folder' : 'file-tree-file'} ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, entry)}
      >
        <span className="file-tree-icon">{icon}</span>
        <span className="file-tree-name">{entry.name}</span>
        {loading && <span className="file-tree-loading">...</span>}
      </div>
      {expanded && children && children.map(child => (
        <FileTreeNode
          key={child.pathKey}
          entry={child}
          depth={depth + 1}
          selectedKey={selectedKey}
          expandedKeys={expandedKeys}
          onToggle={onToggle}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
        />
      ))}
    </>
  )
}
