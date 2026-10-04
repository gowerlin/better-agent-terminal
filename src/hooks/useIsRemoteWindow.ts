import { useEffect, useState } from 'react'

/**
 * T0438 (BUG-105): whether this window is bound to a remote profile (WSL / Docker / SSH /
 * legacy remote). Reads the window's binding (`app:get-window-profile`; a detached workspace
 * window reports its parent's, T0446) and the LOCAL profile list (`profile:list-local`), so
 * the answer does not depend on the remote connection being up (T0443).
 *
 * The binding of a window does not change while it is open, so the answer is cached per
 * renderer. Any failure → false (the window keeps its local UI).
 */
let cached: Promise<boolean> | null = null

async function detectRemoteWindow(): Promise<boolean> {
  try {
    const profileId = await window.electronAPI.app.getWindowProfile()
    if (!profileId) return false
    const { profiles } = await window.electronAPI.profile.listLocal()
    return profiles.find(p => p.id === profileId)?.type === 'remote'
  } catch (err) {
    window.electronAPI.debug?.log?.('[remote-window] detection failed:', err instanceof Error ? err.message : String(err))
    return false
  }
}

export function isRemoteWindow(): Promise<boolean> {
  if (!cached) cached = detectRemoteWindow()
  return cached
}

/** Test-only: forget the cached answer. */
export function resetRemoteWindowCache(): void {
  cached = null
}

export function useIsRemoteWindow(): boolean {
  const [remote, setRemote] = useState(false)
  useEffect(() => {
    let alive = true
    isRemoteWindow().then(value => { if (alive) setRemote(value) })
    return () => { alive = false }
  }, [])
  return remote
}
