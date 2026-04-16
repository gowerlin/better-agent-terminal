import { useState, useRef, useEffect, useCallback } from 'react'
import { getSubmenuDirection } from '../hooks/useMenuPosition'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { TerminalInstance, ShellType } from '../types'
import { SHELL_OPTIONS } from '../types'
import { TerminalThumbnail } from './TerminalThumbnail'
import { getAgentPreset } from '../types/agent-presets'
import type { AgentDefinition } from '../types/agent-runtime'

interface ThumbnailBarProps {
  terminals: TerminalInstance[]
  focusedTerminalId: string | null
  splitTerminalId?: string | null
  onFocus: (id: string) => void
  onSplitTerminal?: (id: string, side?: 'left' | 'right') => void
  onAddTerminal?: () => void
  onAddTerminalWithShell?: (shell: ShellType) => void
  onAddAgent?: (definitionId: string) => void
  /** Agent definitions to show in the add menu (fetched from registry) */
  agentDefinitions?: AgentDefinition[]
  // Legacy callbacks — kept for backward compat, remove when fully migrated
  onAddClaudeAgent?: () => void
  onAddClaudeAgentV2?: () => void
  onAddClaudeWorktree?: () => void
  onAddClaudeCli?: () => void
  onAddClaudeCliWorktree?: () => void
  onReorder?: (orderedIds: string[]) => void
  showAddButton: boolean
  height?: number
  collapsed?: boolean
  onCollapse?: () => void
  onSetSupervisor?: (id: string) => void
  onClearSupervisor?: () => void
}

