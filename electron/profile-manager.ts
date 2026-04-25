import { app } from 'electron'
import path from 'path'
import * as fs from 'fs/promises'
import type { WindowRegistry } from './window-registry'
import { logger } from './logger'

/**
 * Discriminator for which OS the profile targets. Drives translator selection
 * and metadata interpretation in PathTranslator (T0269+).
 *
 * - 'local'        — local machine, no translation
 * - 'wsl-linux'    — WSL distro on Windows host
 * - 'docker-linux' — Linux container on local/remote Docker daemon
 * - 'ssh-linux'    — Linux machine reached via SSH tunnel
 * - 'ssh-darwin'   — macOS machine reached via SSH tunnel
 *
 * `undefined` means a legacy profile (BAT remote pre-PLAN-007) — keeps using
 * IdentityTranslator for backward compatibility.
 */
export type TargetOS = 'local' | 'wsl-linux' | 'docker-linux' | 'ssh-linux' | 'ssh-darwin'

export interface ProfileEntry {
  id: string
  name: string
  type: 'local' | 'remote'
  remoteHost?: string
  remotePort?: number
  remoteToken?: string
  remoteProfileId?: string  // which profile to load on the remote server
  remoteFingerprint?: string  // pinned SHA-256 cert fingerprint (TOFU)
  createdAt: number
  updatedAt: number
  // PLAN-007 T0268: targetOS schema (flat — see spec doc §2.1).
  // All optional so legacy profiles load unchanged.
  targetOS?: TargetOS
  // per-OS metadata (interpretation depends on targetOS)
  wslDistro?: string
  dockerContainer?: string
  dockerHost?: string
  sshHost?: string
  sshUser?: string
  sshPort?: number
  sshKeyPath?: string
  useSshTunnel?: boolean      // ssh-* default true at use-site
  tunnelLocalPort?: number    // ssh-* dynamic port at use-site; schema slot only
}

/**
 * Discriminated union view of a ProfileEntry, narrowed by targetOS.
 * Returned by extractTargetOSMeta() for downstream consumers (translator
 * registry, wizard, UI) to switch on without touching irrelevant flat fields.
 */
export type TargetOSMetadata =
  | { targetOS: 'local' }
  | { targetOS: 'wsl-linux'; wslDistro: string }
  | { targetOS: 'docker-linux'; dockerContainer: string; dockerHost?: string }
  | {
      targetOS: 'ssh-linux' | 'ssh-darwin'
      sshHost: string
      sshUser: string
      sshPort?: number
      sshKeyPath?: string
      useSshTunnel?: boolean
      tunnelLocalPort?: number
    }
  | { targetOS: undefined }   // legacy remote profile (pre-PLAN-007)

/**
 * Project a flat ProfileEntry into a typed metadata view.
 * Pure function; does not validate flat fields are present (caller should
 * surface errors at use-site, not here).
 */
export function extractTargetOSMeta(entry: ProfileEntry): TargetOSMetadata {
  switch (entry.targetOS) {
    case 'local':
      return { targetOS: 'local' }
    case 'wsl-linux':
      return { targetOS: 'wsl-linux', wslDistro: entry.wslDistro ?? '' }
    case 'docker-linux':
      return {
        targetOS: 'docker-linux',
        dockerContainer: entry.dockerContainer ?? '',
        dockerHost: entry.dockerHost,
      }
    case 'ssh-linux':
    case 'ssh-darwin':
      return {
        targetOS: entry.targetOS,
        sshHost: entry.sshHost ?? '',
        sshUser: entry.sshUser ?? '',
        sshPort: entry.sshPort,
        sshKeyPath: entry.sshKeyPath,
        useSshTunnel: entry.useSshTunnel,
        tunnelLocalPort: entry.tunnelLocalPort,
      }
    case undefined:
    default:
      return { targetOS: undefined }
  }
}

