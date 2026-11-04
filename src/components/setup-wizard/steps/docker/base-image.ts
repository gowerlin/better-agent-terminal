import type { WizardContext } from '../../wizard-runner'

/**
 * T0853 (PLAN-052 W4b, D283 U2): the default base image for "Create new". An
 * official image with git / curl / ssh (Agents need git): Debian 12 (glibc
 * 2.36 ≥ the bundle's 2.35), amd64 + arm64, ~130 MiB compressed (Docker Hub,
 * checked 2026-11-04).
 */
export const DEFAULT_DOCKER_BASE_IMAGE = 'buildpack-deps:bookworm-scm'

/** U3: the image docker/Dockerfile builds (bundle baked in) — still typed in by hand. */
export const LEGACY_BAKED_DOCKER_IMAGE = 'bat-server:latest'

export const DOCKER_IMAGE_INVALID_KEY = 'wizard.docker.baseImage.invalid'

// Same grammar as electron/docker-bundle-volume.ts `validateDockerImageRef`
// (keep in sync); main checks again before running docker.
const MAX_IMAGE_REF_LENGTH = 255
const DOMAIN_COMPONENT = /^(?:[a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])$/
const PORT = /^[0-9]{1,5}$/
const PATH_COMPONENT = /^[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*$/
const TAG = /^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$/
const DIGEST = /^[A-Za-z][A-Za-z0-9]*(?:[-_+.][A-Za-z][A-Za-z0-9]*)*:[0-9a-fA-F]{32,}$/

function isRegistryDomain(value: string): boolean {
  const colon = value.indexOf(':')
  const host = colon >= 0 ? value.slice(0, colon) : value
  if (colon >= 0) {
    const port = value.slice(colon + 1)
    if (!PORT.test(port) || Number(port) < 1 || Number(port) > 65535) return false
  }
  return host.split('.').every((component) => DOMAIN_COMPONENT.test(component))
}

/** `[registry[:port]/]path[/path…][:tag][@algo:hex]`, lower-case path components. */
export function isValidDockerImageRef(image: string): boolean {
  if (typeof image !== 'string' || image.length === 0 || image.length > MAX_IMAGE_REF_LENGTH) return false
  let rest = image
  const at = rest.indexOf('@')
  if (at >= 0) {
    if (!DIGEST.test(rest.slice(at + 1))) return false
    rest = rest.slice(0, at)
  }
  const lastSlash = rest.lastIndexOf('/')
  const lastColon = rest.lastIndexOf(':')
  if (lastColon > lastSlash) {
    if (!TAG.test(rest.slice(lastColon + 1))) return false
    rest = rest.slice(0, lastColon)
  }
  const segments = rest.split('/')
  if (segments.length > 1 && (segments[0].includes('.') || segments[0].includes(':') || segments[0] === 'localhost')) {
    if (!isRegistryDomain(segments.shift() as string)) return false
  }
  return segments.length > 0 && segments.every((segment) => PATH_COMPONENT.test(segment))
}

export function currentDockerImage(ctx: WizardContext): string {
  const image = ctx.state.dockerImage
  return typeof image === 'string' && image ? image : DEFAULT_DOCKER_BASE_IMAGE
}

/**
 * T0853 task 1: the base image field ("Create new" only). Pre-filled with the
 * current value (default U2); a custom image (internal registry included) can
 * be typed. Cancel keeps the current value. Without a text prompt (headless
 * runs) the current value is used.
 */
export async function askDockerBaseImage(ctx: WizardContext): Promise<string> {
  const current = currentDockerImage(ctx)
  if (typeof ctx.requestText !== 'function') return current
  const value = await ctx.requestText({
    stepId: 'pick-container',
    title: 'Base image for the new container',
    titleKey: 'wizard.docker.baseImage.title',
    description: 'BAT pulls this image and installs the BAT server into a volume. The image needs glibc 2.35 or newer, /bin/sh, tar and gzip (Alpine does not work).',
    descriptionKey: 'wizard.docker.baseImage.description',
    placeholder: DEFAULT_DOCKER_BASE_IMAGE,
    initialValue: current,
    validate: (input) => (isValidDockerImageRef(input.trim()) ? null : DOCKER_IMAGE_INVALID_KEY),
  })
  if (typeof value !== 'string') return current
  const trimmed = value.trim()
  return isValidDockerImageRef(trimmed) ? trimmed : current
}
