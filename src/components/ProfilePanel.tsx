import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { SetupWizardShell, useDockerWizardController, useSshWizardController, useWslWizardController } from './setup-wizard/SetupWizardShell'
// PLAN-007 T0288 — RFC C-7 ProfileCard + per-env Details slot.
import { ProfileCard, EditRemoteProfileModal, computeRemoteCardStatus, formatRemoteStatusTitle, needsRemoteProbe } from './profiles'
import type { ProfileEntry, RemoteProbeResult, RemoteProfileConnectionSnapshot, TargetOS } from './profiles'
import { AddProfileMenu, type ProfileTypeOption } from './profiles/AddProfileMenu'
import { RemoteToolsEntry } from './profiles/RemoteToolsEntry'
import { ModalOverlay } from './common/ModalOverlay'

// PLAN-007 T0268: targetOS choices for the legacy-remote inline prompt.
const REMOTE_TARGET_OS_OPTIONS: TargetOS[] = ['wsl-linux', 'docker-linux', 'ssh-linux', 'ssh-darwin']

interface RemoteProfileOption {
  id: string
  name: string
  type: string
}

interface ProfilePanelProps {
  onClose: () => void
  onSwitch?: (profileId: string) => void  // deprecated, kept for compat
  onSwitchNewWindow: (profileId: string) => void
  onProfileRenamed?: (profileId: string, newName: string) => void
}

function parseConnectionUrl(input: string): {
  host: string
  port: number
  token: string
  fingerprint: string
} | null {
  try {
    const url = new URL(input.trim())
    const token = url.searchParams.get('token')
    const fingerprint = url.searchParams.get('fp')
    const port = Number(url.port || '9876')
    if (!url.hostname || !token || !fingerprint || Number.isNaN(port)) {
      return null
    }
    return {
      host: url.hostname,
      port,
      token,
      fingerprint,
    }
  } catch {
    return null
  }
}

