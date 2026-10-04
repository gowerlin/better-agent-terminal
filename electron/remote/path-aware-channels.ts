import type { PathTranslator } from './path-translator'

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
 *
 * T0416 (BUG-105): 'arg-indices' translates the string args at the given
 * positions; 'object-fields' translates the named string fields of the object
 * at args[index].
 */
type PathArgSchema =
  | 'first-string' | 'all-strings' | 'array-of-strings'
  | 'pty-create' | 'pty-restart' | 'none'
  | { kind: 'arg-indices'; indices: readonly number[] }
  | { kind: 'object-fields'; index: number; fields: readonly string[] }

/**
 * Every PROXIED_CHANNELS entry is either listed here (its request carries a
 * client-side path) or in PATH_FREE_CHANNELS — enforced by
 * electron/remote/__tests__/path-aware-channels-coverage.test.ts (T0416).
 */
export const PATH_ARG_SCHEMA: Readonly<Record<string, PathArgSchema>> = {
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
  // T0416 (BUG-105): channels brought online on headless by PLAN-036 (T0401 / T0405)
  // (sessionId, { cwd, worktreePath?, ... })
  'claude:start-session': { kind: 'object-fields', index: 1, fields: ['cwd', 'worktreePath'] },
  // (sessionId, sdkSessionId, cwd, model?, apiVersion?, useWorktree?, worktreePath?, ...)
  'claude:resume-session': { kind: 'arg-indices', indices: [2, 6] },
  'claude:list-sessions': 'first-string',
  'claude:scan-skills': 'first-string',
  // (sessionId, cwd)
  'worktree:create': { kind: 'arg-indices', indices: [1] },
  // (sessionId, cwd, worktreePath, branchName)
  'worktree:rehydrate': { kind: 'arg-indices', indices: [1, 2] },
  'github:pr-list': 'first-string',
  'github:issue-list': 'first-string',
  'github:pr-view': 'first-string',
  'github:issue-view': 'first-string',
  'github:pr-comment': 'first-string',
  'github:issue-comment': 'first-string',
  'git-scaffold:healthCheck': 'first-string',
  'git-scaffold:getRepoInfo': 'first-string',
  'git-scaffold:listCommits': 'first-string',
  // ({ id, cwd, command | agent/prompt, ... })
  'terminal:create-with-command': { kind: 'object-fields', index: 0, fields: ['cwd'] },
  'terminal:create-agent-command': { kind: 'object-fields', index: 0, fields: ['cwd'] },
  // T0406: ([roots]) — Electron main sends its windows' folderPaths in client form;
  // this schema (RemoteClient.invoke) is the one and only toServer conversion.
  'workspace:sync-roots': 'array-of-strings',
}

/** Client -> Server channels whose request payloads contain local paths. */
export const PATH_AWARE_CHANNELS = new Set<string>(Object.keys(PATH_ARG_SCHEMA))

/**
 * T0416 (BUG-105): proxied channels whose requests carry no client-side path,
 * each with the reason. A new PROXIED_CHANNELS entry must land here or in
 * PATH_ARG_SCHEMA, or the coverage test fails.
 */
