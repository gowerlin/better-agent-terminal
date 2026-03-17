import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/base.css'
import './styles/layout.css'
import './styles/panels.css'
import './styles/settings.css'
import './styles/context-menu.css'
import './styles/notifications.css'
import './styles/env-snippets.css'
import './styles/resize.css'
import './styles/file-browser.css'
import './styles/path-linker.css'
import './styles/prompt-box.css'
import './styles/claude-agent.css'

const dlog = (...args: unknown[]) => window.electronAPI?.debug?.log(...args)
const t0 = (window as unknown as { __t0?: number }).__t0 || Date.now()
dlog(`[startup] ── renderer ──────────────────────────────`)
dlog(`[startup] main.tsx top-level: +${Date.now() - t0}ms from HTML <script>`)

// Hide splash, show React root
const splash = document.getElementById('splash')
const root = document.getElementById('root')!
if (splash) splash.style.display = 'none'
root.style.display = ''

dlog(`[startup] before createRoot: +${Date.now() - t0}ms`)

ReactDOM.createRoot(root).render(<App />)

dlog(`[startup] after render() queued: +${Date.now() - t0}ms`)

// Track first paint after React mounts
requestAnimationFrame(() => {
  dlog(`[startup] first rAF (React painted): +${Date.now() - t0}ms from HTML`)
})