/**
 * Passive migration (PLAN-007 spec §6 C-2):
 *   - local profile without targetOS → auto-set to 'local' (DOES NOT touch updatedAt)
 *   - remote profile without targetOS → leave undefined (legacy IdentityTranslator path)
 *   - any profile with targetOS already set → no change (idempotent)
 *
 * Runs at load time only; never persisted automatically. Disk shape stays
 * identical until user explicitly edits the profile.
 */
export function migrateProfile(entry: ProfileEntry): ProfileEntry {
  if (entry.targetOS !== undefined) return entry
  if (entry.type === 'local') {
    return { ...entry, targetOS: 'local' }
  }
  // remote without targetOS → leave alone (legacy)
  return entry
}

export interface ProfileIndex {
  profiles: ProfileEntry[]
  activeProfileIds: string[]
  activeProfileId?: string // legacy — migrated to activeProfileIds on read
}

// V1 snapshot (legacy — single window)
export interface ProfileSnapshotV1 {
  id: string
  name: string
  version: 1
  workspaces: unknown[]
  activeWorkspaceId: string | null
  activeGroup: string | null
  terminals?: unknown[]
  activeTerminalId?: string | null
}

// Per-window state within a profile
export interface ProfileWindowSnapshot {
  workspaces: unknown[]
  activeWorkspaceId: string | null
  activeGroup: string | null
  terminals: unknown[]
  activeTerminalId: string | null
  bounds?: { x: number; y: number; width: number; height: number }
}

// V2 snapshot — profile as a set of windows
export interface ProfileSnapshot {
  id: string
  name: string
  version: 2
  windows: ProfileWindowSnapshot[]
}

function getProfilesDir(): string {
  return path.join(app.getPath('userData'), 'profiles')
}

function getIndexPath(): string {
  return path.join(getProfilesDir(), 'index.json')
}

function getProfilePath(id: string): string {
  return path.join(getProfilesDir(), `${id}.json`)
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '') || 'profile'
}

async function ensureDir(): Promise<void> {
  await fs.mkdir(getProfilesDir(), { recursive: true })
}

function normalizeIndex(raw: Record<string, unknown>): ProfileIndex {
  // Migrate legacy activeProfileId → activeProfileIds
  if (!raw.activeProfileIds && raw.activeProfileId) {
    raw.activeProfileIds = [raw.activeProfileId]
    delete raw.activeProfileId
  }
  if (!raw.activeProfileIds) {
    raw.activeProfileIds = ['default']
  }
  if (!Array.isArray(raw.profiles)) {
    throw new Error('malformed profile index: "profiles" must be an array')
  }
  // PLAN-007 T0268 passive migration — apply at load only, never persist.
  const index = raw as unknown as ProfileIndex
  index.profiles = index.profiles.map(migrateProfile)
  return index
}

async function readIndexFile(filePath: string): Promise<ProfileIndex | null> {
  let data: string
  try {
    data = await fs.readFile(filePath, 'utf-8')
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'ENOENT') return null
    throw new Error(`Failed to read profile index at ${filePath}: ${e.message}`)
  }
  return normalizeIndex(JSON.parse(data))
}

/**
 * Returns the parsed profile index, or null if no file exists (first run).
 * Never returns an empty-profiles placeholder, because that placeholder used
 * to trigger ensureInitialized() to overwrite the real index on any read hiccup.
 * On corruption, tries the .bak fallback before throwing — never silently drops data.
 */
async function readIndex(): Promise<ProfileIndex | null> {
  const indexPath = getIndexPath()
  try {
    return await readIndexFile(indexPath)
  } catch (err) {
    const bakPath = `${indexPath}.bak`
    logger.error(`[profile] index.json unreadable, trying ${bakPath}:`, err instanceof Error ? err.message : String(err))
    try {
      const fromBackup = await readIndexFile(bakPath)
      if (fromBackup) {
        logger.log(`[profile] recovered index from ${bakPath} (${fromBackup.profiles.length} profile(s))`)
        return fromBackup
      }
    } catch (bakErr) {
      logger.error(`[profile] backup index also unreadable:`, bakErr instanceof Error ? bakErr.message : String(bakErr))
    }
    // Preserve the corrupt file so user can recover manually — never silently overwrite.
    const quarantine = `${indexPath}.corrupt.${Date.now()}`
    try {
      await fs.copyFile(indexPath, quarantine)
      logger.error(`[profile] quarantined corrupt index at ${quarantine}`)
    } catch { /* best effort */ }
    throw err
  }
}

