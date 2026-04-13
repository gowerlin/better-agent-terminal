import * as fs from 'fs'
import * as path from 'path'

const REGISTRY_FILENAME = 'bat-pty-registry.json'

export interface PtyRegistryEntry {
  id: string
  pid: number
  cwd: string
  createdAt: string
}

export interface PtyRegistry {
  serverPid: number
  ptys: PtyRegistryEntry[]
  updatedAt: string
}

function getRegistryPath(userDataPath: string): string {
  return path.join(userDataPath, REGISTRY_FILENAME)
}

export function readRegistry(userDataPath: string): PtyRegistry | null {
  const registryPath = getRegistryPath(userDataPath)
  try {
    const content = fs.readFileSync(registryPath, 'utf8')
    return JSON.parse(content) as PtyRegistry
  } catch {
    return null
  }
}

export function writeRegistry(registry: PtyRegistry, userDataPath: string): void {
  const registryPath = getRegistryPath(userDataPath)
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8')
}

export function clearRegistry(userDataPath: string): void {
  const registryPath = getRegistryPath(userDataPath)
  try {
    fs.unlinkSync(registryPath)
  } catch {
    // File may not exist — ignore
  }
}

export function addPtyEntry(entry: PtyRegistryEntry, serverPid: number, userDataPath: string): void {
  const registry = readRegistry(userDataPath) ?? {
    serverPid,
    ptys: [],
    updatedAt: new Date().toISOString(),
  }
  // Avoid duplicates — replace if same id exists
  registry.ptys = registry.ptys.filter(e => e.id !== entry.id)
  registry.ptys.push(entry)
  registry.serverPid = serverPid
  registry.updatedAt = new Date().toISOString()
  writeRegistry(registry, userDataPath)
}

export function removePtyEntry(id: string, userDataPath: string): void {
  const registry = readRegistry(userDataPath)
  if (!registry) return
  registry.ptys = registry.ptys.filter(e => e.id !== id)
  registry.updatedAt = new Date().toISOString()
  writeRegistry(registry, userDataPath)
}
