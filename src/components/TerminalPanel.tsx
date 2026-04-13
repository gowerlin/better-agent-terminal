import { useEffect, useRef, useState, memo } from 'react'
import { createPortal } from 'react-dom'
import { useMenuPosition } from '../hooks/useMenuPosition'
import { Terminal } from '@xterm/xterm'
import { TerminalDecorationManager } from '../utils/terminal-decoration-manager'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { CanvasAddon } from '@xterm/addon-canvas'
import { workspaceStore } from '../stores/workspace-store'
import { settingsStore } from '../stores/settings-store'
import '@xterm/xterm/css/xterm.css'

const dlog = (...args: unknown[]) => window.electronAPI?.debug?.log(...args)
const osc52DebugNoticeLine = /^sent \d+ chars via OSC 52 .*paste fails$/u

const filterTerminalOutputNoise = (data: string): string => {
  if (!data.includes('paste fails')) return data

  const usesCRLF = data.includes('\r\n')
  const trailingNewline = /\r?\n$/.test(data)
  const normalized = data.replace(/\r\n/g, '\n')
  const filtered = normalized
    .split('\n')
    .filter(line => !osc52DebugNoticeLine.test(line.trim()))
    .join('\n')

  const restored = usesCRLF ? filtered.replace(/\n/g, '\r\n') : filtered
  if (!restored) return ''
  if (!trailingNewline) return restored

  const newline = usesCRLF ? '\r\n' : '\n'
  return restored.endsWith(newline) ? restored : `${restored}${newline}`
}

interface TerminalPanelProps {
  terminalId: string
  isActive?: boolean
  terminalType?: 'terminal' | 'code-agent'
}

interface ContextMenu {
  x: number
  y: number
  hasSelection: boolean
}

