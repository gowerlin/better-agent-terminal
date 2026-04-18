import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { settingsStore } from '../stores/settings-store'
import { useVoiceRecording } from '../hooks/useVoiceRecording'
import { MicButton } from './voice/MicButton'
import { VoicePreviewPopover } from './voice/VoicePreviewPopover'
import type { VoicePreviewState } from './voice/VoicePreviewPopover'

interface PromptBoxProps {
  terminalId: string
  isActive?: boolean
}

interface CmdInfo {
  name: string
  description: string
}

interface StarCmdInfo {
  name: string
  description: string
  prefix: 'ct' | 'gsd'
}

// Per-terminal history stored in memory
const historyMap = new Map<string, string[]>()

export function PromptBox({ terminalId, isActive = true }: Readonly<PromptBoxProps>) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [fontFamily, setFontFamily] = useState(settingsStore.getFontFamilyString())
  const [imagePath, setImagePath] = useState<string | null>(null)
  const [historyIndex, setHistoryIndex] = useState(-1)
  const draftRef = useRef('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Command menu state
  const [slashCommands, setSlashCommands] = useState<CmdInfo[]>([])
  const [starCommands, setStarCommands] = useState<StarCmdInfo[]>([])
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const showSlashMenuRef = useRef(false)
  const [slashFilter, setSlashFilter] = useState('')
  const [slashMenuIndex, setSlashMenuIndex] = useState(0)
  const [showStarMenu, setShowStarMenu] = useState(false)
  const showStarMenuRef = useRef(false)
  const [starFilter, setStarFilter] = useState('')
  const [starMenuIndex, setStarMenuIndex] = useState(0)

  useEffect(() => { showSlashMenuRef.current = showSlashMenu }, [showSlashMenu])
  useEffect(() => { showStarMenuRef.current = showStarMenu }, [showStarMenu])

  // Voice preview popover state
  const [voicePreviewState, setVoicePreviewState] = useState<VoicePreviewState>('hidden')
  const [voiceTranscriptionMeta, setVoiceTranscriptionMeta] = useState<{
    detectedLanguage?: string
    inferenceTimeMs?: number
  }>({})

  // Voice recording hook
  const voice = useVoiceRecording({
    onTranscribed: (_text, result) => {
      setVoiceTranscriptionMeta({
        detectedLanguage: result?.detectedLanguage,
        inferenceTimeMs: result?.inferenceTimeMs,
      })
      setVoicePreviewState('result')
    },
  })

  // Sync voice hook state → popover state
  useEffect(() => {
    if (voice.state === 'transcribing' && voicePreviewState === 'hidden') {
      setVoicePreviewState('transcribing')
    }
  }, [voice.state, voicePreviewState])

  // Sync voice error → popover error
  useEffect(() => {
    if (voice.error && voicePreviewState !== 'hidden') {
      setVoicePreviewState('error')
    }
  }, [voice.error, voicePreviewState])

  // Alt+M global shortcut — only active on the current active PromptBox
  useEffect(() => {
    if (!isActive) return
    const handler = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
        e.preventDefault()
        voice.toggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isActive, voice.toggle])

  useEffect(() => {
    const unsubscribe = settingsStore.subscribe(() => {
      setFontFamily(settingsStore.getFontFamilyString())
    })
    return unsubscribe
  }, [])

  // Scan slash commands (skills) once on mount using terminal cwd
  useEffect(() => {
    window.electronAPI.pty.getCwd(terminalId).then((cwd: string | null) => {
      if (!cwd) return
      return window.electronAPI.claude.scanSkills(cwd)
    }).then((results: { name: string; description: string }[] | undefined) => {
      if (results) setSlashCommands(results.map(r => ({ name: r.name, description: r.description })))
    }).catch(() => {})
  }, [terminalId])

  // Scan star commands once on mount
  useEffect(() => {
    window.electronAPI.claude.scanStarCommands().then((results: StarCmdInfo[]) => {
      setStarCommands(results)
    }).catch(() => {})
  }, [])

  const filteredSlashCommands = useMemo(() => {
    if (!showSlashMenu) return []
    const q = slashFilter.toLowerCase()
    if (!q) return slashCommands
    const prefix = slashCommands.filter(c => c.name.toLowerCase().startsWith(q))
    const fuzzy = slashCommands.filter(c => !c.name.toLowerCase().startsWith(q) && c.name.toLowerCase().includes(q))
    return [...prefix, ...fuzzy]
  }, [showSlashMenu, slashFilter, slashCommands])

  const filteredStarCommands = useMemo(() => {
    if (!showStarMenu) return []
    const q = starFilter.toLowerCase()
    if (!q) return starCommands
    const prefix = starCommands.filter(c => c.name.toLowerCase().startsWith(q))
    const fuzzy = starCommands.filter(c => !c.name.toLowerCase().startsWith(q) && c.name.toLowerCase().includes(q))
    return [...prefix, ...fuzzy]
  }, [showStarMenu, starFilter, starCommands])

  const handleSlashSelect = useCallback((cmd: CmdInfo) => {
    setText('/' + cmd.name)
    setShowSlashMenu(false)
    textareaRef.current?.focus()
  }, [])

  const handleStarSelect = useCallback((cmd: StarCmdInfo) => {
    setText('*' + cmd.name)
    setShowStarMenu(false)
    textareaRef.current?.focus()
  }, [])

  const getHistory = () => historyMap.get(terminalId) || []

  const handleSend = async () => {
    const content = text.trim()
    if (!content && !imagePath) return

    // Save to history
    if (content) {
      const history = getHistory()
      // Avoid consecutive duplicates
      if (history[history.length - 1] !== content) {
        history.push(content)
        historyMap.set(terminalId, history)
      }
    }
    setHistoryIndex(-1)
    draftRef.current = ''

    // Order: text first (no Enter) → attach image → Enter to submit
    if (content) {
      await window.electronAPI.pty.write(terminalId, content)
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (imagePath) {
      await window.electronAPI.clipboard.writeImage(imagePath)
      await new Promise(resolve => setTimeout(resolve, 100))
      await window.electronAPI.pty.write(terminalId, '\x1bv')
      await new Promise(resolve => setTimeout(resolve, 800))
    }

    await window.electronAPI.pty.write(terminalId, '\r')

    setText('')
    setImagePath(null)
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Slash command menu navigation
    if (showSlashMenu && filteredSlashCommands.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSlashMenuIndex(prev => Math.min(prev + 1, filteredSlashCommands.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSlashMenuIndex(prev => Math.max(prev - 1, 0)); return }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); handleSlashSelect(filteredSlashCommands[slashMenuIndex]); return }
      if (e.key === 'Escape') { e.preventDefault(); setShowSlashMenu(false); return }
    }
    // Star command menu navigation
    if (showStarMenu && filteredStarCommands.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setStarMenuIndex(prev => Math.min(prev + 1, filteredStarCommands.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setStarMenuIndex(prev => Math.max(prev - 1, 0)); return }
      if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); handleStarSelect(filteredStarCommands[starMenuIndex]); return }
      if (e.key === 'Escape') { e.preventDefault(); setShowStarMenu(false); return }
    }
    if (e.key === 'Enter' && e.altKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      const textarea = textareaRef.current
      if (textarea) {
        const { selectionStart, selectionEnd } = textarea
        const newText = text.slice(0, selectionStart) + '\n' + text.slice(selectionEnd)
        setText(newText)
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = selectionStart + 1
        })
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setText('')
      setImagePath(null)
      setHistoryIndex(-1)
      draftRef.current = ''
      return
    }

    if (e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
      return
    }

    const history = getHistory()
    if (history.length === 0) return

    // Up arrow: only when cursor is at the start (first line)
    if (e.key === 'ArrowUp') {
      const textarea = textareaRef.current
      if (textarea && textarea.selectionStart !== 0) return

      e.preventDefault()
      if (historyIndex === -1) {
        // Save current draft before navigating history
        draftRef.current = text
      }
      const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1)
      setHistoryIndex(newIndex)
      setText(history[newIndex])
      return
    }

    // Down arrow: only when cursor is at the end (last line)
    if (e.key === 'ArrowDown') {
      const textarea = textareaRef.current
      if (textarea && textarea.selectionStart !== textarea.value.length) return
      if (historyIndex === -1) return

      e.preventDefault()
      const newIndex = historyIndex + 1
      if (newIndex >= history.length) {
        // Back to draft
        setHistoryIndex(-1)
        setText(draftRef.current)
      } else {
        setHistoryIndex(newIndex)
        setText(history[newIndex])
      }
      return
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setText(val)
    // Reset history navigation when user types
    if (historyIndex !== -1) {
      setHistoryIndex(-1)
      draftRef.current = ''
    }
    // Slash command detection
    if (val.startsWith('/') && !val.includes(' ')) {
      setShowSlashMenu(true)
      setSlashFilter(val.slice(1))
      setSlashMenuIndex(0)
      if (showStarMenuRef.current) setShowStarMenu(false)
    } else if (showSlashMenuRef.current) {
      setShowSlashMenu(false)
    }
    // Star command detection
    if (val.startsWith('*') && !val.includes(' ')) {
      setShowStarMenu(true)
      setStarFilter(val.slice(1))
      setStarMenuIndex(0)
      if (showSlashMenuRef.current) setShowSlashMenu(false)
    } else if (showStarMenuRef.current) {
      setShowStarMenu(false)
    }
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const filePath = await window.electronAPI.clipboard.saveImage()
        if (filePath) {
          setImagePath(filePath)
        }
        return
      }
    }
  }

  const hasContent = text.trim() || imagePath

  return (
    <div className="prompt-box">
      <div className="prompt-box-inner">
        {/* Slash command autocomplete menu */}
        {showSlashMenu && filteredSlashCommands.length > 0 && (
          <div className="prompt-box-cmd-menu">
            {filteredSlashCommands.slice(0, 10).map((cmd, i) => (
              <div
                key={cmd.name}
                className={`prompt-box-cmd-item${i === slashMenuIndex ? ' selected' : ''}`}
                onClick={() => handleSlashSelect(cmd)}
                onMouseEnter={() => setSlashMenuIndex(i)}
              >
                <span className="prompt-box-cmd-name">/{cmd.name}</span>
                <span className="prompt-box-cmd-desc">{cmd.description}</span>
              </div>
            ))}
          </div>
        )}
        {/* Star command autocomplete menu */}
        {showStarMenu && filteredStarCommands.length > 0 && (
          <div className="prompt-box-cmd-menu prompt-box-star-menu">
            {filteredStarCommands.slice(0, 10).map((cmd, i) => (
              <div
                key={`${cmd.prefix}-${cmd.name}`}
                className={`prompt-box-cmd-item${i === starMenuIndex ? ' selected' : ''}`}
                onClick={() => handleStarSelect(cmd)}
                onMouseEnter={() => setStarMenuIndex(i)}
              >
                <span className="prompt-box-cmd-name">*{cmd.name}</span>
                <span className="prompt-box-cmd-prefix">{cmd.prefix}</span>
                <span className="prompt-box-cmd-desc">{cmd.description}</span>
              </div>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          className="prompt-box-textarea"
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={imagePath ? t('promptBox.placeholderWithImage') : t('promptBox.placeholder')}
          style={{ fontFamily }}
          rows={3}
        />
        <MicButton
          state={voice.state}
          onClick={voice.toggle}
          disabled={voice.state === 'disabled'}
          disabledTooltip={voice.error || '請先在 Settings 下載語音模型'}
        />
        <VoicePreviewPopover
          state={voicePreviewState}
          text={voice.lastTranscription ?? undefined}
          errorMessage={voice.error ?? undefined}
          detectedLanguage={voiceTranscriptionMeta.detectedLanguage}
          inferenceTimeMs={voiceTranscriptionMeta.inferenceTimeMs}
          onConfirm={(finalText) => {
            setText((prev) => prev ? prev + ' ' + finalText : finalText)
            setVoicePreviewState('hidden')
            setVoiceTranscriptionMeta({})
            voice.reset()
            textareaRef.current?.focus()
          }}
          onCancel={() => {
            setVoicePreviewState('hidden')
            setVoiceTranscriptionMeta({})
            voice.reset()
            textareaRef.current?.focus()
          }}
        />
        <button
          className="prompt-box-send"
          onClick={handleSend}
          disabled={!hasContent}
          title={t('promptBox.sendToTerminal')}
        >
          ▶
        </button>
      </div>
      <div className="prompt-box-hint">
        {voice.error && (
          <>
            <span className="prompt-box-voice-error" onClick={voice.reset} title="點擊清除">
              ⚠ {voice.error}
            </span>
            {' · '}
          </>
        )}
        {imagePath ? (
          <>
            <span className="prompt-box-image-badge">
              {t('promptBox.imageAttached')}
              <button className="prompt-box-image-remove" onClick={() => setImagePath(null)} title={t('promptBox.removeImage')}>×</button>
            </span>
            {' · '}
          </>
        ) : null}
        {t('promptBox.hint')}
      </div>
    </div>
  )
}