async function writeIndex(index: ProfileIndex): Promise<void> {
  await ensureDir()
  const indexPath = getIndexPath()
  const tmpPath = `${indexPath}.tmp`
  const bakPath = `${indexPath}.bak`

  // Rotate last good file into .bak before clobbering (only if current file parses).
  // Prevents a corrupt write followed by readIndex seeing neither a valid index nor a valid backup.
  try {
    await readIndexFile(indexPath)
    await fs.copyFile(indexPath, bakPath)
  } catch { /* no existing file, or unreadable — skip backup */ }

  // Atomic write: write to temp, then rename. Crash mid-write leaves old file intact.
  await fs.writeFile(tmpPath, JSON.stringify(index, null, 2), 'utf-8')
  await fs.rename(tmpPath, indexPath)
}

function migrateSnapshot(raw: ProfileSnapshotV1 | ProfileSnapshot): ProfileSnapshot {
  if ('version' in raw && raw.version === 2) return raw as ProfileSnapshot
  // V1 → V2: wrap flat fields into a single-element windows array
  const v1 = raw as ProfileSnapshotV1
  return {
    id: v1.id,
    name: v1.name,
    version: 2,
    windows: [{
      workspaces: v1.workspaces,
      activeWorkspaceId: v1.activeWorkspaceId,
      activeGroup: v1.activeGroup,
      terminals: v1.terminals || [],
      activeTerminalId: v1.activeTerminalId || null,
    }],
  }
}

async function readSnapshot(id: string): Promise<ProfileSnapshot | null> {
  try {
    const data = await fs.readFile(getProfilePath(id), 'utf-8')
    const raw = JSON.parse(data)
    return migrateSnapshot(raw)
  } catch {
    return null
  }
}

async function writeSnapshot(snapshot: ProfileSnapshot): Promise<void> {
  await ensureDir()
  await fs.writeFile(getProfilePath(snapshot.id), JSON.stringify(snapshot, null, 2), 'utf-8')
}

// Initialize on first use: create default profile from current workspaces.json.
// Only runs when index.json is genuinely missing — NEVER overwrites an existing index,
// even one that parses to an empty profile list, since that would destroy user data
// on any transient read issue.
async function ensureInitialized(): Promise<ProfileIndex> {
  const existing = await readIndex()
  if (existing) return existing

  // First time: create default profile from existing workspaces
  const now = Date.now()
  const defaultEntry: ProfileEntry = {
    id: 'default',
    name: 'Default',
    type: 'local',
    createdAt: now,
    updatedAt: now,
  }

  // Read current workspaces.json to seed the default profile
  let workspacesData: { workspaces: unknown[]; activeWorkspaceId: string | null; activeGroup: string | null; terminals?: unknown[]; activeTerminalId?: string | null } = {
    workspaces: [],
    activeWorkspaceId: null,
    activeGroup: null,
    terminals: [],
    activeTerminalId: null,
  }
  try {
    const raw = await fs.readFile(path.join(app.getPath('userData'), 'workspaces.json'), 'utf-8')
    const parsed = JSON.parse(raw)
    workspacesData = {
      workspaces: parsed.workspaces || [],
      activeWorkspaceId: parsed.activeWorkspaceId || null,
      activeGroup: parsed.activeGroup || null,
      terminals: parsed.terminals || [],
      activeTerminalId: parsed.activeTerminalId || null,
    }
  } catch { /* no existing workspaces */ }

  const snapshot: ProfileSnapshot = {
    id: 'default',
    name: 'Default',
    version: 2,
    windows: [{
      workspaces: workspacesData.workspaces,
      activeWorkspaceId: workspacesData.activeWorkspaceId,
      activeGroup: workspacesData.activeGroup,
      terminals: workspacesData.terminals || [],
      activeTerminalId: workspacesData.activeTerminalId || null,
    }],
  }

  const newIndex: ProfileIndex = {
    profiles: [defaultEntry],
    activeProfileIds: ['default'],
  }

  await writeSnapshot(snapshot)
  await writeIndex(newIndex)
  return newIndex
}

