import type { Terminal, IMarker, IDecoration, IDecorationOptions } from '@xterm/xterm'

const dlog = (...args: unknown[]) =>
  (window as any).electronAPI?.debug?.log(...args)

interface ManagedDecoration {
  marker: IMarker
  decoration: IDecoration | undefined
  onRenderCallback?: (element: HTMLElement) => void
  disposed: boolean
}

export class TerminalDecorationManager {
  private terminal: Terminal | null = null
  private decorations: Map<string, ManagedDecoration> = new Map()
  private disposables: Array<{ dispose(): void }> = []

  /**
   * Attach to a terminal instance. Call once after terminal is created.
   */
  attach(terminal: Terminal): void {
    this.terminal = terminal
    dlog('[decoration-manager] attached')
  }

  /**
   * Create a marker at the current cursor position (normal buffer only).
   * Returns the marker, or null if terminal is not attached.
   */
  addMarker(id: string, cursorYOffset = 0): IMarker | null {
    if (!this.terminal) return null
    const marker = this.terminal.registerMarker(cursorYOffset)
    if (!marker) return null

    this.decorations.set(id, {
      marker,
      decoration: undefined,
      disposed: false
    })

    marker.onDispose(() => {
      const entry = this.decorations.get(id)
      if (entry) entry.disposed = true
    })

    return marker
  }

  /**
   * Register a decoration anchored to an existing marker.
   * Returns the decoration or undefined if alt buffer is active or marker is disposed.
   *
   * @param id - Unique ID matching a previously added marker
   * @param options - Partial decoration options (marker is auto-filled)
   * @param onRender - Callback when the decoration's DOM element is created/updated
   */
  addDecoration(
    id: string,
    options?: Partial<Omit<IDecorationOptions, 'marker'>>,
    onRender?: (element: HTMLElement) => void
  ): IDecoration | undefined {
    if (!this.terminal) return undefined
    const entry = this.decorations.get(id)
    if (!entry || entry.disposed) return undefined

    const decoration = this.terminal.registerDecoration({
      marker: entry.marker,
      ...options
    })

    if (decoration) {
      entry.decoration = decoration
      entry.onRenderCallback = onRender

      if (onRender) {
        const renderDisposable = decoration.onRender((element) => {
          onRender(element)
        })
        this.disposables.push(renderDisposable)
      }

      decoration.onDispose(() => {
        entry.decoration = undefined
      })
    } else {
      dlog('[decoration-manager] registerDecoration returned undefined (alt buffer active?)', id)
    }

    return decoration
  }

  /**
   * Remove a specific marker and its decoration by ID.
   */
  remove(id: string): void {
    const entry = this.decorations.get(id)
    if (!entry) return
    entry.decoration?.dispose()
    entry.marker.dispose()
    this.decorations.delete(id)
  }

  /**
   * Remove all managed decorations and markers.
   */
  removeAll(): void {
    for (const [id] of this.decorations) {
      this.remove(id)
    }
  }

  /**
   * Get a managed decoration entry by ID.
   */
  get(id: string): ManagedDecoration | undefined {
    return this.decorations.get(id)
  }

  /**
   * Count of currently registered decorations.
   */
  get count(): number {
    return this.decorations.size
  }

  /**
   * Full cleanup — call when terminal is disposed.
   */
  dispose(): void {
    this.removeAll()
    for (const d of this.disposables) d.dispose()
    this.disposables = []
    this.terminal = null
    dlog('[decoration-manager] disposed')
  }
}
