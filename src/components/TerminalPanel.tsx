import { useEffect, useRef, useState, memo, type DragEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useMenuPosition } from '../hooks/useMenuPosition'
import { Terminal } from '@xterm/xterm'
import { TerminalDecorationManager } from '../utils/terminal-decoration-manager'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import { CanvasAddon } from '@xterm/addon-canvas'
import { workspaceStore } from '../stores/workspace-store'
import { settingsStore } from '../stores/settings-store'
import { dispatchSyntheticEnterKeydown } from '../utils/terminal-keyboard-event'
import { PtyOutputReplayer, registerPtyNoticeSink, registerPtyReplaySink, registerPtySizeSyncSink } from '../lib/pty-replay'
import { buildTerminalDropInsertion, dataTransferHasFiles, droppedFilePaths, terminalShellFamily } from '../lib/terminal-drop'
import { imagePasteKey, isMacCommandPaste, readTerminalClipboard } from '../lib/terminal-paste'
import { attachmentDisplayNames } from '../lib/client-paths'
import { forcesTerminalSelection, isMouseTrackingDecset, isMouseTrackingOn, MouseReportSelectionKeeper, shouldCloseTerminalContextMenuOnKey, shouldShowTerminalContextMenu } from '../lib/terminal-context-menu'
import { ALT_SCREEN_EXIT, MOUSE_TRACKING_RESET, MouseReportEchoDetector } from '../lib/mouse-tracking-reset'
import { mouseReportEncoding, planWheelReports, shouldSendWheelReports, WheelLineAccumulator } from '../lib/terminal-wheel-reports'
import { createLinkHoverTooltip, createOsc8LinkHandler, findFileLinks } from '../lib/terminal-file-links'
import { CtToast, useCtToast } from './CtToast'
import { registerUsageLimitSender } from '../stores/usage-limit-store'
import { USAGE_LIMIT_ENTER_DELAY_MS, USAGE_LIMIT_SCREEN_LINES, usageLimitRecheckFailure } from '../lib/usage-limit'
import '@xterm/xterm/css/xterm.css'

const dlog = (...args: unknown[]) => window.electronAPI?.debug?.log(...args)

// T0669 / BUG-164: redraw of a visible terminal after a GPU process crash (see the effect).
/** How often to check whether the layer canvases have their context back. */
const GPU_REDRAW_POLL_MS = 250
/** Redraw anyway after this long, even if a layer canvas still reports a lost context. */
const GPU_REDRAW_MAX_WAIT_MS = 5_000
/** Back-to-back crashes: at least this long between two redraws of one terminal. */
const GPU_REDRAW_MIN_INTERVAL_MS = 1_000
const osc52DebugNoticeLine = /^sent \d+ chars via OSC 52 .*paste fails$/u

interface RemoteKeypressTrace {
  traceId: string
  source?: string
  reason?: string
  dataEvents: number
  dataBytes: number
  dataControls: string[]
  /** T0566: what xterm writes for this keypress is BAT's automatic write (`pty.write` `{ auto }`). */
  auto?: boolean
}

/**
 * PLAN-044 / T0566: the bottom of the terminal's content as text lines (wrapped rows joined),
 * at most `max` non-blank lines — what the usage-limit re-check reads.
 */
function terminalScreenLines(terminal: Terminal, max: number): string[] {
  const buffer = terminal.buffer.active
  const lines: string[] = []
  let pending = ''
  for (let row = buffer.baseY + terminal.rows - 1; row >= 0 && lines.length < max; row--) {
    const line = buffer.getLine(row)
    if (!line) continue
    pending = line.translateToString(true) + pending
    if (line.isWrapped) continue
    if (pending.trim()) lines.unshift(pending)
    pending = ''
  }
  if (pending.trim() && lines.length < max) lines.unshift(pending)
  return lines
}

const describeTerminalInputData = (data: string): string => {
  const parts: string[] = []
  for (const ch of data) {
    const code = ch.charCodeAt(0)
    if (code === 13) parts.push('CR')
    else if (code === 10) parts.push('LF')
    else if (code === 9) parts.push('TAB')
    else if (code === 27) parts.push('ESC')
    else if (code === 3) parts.push('ETX')
    else if (code < 32 || code === 127) parts.push(`0x${code.toString(16).padStart(2, '0')}`)
    else parts.push('text')
  }
  return parts.join(',')
}

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
}

