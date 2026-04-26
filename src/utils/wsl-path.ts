const LONG_PATH_PREFIX = '\\\\?\\'
const WIN_DRIVE_PATTERN = /^[A-Za-z]:[\\/]/
const WSL_UNC_PATTERN = /^\\\\wsl(?:\$|\.localhost)\\([^\\]+)(?:\\(.*))?$/i
const WSL_MOUNT_PATTERN = /^\/mnt\/([a-zA-Z])(?:\/(.*))?$/

function stripLongPathPrefix(path: string): string {
  if (!path.startsWith(LONG_PATH_PREFIX)) {
    return path
  }

  return path.slice(LONG_PATH_PREFIX.length)
}

export function winToWsl(winPath: string, distro: string): string {
  const normalized = stripLongPathPrefix(winPath)

  if (WIN_DRIVE_PATTERN.test(normalized)) {
    const drive = normalized[0].toLowerCase()
    const rest = normalized.slice(2).replace(/[\\/]+/g, '/')
    return rest.length > 0 ? `/mnt/${drive}${rest.startsWith('/') ? rest : `/${rest}`}` : `/mnt/${drive}`
  }

  const uncMatch = normalized.match(WSL_UNC_PATTERN)
  if (uncMatch && uncMatch[1].toLowerCase() === distro.toLowerCase()) {
    const rest = uncMatch[2] ? uncMatch[2].replace(/\\/g, '/') : ''
    return rest.length > 0 ? `/${rest}` : '/'
  }

  return normalized
}

export function wslToWin(wslPath: string, distro: string): string {
  const mountMatch = wslPath.match(WSL_MOUNT_PATTERN)
  if (mountMatch) {
    const drive = mountMatch[1].toUpperCase()
    const rest = mountMatch[2] ? `\\${mountMatch[2].replace(/\//g, '\\')}` : '\\'
    return `${drive}:${rest}`
  }

  if (wslPath.startsWith('/')) {
    return `\\\\wsl.localhost\\${distro}${wslPath.replace(/\//g, '\\')}`
  }

  return wslPath
}
