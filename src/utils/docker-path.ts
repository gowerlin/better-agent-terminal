export interface DockerMount {
  host: string
  container: string
}

const WINDOWS_HOST_PATH_PATTERN = /^[A-Za-z]:[\\/]/

/**
 * Boundary-aware startsWith: prefix must be followed by a path separator or string end.
 * Empty prefix returns false to avoid all-match degeneracy (T0294 EC-001).
 * Avoids prefix-collision bug like '/Users/al' matching '/Users/alice' (T0294 F-001).
 */
export function startsWithPath(p: string, prefix: string): boolean {
  if (!prefix) return false
  if (!p.startsWith(prefix)) return false
  if (p.length === prefix.length) return true
  const next = p[prefix.length]
  return next === '/' || next === '\\'
}

/**
 * Reject degenerate mounts that would over-match every path:
 *   host/container empty or root-only ('/' or '\\').
 */
export function isValidMount(mount: DockerMount): boolean {
  const { host, container } = mount
  if (!host || !container) return false
  if (host === '/' || host === '\\') return false
  if (container === '/' || container === '\\') return false
  return true
}

function sortMounts(mounts: DockerMount[]): DockerMount[] {
  return [...mounts].filter(isValidMount).sort((a, b) => b.host.length - a.host.length)
}

export function normalizeHostPath(path: string): string {
  if (!WINDOWS_HOST_PATH_PATTERN.test(path)) {
    return path
  }

  return `${path[0].toLowerCase()}${path.slice(1)}`.replace(/\\/g, '/')
}

export function hostToContainer(hostPath: string, mounts: DockerMount[]): string {
  const normalizedPath = normalizeHostPath(hostPath)

  for (const mount of sortMounts(mounts)) {
    const normalizedHost = normalizeHostPath(mount.host)
    if (startsWithPath(normalizedPath, normalizedHost)) {
      return mount.container + hostPath.slice(mount.host.length).replace(/\\/g, '/')
    }
  }

  return hostPath
}

export function containerToHost(containerPath: string, mounts: DockerMount[]): string {
  for (const mount of sortMounts(mounts)) {
    if (startsWithPath(containerPath, mount.container)) {
      const tail = containerPath.slice(mount.container.length)
      if (WINDOWS_HOST_PATH_PATTERN.test(mount.host)) {
        return mount.host + tail.replace(/\//g, '\\')
      }
      return mount.host + tail
    }
  }

  return containerPath
}

export function ownsDockerPath(path: string, mounts: DockerMount[]): boolean {
  const normalizedPath = normalizeHostPath(path)

  for (const mount of sortMounts(mounts)) {
    if (
      startsWithPath(normalizedPath, normalizeHostPath(mount.host))
      || startsWithPath(path, mount.container)
    ) {
      return true
    }
  }

  return false
}