export function ProfilePanel({ onClose, onSwitchNewWindow, onProfileRenamed }: ProfilePanelProps) {
  const { t } = useTranslation()
  const [profiles, setProfiles] = useState<ProfileEntry[]>([])
  const [activeProfileIds, setActiveProfileIds] = useState<string[]>(['default'])
  const [windowProfileId, setWindowProfileId] = useState<string | null>(null)
  const [creating, setCreating] = useState<'local' | 'remote' | false>(false)
  const [newName, setNewName] = useState('')
  const [remoteHost, setRemoteHost] = useState('')
  const [remotePort, setRemotePort] = useState('9876')
  const [remoteToken, setRemoteToken] = useState('')
  const [remoteFingerprint, setRemoteFingerprint] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editingRemoteId, setEditingRemoteId] = useState<string | null>(null)
  const [editRemoteHost, setEditRemoteHost] = useState('')
  const [editRemotePort, setEditRemotePort] = useState('')
  const [editRemoteToken, setEditRemoteToken] = useState('')
  const [editRemoteFingerprint, setEditRemoteFingerprint] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, 'ok' | 'fail' | 'testing'>>({})
  const [remoteProfiles, setRemoteProfiles] = useState<RemoteProfileOption[]>([])
  const [selectedRemoteProfileId, setSelectedRemoteProfileId] = useState<string>('')
  const [fetchingRemoteProfiles, setFetchingRemoteProfiles] = useState(false)
  const [remoteProfileError, setRemoteProfileError] = useState<string>('')
  // For editing existing remote profile's target
  const [editRemoteProfiles, setEditRemoteProfiles] = useState<RemoteProfileOption[]>([])
  const [editSelectedRemoteProfileId, setEditSelectedRemoteProfileId] = useState<string>('')
  const [editFetchingRemoteProfiles, setEditFetchingRemoteProfiles] = useState(false)
  // T0650 (BUG-157): "Pin expected fingerprint" in the edit dialog. The ref tells a pin that
  // finishes late whether its dialog is still the open one.
  const [editPinning, setEditPinning] = useState(false)
  const [editPinError, setEditPinError] = useState('')
  const editingRemoteIdRef = useRef<string | null>(null)
  editingRemoteIdRef.current = editingRemoteId
  const createInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  // T0513 (BUG-123): the remote card's light — this machine's connection / windows per profile,
  // plus a probe of the target for profiles with neither (idle vs connection failed).
  const [connByProfileId, setConnByProfileId] = useState<Record<string, RemoteProfileConnectionSnapshot>>({})
  const [probeByProfileId, setProbeByProfileId] = useState<Record<string, RemoteProbeResult>>({})
  const loadGeneration = useRef(0)
  // PLAN-007 T0288 — RFC C-7: track per-card expansion (auto-expand the card
  // currently being remote-edited so the legacy targetOS prompt remains visible).
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const readConnectionStates = useCallback(async (): Promise<Record<string, RemoteProfileConnectionSnapshot>> => {
    try {
      const list = await window.electronAPI.remote.profileConnectionStates()
      return Object.fromEntries(list.map(c => [c.profileId, c]))
    } catch (err) {
      window.electronAPI.debug?.log?.('[ProfilePanel] remote:profile-connection-states failed', err instanceof Error ? err.message : String(err))
      return {}
    }
  }, [])

  const loadProfiles = useCallback(async () => {
    const generation = ++loadGeneration.current
    const result = await window.electronAPI.profile.listLocal()
    setProfiles(result.profiles)
    setActiveProfileIds(result.activeProfileIds)
    const wpId = await window.electronAPI.app.getWindowProfile()
    setWindowProfileId(wpId)

    const conns = await readConnectionStates()
    if (generation !== loadGeneration.current) return
    setConnByProfileId(conns)

    // T0513 (BUG-123): probe only the remote profiles this machine has nothing to say about
    // (no connection, no window). The target's `profile:list` used to decide the light, but a
    // headless bat-server answers it with an empty stub, so WSL / SSH / Docker cards stayed red.
    // ssh-* profiles are never probed: without their tunnel the address is the server's localhost.
    const probeEntries = result.profiles.filter(p => needsRemoteProbe(p, conns[p.id]))
    const targetMap = new Map<string, { host: string; port: number; token: string; fingerprint: string; profiles: ProfileEntry[] }>()
    for (const p of probeEntries) {
      const key = `${p.remoteHost}|${p.remotePort || 9876}|${p.remoteToken}|${p.remoteFingerprint}`
      const entry = targetMap.get(key)
      if (entry) entry.profiles.push(p)
      else targetMap.set(key, {
        host: p.remoteHost!,
        port: p.remotePort || 9876,
        token: p.remoteToken!,
        fingerprint: p.remoteFingerprint!,
        profiles: [p],
      })
    }
    if (targetMap.size === 0) {
      setProbeByProfileId({})
      return
    }
    const settled = await Promise.allSettled(
      Array.from(targetMap.values()).map(target =>
        window.electronAPI.remote.listProfiles(target.host, target.port, target.token, target.fingerprint),
      ),
    )
    if (generation !== loadGeneration.current) return
    const targets = Array.from(targetMap.values())
    const probes: Record<string, RemoteProbeResult> = {}
    settled.forEach((s, i) => {
      for (const p of targets[i].profiles) {
        if (s.status === 'rejected') {
          probes[p.id] = { ok: false, error: s.reason instanceof Error ? s.reason.message : String(s.reason) }
        } else if ('error' in s.value) {
          probes[p.id] = { ok: false, errorCode: s.value.errorCode, error: s.value.error }
        } else {
          // A full BAT reports which of its own profiles are open there (legacy remote alias);
          // that is the target's state, not this machine's connection — tooltip only.
          probes[p.id] = { ok: true, remoteActive: s.value.activeProfileIds.includes(p.remoteProfileId || 'default') }
        }
      }
    })
    setProbeByProfileId(probes)
  }, [readConnectionStates])

  useEffect(() => {
    loadProfiles()
  }, [loadProfiles])

  // T0513: follow connects / disconnects / idle releases while the dialog is open.
  useEffect(() => {
    const subscribe = window.electronAPI.remote.onProfileConnectionsChanged
    if (typeof subscribe !== 'function') return
    return subscribe(() => {
      void readConnectionStates().then(setConnByProfileId)
    })
  }, [readConnectionStates])

  useEffect(() => {
    if (creating && createInputRef.current) {
      createInputRef.current.focus()
    }
  }, [creating])

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const wslWizard = useWslWizardController(() => {
    void loadProfiles()
  })
  // T0306 — Docker wizard entry, surfaced via AddProfileMenu (group: container).
  const dockerWizard = useDockerWizardController(() => {
    void loadProfiles()
  })
  // T0287 — Phase 4 capstone: SSH wizard entry. Mirrors WSL wizard pattern.
  const sshWizard = useSshWizardController(() => {
    void loadProfiles()
  })

  // Esc (T0567, through ModalOverlay): an inline name edit is cancelled first, then Profiles
  // closes. The delete confirmation and the remote edit modal sit above Profiles and take Esc
  // themselves; a setup wizard on top blocks it, so Profiles stays open and the wizard is not
  // unmounted (= cancelled / rolled back).
  const handleEscape = () => {
    if (creating) { setCreating(false); setNewName('') }
    else if (editingId) { setEditingId(null); setEditValue('') }
    else onClose()
  }

  const fetchRemoteProfileList = async (host: string, port: number, token: string, fingerprint?: string): Promise<{ profiles: RemoteProfileOption[]; fingerprint?: string }> => {
    const result = await window.electronAPI.remote.listProfiles(host, port, token, fingerprint || undefined)
    if ('error' in result) {
      const mismatchFp = result.fingerprint
      const code = result.errorCode
      const err = new Error(result.error)
      ;(err as Error & { errorCode?: string; fingerprint?: string }).errorCode = code
      ;(err as Error & { errorCode?: string; fingerprint?: string }).fingerprint = mismatchFp
      throw err
    }
    return { profiles: result.profiles, fingerprint: result.fingerprint }
  }

  const handleFetchRemoteProfiles = async () => {
    if (!remoteHost.trim() || !remoteToken.trim()) return
    setFetchingRemoteProfiles(true)
    setRemoteProfileError('')
    try {
      const pinned = remoteFingerprint.trim()
      const { profiles, fingerprint: observed } = await fetchRemoteProfileList(
        remoteHost.trim(),
        parseInt(remotePort) || 9876,
        remoteToken.trim(),
        pinned || undefined
      )
      setRemoteProfiles(profiles)
      // TOFU: populate the fingerprint field with the observed value if it was empty
      if (!pinned && observed) {
        setRemoteFingerprint(observed)
      }
      // Auto-select default or first
      const defaultP = profiles.find(p => p.id === 'default') || profiles[0]
      setSelectedRemoteProfileId(defaultP?.id || '')
    } catch (err) {
      setRemoteProfileError(err instanceof Error ? err.message : String(err))
      setRemoteProfiles([])
    } finally {
      setFetchingRemoteProfiles(false)
    }
  }

  const handleCreate = async () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    if (creating === 'remote') {
      if (!remoteHost.trim() || !remoteToken.trim()) return
      if (!selectedRemoteProfileId) return
      await window.electronAPI.profile.create(trimmed, {
        type: 'remote',
        remoteHost: remoteHost.trim(),
        remotePort: parseInt(remotePort) || 9876,
        remoteToken: remoteToken.trim(),
        remoteProfileId: selectedRemoteProfileId,
        remoteFingerprint: remoteFingerprint.trim() || undefined,
      })
    } else {
      await window.electronAPI.profile.create(trimmed)
    }
    setCreating(false)
    setNewName('')
    setRemoteHost('')
    setRemotePort('9876')
    setRemoteToken('')
    setRemoteFingerprint('')
    setRemoteProfiles([])
    setSelectedRemoteProfileId('')
    loadProfiles()
  }

  const handleRename = async (profileId: string) => {
    const trimmed = editValue.trim()
    if (!trimmed) { setEditingId(null); return }
    await window.electronAPI.profile.rename(profileId, trimmed)
    setEditingId(null)
    setEditValue('')
    loadProfiles()
    onProfileRenamed?.(profileId, trimmed)
  }

  const handleStartEditRemote = (profile: ProfileEntry) => {
    setEditingRemoteId(profile.id)
    setEditRemoteHost(profile.remoteHost || '')
    setEditRemotePort(String(profile.remotePort || 9876))
    setEditRemoteToken(profile.remoteToken || '')
    setEditRemoteFingerprint(profile.remoteFingerprint || '')
    setEditRemoteProfiles([])
    setEditSelectedRemoteProfileId(profile.remoteProfileId || '')
    setEditPinning(false)
    setEditPinError('')
  }

  const handleFetchEditRemoteProfiles = async () => {
    if (!editRemoteHost.trim() || !editRemoteToken.trim()) return
    setEditFetchingRemoteProfiles(true)
    try {
      const pinned = editRemoteFingerprint.trim()
      const { profiles, fingerprint: observed } = await fetchRemoteProfileList(
        editRemoteHost.trim(),
        parseInt(editRemotePort) || 9876,
        editRemoteToken.trim(),
        pinned || undefined,
      )
      setEditRemoteProfiles(profiles)
      if (!pinned && observed) {
        setEditRemoteFingerprint(observed)
      }
      // Keep current selection if still valid, else auto-select
      if (!profiles.some(p => p.id === editSelectedRemoteProfileId)) {
        const defaultP = profiles.find(p => p.id === 'default') || profiles[0]
        setEditSelectedRemoteProfileId(defaultP?.id || '')
      }
    } catch {
      setEditRemoteProfiles([])
    } finally {
      setEditFetchingRemoteProfiles(false)
    }
  }

  const handleSaveRemote = async (profileId: string) => {
    const host = editRemoteHost.trim()
    const token = editRemoteToken.trim()
    if (!host || !token) return
    await window.electronAPI.profile.update(profileId, {
      remoteHost: host,
      remotePort: parseInt(editRemotePort) || 9876,
      remoteToken: token,
      remoteProfileId: editSelectedRemoteProfileId || undefined,
      remoteFingerprint: editRemoteFingerprint.trim() || undefined,
    })
    setEditingRemoteId(null)
    setEditRemoteProfiles([])
    loadProfiles()
  }

  // T0650 (BUG-157): the pinned value also goes into the dialog's state, otherwise Save writes the
  // old fingerprint back. A failed pin is shown in the dialog and writes nothing.
  const handlePinFingerprint = async (profile: ProfileEntry) => {
    if (!profile.remoteHost || !profile.remoteToken) return
    const stillEditing = () => editingRemoteIdRef.current === profile.id
    setEditPinning(true)
    setEditPinError('')
    try {
      const result = await window.electronAPI.remote.testConnection(
        profile.remoteHost,
        profile.remotePort || 9876,
        profile.remoteToken,
        undefined // no pinning — just observe current fingerprint
      )
      if (result.ok && result.fingerprint) {
        await window.electronAPI.profile.update(profile.id, {
          remoteFingerprint: result.fingerprint,
        })
        if (stillEditing()) setEditRemoteFingerprint(result.fingerprint)
        loadProfiles()
      } else if (stillEditing()) {
        setEditPinError(formatRemoteStatusTitle(t, { status: 'disconnected', reason: 'probeFailed', errorCode: result.errorCode, detail: result.error }))
      }
    } catch (err) {
      if (stillEditing()) {
        setEditPinError(formatRemoteStatusTitle(t, { status: 'disconnected', reason: 'probeFailed', detail: err instanceof Error ? err.message : String(err) }))
      }
    } finally {
      if (stillEditing()) setEditPinning(false)
    }
  }

  // PLAN-007 T0268: set targetOS on a legacy remote profile from the inline prompt.
  // Non-blocking: user may skip and keep using legacy IdentityTranslator path.
  const handleSetTargetOS = async (profileId: string, targetOS: TargetOS) => {
    await window.electronAPI.profile.update(profileId, { targetOS })
    loadProfiles()
  }

  const handleDelete = async (profileId: string) => {
    await window.electronAPI.profile.delete(profileId)
    setConfirmDelete(null)
    loadProfiles()
  }

  const handleDuplicate = async (profileId: string) => {
    const source = profiles.find(p => p.id === profileId)
    if (!source) return
    await window.electronAPI.profile.duplicate(profileId, `${source.name} (Copy)`)
    loadProfiles()
  }

  const handleTestConnection = useCallback(async (profile: ProfileEntry) => {
    if (!profile.remoteHost || !profile.remoteToken) return
    setTestingId(profile.id)
    setTestResult(prev => ({ ...prev, [profile.id]: 'testing' }))
    try {
      const result = await window.electronAPI.remote.testConnection(
        profile.remoteHost,
        profile.remotePort || 9876,
        profile.remoteToken,
        profile.remoteFingerprint
      )
      setTestResult(prev => ({ ...prev, [profile.id]: result.ok ? 'ok' : 'fail' }))
    } catch {
      setTestResult(prev => ({ ...prev, [profile.id]: 'fail' }))
    } finally {
      setTestingId(null)
    }
  }, [])

  const handleSaveCurrent = async () => {
    if (windowProfileId) {
      await window.electronAPI.profile.save(windowProfileId)
      loadProfiles()
    }
  }

  const handleSwitchRequest = (profileId: string) => {
    if (profileId === windowProfileId) return
    onSwitchNewWindow(profileId)
  }

  return (
    <ModalOverlay className="settings-overlay" onEscape={handleEscape}>
      <div className="settings-panel profile-panel" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>{t('profiles.title')}</h2>
          <button className="settings-close" onClick={onClose}>&times;</button>
        </div>
        <div className="settings-body" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            <button className="profile-action-btn" onClick={handleSaveCurrent} title={t('profiles.saveCurrent')}>
              {t('profiles.saveCurrent')}
            </button>
            <button className="profile-action-btn" onClick={() => { setCreating('local'); setNewName('') }}>
              {t('profiles.addLocal')}
            </button>
            <button className="profile-action-btn" onClick={() => { setCreating('remote'); setNewName('') }}>
              {t('profiles.addRemote')}
            </button>
            <AddProfileMenu
              options={[
                {
                  id: 'wsl',
                  section: 'container',
                  icon: '🐧',
                  label: t('profiles.addWslProfile'),
                  suggested: true,
                  onClick: () => wslWizard.open(''),
                },
                {
                  id: 'docker',
                  section: 'container',
                  icon: '🐳',
                  label: t('profiles.addDockerProfile'),
                  onClick: () => dockerWizard.open(''),
                },
                {
                  id: 'ssh',
                  section: 'remote',
                  icon: '🔐',
                  label: t('profiles.addSshProfile'),
                  onClick: () => sshWizard.open(''),
                },
              ] satisfies ProfileTypeOption[]}
            />
          </div>

          {creating && (
            <div className="profile-create-row" style={{ flexDirection: 'column', gap: 8 }}>
              <input
                ref={createInputRef}
                type="text"
                className="profile-name-input"
                placeholder={t('profiles.profileNamePlaceholder')}
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && creating === 'local') handleCreate()
                  if (e.key === 'Escape') { setCreating(false); setNewName('') }
                }}
              />
              {creating === 'remote' && (
                <>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      className="profile-name-input"
                      placeholder={t('profiles.hostPlaceholder')}
                      value={remoteHost}
                      onChange={e => { setRemoteHost(e.target.value); setRemoteProfiles([]); setSelectedRemoteProfileId('') }}
                      style={{ flex: '1 1 120px' }}
                    />
                    <input
                      type="number"
                      className="profile-name-input"
                      placeholder={t('profiles.portPlaceholder')}
                      value={remotePort}
                      onChange={e => { setRemotePort(e.target.value); setRemoteProfiles([]); setSelectedRemoteProfileId('') }}
                      style={{ width: 70 }}
                    />
                    <input
                      type="text"
                      className="profile-name-input"
                      placeholder={t('profiles.tokenPlaceholder')}
                      value={remoteToken}
                      onChange={e => { setRemoteToken(e.target.value); setRemoteProfiles([]); setSelectedRemoteProfileId('') }}
                      style={{ flex: '1 1 160px' }}
                    />
                  </div>
                  <input
                    type="text"
                    className="profile-name-input"
                    placeholder={t('profiles.fingerprint.expectedPlaceholder')}
                    value={remoteFingerprint}
                    onChange={e => setRemoteFingerprint(e.target.value)}
                    readOnly
                    title={t('profiles.fingerprint.expectedTitle', { fetch: t('profiles.fetchProfiles'), pin: t('profiles.fingerprint.pin') })}
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: 11, opacity: 0.8 }}
                  />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      className="profile-action-btn"
                      onClick={handleFetchRemoteProfiles}
                      disabled={fetchingRemoteProfiles || !remoteHost.trim() || !remoteToken.trim()}
                    >
                      {fetchingRemoteProfiles ? t('profiles.fetchingProfiles') : t('profiles.fetchProfiles')}
                    </button>
                    {remoteProfileError && (
                      <span style={{ color: '#e5534b', fontSize: 12 }}>{remoteProfileError}</span>
                    )}
                  </div>
                  {remoteProfiles.length > 0 && (
                    <select
                      className="profile-name-input"
                      value={selectedRemoteProfileId}
                      onChange={e => setSelectedRemoteProfileId(e.target.value)}
                      style={{ width: '100%' }}
                    >
                      {remoteProfiles.map(rp => (
                        <option key={rp.id} value={rp.id}>
                          {rp.name} {rp.type === 'remote' ? `(${t('profiles.remote')})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="profile-action-btn"
                  onClick={handleCreate}
                  disabled={creating === 'remote' && !selectedRemoteProfileId}
                >
                  {t('common.create')}
                </button>
                <button className="profile-action-btn" onClick={() => { setCreating(false); setNewName(''); setRemoteProfiles([]); setSelectedRemoteProfileId('') }}>{t('common.cancel')}</button>
              </div>
            </div>
          )}

          {(() => {
            const localList = profiles.filter(p => p.type !== 'remote')
            const remoteList = profiles.filter(p => p.type === 'remote')
            const remoteStatusOf = (p: ProfileEntry) =>
              computeRemoteCardStatus({ profile: p, conn: connByProfileId[p.id], probe: probeByProfileId[p.id] })

            // PLAN-007 T0288 — RFC C-7: render each row via <ProfileCard>. The
            // legacy targetOS prompt rides into expandedExtras; rename input
            // overrides the header; remote-edit moves to a modal (see below).
            const renderCard = (profile: ProfileEntry) => {
              const remoteStatus = profile.type === 'remote' ? remoteStatusOf(profile) : null
              const isRunning = remoteStatus ? remoteStatus.status === 'connected' : activeProfileIds.includes(profile.id)
              const isActive = profile.id === windowProfileId
              const isExpanded = expandedIds.has(profile.id) || editingRemoteId === profile.id
              const headerOverride = editingId === profile.id ? (
                <input
                  ref={editInputRef}
                  type="text"
                  className="profile-name-input"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => handleRename(profile.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRename(profile.id)
                    if (e.key === 'Escape') { setEditingId(null); setEditValue('') }
                  }}
                  onClick={e => e.stopPropagation()}
                />
              ) : undefined
              const legacyTargetOsPrompt = profile.type === 'remote' && profile.targetOS === undefined ? (
                <div
                  data-testid="legacy-remote-targetos-prompt"
                  className="profile-card-legacy-prompt"
                  style={{
                    padding: '8px 10px',
                    marginBottom: 6,
                    background: 'rgba(210, 153, 34, 0.12)',
                    border: '1px solid rgba(210, 153, 34, 0.5)',
                    borderRadius: 4,
                    fontSize: 12,
                    color: '#d29922',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <span style={{ flex: '1 1 auto' }}>
                    ⚠ {t('profiles.legacyTargetOsPrompt')}
                  </span>
                  <select
                    className="profile-name-input"
                    defaultValue=""
                    onChange={e => {
                      const v = e.target.value as TargetOS | ''
                      if (v) handleSetTargetOS(profile.id, v)
                    }}
                    style={{ width: 160, fontSize: 12 }}
                  >
                    <option value="" disabled>{t('profiles.selectTargetOs')}</option>
                    {REMOTE_TARGET_OS_OPTIONS.map(os => (
                      <option key={os} value={os}>{os}</option>
                    ))}
                  </select>
                </div>
              ) : undefined
              // T0413 (PLAN-037 F): expandedExtras only mounts while the card is expanded,
              // so the remote tools probe runs on expand, never for the whole list.
              const expandedExtras = profile.type === 'remote' ? (
                <>
                  {legacyTargetOsPrompt}
                  <div style={{ marginBottom: 6 }}>
                    <RemoteToolsEntry profileId={profile.id} host="profile" />
                  </div>
                </>
              ) : undefined
              const inlineActions = (
                <>
                  {profile.type === 'remote' && (
                    <button
                      className={`profile-icon-btn ${testResult[profile.id] === 'ok' ? 'success' : testResult[profile.id] === 'fail' ? 'danger' : ''}`}
                      title={testResult[profile.id] === 'ok' ? t('profiles.connected') : testResult[profile.id] === 'fail' ? t('profiles.connectionFailed') : t('profiles.testConnection')}
                      onClick={() => handleTestConnection(profile)}
                      disabled={testingId === profile.id}
                    >
                      {testingId === profile.id ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spin">
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          {testResult[profile.id] === 'ok' && <polyline points="22 4 12 14.01 9 11.01" />}
                          {testResult[profile.id] === 'fail' && <><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>}
                        </svg>
                      )}
                    </button>
                  )}
                  {profile.type === 'remote' && (
                    <button
                      className="profile-icon-btn"
                      title={t('profiles.editConnection')}
                      onClick={() => handleStartEditRemote(profile)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                    </button>
                  )}
                  <button
                    className="profile-icon-btn"
                    title={t('profiles.duplicate')}
                    onClick={() => handleDuplicate(profile.id)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                </>
              )
              return (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  isActive={isActive}
                  isRunning={isRunning}
                  connectionStatus={remoteStatus?.status}
                  connectionStatusTitle={remoteStatus ? formatRemoteStatusTitle(t, remoteStatus) : undefined}
                  isExpanded={isExpanded}
                  onToggleExpand={() => toggleExpanded(profile.id)}
                  onSwitch={() => handleSwitchRequest(profile.id)}
                  onEdit={() => { setEditingId(profile.id); setEditValue(profile.name) }}
                  onDelete={profile.id !== 'default' ? () => setConfirmDelete(profile.id) : undefined}
                  actions={inlineActions}
                  expandedExtras={expandedExtras}
                  headerOverride={headerOverride}
                />
              )
            }
            return (
              <div className="profile-list">
                <div className="profile-section-header">{t('profiles.localSection')}</div>
                {localList.map(renderCard)}
                {remoteList.length > 0 && (
                  <>
                    <div className="profile-section-header">{t('profiles.remoteSection')}</div>
                    {remoteList.map(renderCard)}
                  </>
                )}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <ModalOverlay className="settings-overlay" style={{ zIndex: 1001 }} onEscape={() => setConfirmDelete(null)}>
          <div className="settings-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: 360, padding: 20 }}>
            <h3 style={{ margin: '0 0 12px', color: '#e5534b' }}>{t('profiles.deleteProfile')}</h3>
            <p style={{ margin: '0 0 16px', color: '#aaa' }}>
              {t('profiles.deleteConfirm', { name: profiles.find(p => p.id === confirmDelete)?.name })}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="profile-action-btn" onClick={() => setConfirmDelete(null)}>{t('common.cancel')}</button>
              <button className="profile-action-btn danger" onClick={() => handleDelete(confirmDelete)}>{t('common.delete')}</button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* PLAN-007 T0288 — RFC C-7: remote-edit moved out of the inline row into a dedicated modal. */}
      {editingRemoteId && (() => {
        const profile = profiles.find(p => p.id === editingRemoteId)
        if (!profile) return null
        const closeModal = () => { setEditingRemoteId(null); setEditRemoteProfiles([]); setEditPinning(false); setEditPinError('') }
        return (
          <EditRemoteProfileModal
            profile={profile}
            host={editRemoteHost}
            port={editRemotePort}
            token={editRemoteToken}
            fingerprint={editRemoteFingerprint}
            selectedRemoteProfileId={editSelectedRemoteProfileId}
            remoteProfiles={editRemoteProfiles}
            fetching={editFetchingRemoteProfiles}
            pinning={editPinning}
            pinError={editPinError}
            setHost={setEditRemoteHost}
            setPort={setEditRemotePort}
            setToken={setEditRemoteToken}
            setFingerprint={setEditRemoteFingerprint}
            setSelectedRemoteProfileId={setEditSelectedRemoteProfileId}
            setRemoteProfiles={setEditRemoteProfiles}
            parseConnectionUrl={parseConnectionUrl}
            onFetch={handleFetchEditRemoteProfiles}
            onPin={() => handlePinFingerprint(profile)}
            onSave={() => handleSaveRemote(profile.id)}
            onClose={closeModal}
          />
        )
      })()}

      {wslWizard.isOpen && wslWizard.ctx && (
        <ModalOverlay className="settings-overlay" style={{ zIndex: 1002 }}>
          <div className="settings-panel" onClick={e => e.stopPropagation()} style={{ width: 'min(1040px, 90vw)', maxWidth: 'min(1040px, 90vw)' }}>
            <div className="settings-header">
              <h2>{t('profiles.addWslProfile')}</h2>
              <button className="settings-close" onClick={wslWizard.close}>&times;</button>
            </div>
            <div className="settings-body" style={{ padding: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <SetupWizardShell
                key={wslWizard.key}
                ctx={wslWizard.ctx}
                onComplete={wslWizard.handleComplete}
                steps={wslWizard.steps}
              />
            </div>
          </div>
        </ModalOverlay>
      )}

      {dockerWizard.isOpen && dockerWizard.ctx && (
        <ModalOverlay className="settings-overlay" style={{ zIndex: 1002 }}>
          <div className="settings-panel" onClick={e => e.stopPropagation()} style={{ width: 'min(1040px, 90vw)', maxWidth: 'min(1040px, 90vw)' }}>
            <div className="settings-header">
              <h2>{t('profiles.addDockerProfile')}</h2>
              <button className="settings-close" onClick={dockerWizard.close}>&times;</button>
            </div>
            <div className="settings-body" style={{ padding: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <SetupWizardShell
                key={dockerWizard.key}
                ctx={dockerWizard.ctx}
                onComplete={dockerWizard.handleComplete}
                steps={dockerWizard.steps}
              />
            </div>
          </div>
        </ModalOverlay>
      )}

      {sshWizard.isOpen && sshWizard.ctx && (
        <ModalOverlay className="settings-overlay" style={{ zIndex: 1002 }}>
          <div className="settings-panel" onClick={e => e.stopPropagation()} style={{ width: 'min(1040px, 90vw)', maxWidth: 'min(1040px, 90vw)' }}>
            <div className="settings-header">
              <h2>{t('profiles.addSshProfile')}</h2>
              <button className="settings-close" onClick={sshWizard.close}>&times;</button>
            </div>
            <div className="settings-body" style={{ padding: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <SetupWizardShell
                key={sshWizard.key}
                ctx={sshWizard.ctx}
                onComplete={sshWizard.handleComplete}
                steps={sshWizard.steps}
              />
            </div>
          </div>
        </ModalOverlay>
      )}

    </ModalOverlay>
  )
}