export const PATH_FREE_CHANNELS: ReadonlyMap<string, string> = new Map([
  ['pty:write', 'id + terminal input bytes'],
  ['pty:resize', 'id + cols/rows'],
  ['pty:kill', 'id only'],
  ['pty:get-cwd', 'id only (result is path-returning)'],
  ['pty:get-buffer', 'id only'],
  ['claude:send-message', 'sessionId + prompt text + images as data: URLs'],
  ['claude:stop-session', 'sessionId only'],
  ['claude:abort-session', 'sessionId only'],
  ['claude:set-permission-mode', 'sessionId + enum'],
  ['claude:set-codex-sandbox-mode', 'sessionId + enum'],
  ['claude:set-codex-approval-policy', 'sessionId + enum'],
  ['claude:set-model', 'sessionId + model id'],
  ['claude:set-effort', 'sessionId + effort level'],
  ['claude:reset-session', 'sessionId only'],
  ['claude:get-supported-models', 'sessionId only'],
  ['claude:get-account-info', 'sessionId only'],
  ['claude:get-supported-commands', 'sessionId only'],
  ['claude:get-supported-agents', 'sessionId only'],
  ['claude:get-session-meta', 'sessionId only (result cwd stays server-side, see SERVER_PATH_RESULT_CHANNELS)'],
  ['claude:get-worktree-status', 'sessionId only (result stays server-side, see SERVER_PATH_RESULT_CHANNELS)'],
  ['claude:cleanup-worktree', 'sessionId + boolean'],
  ['claude:resolve-permission', 'sessionId + toolUseId + tool decision'],
  ['claude:resolve-ask-user', 'sessionId + toolUseId + answers'],
  ['claude:fork-session', 'sessionId only'],
  ['claude:rewind-to-prompt', 'not available in this build'],
  ['claude:stop-task', 'sessionId + taskId'],
  ['claude:rest-session', 'sessionId only'],
  ['claude:wake-session', 'sessionId only'],
  ['claude:is-resting', 'sessionId only'],
  ['claude:archive-messages', 'ALWAYS_LOCAL (never proxied); sessionId + messages'],
  ['claude:load-archived', 'ALWAYS_LOCAL (never proxied); sessionId + offset/limit'],
  ['claude:clear-archive', 'ALWAYS_LOCAL (never proxied); sessionId only'],
  ['claude:fetch-subagent-messages', 'sessionId + toolUseId'],
  ['claude:scan-star-commands', 'no args (scans the server home)'],
  ['claude:get-context-usage', 'sessionId only'],
  ['claude:get-statusline-extras', 'no args (reads the server ~/.claude)'],
  ['claude:auth-status', 'no args'],
  ['claude:auth-login', 'no args'],
  ['claude:auth-logout', 'no args'],
  ['claude:account-list', 'no args'],
  ['claude:account-import-current', 'no args'],
  ['claude:account-switch', 'account id'],
  ['claude:get-cli-path', 'no args (result stays server-side, see SERVER_PATH_RESULT_CHANNELS)'],
  ['claude:detectRuntime', 'customPath comes from the remote settings (settings:load is proxied): already a server path'],
  ['worktree:remove', 'sessionId + boolean'],
  ['worktree:status', 'sessionId only (result stays server-side, see SERVER_PATH_RESULT_CHANNELS)'],
  ['worktree:merge', 'sessionId + strategy enum'],
  ['workspace:save', 'ALWAYS_LOCAL (never proxied); workspace JSON stays in the local window registry'],
  ['workspace:load', 'ALWAYS_LOCAL (never proxied); no args'],
  ['settings:save', 'remote settings JSON; paths in it are server paths for the remote host'],
  ['settings:load', 'no args'],
  ['settings:get-shell-path', 'shell type enum (result is a server shell path)'],
  ['settings:get-logging-info', 'no args (result is the server log dir, display only)'],
  ['settings:cleanup-logs', 'no args'],
  ['github:check-cli', 'customPath comes from the remote settings: already a server path'],
  ['snippet:getAll', 'no args'],
  ['snippet:getById', 'snippet id'],
  ['snippet:create', 'snippet record'],
  ['snippet:update', 'snippet id + record'],
  ['snippet:delete', 'snippet id'],
  ['snippet:toggleFavorite', 'snippet id'],
  ['snippet:search', 'search text'],
  ['snippet:getCategories', 'no args'],
  ['snippet:getFavorites', 'no args'],
  ['snippet:getByWorkspace', 'workspace id'],
  ['profile:list', 'no args'],
  ['profile:load', 'profile id'],
  ['profile:load-snapshot', 'profile id; snapshot workspaces keep the client form the window saved'],
  ['profile:get-active-ids', 'no args'],
  ['profile:activate', 'profile id'],
  ['profile:deactivate', 'profile id'],
  ['terminal:notify', '{ targetId, message, source }'],
  ['terminal:keypress', '{ targetId, key, code, ... }'],
  ['remote-tools:detect', 'no args (result lists server install paths)'],
])

/** Server -> Client channels whose results contain absolute paths to rewrite. */
export const PATH_RETURNING_CHANNELS = new Set<string>([
  'fs:readdir',
  'fs:search',
  'git:getRoot',
  'pty:get-cwd',
  // T0416: { gitRoot } — shown in the Git Graph panel, same as git:getRoot
  'git-scaffold:healthCheck',
  'git-scaffold:getRepoInfo',
])

/**
 * T0416 (BUG-105): results that DO contain server paths but must stay in
 * server form. Each entry says who consumes the path.
 */
export const SERVER_PATH_RESULT_CHANNELS: ReadonlyMap<string, string> = new Map([
  ['claude:get-cli-path', 'typed into a terminal running on the remote host'],
  ['claude:detectRuntime', 'server claude locations, shown in remote settings'],
  ['github:check-cli', 'server gh location, shown in settings'],
  ['settings:get-shell-path', 'shell spawned on the remote host'],
  ['settings:get-logging-info', 'server log dir, display only'],
  ['remote-tools:detect', 'server install locations, display only'],
  ['claude:get-session-meta', 'cwd unused by the renderer'],
  ['claude:get-worktree-status', 'only diff is read; worktreePath matches the claude:worktree-info event, which stays server form because the panel embeds it in prompts sent to the remote agent'],
  ['worktree:create', 'worktreePath is persisted next to claude:worktree-info (server form) and only flows back into pty:create / worktree:rehydrate / git:*, whose toServer is a no-op on server paths'],
  ['worktree:status', 'unused by the renderer; same form as worktree:create'],
])