let renderCount = 0
export const TerminalPanel = memo(function TerminalPanel({ terminalId, isActive = true, terminalType }: TerminalPanelProps) {
  renderCount++
  if (renderCount <= 50 || renderCount % 50 === 0) {
    dlog(`[render] TerminalPanel render #${renderCount} terminal=${terminalId} active=${isActive}`)
  }
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const decorationManagerRef = useRef<TerminalDecorationManager | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null)
  const { pos: menuPos, menuRef: ctxMenuRef } = useMenuPosition(contextMenu)
  const [altBufferActive, setAltBufferActive] = useState(false)
  const altBufferRef = useRef(false)
  const [terminalReady, setTerminalReady] = useState(false)
  const hasBeenFocusedRef = useRef(false)
  const isActiveRef = useRef(isActive)
  const doResizeRef = useRef<(() => void) | null>(null)

  // Keep isActiveRef in sync with isActive prop
  useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  const pasteAbortRef = useRef<{ cancelled: boolean } | null>(null)

  // Chunked write with sequential scheduling (avoids creating thousands of timers)
  const writeChunked = (text: string) => {
    const CHUNK_SIZE = 2000
    const DELAY = 30
    const abort = { cancelled: false }
    pasteAbortRef.current = abort
    let offset = 0

    const sendNext = () => {
      if (abort.cancelled || offset >= text.length) {
        pasteAbortRef.current = null
        return
      }
      const chunk = text.slice(offset, offset + CHUNK_SIZE)
      offset += CHUNK_SIZE
      window.electronAPI.pty.write(terminalId, chunk)
      setTimeout(sendNext, DELAY)
    }
    sendNext()
  }

  // Handle paste with size confirmation for large text
  const handlePasteText = async (text: string) => {
    if (!text) return

    // Cancel any in-progress paste
    if (pasteAbortRef.current) {
      pasteAbortRef.current.cancelled = true
    }

    const CONFIRM_THRESHOLD = 10 * 1024 // 10KB

    if (text.length > CONFIRM_THRESHOLD) {
      const sizeKB = (text.length / 1024).toFixed(1)
      const sizeMB = (text.length / (1024 * 1024)).toFixed(2)
      const sizeLabel = text.length > 1024 * 1024 ? `${sizeMB} MB` : `${sizeKB} KB`
      const lines = text.split('\n').length

      const confirmed = await window.electronAPI.dialog.confirm(
        `About to paste a large text:\n\n• Size: ${sizeLabel} (${text.length.toLocaleString()} chars)\n• Lines: ${lines.toLocaleString()}\n\nThis may take a moment. Continue?`,
        'Large Paste Warning'
      )
      if (!confirmed) return
    }

    if (text.length > 64000) {
      writeChunked(text)
    } else {
      terminalRef.current?.paste(text)
    }
  }

  // Handle context menu actions
  const handleCopy = () => {
    if (terminalRef.current) {
      const selection = terminalRef.current.getSelection()
      if (selection) {
        navigator.clipboard.writeText(selection)
      }
    }
    setContextMenu(null)
    setTimeout(() => terminalRef.current?.focus(), 0)
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        await handlePasteText(text)
      }
    } catch (err) {
      dlog('Failed to read clipboard for context-menu paste', err)
    } finally {
      setContextMenu(null)
      // Restore focus after menu unmount so keyboard input keeps working.
      setTimeout(() => terminalRef.current?.focus(), 0)
    }
  }

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Close context menu on Escape key (BUG-011a)
  useEffect(() => {
    if (!contextMenu) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [contextMenu])

  // Close context menu on terminal scroll (BUG-008)
  useEffect(() => {
    if (!contextMenu) return
    const viewport = containerRef.current?.querySelector('.xterm-viewport')
    if (!viewport) return
    const handleScroll = () => setContextMenu(null)
    viewport.addEventListener('scroll', handleScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', handleScroll)
  }, [contextMenu])

  // Handle terminal resize and focus when becoming active
  useEffect(() => {
    if (isActive && terminalReady && terminalRef.current) {
      const terminal = terminalRef.current

      // Single RAF — resize + focus, no clearTextureAtlas (causes blank frame flicker)
      const rafId = requestAnimationFrame(() => {
        if (!terminal) return

        dlog(`[resize] isActive effect → doResize terminal=${terminalId}`)
        doResizeRef.current?.()
        terminal.focus()

        // Execute agent command on first focus for code-agent terminals
        if (!hasBeenFocusedRef.current && terminalType === 'code-agent') {
          hasBeenFocusedRef.current = true
          const terminalInstance = workspaceStore.getState().terminals.find(t => t.id === terminalId)
          if (terminalInstance && !terminalInstance.agentCommandSent && !terminalInstance.hasUserInput) {
            const agentCommand = settingsStore.getAgentCommand()
            if (agentCommand) {
              setTimeout(() => {
                const currentTerminal = workspaceStore.getState().terminals.find(t => t.id === terminalId)
                if (isActiveRef.current && currentTerminal && !currentTerminal.hasUserInput && !currentTerminal.agentCommandSent) {
                  window.electronAPI.pty.write(terminalId, agentCommand + '\r')
                  workspaceStore.markAgentCommandSent(terminalId)
                }
              }, 3000)
            }
          }
        }
      })

      return () => cancelAnimationFrame(rafId)
    }
  }, [isActive, terminalReady, terminalId, terminalType])

  // IntersectionObserver removed — isActive effect already handles resize on visibility change

  useEffect(() => {
    if (!containerRef.current) return

    const settings = settingsStore.getSettings()
    const colors = settingsStore.getTerminalColors()

    // Create terminal instance with customizable colors
    const terminal = new Terminal({
      theme: {
        background: colors.background,
        foreground: colors.foreground,
        cursor: colors.cursor,
        cursorAccent: colors.background,
        selectionBackground: '#5c5142',
        black: '#3b3228',
        red: '#cb6077',
        green: '#beb55b',
        yellow: '#f4bc87',
        blue: '#8ab3b5',
        magenta: '#a89bb9',
        cyan: '#7bbda4',
        white: '#d0c8c6',
        brightBlack: '#554d46',
        brightRed: '#cb6077',
        brightGreen: '#beb55b',
        brightYellow: '#f4bc87',
        brightBlue: '#8ab3b5',
        brightMagenta: '#a89bb9',
        brightCyan: '#7bbda4',
        brightWhite: '#f5f1e6'
      },
      fontSize: settings.fontSize,
      fontFamily: settingsStore.getFontFamilyString(),
      cursorBlink: true,
      scrollback: 10000,
      allowProposedApi: true,
      allowTransparency: true
    })

    const fitAddon = new FitAddon()
    const unicode11Addon = new Unicode11Addon()
    const webLinksAddon = new WebLinksAddon((event, uri) => {
      // Open URL in default browser
      window.electronAPI.shell.openExternal(uri)
    })
    terminal.loadAddon(fitAddon)
    terminal.loadAddon(webLinksAddon)
    terminal.loadAddon(unicode11Addon)
    terminal.unicode.activeVersion = '11'
    terminal.open(containerRef.current)

    // Use canvas renderer for better rendering performance
    terminal.loadAddon(new CanvasAddon())

    // Register file:// URL link provider (WebLinksAddon only handles http/https)
    terminal.registerLinkProvider({
      provideLinks(bufferLineNumber, callback) {
        const line = terminal.buffer.active.getLine(bufferLineNumber - 1)
        if (!line) { callback(undefined); return }
        const text = line.translateToString()
        const fileUrlRegex = /file:\/\/\/[^\s'"\])}>,;`]+/g
        let match
        const links = []
        while ((match = fileUrlRegex.exec(text)) !== null) {
          const url = match[0]
          const startX = match.index + 1
          const endX = match.index + url.length
          links.push({
            text: url,
            range: {
              start: { x: startX, y: bufferLineNumber },
              end: { x: endX, y: bufferLineNumber }
            },
            activate() {
              window.electronAPI.shell.openExternal(url)
            }
          })
        }
        callback(links.length > 0 ? links : undefined)
      }
    })

    // Deduplicated resize helper — avoids redundant pty.resize IPC calls
    let lastSentCols = 0
    let lastSentRows = 0
    const doResize = () => {
      fitAddon.fit()
      const { cols, rows } = terminal
      if (cols !== lastSentCols || rows !== lastSentRows) {
        lastSentCols = cols
        lastSentRows = rows
        dlog(`[resize] pty.resize cols=${cols} rows=${rows} terminal=${terminalId}`)
        window.electronAPI.pty.resize(terminalId, cols, rows)
      }
    }
    doResizeRef.current = doResize

    // Fix IME textarea position - force it to bottom left
    const fixImePosition = () => {
      const textarea = containerRef.current?.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement
      if (textarea) {
        textarea.style.position = 'fixed'
        textarea.style.bottom = '80px'
        textarea.style.left = '220px'
        textarea.style.top = 'auto'
        textarea.style.width = '1px'
        textarea.style.height = '20px'
        textarea.style.opacity = '0'
        textarea.style.zIndex = '10'
        textarea.style.caretColor = 'transparent'
        textarea.style.color = 'transparent'
      }
    }

    // Use MutationObserver to keep fixing position when xterm.js changes it
    // Debounced with RAF to avoid layout thrashing
    let mutationCount = 0
    let imePendingRaf = 0
    const observer = new MutationObserver(() => {
      mutationCount++
      if (mutationCount <= 20 || mutationCount % 100 === 0) {
        dlog(`[render] MutationObserver #${mutationCount} terminal=${terminalId}`)
      }
      if (!imePendingRaf) {
        imePendingRaf = requestAnimationFrame(() => {
          imePendingRaf = 0
          fixImePosition()
        })
      }
    })

    const textarea = containerRef.current?.querySelector('.xterm-helper-textarea')
    if (textarea) {
      observer.observe(textarea, { attributes: true, attributeFilter: ['style'] })
      fixImePosition()
    }

    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    setTerminalReady(true)

    // Initialize decoration manager
    const decorationManager = new TerminalDecorationManager()
    decorationManager.attach(terminal)
    decorationManagerRef.current = decorationManager

    // Track alt buffer state (BUG-008 infrastructure)
    const bufferChangeDisposable = terminal.buffer.onBufferChange((activeBuffer) => {
      const isAlt = activeBuffer === terminal.buffer.alternate
      setAltBufferActive(isAlt)
      altBufferRef.current = isAlt
      workspaceStore.setTerminalAltBuffer(terminalId, isAlt)
      dlog(`[terminal] buffer changed: ${isAlt ? 'alt' : 'normal'}`, terminalId)
    })

    // Handle terminal input
    terminal.onData((data) => {
      window.electronAPI.pty.write(terminalId, data)
      // Mark terminal as having user input (for agent command tracking)
      if (terminalType === 'code-agent') {
        workspaceStore.markHasUserInput(terminalId)
      }
    })

    // Track IME composition state on xterm's hidden textarea
    // to prevent CAPS LOCK and other keys from committing partial IME input
    let imeComposing = false
    const xtermTextarea = containerRef.current?.querySelector('.xterm-helper-textarea')
    if (xtermTextarea) {
      xtermTextarea.addEventListener('compositionstart', () => { imeComposing = true })
      xtermTextarea.addEventListener('compositionend', () => { imeComposing = false })
    }

    // Handle copy and paste shortcuts
    terminal.attachCustomKeyEventHandler((event) => {
      // Only handle keydown events to prevent duplicate actions
      if (event.type !== 'keydown') return true

      // During IME composition, block non-composition key events
      // to prevent CAPS LOCK etc. from committing partial input
      if ((imeComposing || event.isComposing) && event.key !== 'Escape') {
        // keyCode 229 = IME composition event, let it through
        // Everything else (CAPS LOCK, modifiers, etc.) should be blocked
        return event.keyCode === 229
      }

      // Shift+Enter for newline (multiline input)
      if (event.shiftKey && event.key === 'Enter') {
        event.preventDefault()
        // Send newline character to allow multiline input
        window.electronAPI.pty.write(terminalId, '\n')
        return false
      }
      // Ctrl+Shift+C for copy
      if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        const selection = terminal.getSelection()
        if (selection) {
          navigator.clipboard.writeText(selection)
        }
        return false
      }
      // Ctrl+Shift+V for paste
      if (event.ctrlKey && event.shiftKey && event.key === 'V') {
        navigator.clipboard.readText().then((text) => {
          handlePasteText(text)
        })
        return false
      }
      // Ctrl+V for paste (standard shortcut)
      if (event.ctrlKey && !event.shiftKey && event.key === 'v') {
        event.preventDefault()
        // On Windows, check if clipboard contains an image and send Alt+V
        const isWindows = navigator.platform.toLowerCase().includes('win')
        if (isWindows) {
          navigator.clipboard.read().then(async (items) => {
            let hasImage = false
            for (const item of items) {
              if (item.types.some(type => type.startsWith('image/'))) {
                hasImage = true
                break
              }
            }
            if (hasImage) {
              // Send Alt+V (ESC + v) to terminal for image paste handling
              window.electronAPI.pty.write(terminalId, '\x1bv')
            } else {
              // Normal text paste
              const text = await navigator.clipboard.readText()
              handlePasteText(text)
            }
          }).catch(() => {
            // Fallback to text paste if clipboard.read() fails
            navigator.clipboard.readText().then((text) => {
              handlePasteText(text)
            })
          })
        } else {
          // On macOS/Linux, just paste text directly
          navigator.clipboard.readText().then((text) => {
            handlePasteText(text)
          })
        }
        return false
      }
      // Ctrl+C for copy when there's a selection
      if (event.ctrlKey && !event.shiftKey && event.key === 'c') {
        const selection = terminal.getSelection()
        if (selection) {
          navigator.clipboard.writeText(selection)
          return false
        }
        // If no selection, let Ctrl+C pass through for interrupt signal
        return true
      }
      // Ctrl+= / Ctrl+NumpadAdd for zoom in
      if (event.ctrlKey && !event.shiftKey && !event.altKey && (event.key === '=' || event.key === '+' || event.key === 'Add')) {
        event.preventDefault()
        settingsStore.zoomIn()
        return false
      }
      // Ctrl+- / Ctrl+NumpadSubtract for zoom out
      if (event.ctrlKey && !event.shiftKey && !event.altKey && (event.key === '-' || event.key === 'Subtract')) {
        event.preventDefault()
        settingsStore.zoomOut()
        return false
      }
      // Ctrl+0 / Ctrl+Numpad0 for reset zoom
      if (event.ctrlKey && !event.shiftKey && !event.altKey && event.key === '0') {
        event.preventDefault()
        settingsStore.resetZoom()
        return false
      }
      return true
    })

    // Right-click context menu for copy/paste
    containerRef.current.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      const selection = terminal.getSelection()
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        hasSelection: !!selection
      })
    })

    // Ctrl+Mouse Wheel zoom (font size)
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault()
        e.stopPropagation()
        if (e.deltaY < 0) {
          settingsStore.zoomIn()
        } else if (e.deltaY > 0) {
          settingsStore.zoomOut()
        }
      }
    }
    containerRef.current.addEventListener('wheel', handleWheel, { passive: false, capture: true })

    // Handle manual redraw request (from toolbar redraw button)
    const handleRedrawEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ terminalId: string }>).detail
      if (detail.terminalId !== terminalId) return
      // Force xterm re-render by temporarily changing dimensions,
      // then fitAddon.fit() restores the correct size.
      // Reset dedup counters so PTY resize always fires (triggers SIGWINCH
      // for alt-buffer apps like vim, htop).
      terminal.resize(terminal.cols + 1, terminal.rows)
      lastSentCols = 0
      lastSentRows = 0
      doResize()
      dlog(`[redraw] manual redraw terminal=${terminalId}`)
    }
    window.addEventListener('terminal-redraw', handleRedrawEvent)

    // Handle terminal output
    const PROMPT_MARKER_LIMIT = 100
    const unsubscribeOutput = window.electronAPI.pty.onOutput((id, data) => {
      if (id === terminalId) {
        const filteredData = filterTerminalOutputNoise(data)
        if (filteredData) {
          terminal.write(filteredData)
          // Optional: register marker on prompt detection (decoration pipeline demo)
          // Only in normal buffer — alt buffer returns null gracefully
          if (!altBufferRef.current && decorationManager.count < PROMPT_MARKER_LIMIT) {
            const lines = filteredData.split('\n')
            const lastLine = lines[lines.length - 1]?.trim()
            if (lastLine && /[$>#]\s*$/.test(lastLine)) {
              const markerId = `prompt-${Date.now()}`
              const marker = decorationManager.addMarker(markerId)
              if (marker) {
                decorationManager.addDecoration(markerId, {
                  anchor: 'left',
                  width: 1,
                  height: 1
                }, (element) => {
                  element.style.background = 'rgba(255, 255, 255, 0.08)'
                  element.style.width = '3px'
                  element.style.borderRadius = '1px'
                })
              }
            }
          }
        }
      }
    })

    // Handle terminal exit
    const unsubscribeExit = window.electronAPI.pty.onExit((id, exitCode) => {
      if (id === terminalId) {
        terminal.write(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`)
      }
    })

    // Handle resize — debounce to avoid expensive xterm reflows during window drag
    let resizeTimer: ReturnType<typeof setTimeout> | null = null
    let resizeObserverCount = 0
    const resizeObserver = new ResizeObserver((entries) => {
      resizeObserverCount++
      const entry = entries[0]
      const w = Math.round(entry.contentRect.width)
      const h = Math.round(entry.contentRect.height)
      dlog(`[render] ResizeObserver #${resizeObserverCount} terminal=${terminalId} active=${isActiveRef.current} ${w}x${h}`)
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        resizeTimer = null
        if (!isActiveRef.current) return
        dlog(`[render] ResizeObserver debounce → doResize terminal=${terminalId}`)
        doResize()
        // fitAddon.fit() already triggers xterm re-render; no extra refresh needed
      }, 200)
    })
    resizeObserver.observe(containerRef.current)

    // Initial resize — only for active terminal, delayed to ensure DOM is ready
    if (isActiveRef.current) {
      setTimeout(() => {
        dlog(`[resize] initial doResize terminal=${terminalId}`)
        doResize()
      }, 100)
    }

    // Subscribe to settings changes for font and color updates
    const unsubscribeSettings = settingsStore.subscribe(() => {
      const newSettings = settingsStore.getSettings()
      const newColors = settingsStore.getTerminalColors()
      terminal.options.fontSize = newSettings.fontSize
      terminal.options.fontFamily = settingsStore.getFontFamilyString()
      terminal.options.theme = {
        ...terminal.options.theme,
        background: newColors.background,
        foreground: newColors.foreground,
        cursor: newColors.cursor,
        cursorAccent: newColors.background
      }
      if (isActiveRef.current) {
        dlog(`[resize] settings changed → doResize terminal=${terminalId}`)
        doResize()
      }
    })

    return () => {
      window.removeEventListener('terminal-redraw', handleRedrawEvent)
      unsubscribeOutput()
      unsubscribeExit()
      unsubscribeSettings()
      bufferChangeDisposable.dispose()
      decorationManagerRef.current?.dispose()
      decorationManagerRef.current = null
      if (resizeTimer) clearTimeout(resizeTimer)
      if (imePendingRaf) cancelAnimationFrame(imePendingRaf)
      resizeObserver.disconnect()
      observer.disconnect()
      containerRef.current?.removeEventListener('wheel', handleWheel, { capture: true })
      doResizeRef.current = null
      terminal.dispose()
    }
  }, [terminalId])

  return (
    <div ref={containerRef} className="terminal-panel">
      {/* Context Menu — Fix BUG-002: portal to body to avoid position:fixed offset from parent transforms */}
      {contextMenu && createPortal(
        <div
          ref={ctxMenuRef}
          className="context-menu"
          style={menuPos
            ? { position: 'fixed', left: menuPos.x, top: menuPos.y, zIndex: 1000 }
            : { position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1000, visibility: 'hidden' as const }
          }
        >
          {contextMenu.hasSelection && (
            <button onClick={handleCopy} className="context-menu-item">
              複製
            </button>
          )}
          <button onClick={handlePaste} className="context-menu-item">
            貼上
          </button>
        </div>,
        document.body
      )}
    </div>
  )
})
