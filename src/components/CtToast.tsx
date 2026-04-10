import { useState, useEffect, useCallback } from 'react'

export interface ToastMessage {
  id: string
  text: string
  type: 'success' | 'info' | 'warning'
  duration?: number
}

interface CtToastProps {
  messages: ToastMessage[]
  onDismiss: (id: string) => void
}

export function CtToast({ messages, onDismiss }: CtToastProps) {
  if (messages.length === 0) return null

  return (
    <div className="ct-toast-container">
      {messages.map(msg => (
        <ToastItem key={msg.id} message={msg} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

function ToastItem({ message, onDismiss }: { message: ToastMessage; onDismiss: (id: string) => void }) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const duration = message.duration ?? 5000
    const fadeTimer = setTimeout(() => setFading(true), duration - 300)
    const dismissTimer = setTimeout(() => onDismiss(message.id), duration)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(dismissTimer)
    }
  }, [message.id, message.duration, onDismiss])

  return (
    <div className={`ct-toast ct-toast-${message.type}${fading ? ' ct-toast-fade' : ''}`}>
      <span className="ct-toast-text">{message.text}</span>
      <button className="ct-toast-close" onClick={() => onDismiss(message.id)}>×</button>
    </div>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Toast 管理 hook
 */
export function useCtToast() {
  const [messages, setMessages] = useState<ToastMessage[]>([])

  const addToast = useCallback((text: string, type: ToastMessage['type'] = 'info', duration = 5000) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setMessages(prev => [...prev, { id, text, type, duration }])
  }, [])

  const dismissToast = useCallback((id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id))
  }, [])

  return { messages, addToast, dismissToast }
}
