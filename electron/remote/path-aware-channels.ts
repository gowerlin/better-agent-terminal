import type { PathTranslator } from './path-translator'

/** Client -> Server channels whose request payloads contain local paths. */
export const PATH_AWARE_CHANNELS = new Set<string>([
  'fs:readdir',
  'fs:readFile',
  'fs:stat',
  'fs:search',
  'fs:watch',
  'fs:unwatch',
  'fs:reset-watch',
  'git:branch',
  'git:log',
  'git:diff',
  'git:diff-files',
  'git:status',
  'git:get-github-url',
  'git:getRoot',
  'pty:create',
  'pty:restart',
  'image:read-as-data-url',
])

/** Server -> Client channels whose results contain absolute paths to rewrite. */
export const PATH_RETURNING_CHANNELS = new Set<string>([
  'fs:readdir',
  'fs:search',
  'git:getRoot',
  'pty:get-cwd',
])

type PtyCreateLike = { cwd?: unknown }

function translatePathField<T extends Record<string, unknown>>(
  value: T,
  key: string,
  translate: (input: string) => string,
): T {
  const current = value[key]
  if (typeof current !== 'string') return value
  return { ...value, [key]: translate(current) }
}

/**
 * Per-channel schema for path translation (BUG-065 / T0301). Replaces the
 * prior default-args[0] assumption that skipped args[1+] on multi-path
 * channels like git:diff-files. Channels not listed default to 'first-string'.
 */
type PathArgSchema =
  | 'first-string' | 'all-strings' | 'array-of-strings'
  | 'pty-create' | 'pty-restart' | 'none'

const PATH_ARG_SCHEMA: Record<string, PathArgSchema> = {
  'fs:readdir': 'first-string',
  'fs:readFile': 'first-string',
  'fs:stat': 'first-string',
  'fs:search': 'first-string',
  'fs:watch': 'first-string',
  'fs:unwatch': 'first-string',
  'fs:reset-watch': 'array-of-strings',
  'git:branch': 'first-string',
  'git:log': 'first-string',
  'git:diff': 'first-string',
  'git:diff-files': 'all-strings',
  'git:status': 'first-string',
  'git:get-github-url': 'first-string',
  'git:getRoot': 'first-string',
  'image:read-as-data-url': 'first-string',
  'pty:create': 'pty-create',
  'pty:restart': 'pty-restart',
}

export function translateInvokeArgs(
  channel: string,
  args: unknown[],
  translator: PathTranslator,
): unknown[] {
  if (!PATH_AWARE_CHANNELS.has(channel)) return args

  const schema: PathArgSchema = PATH_ARG_SCHEMA[channel] ?? 'first-string'

  switch (schema) {
    case 'none':
      return args

    case 'first-string':
      if (typeof args[0] !== 'string') return args
      return [translator.toServer(args[0]), ...args.slice(1)]

    case 'all-strings':
      return args.map((value) => (
        typeof value === 'string' ? translator.toServer(value) : value
      ))

    case 'array-of-strings': {
      const head = args[0]
      if (!Array.isArray(head)) return args
      const translated = head.map((entry) => (
        typeof entry === 'string' ? translator.toServer(entry) : entry
      ))
      return [translated, ...args.slice(1)]
    }

    case 'pty-create': {
      const [options, ...rest] = args
      if (!options || typeof options !== 'object') return args
      return [translatePathField(options as PtyCreateLike, 'cwd', (value) => translator.toServer(value)), ...rest]
    }

    case 'pty-restart': {
      const [id, cwd, ...rest] = args
      return [id, typeof cwd === 'string' ? translator.toServer(cwd) : cwd, ...rest]
    }

    default:
      return args
  }
}

export function normalizePathsInResult(
  channel: string,
  result: unknown,
  translator: PathTranslator,
): unknown {
  switch (channel) {
    case 'fs:readdir':
    case 'fs:search':
      if (!Array.isArray(result)) return result
      return result.map((entry) => (
        entry && typeof entry === 'object'
          ? translatePathField(entry as Record<string, unknown>, 'path', (value) => translator.toClient(value))
          : entry
      ))

    case 'git:getRoot':
    case 'pty:get-cwd':
      return typeof result === 'string' ? translator.toClient(result) : result

    default:
      return result
  }
}

export function translateRemoteEventArgs(
  channel: string,
  args: unknown[],
  translator: PathTranslator,
): unknown[] {
  if (channel !== 'fs:changed' || args.length === 0) return args

  const [payload, ...rest] = args
  if (typeof payload === 'string') {
    return [translator.toClient(payload), ...rest]
  }
  if (payload && typeof payload === 'object') {
    return [
      translatePathField(payload as Record<string, unknown>, 'path', (value) => translator.toClient(value)),
      ...rest,
    ]
  }
  return args
}