export class ProfileManager {
  private windowRegistry: WindowRegistry | null = null

  setWindowRegistry(registry: WindowRegistry): void {
    this.windowRegistry = registry
  }

  async list(): Promise<{ profiles: ProfileEntry[]; activeProfileIds: string[] }> {
    const index = await ensureInitialized()
    return { profiles: index.profiles, activeProfileIds: index.activeProfileIds }
  }

  async create(name: string, options?: { type?: 'local' | 'remote'; remoteHost?: string; remotePort?: number; remoteToken?: string; remoteProfileId?: string; remoteFingerprint?: string }): Promise<ProfileEntry> {
    const index = await ensureInitialized()
    let id = toSlug(name)
    // Ensure unique ID
    if (index.profiles.some(p => p.id === id)) {
      id = `${id}-${Date.now()}`
    }

    const now = Date.now()
    const entry: ProfileEntry = {
      id,
      name,
      type: options?.type || 'local',
      remoteHost: options?.remoteHost,
      remotePort: options?.remotePort,
      remoteToken: options?.remoteToken,
      remoteProfileId: options?.remoteProfileId,
      remoteFingerprint: options?.remoteFingerprint,
      createdAt: now,
      updatedAt: now,
    }

    // Only create snapshot for local profiles
    if (entry.type === 'local') {
      const snapshot: ProfileSnapshot = {
        id,
        name,
        version: 2,
        windows: [],
      }
      await writeSnapshot(snapshot)
    }

    index.profiles.push(entry)
    await writeIndex(index)
    return entry
  }

  // Save all windows belonging to this profile into its snapshot
  async save(profileId: string): Promise<boolean> {
    const index = await ensureInitialized()
    const entry = index.profiles.find(p => p.id === profileId)
    if (!entry) return false
    if (!this.windowRegistry) return false

    const allWindows = await this.windowRegistry.readAll()
    const profileWindows = allWindows.filter(w => w.profileId === profileId)

    // If no windows are currently open for this profile, keep existing snapshot
    if (profileWindows.length === 0) return false

    const windowSnapshots: ProfileWindowSnapshot[] = profileWindows.map(w => ({
      workspaces: w.workspaces,
      activeWorkspaceId: w.activeWorkspaceId,
      activeGroup: w.activeGroup,
      terminals: w.terminals,
      activeTerminalId: w.activeTerminalId,
      bounds: w.bounds,
    }))

    const snapshot: ProfileSnapshot = {
      id: profileId,
      name: entry.name,
      version: 2,
      windows: windowSnapshots,
    }

    await writeSnapshot(snapshot)
    entry.updatedAt = Date.now()
    await writeIndex(index)
    return true
  }

  // Load a profile snapshot (pure read, no side effects)
  async loadSnapshot(profileId: string): Promise<ProfileSnapshot | null> {
    const index = await ensureInitialized()
    if (!index.profiles.some(p => p.id === profileId)) return null
    return readSnapshot(profileId)
  }

  // Load a profile: mark as active and return snapshot (window creation handled by caller)
  async load(profileId: string): Promise<ProfileSnapshot | null> {
    const snapshot = await this.loadSnapshot(profileId)
    if (!snapshot) return null

    // Add to active profiles
    await this.activateProfile(profileId)

    return snapshot
  }

  async delete(profileId: string): Promise<boolean> {
    if (profileId === 'default') return false // Cannot delete default

    const index = await ensureInitialized()
    const idx = index.profiles.findIndex(p => p.id === profileId)
    if (idx === -1) return false

    index.profiles.splice(idx, 1)

    // Remove from active profiles if present
    index.activeProfileIds = index.activeProfileIds.filter(id => id !== profileId)

    await writeIndex(index)

    // Remove snapshot file
    try { await fs.unlink(getProfilePath(profileId)) } catch { /* ignore */ }

    return true
  }

