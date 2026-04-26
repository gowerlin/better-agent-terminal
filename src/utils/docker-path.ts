export interface DockerMount {
  host: string
  container: string
}

const WINDOWS_HOST_PATH_PATTERN = /^[A-Za-z]:[\\/]/

function sortMounts(mounts: DockerMount[]): DockerMount[] {
  return [...mounts].sort((a, b) => b.host.length - a.host.length)
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
    if (normalizedPath.startsWith(normalizedHost)) {
      return mount.container + hostPath.slice(mount.host.length).replace(/\\/g, '/')
    }
  }

  return hostPath
}

export function containerToHost(containerPath: string, mounts: DockerMount[]): string {
  for (const mount of sortMounts(mounts)) {
    if (containerPath.startsWith(mount.container)) {
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
    if (normalizedPath.startsWith(normalizeHostPath(mount.host)) || path.startsWith(mount.container)) {
      return true
    }
  }

  return false
}
