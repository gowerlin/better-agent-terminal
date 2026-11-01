// T0727: a local stand-in for the Anthropic Messages API, so e2e specs can drive the real embedded
// claude CLI (through the Claude Agent SDK) without a login, without tokens and without network.
//
// Point the CLI at it with `ANTHROPIC_BASE_URL=http://127.0.0.1:<port>` and any `ANTHROPIC_API_KEY`
// (it is never checked). Every request is recorded (model, offered tools, the ToolSearch deferred
// list); the reply is chosen by a script:
//
//   - A conversation belongs to a scenario when a user text block contains `[[T0727:<name>]]`
//     (the latest such message wins, so later prompts in the same session start new scenarios).
//   - The step is the number of tool rounds after that message (user messages carrying a
//     `tool_result`), so the script is stateless and survives CLI retries and resumes.
//   - Requests without tools, or whose last message is neither the tagged prompt nor a tool result
//     (title / prompt-suggestion / summary side calls), get a plain `ok`.
//   - `gate(name)` holds every step of a scenario until `release(name, step)`, so a spec can check
//     the UI between two model turns.
//
// `startBlockingProxy` is an HTTP(S) proxy that refuses everything and records what was attempted:
// set it as `HTTPS_PROXY` / `HTTP_PROXY` (with `NO_PROXY=127.0.0.1,localhost`) to prove that no
// request leaves the machine.
//
// Plain erasable TypeScript (no enums / parameter properties), so Node can also import it directly.

import http from 'node:http'
import type net from 'node:net'

export interface ToolCall { name: string; input: Record<string, unknown> }
/** One model turn: streamed text (each string is one delta) and / or one tool call. */
export interface FakeTurn { text?: string[]; tool?: ToolCall; /** Pause after each text delta (default: the server's `deltaDelayMs`). */ deltaDelayMs?: number }

export interface ScenarioContext {
  step: number
  /** Text of every tool_result in the conversation, oldest first. */
  toolResults: string[]
  /** Agent types the CLI listed for the Agent tool. */
  agentTypes: string[]
  model: string
}

/** Returns the turn for a step, or null when the scenario is over (→ `ok`). */
export type Scenario = (ctx: ScenarioContext) => FakeTurn | null

export interface FakeRequest {
  seq: number
  at: number
  method: string
  url: string
  model: string
  stream: boolean
  /** Names in the request's `tools` array. */
  tools: string[]
  /** Names the CLI announced as deferred (loadable through ToolSearch). */
  deferred: string[]
  scenario: string | null
  step: number | null
  /** Concatenated user text of the whole conversation (for "was this resumed" checks). */
  userText: string
  messageCount: number
}

export interface FakeAnthropicApi {
  port: number
  baseUrl: string
  requests: FakeRequest[]
  gate(scenario: string): void
  release(scenario: string, step: number): void
  /** Resolves once a request for (scenario, step) has arrived (held or answered). */
  waitFor(scenario: string, step: number, timeoutMs?: number): Promise<FakeRequest>
  close(): Promise<void>
}

const TAG = /\[\[T0727:([a-z0-9-]+)\]\]/g

type Block = { type?: string; text?: string; content?: unknown }
type Message = { role?: string; content?: string | Block[] }

function textOf(content: Message['content']): string {
  if (typeof content === 'string') return content
  return (content ?? []).filter(b => b.type === 'text').map(b => b.text ?? '').join('\n')
}

function hasToolResult(content: Message['content']): boolean {
  return Array.isArray(content) && content.some(b => b.type === 'tool_result')
}

function toolResultTexts(messages: Message[]): string[] {
  const out: string[] = []
  for (const m of messages) {
    if (!Array.isArray(m.content)) continue
    for (const b of m.content) {
      if (b.type !== 'tool_result') continue
      out.push(typeof b.content === 'string' ? b.content : Array.isArray(b.content) ? (b.content as Block[]).map(x => x.text ?? '').join('\n') : '')
    }
  }
  return out
}

/** The deferred list: the lines after "…available via ToolSearch…:" up to the first blank line. */
export function deferredToolNames(allText: string): string[] {
  const m = /available via ToolSearch[^\n]*\n((?:[A-Za-z0-9_]+\n)+)/.exec(allText)
  return m ? m[1].split('\n').filter(Boolean) : []
}