interface ContextMenu {
  x: number
  y: number
  /** The selection at the right-click; Copy writes this, not what xterm holds by the time it is clicked (T0571). */
  selectionText: string
  /** BUG-166 / T0672: the program tracks the mouse at the right-click → "Reset mouse mode". */
  mouseTracking: boolean
  /** The alternate screen is on at the right-click → "Leave alternate screen". */
  altBuffer: boolean
}

let renderCount = 0
export const TerminalPanel = memo(function TerminalPanel({ terminalId, isActive = true }: TerminalPanelProps) {
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
  // Read by xterm's key handler, which is attached once (T0569 / BUG-143).
  const contextMenuOpenRef = useRef(false)
  contextMenuOpenRef.current = contextMenu !== null
  const [_altBufferActive, setAltBufferActive] = useState(false)
  const altBufferRef = useRef(false)
  const [terminalReady, setTerminalReady] = useState(false)
  const isActiveRef = useRef(isActive)
  const doResizeRef = useRef<(() => void) | null>(null)
  const resetMouseTrackingRef = useRef<((reason: string) => void) | null>(null)
  const exitAltScreenRef = useRef<(() => void) | null>(null)
  const remoteKeypressTraceRef = useRef<RemoteKeypressTrace | null>(null)
  const { t } = useTranslation()
  const { messages: noticeToasts, addToast: addNoticeToast, dismissToast: dismissNoticeToast } = useCtToast()

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

  // T0439: dropping files types their quoted paths (host form in a remote window), no Enter.
  // Electron 41 does not navigate on drop (navigateOnDragDrop defaults to false); taking the
  // drop here also keeps it from ever reaching will-navigate → openExternal.
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (!dataTransferHasFiles(e.dataTransfer)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    if (!dataTransferHasFiles(e.dataTransfer)) return
    e.preventDefault()
    e.stopPropagation()
    const paths = droppedFilePaths(e.dataTransfer)
    if (paths.length === 0) return
    await insertFilePaths(paths)
  }

  // Shared by file drop and the macOS Finder-copy paste (T0522): quoted paths, no Enter.
  const insertFilePaths = async (paths: string[]) => {
    const shell = await terminalShellFamily(terminalId)
    const { text, rejected } = await buildTerminalDropInsertion(paths, shell)
    if (rejected.length > 0) {
      addNoticeToast(t('claude.attachmentNotOnRemoteHost', { files: attachmentDisplayNames(rejected) }), 'warning', 8000)
    }
    if (!text) return
    const terminal = terminalRef.current
    if (terminal) {
      // paste() honours bracketed paste mode, so TUIs (claude CLI) see a paste, not keystrokes.
      terminal.paste(text)
      terminal.focus()
    } else {
      window.electronAPI.pty.write(terminalId, text)
    }
  }

  // Ctrl+V / macOS Command+V / context-menu Paste (T0522, T0524): Finder-copied items are typed
  // as paths (like a drop); an image sends the claude CLI's image-paste key so the CLI reads the
  // clipboard itself; anything else pastes as text.
  const pasteClipboard = async (source: string) => {
    const content = await readTerminalClipboard(undefined, dlog)
    dlog(`[terminal-paste] ${source} → ${content.kind} terminal=${terminalId}`)
    if (content.kind === 'paths') {
      await insertFilePaths(content.paths)
    } else if (content.kind === 'image') {
      window.electronAPI.pty.write(terminalId, imagePasteKey(window.electronAPI.platform))
    } else {
      await handlePasteText(content.text)
    }
  }

  // Handle context menu actions
  const handleCopy = () => {
    if (contextMenu?.selectionText) {
      navigator.clipboard.writeText(contextMenu.selectionText)
    }
    setContextMenu(null)
    setTimeout(() => terminalRef.current?.focus(), 0)
  }

  const handlePaste = async () => {
    try {
      await pasteClipboard('context-menu Paste')
    } catch (err) {
      dlog('Failed to read clipboard for context-menu paste', err)
    } finally {
      setContextMenu(null)
      // Restore focus after menu unmount so keyboard input keeps working.
      setTimeout(() => terminalRef.current?.focus(), 0)
    }
  }

  // BUG-166 / T0672: tracking (or the alternate screen) a program left on, turned off in xterm only.
  const handleResetMouseMode = () => {
    resetMouseTrackingRef.current?.('manual')
    setContextMenu(null)
    setTimeout(() => terminalRef.current?.focus(), 0)
  }

  const handleExitAltScreen = () => {
    exitAltScreenRef.current?.()
    setContextMenu(null)
    setTimeout(() => terminalRef.current?.focus(), 0)
  }

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null)
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Close context menu on Escape key (BUG-011a). With focus in the terminal xterm stops the key
  // before it reaches document; the key handler closes the menu then (T0569 / BUG-143).
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

      // Single RAF — resize + focus; nested RAF handles clearTextureAtlas (Win11 text overlap fix)
      const rafId = requestAnimationFrame(() => {
        if (!terminal) return

        dlog(`[resize] isActive effect → doResize terminal=${terminalId}`)
        doResizeRef.current?.()
        terminal.focus()

        // Force refresh terminal content to fix black screen / text overlap after visibility change (Win11 fix)
        requestAnimationFrame(() => {
          terminal.clearTextureAtlas()
          terminal.refresh(0, terminal.rows - 1)
          terminal.focus()
        })
      })

      return () => cancelAnimationFrame(rafId)
    }
  }, [isActive, terminalReady, terminalId])

  // IntersectionObserver removed — isActive effect already handles resize on visibility change

  useEffect(() => {
    if (!containerRef.current) return

    const settings = settingsStore.getSettings()
    const colors = settingsStore.getTerminalColors()

    // OSC 8 hyperlinks (BUG-174 / T0713): http(s) / file only, real target shown on hover
    const linkHover = createLinkHoverTooltip(() => terminal.element)
    const linkHandler = createOsc8LinkHandler({
      openExternal: uri => { window.electronAPI.shell.openExternal(uri) },
      log: message => dlog(message),
      showHover: linkHover.showHover,
      hideHover: linkHover.hideHover,
    })

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
      allowTransparency: true,
      linkHandler
    })

    const fitAddon = new FitAddon()
    const unicode11Addon = new Unicode11Addon()
    const webLinksAddon = new WebLinksAddon((_event, uri) => {
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

    // Register file:// URL link provider (WebLinksAddon only handles http/https).
    // Ranges are in cells and follow wrapped rows (BUG-174 / T0713, findFileLinks).
    terminal.registerLinkProvider({
      provideLinks(bufferLineNumber, callback) {
        const links = findFileLinks(terminal.buffer.active, bufferLineNumber).map(({ text, range }) => ({
          text,
          range,
          activate() {
            window.electronAPI.shell.openExternal(text)
          }
        }))
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

    // A selection xterm drops only because it sent a mouse report comes back (T0571 / BUG-144:
    // with DECSET 1003 every pointer move is a report, so Shift + drag never reached the menu).
    // T0573: the claude CLI also sets tracking again when the tab gets focus back, which clears the
    // selection without any input and, when the focusing press is the Shift + drag, ends the drag.
    let selectionDrag: Pick<MouseEvent, 'clientX' | 'clientY' | 'shiftKey' | 'altKey' | 'ctrlKey' | 'metaKey'> | null = null
    let pressingAgain = false
    const selectionKeeper = new MouseReportSelectionKeeper(terminal, undefined, {
      isDragging: () => selectionDrag !== null,
      resume: () => {
        const screen = terminal.element?.querySelector('.xterm-screen')
        if (!selectionDrag || !screen) return false
        const { clientX, clientY, shiftKey, altKey, ctrlKey, metaKey } = selectionDrag
        pressingAgain = true
        try {
          // Same modifiers as the press that began the drag, so xterm selects and reports nothing.
          screen.dispatchEvent(new MouseEvent('mousedown', {
            bubbles: true, cancelable: true, detail: 1, button: 0, buttons: 1,
            clientX, clientY, shiftKey, altKey, ctrlKey, metaKey,
          }))
        } finally {
          pressingAgain = false
        }
        return true
      },
    })
    const selectionChangeDisposable = terminal.onSelectionChange(() => selectionKeeper.handleSelectionChange())
    const trackingSetDisposable = terminal.parser.registerCsiHandler({ prefix: '?', final: 'h' }, (params) => {
      // Before xterm handles it; not when it turns tracking on from off.
      if (isMouseTrackingDecset(params) && isMouseTrackingOn(terminal.modes.mouseTrackingMode)) selectionKeeper.handleMouseTrackingSet()
      return false
    })
    // The program gets these (or a new selection starts): the selection is not brought back after them.
    const forgetKeptSelection = (e: MouseEvent | WheelEvent) => {
      if (pressingAgain) return
      if (e.type === 'mousedown' && e.button === 2 && e.shiftKey) return
      selectionKeeper.forget(e.type === 'wheel' ? 'wheel' : 'mouse press')
      selectionDrag = e.type === 'mousedown' && e.button === 0 && isMouseTrackingOn(terminal.modes.mouseTrackingMode)
        && forcesTerminalSelection(e, window.electronAPI?.platform, terminal.options.macOptionClickForcesSelection)
        ? e
        : null
    }
    // Capture on document: before xterm's own mouseup, with the drag's final range in place.
    const endSelectionDrag = (e: MouseEvent) => {
      if (e.button !== 0 || !selectionDrag) return
      selectionDrag = null
      selectionKeeper.handleSelectionDragEnd()
    }
    // A release that never arrived: a stale drag must not be pressed again (xterm would then
    // follow the pointer with no button down).
    const dropStaleSelectionDrag = (e: MouseEvent) => {
      if (selectionDrag && (e.buttons & 1) === 0) selectionDrag = null
    }
    containerRef.current.addEventListener('mousedown', forgetKeptSelection, { capture: true })
    containerRef.current.addEventListener('wheel', forgetKeptSelection, { capture: true, passive: true })
    document.addEventListener('mouseup', endSelectionDrag, { capture: true })
    document.addEventListener('mousemove', dropStaleSelectionDrag, { capture: true, passive: true })

    // BUG-166 / T0672: a program that tracked the mouse ended without turning tracking off (codex
    // killed by a signal), so the shell types every report into its command line. Tracking is
    // turned off in this xterm only (never written to the PTY); the alternate screen is left alone.
    const echoDetector = new MouseReportEchoDetector()
    const resetMouseTracking = (reason: string) => {
      const mode = terminal.modes.mouseTrackingMode
      terminal.write(MOUSE_TRACKING_RESET)
      echoDetector.clear()
      selectionDrag = null
      selectionKeeper.forget('mouse tracking reset')
      dlog(`[mouse-tracking] reset: ${reason} terminal=${terminalId} mode=${mode}`)
    }
    resetMouseTrackingRef.current = resetMouseTracking
    exitAltScreenRef.current = () => {
      terminal.write(ALT_SCREEN_EXIT)
      dlog(`[mouse-tracking] alt screen left: manual terminal=${terminalId}`)
    }

    // Track alt buffer state (BUG-008 infrastructure)
    const bufferChangeDisposable = terminal.buffer.onBufferChange((activeBuffer) => {
      const isAlt = activeBuffer === terminal.buffer.alternate
      selectionKeeper.forget('buffer switch')
      setAltBufferActive(isAlt)
      altBufferRef.current = isAlt
      workspaceStore.setTerminalAltBuffer(terminalId, isAlt)
      dlog(`[terminal] buffer changed: ${isAlt ? 'alt' : 'normal'}`, terminalId)
    })

    // Handle terminal input
    terminal.onData((data) => {
      selectionKeeper.handleData(data)
      echoDetector.noteInput(data, performance.now(), isMouseTrackingOn(terminal.modes.mouseTrackingMode))
      const trace = remoteKeypressTraceRef.current
      if (trace) {
        trace.dataEvents += 1
        trace.dataBytes += data.length
        trace.dataControls.push(describeTerminalInputData(data))
        dlog(`[terminal-submit] xterm onData terminal=${terminalId} trace=${trace.traceId} bytes=${data.length} controls=${trace.dataControls.at(-1)}`)
      }
      // T0566: the Enter of a usage-limit continue is BAT's automatic write, not the user's input.
      if (trace?.auto) window.electronAPI.pty.write(terminalId, data, { auto: true })
      else window.electronAPI.pty.write(terminalId, data)
    })

    // `bat-notify --submit` (terminal:keypress) and the usage-limit continue (T0566): Enter through
    // xterm, so the agent gets the bytes a real Enter key produces. False = no xterm textarea.
    const dispatchEnter = (info: { traceId: string; source?: string; reason?: string; auto?: boolean }): boolean => {
      const { traceId } = info
      const textarea = containerRef.current?.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement | null
      if (!textarea) {
        dlog(`[terminal-submit] remote Enter aborted terminal=${terminalId} trace=${traceId} reason=missing-xterm-helper-textarea`)
        return false
      }

      const trace: RemoteKeypressTrace = {
        traceId,
        source: info.source,
        reason: info.reason,
        dataEvents: 0,
        dataBytes: 0,
        dataControls: [],
        auto: info.auto,
      }
      remoteKeypressTraceRef.current = trace
      // T0566: an automatic continue may land in a background tab — give the focus back afterwards
      // so the user's typing keeps going where it was.
      const previousFocus = info.auto ? document.activeElement as HTMLElement | null : null

      try {
        terminal.focus()
        textarea.focus({ preventScroll: true })
        const result = dispatchSyntheticEnterKeydown(textarea)
        dlog(`[terminal-submit] remote Enter dispatched terminal=${terminalId} trace=${traceId} dispatchReturned=${result.dispatchReturned} defaultPrevented=${result.defaultPrevented} dataEvents=${trace.dataEvents} dataBytes=${trace.dataBytes} controls=${trace.dataControls.join('|') || 'none'}`)
        if (trace.dataEvents === 0) {
          dlog(`[terminal-submit] remote Enter produced no xterm data terminal=${terminalId} trace=${traceId}`)
        }
      } finally {
        remoteKeypressTraceRef.current = null
        if (previousFocus && previousFocus !== textarea && previousFocus.isConnected) previousFocus.focus({ preventScroll: true })
      }
      return true
    }

    const unsubscribeKeypress = window.electronAPI.pty.onTerminalKeypress((info) => {
      if (info.targetId !== terminalId) return
      const isEnter = info.key === 'Enter' || info.code === 'Enter' || info.keyCode === 13
      if (!isEnter) return
      const traceId = info.traceId ?? `renderer-${Date.now().toString(36)}`
      dlog(`[terminal-submit] remote Enter received terminal=${terminalId} trace=${traceId} source=${info.source ?? '?'} reason=${info.reason ?? '?'} path=dom-keydown`)
      dispatchEnter({ traceId, source: info.source, reason: info.reason })
    })

    // PLAN-044 / T0566: the usage limit reset — re-check this screen, type the text (automatic
    // write), then Enter through xterm. App.tsx calls it in the window holding the tab.
    const unregisterUsageLimit = registerUsageLimitSender(terminalId, async (info) => {
      const failure = usageLimitRecheckFailure(terminalScreenLines(terminal, USAGE_LIMIT_SCREEN_LINES), info.action, Date.now())
      if (failure) return { ok: false, reason: `re-check failed: ${failure}` }
      if (info.action === 'text' && info.text) {
        await window.electronAPI.pty.write(terminalId, info.text, { auto: true })
        await new Promise<void>(resolve => setTimeout(resolve, USAGE_LIMIT_ENTER_DELAY_MS))
      }
      dlog(`[terminal-submit] remote Enter received terminal=${terminalId} trace=${info.traceId} source=usage-limit reason=${info.agent} path=dom-keydown`)
      if (!dispatchEnter({ traceId: info.traceId, source: 'usage-limit', reason: info.agent, auto: true })) {
        await window.electronAPI.pty.write(terminalId, '\r', { auto: true })
        return { ok: true, path: 'pty-write (no xterm textarea)' }
      }
      return { ok: true, path: 'dom-keydown' }
    })

    // Track IME composition state on xterm's hidden textarea
    // to prevent CAPS LOCK and other keys from committing partial IME input
    let imeComposing = false
    const xtermTextarea = containerRef.current?.querySelector('.xterm-helper-textarea')
    if (xtermTextarea) {
      xtermTextarea.addEventListener('compositionstart', () => { imeComposing = true })
      xtermTextarea.addEventListener('compositionend', () => { imeComposing = false })
    }

    // T0522: Command+V is pasted by pasteClipboard. Should a native paste (Edit menu
    // role) still follow it, swallow it before xterm sees it so text never lands twice.
    let suppressNativePasteUntil = 0
    const handleNativePaste = (e: Event) => {
      if (performance.now() > suppressNativePasteUntil) return
      suppressNativePasteUntil = 0
      e.preventDefault()
      e.stopImmediatePropagation()
      dlog(`[terminal-paste] swallowed native paste after Command+V terminal=${terminalId}`)
    }
    containerRef.current?.addEventListener('paste', handleNativePaste, { capture: true })

    // BUG-165 / T0698: codex on the alternate screen gets one SGR wheel report per line scrolled
    // (xterm sends at most one per event); every other case stays xterm's.
    const wheelLineAccumulator = new WheelLineAccumulator()
    let wheelReportsOn = false
    terminal.attachCustomWheelEventHandler((event) => {
      const on = shouldSendWheelReports({
        agentPreset: workspaceStore.getState().terminals.find(t => t.id === terminalId)?.agentPreset,
        bufferType: terminal.buffer.active.type,
        mouseTrackingMode: terminal.modes.mouseTrackingMode,
        mouseEncoding: mouseReportEncoding(terminal),
      })
      if (on !== wheelReportsOn) {
        wheelReportsOn = on
        wheelLineAccumulator.reset()
        dlog(`[wheel-reports] ${on ? 'on' : 'off'} terminal=${terminalId} buffer=${terminal.buffer.active.type} mode=${terminal.modes.mouseTrackingMode} encoding=${mouseReportEncoding(terminal) ?? 'unknown'}`)
      }
      if (!on) return true
      const screen = terminal.element?.querySelector('.xterm-screen') as HTMLElement | null
      if (!screen) return true
      const rect = screen.getBoundingClientRect()
      const style = window.getComputedStyle(screen)
      const plan = planWheelReports(event, {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        paddingLeft: parseInt(style.getPropertyValue('padding-left')),
        paddingTop: parseInt(style.getPropertyValue('padding-top')),
        cols: terminal.cols,
        rows: terminal.rows,
      }, {
        scrollSensitivity: terminal.options.scrollSensitivity,
        fastScrollSensitivity: terminal.options.fastScrollSensitivity,
        fastScrollModifier: terminal.options.fastScrollModifier,
      }, wheelLineAccumulator)
      if (!plan) return true
      // Same path as xterm's own report (`triggerDataEvent(report, true)` → onData → PTY).
      for (const report of plan.reports) terminal.input(report, true)
      return false
    })

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

      // Escape with the right-click menu open closes the menu and is not sent to the PTY
      // (T0569 / BUG-143: xterm would write ESC and stop the key before document sees it).
      if (shouldCloseTerminalContextMenuOnKey(event, contextMenuOpenRef.current, imeComposing)) {
        event.preventDefault()
        event.stopPropagation()
        contextMenuOpenRef.current = false
        setContextMenu(null)
        dlog(`[terminal-context-menu] terminal=${terminalId} closed by Escape (not sent to the terminal)`)
        return false
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
      // Command+V on macOS (T0522 / BUG-128): handled here instead of xterm's DOM paste
      // event, which reads only text/plain and so typed nothing for a Finder copy.
      // preventDefault keeps the native paste (Edit menu role) from pasting a second time.
      if (isMacCommandPaste(event, window.electronAPI.platform)) {
        event.preventDefault()
        suppressNativePasteUntil = performance.now() + 1000
        pasteClipboard('Command+V').catch(err => dlog('[terminal-paste] Command+V paste failed', err))
        return false
      }
      // Ctrl+V for paste (standard shortcut). An image on the clipboard sends the claude CLI's
      // image-paste key instead (T0524: Alt+V on Windows, Ctrl+V on macOS / Linux).
      if (event.ctrlKey && !event.shiftKey && event.key === 'v') {
        event.preventDefault()
        pasteClipboard('Ctrl+V').catch(err => dlog('[terminal-paste] Ctrl+V paste failed', err))
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

    // Right-click context menu for copy/paste. Not while the program tracks the mouse and so
    // handles the right button itself (T0568 / BUG-142); Shift + right-click still opens it.
    containerRef.current.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      const mouseTrackingMode = terminal.modes.mouseTrackingMode
      if (!shouldShowTerminalContextMenu(mouseTrackingMode, e.shiftKey)) {
        dlog(`[terminal-context-menu] terminal=${terminalId} not shown: the program tracks the mouse (${mouseTrackingMode}); Shift+right-click opens it`)
        return
      }
      const selectionText = terminal.getSelection()
      // T0573: what the menu was built from, to read a failed Copy from the user's log.
      dlog(`[terminal-context-menu] terminal=${terminalId} shown: mouseTrackingMode=${mouseTrackingMode} shift=${e.shiftKey} hasSelection=${terminal.hasSelection()} selectionText=${selectionText.length} chars keeper=${selectionKeeper.lastAction}`)
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        selectionText,
        mouseTracking: isMouseTrackingOn(mouseTrackingMode),
        altBuffer: altBufferRef.current,
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
    const writeOutput = (data: string) => {
      const filteredData = filterTerminalOutputNoise(data)
      if (filteredData) {
        terminal.write(filteredData)
        if (echoDetector.noteOutput(filteredData, performance.now(), isMouseTrackingOn(terminal.modes.mouseTrackingMode))) {
          resetMouseTracking('reports echoed as text')
        }
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
    // T0403: live output goes through the replayer so a pty:get-buffer replay (PTY was
    // already running when pty:create was re-sent) lands before it, without duplicating it.
    const replayer = new PtyOutputReplayer(terminalId, {
      write: writeOutput,
      reset: () => terminal.reset(),
    }, (id) => window.electronAPI.pty.getBuffer(id))
    const unsubscribeOutput = window.electronAPI.pty.onOutput((id, data) => {
      if (id === terminalId) replayer.push(data)
    })
    const unregisterReplay = registerPtyReplaySink(terminalId, () => {
      replayer.replay()
        .then((chars) => dlog(`[T0403] replay terminal=${terminalId} chars=${chars}`))
        .catch(() => { /* view disposed mid-replay */ })
    })
    // T0424: why this terminal has no PTY (e.g. remote PTY limit) — one readable line.
    const unregisterNotice = registerPtyNoticeSink(terminalId, (text) => {
      terminal.write(`\r\n\x1b[33m${text}\x1b[0m\r\n`)
    })
    // T0572 (BUG-145): a PTY was just spawned at the host's 120x30 — the size sent before may
    // have been dropped (id not there yet) or deduped (restart). Send it again; a hidden view
    // sends on its next activation (the dedup is reset).
    const unregisterSizeSync = registerPtySizeSyncSink(terminalId, () => {
      lastSentCols = 0
      lastSentRows = 0
      if (!isActiveRef.current) return
      dlog(`[resize] PTY spawned → doResize terminal=${terminalId}`)
      doResize()
    })

    // T0669 / BUG-164: after a GPU process crash xterm's canvas layers and its glyph atlas come
    // back blank, and nothing redraws a terminal that stays visible (the isActive effect only runs
    // on activation). Redraw it once per crash, when its canvases are usable again: a layer
    // canvas's `contextrestored`, or the first poll that finds no layer canvas with a lost context
    // (the restore can happen before this message arrives), at most GPU_REDRAW_MAX_WAIT_MS later.
    // A crash while the window is hidden waits for it to show. Hidden terminals do nothing: the
    // isActive effect redraws them on activation. Crashes arriving while one waits share its redraw.
    let gpuCrashSeen = 0
    let gpuCrashPending = 0
    let gpuRedrawLastAt = 0
    let cancelGpuRedraw: (() => void) | null = null
    const layerCanvases = () => Array.from(containerRef.current?.querySelectorAll<HTMLCanvasElement>('.xterm-screen canvas') ?? [])
    const anyLayerContextLost = () => layerCanvases().some(canvas => {
      try {
        return (canvas.getContext('2d') as CanvasRenderingContext2D | null)?.isContextLost?.() === true
      } catch {
        return false
      }
    })
    const redrawAfterGpuCrash = (trigger: string) => {
      cancelGpuRedraw = null
      const crash = gpuCrashPending
      gpuCrashPending = 0
      if (!isActiveRef.current) {
        dlog(`[gpu] terminal redraw skipped (no longer active) terminal=${terminalId} crash=#${crash}`)
        return
      }
      gpuRedrawLastAt = Date.now()
      terminal.clearTextureAtlas()
      terminal.refresh(0, terminal.rows - 1)
      dlog(`[gpu] terminal redraw after GPU crash terminal=${terminalId} crash=#${crash} trigger=${trigger}`)
    }
    const scheduleGpuRedraw = () => {
      if (document.visibilityState === 'hidden') {
        const onVisible = () => {
          if (document.visibilityState === 'hidden') return
          document.removeEventListener('visibilitychange', onVisible)
          scheduleGpuRedraw()
        }
        document.addEventListener('visibilitychange', onVisible)
        cancelGpuRedraw = () => document.removeEventListener('visibilitychange', onVisible)
        return
      }
      const startedAt = Date.now()
      const canvases = layerCanvases()
      let poll: ReturnType<typeof setInterval> | null = null
      let delay: ReturnType<typeof setTimeout> | null = null
      let raf = 0
      const onRestored = () => ready('contextrestored')
      const stopWaiting = () => {
        if (poll) clearInterval(poll)
        poll = null
        canvases.forEach(canvas => canvas.removeEventListener('contextrestored', onRestored))
      }
      const ready = (trigger: string) => {
        stopWaiting()
        delay = setTimeout(() => {
          delay = null
          raf = requestAnimationFrame(() => redrawAfterGpuCrash(trigger))
        }, Math.max(0, gpuRedrawLastAt + GPU_REDRAW_MIN_INTERVAL_MS - Date.now()))
      }
      canvases.forEach(canvas => canvas.addEventListener('contextrestored', onRestored))
      poll = setInterval(() => {
        if (Date.now() - startedAt >= GPU_REDRAW_MAX_WAIT_MS) ready('timeout')
        else if (!anyLayerContextLost()) ready('settled')
      }, GPU_REDRAW_POLL_MS)
      cancelGpuRedraw = () => {
        stopWaiting()
        if (delay) clearTimeout(delay)
        if (raf) cancelAnimationFrame(raf)
      }
    }
    const unsubscribeGpuProcessGone = window.electronAPI.system.onGpuProcessGone(({ crash }) => {
      if (crash <= gpuCrashSeen) return
      gpuCrashSeen = crash
      if (!isActiveRef.current) return
      gpuCrashPending = crash
      if (cancelGpuRedraw) return
      dlog(`[gpu] terminal redraw scheduled terminal=${terminalId} crash=#${crash}`)
      scheduleGpuRedraw()
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
      unregisterReplay()
      unregisterNotice()
      unregisterSizeSync()
      unsubscribeGpuProcessGone()
      cancelGpuRedraw?.()
      replayer.dispose()
      unsubscribeOutput()
      unsubscribeExit()
      unsubscribeKeypress()
      unregisterUsageLimit()
      unsubscribeSettings()
      bufferChangeDisposable.dispose()
      selectionChangeDisposable.dispose()
      trackingSetDisposable.dispose()
      document.removeEventListener('mouseup', endSelectionDrag, { capture: true })
      document.removeEventListener('mousemove', dropStaleSelectionDrag, { capture: true })
      decorationManagerRef.current?.dispose()
      decorationManagerRef.current = null
      if (resizeTimer) clearTimeout(resizeTimer)
      if (imePendingRaf) cancelAnimationFrame(imePendingRaf)
      resizeObserver.disconnect()
      observer.disconnect()
      containerRef.current?.removeEventListener('wheel', handleWheel, { capture: true })
      containerRef.current?.removeEventListener('mousedown', forgetKeptSelection, { capture: true })
      containerRef.current?.removeEventListener('wheel', forgetKeptSelection, { capture: true })
      containerRef.current?.removeEventListener('paste', handleNativePaste, { capture: true })
      doResizeRef.current = null
      resetMouseTrackingRef.current = null
      exitAltScreenRef.current = null
      linkHover.dispose()
      terminal.dispose()
    }
  }, [terminalId])

  return (
    <div ref={containerRef} className="terminal-panel" onDragOver={handleDragOver} onDrop={handleDrop}>
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
          {contextMenu.selectionText && (
            <button onClick={handleCopy} className="context-menu-item">
              複製
            </button>
          )}
          <button onClick={handlePaste} className="context-menu-item">
            貼上
          </button>
          {(contextMenu.mouseTracking || contextMenu.altBuffer) && <div className="context-menu-divider" />}
          {contextMenu.mouseTracking && (
            <button onClick={handleResetMouseMode} className="context-menu-item" data-menu-action="reset-mouse-mode">
              {t('terminal.resetMouseMode')}
            </button>
          )}
          {contextMenu.altBuffer && (
            <button onClick={handleExitAltScreen} className="context-menu-item" data-menu-action="exit-alt-screen">
              {t('terminal.exitAltScreen')}
            </button>
          )}
        </div>,
        document.body
      )}
      <CtToast messages={noticeToasts} onDismiss={dismissNoticeToast} />
    </div>
  )
})
