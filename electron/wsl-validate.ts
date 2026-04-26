const DISTRO_NAME_PATTERN = /^[A-Za-z0-9._-]+$/
const SERVICE_NAME_PATTERN = /^[A-Za-z0-9._-]+\.service$/
const SHELL_METACHAR_PATTERN = /[;|&$`]/

export function assertValidDistro(distro: string): void {
  if (!DISTRO_NAME_PATTERN.test(distro)) {
    throw new Error(`Invalid WSL distro name: ${distro}`)
  }
}

export function assertValidUnixPath(filePath: string, allowTilde = true): void {
  const startsWithAllowedRoot = filePath.startsWith('/') || (allowTilde && filePath.startsWith('~/'))
  if (!startsWithAllowedRoot || filePath.includes('..') || SHELL_METACHAR_PATTERN.test(filePath)) {
    throw new Error(`Invalid Unix path: ${filePath}`)
  }
}

export function assertValidServiceName(name: string): void {
  if (!SERVICE_NAME_PATTERN.test(name)) {
    throw new Error(`Invalid service name: ${name}`)
  }
}