function agentTypeNames(allText: string): string[] {
  const m = /Available agent types for the Agent tool:\n((?:- [^\n]+\n?)+)/.exec(allText)
  return m ? m[1].split('\n').map(l => /^- ([^:]+):/.exec(l)?.[1] ?? '').filter(Boolean) : []
}

function scenarioOf(all: Message[]): { name: string; step: number } | null {
  // Claude 5 requests end with a `system` role message (environment block): only user / assistant count.
  const messages = all.filter(m => m.role === 'user' || m.role === 'assistant')
  const last = messages.at(-1)
  if (!last || last.role !== 'user') return null
  const lastIsPrompt = [...textOf(last.content).matchAll(TAG)].length > 0
  if (!lastIsPrompt && !hasToolResult(last.content)) return null
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== 'user') continue
    const tags = [...textOf(messages[i].content).matchAll(TAG)]
    if (tags.length === 0) continue
    const step = messages.slice(i + 1).filter(m => m.role === 'user' && hasToolResult(m.content)).length
    return { name: tags.at(-1)![1], step }
  }
  return null
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export function startFakeAnthropicApi(scenarios: Record<string, Scenario>, opts: { deltaDelayMs?: number } = {}): Promise<FakeAnthropicApi> {
  const deltaDelayMs = opts.deltaDelayMs ?? 40
  const requests: FakeRequest[] = []
  const gated = new Set<string>()
  const released = new Set<string>()
  const held = new Map<string, Array<() => void>>()
  const waiters: Array<{ scenario: string; step: number; resolve: (r: FakeRequest) => void }> = []
  let msgSeq = 0

  const key = (s: string, n: number) => `${s}#${n}`
  const notify = (r: FakeRequest) => {
    for (let i = waiters.length - 1; i >= 0; i--) {
      const w = waiters[i]
      if (w.scenario === r.scenario && w.step === r.step) { waiters.splice(i, 1); w.resolve(r) }
    }
  }

  async function writeTurn(res: http.ServerResponse, model: string, turn: FakeTurn): Promise<void> {
    const id = `msg_t0727_${++msgSeq}`
    const usage = { input_tokens: 10, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 }
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
    const ev = (type: string, data: Record<string, unknown>) => res.write(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`)
    ev('message_start', { message: { id, type: 'message', role: 'assistant', model, content: [], stop_reason: null, stop_sequence: null, usage } })
    let index = 0
    if (turn.text?.length) {
      ev('content_block_start', { index, content_block: { type: 'text', text: '' } })
      for (const delta of turn.text) {
        ev('content_block_delta', { index, delta: { type: 'text_delta', text: delta } })
        const pause = turn.deltaDelayMs ?? deltaDelayMs
        if (pause > 0) await sleep(pause)
      }
      ev('content_block_stop', { index })
      index++
    }
    if (turn.tool) {
      ev('content_block_start', { index, content_block: { type: 'tool_use', id: `toolu_t0727_${msgSeq}`, name: turn.tool.name, input: {} } })
      ev('content_block_delta', { index, delta: { type: 'input_json_delta', partial_json: JSON.stringify(turn.tool.input) } })
      ev('content_block_stop', { index })
    }
    ev('message_delta', { delta: { stop_reason: turn.tool ? 'tool_use' : 'end_turn', stop_sequence: null }, usage: { output_tokens: 5 } })
    ev('message_stop', {})
    res.end()
  }

  const server = http.createServer((req, res) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', d => { body += d })
    req.on('end', () => {
      void (async () => {
        let j: { model?: string; stream?: boolean; tools?: Array<{ name?: string }>; messages?: Message[]; system?: unknown } = {}
        try { j = JSON.parse(body) } catch { /* not JSON */ }
        const messages = j.messages ?? []
        const userText = messages.filter(m => m.role === 'user').map(m => textOf(m.content)).join('\n')
        const systemText = Array.isArray(j.system) ? (j.system as Block[]).map(b => b.text ?? '').join('\n') : String(j.system ?? '')
        // The deferred list and the agent types sit in a user message (4.x) or in a trailing `system` message (Claude 5).
        const allText = `${systemText}\n${messages.map(m => textOf(m.content)).join('\n')}`
        const tools = (j.tools ?? []).map(t => t.name ?? '')
        const sc = tools.length > 0 ? scenarioOf(messages) : null
        const record: FakeRequest = {
          seq: requests.length, at: Date.now(), method: req.method ?? '', url: req.url ?? '', model: j.model ?? '', stream: j.stream === true,
          tools, deferred: deferredToolNames(allText), scenario: sc?.name ?? null, step: sc?.step ?? null, userText, messageCount: messages.length,
        }
        requests.push(record)
        notify(record)

        if (!(req.url ?? '').startsWith('/v1/messages')) {
          res.writeHead(404, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'T0727 fake API: not implemented' } }))
          return
        }
        if ((req.url ?? '').startsWith('/v1/messages/count_tokens')) {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ input_tokens: 10 }))
          return
        }
        if (sc && gated.has(sc.name) && !released.has(key(sc.name, sc.step))) {
          await new Promise<void>(resolve => {
            const list = held.get(key(sc.name, sc.step)) ?? []
            list.push(resolve)
            held.set(key(sc.name, sc.step), list)
          })
        }
        const script = sc ? scenarios[sc.name] : undefined
        const turn = script?.({ step: sc!.step, toolResults: toolResultTexts(messages), agentTypes: agentTypeNames(allText), model: j.model ?? '' }) ?? { text: ['ok'] }
        if (j.stream !== true) {
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({
            id: `msg_t0727_${++msgSeq}`, type: 'message', role: 'assistant', model: j.model, stop_reason: 'end_turn', stop_sequence: null,
            content: [{ type: 'text', text: (turn.text ?? ['ok']).join('') }],
            usage: { input_tokens: 10, output_tokens: 1, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
          }))
          return
        }
        await writeTurn(res, j.model ?? '', turn)
      })().catch(() => { try { res.destroy() } catch { /* ignore */ } })
    })
  })

  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    const port = (server.address() as net.AddressInfo).port
    resolve({
      port,
      baseUrl: `http://127.0.0.1:${port}`,
      requests,
      gate: (scenario) => { gated.add(scenario) },
      release: (scenario, step) => {
        released.add(key(scenario, step))
        for (const r of held.get(key(scenario, step)) ?? []) r()
        held.delete(key(scenario, step))
      },
      waitFor: (scenario, step, timeoutMs = 60_000) => {
        const seen = requests.find(r => r.scenario === scenario && r.step === step)
        if (seen) return Promise.resolve(seen)
        return new Promise((ok, fail) => {
          const timer = setTimeout(() => fail(new Error(`fake API: no request for ${scenario} step ${step} within ${timeoutMs} ms`)), timeoutMs)
          waiters.push({ scenario, step, resolve: r => { clearTimeout(timer); ok(r) } })
        })
      },
      close: () => new Promise<void>(r => {
        for (const list of held.values()) for (const go of list) go()
        held.clear()
        server.closeAllConnections?.()
        server.close(() => r())
      }),
    })
  }))
}

export interface BlockingProxy { port: number; url: string; attempts: string[]; close(): Promise<void> }

/** Refuses every proxied request (403) and records the target, e.g. `CONNECT api.anthropic.com:443`. */
export function startBlockingProxy(): Promise<BlockingProxy> {
  const attempts: string[] = []
  const server = http.createServer((req, res) => {
    attempts.push(`${req.method} ${req.url}`)
    res.writeHead(403)
    res.end()
  })
  server.on('connect', (req: http.IncomingMessage, socket: net.Socket) => {
    socket.on('error', () => { /* client gave up */ })
    attempts.push(`CONNECT ${req.url}`)
    socket.end('HTTP/1.1 403 Forbidden\r\n\r\n')
  })
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => {
    const port = (server.address() as net.AddressInfo).port
    resolve({
      port,
      url: `http://127.0.0.1:${port}`,
      attempts,
      close: () => new Promise<void>(r => { server.closeAllConnections?.(); server.close(() => r()) }),
    })
  }))
}