  async rename(profileId: string, newName: string): Promise<boolean> {
    const index = await ensureInitialized()
    const entry = index.profiles.find(p => p.id === profileId)
    if (!entry) return false

    entry.name = newName
    entry.updatedAt = Date.now()
    await writeIndex(index)

    // Also update snapshot name
    const snapshot = await readSnapshot(profileId)
    if (snapshot) {
      snapshot.name = newName
      await writeSnapshot(snapshot)
    }

    return true
  }

  async duplicate(profileId: string, newName: string): Promise<ProfileEntry | null> {
    const snapshot = await readSnapshot(profileId)
    if (!snapshot) return null

    const entry = await this.create(newName)

    // Copy workspace data from source
    const newSnapshot: ProfileSnapshot = {
      ...snapshot,
      id: entry.id,
      name: newName,
    }
    await writeSnapshot(newSnapshot)

    return entry
  }

  async update(profileId: string, updates: {
    remoteHost?: string
    remotePort?: number
    remoteToken?: string
    remoteProfileId?: string
    remoteFingerprint?: string
    targetOS?: TargetOS
    wslDistro?: string
    dockerContainer?: string
    dockerHost?: string
    sshHost?: string
    sshUser?: string
    sshPort?: number
    sshKeyPath?: string
    useSshTunnel?: boolean
    tunnelLocalPort?: number
  }): Promise<boolean> {
    const index = await ensureInitialized()
    const entry = index.profiles.find(p => p.id === profileId)
    if (!entry) return false

    if (updates.remoteHost !== undefined) entry.remoteHost = updates.remoteHost
    if (updates.remotePort !== undefined) entry.remotePort = updates.remotePort
    if (updates.remoteToken !== undefined) entry.remoteToken = updates.remoteToken
    if (updates.remoteProfileId !== undefined) entry.remoteProfileId = updates.remoteProfileId
    if (updates.remoteFingerprint !== undefined) entry.remoteFingerprint = updates.remoteFingerprint
    if (updates.targetOS !== undefined) entry.targetOS = updates.targetOS
    if (updates.wslDistro !== undefined) entry.wslDistro = updates.wslDistro
    if (updates.dockerContainer !== undefined) entry.dockerContainer = updates.dockerContainer
    if (updates.dockerHost !== undefined) entry.dockerHost = updates.dockerHost
    if (updates.sshHost !== undefined) entry.sshHost = updates.sshHost
    if (updates.sshUser !== undefined) entry.sshUser = updates.sshUser
    if (updates.sshPort !== undefined) entry.sshPort = updates.sshPort
    if (updates.sshKeyPath !== undefined) entry.sshKeyPath = updates.sshKeyPath
    if (updates.useSshTunnel !== undefined) entry.useSshTunnel = updates.useSshTunnel
    if (updates.tunnelLocalPort !== undefined) entry.tunnelLocalPort = updates.tunnelLocalPort
    entry.updatedAt = Date.now()
    await writeIndex(index)
    return true
  }

  async getProfile(profileId: string): Promise<ProfileEntry | null> {
    const index = await ensureInitialized()
    return index.profiles.find(p => p.id === profileId) || null
  }

  async getActiveProfileIds(): Promise<string[]> {
    const index = await ensureInitialized()
    return index.activeProfileIds
  }

  async activateProfile(profileId: string): Promise<void> {
    const index = await ensureInitialized()
    if (!index.activeProfileIds.includes(profileId)) {
      index.activeProfileIds.push(profileId)
      await writeIndex(index)
    }
  }

  async deactivateProfile(profileId: string): Promise<void> {
    const index = await ensureInitialized()
    index.activeProfileIds = index.activeProfileIds.filter(id => id !== profileId)
    await writeIndex(index)
  }
}
