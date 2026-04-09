import { useEffect, useState, memo } from 'react'
import type { TerminalInstance } from '../types'
import { ActivityIndicator } from './ActivityIndicator'
import { settingsStore } from '../stores/settings-store'
import { getAgentPreset } from '../types/agent-presets'
import type { AgentDefinition } from '../types/agent-runtime'

// Global preview cache - persists across component unmounts
const MAX_PREVIEW_CACHE = 100
const previewCache = new Map<string, string>()
const previewSubscribers = new Map<string, Set<() => void>>()

/** Remove a terminal's preview from the cache (call when terminal is destroyed) */
export function clearPreviewCache(terminalId: string) {
  previewCache.delete(terminalId)
  previewSubscribers.delete(terminalId)
}

function updatePreviewCache(id: string, value: string) {
  previewCache.set(id, value)
  previewSubscribers.get(id)?.forEach(fn => fn())
}

function subscribeToPreview(id: string, fn: () => void): () => void {
  if (!previewSubscribers.has(id)) previewSubscribers.set(id, new Set())
  previewSubscribers.get(id)!.add(fn)
  return () => {
    const subs = previewSubscribers.get(id)
    if (!subs) return
    subs.delete(fn)
    if (subs.size === 0) previewSubscribers.delete(id)
  }
}

// Strip all ANSI escape sequences and problematic characters
const stripAnsi = (str: string): string => {
  return str
    // CSI sequences: \x1b[ followed by params and command char
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
    // OSC sequences: \x1b] ... (terminated by BEL \x07 or ST \x1b\\)
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    // Other escape sequences: \x1b followed by single char
    .replace(/\x1b[()][AB012]/g, '')
    .replace(/\x1b[=>]/g, '')
    // DCS, PM, APC sequences
    .replace(/\x1b[PX^_][^\x1b]*\x1b\\/g, '')
    // Bell character
    .replace(/\x07/g, '')
    // Carriage return (often used for overwriting lines)
    .replace(/\r/g, '')
    // Any remaining single-char escapes
    .replace(/\x1b./g, '')
    // Private Use Area characters (Powerline, Nerd Fonts icons) - causes box characters
    .replace(/[\uE000-\uF8FF]/g, '')
    // Braille patterns (often used for terminal graphics)
    .replace(/[\u2800-\u28FF]/g, '')
    // Box drawing characters that may not render well at small sizes
    .replace(/[\u2500-\u257F]/g, '')
}

// Batched preview update — accumulate and flush via RAF to avoid per-chunk processing
const pendingPreviews = new Map<string, string>()
let previewRafId = 0

function scheduleBatchedPreviewUpdate(id: string, data: string) {
  const prev = pendingPreviews.get(id) || previewCache.get(id) || ''
  pendingPreviews.set(id, prev + data)
  if (!previewRafId) {
    previewRafId = requestAnimationFrame(() => {
      previewRafId = 0
      for (const [tid, raw] of pendingPreviews) {
        const cleaned = stripAnsi(raw)
        const lines = cleaned.split('\n').slice(-8)
        updatePreviewCache(tid, lines.join('\n'))
      }
      pendingPreviews.clear()
      // Evict oldest entries if cache is too large
      if (previewCache.size > MAX_PREVIEW_CACHE) {
        const firstKey = previewCache.keys().next().value
        if (firstKey) previewCache.delete(firstKey)
      }
    })
  }
}

// Global listener setup - only once
let globalListenerSetup = false
const setupGlobalListener = () => {
  if (globalListenerSetup) return
  globalListenerSetup = true

  // PTY output for regular terminals — batched via RAF
  window.electronAPI.pty.onOutput((id, data) => {
    scheduleBatchedPreviewUpdate(id, data)
  })

  // Claude agent messages for agent terminal previews
  window.electronAPI.claude.onMessage((sessionId, message) => {
    const msg = message as { role?: string; content?: string }
    if (msg.role === 'assistant' && msg.content) {
      const lines = msg.content.split('\n').slice(-8)
      updatePreviewCache(sessionId, lines.join('\n'))
    }
  })

  // Claude agent streaming text for live preview
  window.electronAPI.claude.onStream((sessionId, data) => {
    const stream = data as { text?: string }
    if (stream.text) {
      const prev = previewCache.get(sessionId) || ''
      const combined = prev + stream.text
      const lines = combined.split('\n').slice(-8)
      updatePreviewCache(sessionId, lines.join('\n'))
    }
  })
}

interface TerminalThumbnailProps {
  terminal: TerminalInstance
  isActive: boolean
  onClick: () => void
}

const dlog = (...args: unknown[]) => window.electronAPI?.debug?.log(...args)
let thumbRenderCount = 0
export const TerminalThumbnail = memo(function TerminalThumbnail({ terminal, isActive, onClick }: TerminalThumbnailProps) {
  thumbRenderCount++
  if (thumbRenderCount <= 30 || thumbRenderCount % 50 === 0) {
    dlog(`[render] Thumbnail render #${thumbRenderCount} id=${terminal.id.slice(0,8)} active=${isActive}`)
  }
  const [preview, setPreview] = useState<string>(previewCache.get(terminal.id) || '')
  const [fontFamily, setFontFamily] = useState<string>(settingsStore.getFontFamilyString())

  // Check if this is an agent terminal
  const isAgent = terminal.agentPreset && terminal.agentPreset !== 'none'
  const presetConfig = isAgent ? getAgentPreset(terminal.agentPreset!) : null
  const [registryDef, setRegistryDef] = useState<AgentDefinition | null>(null)

  useEffect(() => {
    if (isAgent && !presetConfig && terminal.agentPreset) {
      window.electronAPI.agent?.getDefinition(terminal.agentPreset).then((def: AgentDefinition | null) => {
        setRegistryDef(def)
      }).catch(() => {})
    }
  }, [isAgent, presetConfig, terminal.agentPreset])

  const agentConfig = presetConfig || (registryDef ? { id: registryDef.id, name: registryDef.name, icon: registryDef.icon, color: registryDef.color } : null)

  useEffect(() => {
    setupGlobalListener()

    // Subscribe to cache updates for this terminal (event-driven, no polling)
    const unsubscribePreview = subscribeToPreview(terminal.id, () => {
      setPreview(previewCache.get(terminal.id) || '')
    })

    // Subscribe to settings changes for font updates
    const unsubscribeSettings = settingsStore.subscribe(() => {
      setFontFamily(settingsStore.getFontFamilyString())
    })

    return () => {
      unsubscribePreview()
      unsubscribeSettings()
    }
  }, [terminal.id])

  return (
    <div
      className={`thumbnail ${isActive ? 'active' : ''} ${isAgent ? 'agent-terminal' : ''}`}
      onClick={onClick}
      style={agentConfig ? { '--agent-color': agentConfig.color } as React.CSSProperties : undefined}
    >
      <div className="thumbnail-header">
        <div className={`thumbnail-title ${isAgent ? 'agent-terminal' : ''}`}>
          {isAgent && <span>{agentConfig?.icon}</span>}
          <span>{terminal.title}</span>
        </div>
        <ActivityIndicator terminalId={terminal.id} size="small" />
      </div>
      <div className="thumbnail-preview" style={{ fontFamily }}>
        {preview || (isAgent ? '' : '$ _')}
      </div>
    </div>
  )
})
