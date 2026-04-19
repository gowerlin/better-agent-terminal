// BUG-048 Option B — eager-installed pending reveal buffer.
// Dispatchers call `window.dispatchEvent('file-tree-reveal')` synchronously from click handlers.
// When FileTree is lazy and not yet mounted the event is lost; this module keeps the latest
// requested path so FileTree can replay it on mount.
//
// Must be imported eagerly (non-lazy) so the listener is installed before any dispatch.

let pendingReveal: string | null = null

if (typeof window !== 'undefined') {
  window.addEventListener('file-tree-reveal', (e: Event) => {
    const detail = (e as CustomEvent).detail as { path?: unknown } | null
    if (detail && typeof detail.path === 'string') {
      pendingReveal = detail.path
    }
  })
}

export function consumePendingReveal(): string | null {
  const p = pendingReveal
  pendingReveal = null
  return p
}

export function clearPendingReveal(): void {
  pendingReveal = null
}