export function translateInvokeArgs(
  channel: string,
  args: unknown[],
  translator: PathTranslator,
): unknown[] {
  if (!PATH_AWARE_CHANNELS.has(channel)) return args

  const schema: PathArgSchema = PATH_ARG_SCHEMA[channel] ?? 'first-string'
  const toServer = (value: string) => translator.toServer(value)

  if (typeof schema === 'object') {
    if (schema.kind === 'arg-indices') {
      return args.map((value, index) => (
        typeof value === 'string' && schema.indices.includes(index) ? toServer(value) : value
      ))
    }
    const target = args[schema.index]
    if (!target || typeof target !== 'object' || Array.isArray(target)) return args
    const translated = schema.fields.reduce(
      (acc, field) => translatePathField(acc, field, toServer),
      target as Record<string, unknown>,
    )
    return args.map((value, index) => (index === schema.index ? translated : value))
  }

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

    case 'git-scaffold:healthCheck':
    case 'git-scaffold:getRepoInfo':
      if (!result || typeof result !== 'object' || Array.isArray(result)) return result
      return translatePathField(result as Record<string, unknown>, 'gitRoot', (value) => translator.toClient(value))

    default:
      return result
  }
}

/**
 * T0406: PROXIED_EVENTS whose payload carries a server path that is rewritten to
 * client form on arrival (translateRemoteEventArgs). Every PROXIED_EVENTS entry
 * is here or in PATH_FREE_EVENTS — path-aware-channels-coverage.test.ts.
 */
export const PATH_EVENT_CHANNELS: ReadonlyMap<string, string> = new Map([
  ['fs:changed', 'args[0] = the watched dir (server form after fs:watch toServer); the renderer matches it against the client-form path it watched'],
])

/**
 * T0406: PROXIED_EVENTS delivered as is, each with the reason. Some do carry
 * server paths and deliberately keep them in server form.
 */
export const PATH_FREE_EVENTS: ReadonlyMap<string, string> = new Map([
  ['pty:output', 'terminal id + output bytes (paths in it are shell text from the remote host)'],
  ['pty:exit', 'terminal id + exit code'],
  ['claude:message', 'agent transcript content; paths are what the remote agent saw and said (free text, not rewritten)'],
  ['claude:tool-use', 'tool input as the remote agent issued it (server paths stay server form; see T0416 遭遇問題 2 for free-text paths)'],
  ['claude:tool-result', 'tool output from the remote host (free text)'],
  ['claude:stream', 'streamed agent text'],
  ['claude:result', 'turn result (usage / cost / text)'],
  ['claude:error', 'error text from the remote agent'],
  ['claude:status', 'sessionId + status'],
  ['claude:permission-request', 'tool permission request as the remote agent issued it (server paths shown as is)'],
  ['claude:permission-resolved', 'sessionId + toolUseId'],
  ['claude:ask-user', 'agent question + options (text)'],
  ['claude:ask-user-resolved', 'sessionId + toolUseId'],
  ['claude:modeChange', 'sessionId + permission mode enum'],
  ['claude:history', 'resumed transcript items (same rule as claude:message)'],
  ['claude:prompt-suggestion', 'suggestion text'],
  ['claude:session-reset', 'sessionId only'],
  ['claude:worktree-info', 'worktreePath / gitRoot stay server form: the panel embeds them in prompts to the remote agent (T0416, same as worktree:create)'],
  ['claude:rate-limit', 'rate limit numbers'],
  ['claude:turn-end', 'sessionId + { reason, error? } (codex; no codex on headless)'],
  ['claude:runtime-degraded', 'sessionId + reason / detail text about the server claude runtime (display only)'],
  ['claude:runtime-warning', 'sessionId + server claude version + message (display only)'],
  ['workspace:detached', 'workspace id (Electron host only, sent to its own windows)'],
  ['workspace:reattached', 'workspace id (Electron host only)'],
  ['workspace:reload', 'workspace JSON of an Electron host window registry, in the form that host window saved; headless never emits it'],
  ['system:resume', 'no payload'],
  ['terminal:notified', '{ targetId, message, source } (terminal ids + message text)'],
])

export function translateRemoteEventArgs(
  channel: string,
  args: unknown[],
  translator: PathTranslator,
): unknown[] {
  if (!PATH_EVENT_CHANNELS.has(channel) || args.length === 0) return args

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