export function ThumbnailBar({
  terminals,
  focusedTerminalId,
  splitTerminalId,
  onFocus,
  onSplitTerminal,
  onAddTerminal,
  onAddTerminalWithShell,
  onAddAgent,
  agentDefinitions = [],
  onAddClaudeAgent,
  onAddClaudeAgentV2,
  onAddClaudeWorktree,
  onAddClaudeCli,
  onAddClaudeCliWorktree,
  onReorder,
  showAddButton,
  height,
  collapsed = false,
  onCollapse,
  onSetSupervisor,
  onClearSupervisor
}: ThumbnailBarProps) {
  const { t } = useTranslation()
  // Check if these are agent terminals or regular terminals
  const firstTerminal = terminals[0]
  const isAgentList = firstTerminal?.agentPreset && firstTerminal.agentPreset !== 'none'
  const label = isAgentList
    ? (getAgentPreset(firstTerminal.agentPreset!)?.name || 'Agent')
    : t('terminal.terminals')

  // All hooks must be declared before any conditional return (React rules of hooks)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('before')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})
  const [shellSubmenu, setShellSubmenu] = useState(false)
  const shellItemRef = useRef<HTMLDivElement>(null)
  const [submenuDir, setSubmenuDir] = useState<'right' | 'left'>('right')
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)
  const addMenuPopupRef = useRef<HTMLDivElement>(null)
  const addBtnRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Platform-filtered shell options (exclude 'auto' — clicking the parent item does that)
  const platform = (window as any).electronAPI?.platform || 'darwin'
  const shellOptions = SHELL_OPTIONS.filter(opt => opt.id !== 'auto' && opt.id !== 'custom' && opt.platforms.includes(platform))

  // Track horizontal scroll overflow
  const updateScrollState = useCallback(() => {
    const el = listRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    updateScrollState()
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      ro.disconnect()
    }
  }, [updateScrollState, terminals.length])

  const scrollList = useCallback((direction: 'left' | 'right') => {
    const el = listRef.current
    if (!el) return
    el.scrollBy({ left: direction === 'left' ? -220 : 220, behavior: 'smooth' })
  }, [])

  // Close menu on outside click
  useEffect(() => {
    if (!showAddMenu) return
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        addMenuRef.current && !addMenuRef.current.contains(target) &&
        addMenuPopupRef.current && !addMenuPopupRef.current.contains(target)
      ) {
        setShowAddMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showAddMenu])

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
    // Make the drag ghost semi-transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.4'
    }
  }, [])

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1'
    }
    setDraggedId(null)
    setDropTargetId(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    // Only handle drags that originated from a thumbnail (not resize handles etc.)
    if (!draggedId || id === draggedId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    // Determine if dropping before or after based on mouse position
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const pos = e.clientY < midY ? 'before' : 'after'

    setDropTargetId(id)
    setDropPosition(pos)
  }, [draggedId])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if leaving the element (not entering a child)
    const related = e.relatedTarget as HTMLElement | null
    if (!related || !(e.currentTarget as HTMLElement).contains(related)) {
      setDropTargetId(null)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId || !onReorder) return

    const currentOrder = terminals.map(t => t.id)
    const draggedIndex = currentOrder.indexOf(draggedId)
    if (draggedIndex === -1) return

    // Remove dragged item
    currentOrder.splice(draggedIndex, 1)

    // Calculate new index based on drop position
    let newIndex = currentOrder.indexOf(targetId)
    if (dropPosition === 'after') {
      newIndex += 1
    }

    // Insert at new position
    currentOrder.splice(newIndex, 0, draggedId)
    onReorder(currentOrder)

    setDraggedId(null)
    setDropTargetId(null)
  }, [draggedId, dropPosition, terminals, onReorder])

  // Collapsed state - show icon bar
  if (collapsed) {
    return (
      <div
        className="collapsed-bar collapsed-bar-bottom"
        onClick={onCollapse}
        title={t('terminal.expandThumbnails')}
      >
        <div className="collapsed-bar-icon">🖼️</div>
        <span className="collapsed-bar-label">{label}</span>
      </div>
    )
  }

  const style = height ? { height: `${height}px`, flex: 'none' } : undefined

  return (
    <div className="thumbnail-bar" style={style}>
      <div className="thumbnail-bar-header">
        <span>{label}</span>
        <div className="thumbnail-bar-actions">
          {onAddTerminal && (
            <div className="thumbnail-add-wrapper" ref={addMenuRef}>
              <button
                ref={addBtnRef}
                className="thumbnail-add-btn"
                onClick={() => {
                  setShowAddMenu(prev => {
                    if (!prev && addBtnRef.current) {
                      const rect = addBtnRef.current.getBoundingClientRect()
                      const menuHeight = 200
                      const spaceBelow = window.innerHeight - rect.bottom
                      const openUpward = spaceBelow < menuHeight && rect.top > menuHeight
                      setMenuStyle(openUpward
                        ? { bottom: window.innerHeight - rect.top + 4, right: window.innerWidth - rect.right }
                        : { top: rect.bottom + 4, right: window.innerWidth - rect.right }
                      )
                    }
                    return !prev
                  })
                }}
                title={t('terminal.addTerminalOrAgent')}
              >
                +
              </button>
              {showAddMenu && createPortal(
                <div className="thumbnail-add-menu" ref={addMenuPopupRef} style={menuStyle}>
                  <div
                    ref={shellItemRef}
                    className="thumbnail-add-menu-item has-submenu"
                    onClick={() => { onAddTerminal(); setShowAddMenu(false); setShellSubmenu(false) }}
                    onMouseEnter={() => { setShellSubmenu(true); setSubmenuDir(getSubmenuDirection(shellItemRef.current)) }}
                    onMouseLeave={() => setShellSubmenu(false)}
                  >
                    <span className="thumbnail-add-menu-icon">⌘</span>
                    {t('terminal.terminalLabel')}
                    <span className="thumbnail-submenu-arrow">{submenuDir === 'left' ? '◂' : '▸'}</span>
                    {shellSubmenu && onAddTerminalWithShell && shellOptions.length > 0 && (
                      <div className="thumbnail-add-submenu" style={submenuDir === 'left' ? { left: 'auto', right: '100%' } : undefined}>
                        {shellOptions.map(opt => (
                          <div
                            key={opt.id}
                            className="thumbnail-add-menu-item"
                            onClick={(e) => { e.stopPropagation(); onAddTerminalWithShell(opt.id); setShowAddMenu(false); setShellSubmenu(false) }}
                          >
                            <span className="thumbnail-add-menu-icon">⌘</span>
                            {opt.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Dynamic agent definitions from registry */}
                  {onAddAgent && agentDefinitions.length > 0 ? (
                    agentDefinitions.map(def => (
                      <div
                        key={def.id}
                        className="thumbnail-add-menu-item"
                        onClick={() => { onAddAgent(def.id); setShowAddMenu(false) }}
                      >
                        <span className="thumbnail-add-menu-icon" style={{ color: def.color }}>{def.icon}</span>
                        {def.name}
                        {def.suggested && <span className="thumbnail-add-menu-suggested">suggested</span>}
                      </div>
                    ))
                  ) : (
                    <>
                      {/* Legacy fallback — remove when fully migrated */}
                      {onAddClaudeAgent && (
                        <div
                          className="thumbnail-add-menu-item"
                          onClick={() => { onAddClaudeAgent(); setShowAddMenu(false) }}
                        >
                          <span className="thumbnail-add-menu-icon" style={{ color: '#d97706' }}>✦</span>
                          Claude Agent V1
                          <span className="thumbnail-add-menu-suggested">suggested</span>
                        </div>
                      )}
                      {onAddClaudeAgentV2 && (
                        <div
                          className="thumbnail-add-menu-item"
                          onClick={() => { onAddClaudeAgentV2(); setShowAddMenu(false) }}
                        >
                          <span className="thumbnail-add-menu-icon" style={{ color: '#eab308' }}>✦</span>
                          Claude Agent V2
                        </div>
                      )}
                      {onAddClaudeWorktree && (
                        <div
                          className="thumbnail-add-menu-item"
                          onClick={() => { onAddClaudeWorktree(); setShowAddMenu(false) }}
                        >
                          <span className="thumbnail-add-menu-icon" style={{ color: '#22c55e' }}>🌳</span>
                          Claude Agent V1 (Worktree)
                        </div>
                      )}
                      {onAddClaudeCli && (
                        <div
                          className="thumbnail-add-menu-item"
                          onClick={() => { onAddClaudeCli(); setShowAddMenu(false) }}
                        >
                          <span className="thumbnail-add-menu-icon" style={{ color: '#d97706' }}>▶</span>
                          Claude CLI
                          <span className="thumbnail-add-menu-suggested">suggested</span>
                        </div>
                      )}
                      {onAddClaudeCliWorktree && (
                        <div
                          className="thumbnail-add-menu-item"
                          onClick={() => { onAddClaudeCliWorktree(); setShowAddMenu(false) }}
                        >
                          <span className="thumbnail-add-menu-icon" style={{ color: '#22c55e' }}>▶🌳</span>
                          Claude CLI (Worktree)
                        </div>
                      )}
                    </>
                  )}
                </div>,
                document.body
              )}
            </div>
          )}
          {onCollapse && (
            <button className="thumbnail-collapse-btn" onClick={onCollapse} title={t('terminal.collapsePanel')}>
              ▼
            </button>
          )}
        </div>
      </div>
      <div className="thumbnail-list-wrapper">
        {canScrollLeft && (
          <button className="thumbnail-scroll-btn thumbnail-scroll-left" onClick={() => scrollList('left')} title="Scroll left">‹</button>
        )}
        <div
          ref={listRef}
          className="thumbnail-list"
          onContextMenu={(e) => {
          // Only trigger on the list background, not on individual thumbnails
          if ((e.target as HTMLElement).closest('.thumbnail')) return
          e.preventDefault()
          if (onAddTerminal) {
            setMenuStyle({ top: e.clientY, left: e.clientX })
            setShowAddMenu(true)
          }
        }}
      >
        {terminals.map(terminal => (
          <div
            key={terminal.id}
            draggable={!!onReorder}
            onDragStart={(e) => handleDragStart(e, terminal.id)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, terminal.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, terminal.id)}
            className={`thumbnail-drag-wrapper${
              dropTargetId === terminal.id && draggedId !== terminal.id
                ? ` drop-${dropPosition}`
                : ''
            }${draggedId === terminal.id ? ' dragging' : ''}`}
          >
            <TerminalThumbnail
              terminal={terminal}
              isActive={terminal.id === focusedTerminalId}
              isSplit={terminal.id === splitTerminalId}
              onClick={() => onFocus(terminal.id)}
              onSplitTerminal={onSplitTerminal}
              onSetSupervisor={onSetSupervisor}
              onClearSupervisor={onClearSupervisor}
            />
          </div>
        ))}
        </div>
        {canScrollRight && (
          <button className="thumbnail-scroll-btn thumbnail-scroll-right" onClick={() => scrollList('right')} title="Scroll right">›</button>
        )}
      </div>
    </div>
  )
}
