import * as fs from 'fs'

export interface DockerMount {
  host: string
  container: string
}

const CONTAINER_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/

export function validateHostPath(filePath: string): { ok: boolean; error?: string } {
  if (!filePath.trim()) {
    return { ok: false, error: 'Host path is required.' }
  }
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `Host path does not exist: ${filePath}` }
  }
  return { ok: true }
}

export function validateContainerPath(filePath: string): { ok: boolean; error?: string } {
  if (!filePath.trim()) {
    return { ok: false, error: 'Container path is required.' }
  }
  if (!filePath.startsWith('/')) {
    return { ok: false, error: `Container path must start with "/": ${filePath}` }
  }
  return { ok: true }
}

export function validateMountTable(mounts: DockerMount[]): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  const seenHosts = new Set<string>()
  const seenContainers = new Set<string>()

  mounts.forEach((mount, index) => {
    const hostResult = validateHostPath(mount.host)
    if (!hostResult.ok && hostResult.error) errors.push(`Row ${index + 1}: ${hostResult.error}`)

    const containerResult = validateContainerPath(mount.container)
    if (!containerResult.ok && containerResult.error) errors.push(`Row ${index + 1}: ${containerResult.error}`)

    const normalizedHost = mount.host.trim().toLowerCase()
    const normalizedContainer = mount.container.trim()
    if (seenHosts.has(normalizedHost)) errors.push(`Row ${index + 1}: duplicate host path ${mount.host}`)
    if (seenContainers.has(normalizedContainer)) errors.push(`Row ${index + 1}: duplicate container path ${mount.container}`)
    seenHosts.add(normalizedHost)
    seenContainers.add(normalizedContainer)
  })

  return { ok: errors.length === 0, errors }
}

export function validateContainerName(name: string): { ok: boolean; error?: string } {
  if (!name.trim()) {
    return { ok: false, error: 'Container name is required.' }
  }
  if (!CONTAINER_NAME_PATTERN.test(name)) {
    return { ok: false, error: `Invalid Docker container name: ${name}` }
  }
  return { ok: true }
}
