// T0887 (PLAN-066, D308): the one conout Worker of the Terminal Server on Windows (electron/terminal-server/shared-conout.ts).
//
// @lydell/node-pty 1.1.0 starts one worker_threads Worker per PTY (worker/conoutSocketWorker.js, ~14 MB each) whose only
// job is to drain the ConPTY output pipe off the main thread — ClosePseudoConsole waits for that pipe to drain, so the
// main thread must never be the reader (microsoft/node-pty#375). This Worker does the same relay for every PTY of the
// process: connect to the PTY's conout pipe, listen on `<pipe>-worker`, forward the conout data to whoever connects (the
// PTY agent's out socket on the main thread). Each relay is independent: an error ends only that relay.
//
// T0889 (BUG-215): the relay forwards raw bytes (no UTF-8 decode / re-encode here: the main thread's socket decodes, with
// a decoder that keeps multi-byte characters split across chunks) and batches. ConPTY hands over output in very small
// pieces (~10 characters each while 10 tabs flood), and every piece became one data event, one Terminal Server message
// and one IPC message downstream. A relay now sends at once when it last sent RELAY_BATCH_MS ago or longer (a typed
// character's echo is not delayed), otherwise it collects until RELAY_BATCH_MS after the last send or RELAY_BATCH_MAX_BYTES.
// Order and bytes are unchanged. Back-pressure as before (`pipe()`): when the main thread does not keep up, conout reading
// pauses until the socket drains. Conout is read only once a client is connected (as `pipe()` in the connection handler),
// and its end is passed on after the pending bytes.
//
// Messages: main → worker `{ type: 'open', id, conoutPipeName }` / `{ type: 'close', id }`;
//           worker → main `{ type: 'ready', id }` (the `<pipe>-worker` server listens) / `{ type: 'closed', id }`.
// Never logs and never posts PTY output: the data goes from the conout pipe straight into the worker-pipe sockets.
'use strict'

const { parentPort } = require('node:worker_threads')
const net = require('node:net')

/** A relay that sent this long ago or longer sends the next data at once; otherwise it waits until then. */
const RELAY_BATCH_MS = 4
/** Pending bytes that are sent at once, whatever the time. */
const RELAY_BATCH_MAX_BYTES = 256 * 1024

/** Same name as node-pty's shared/conout.js getWorkerPipeName (written out so no package-internal path is required). */
function workerPipeName(conoutPipeName) {
  return conoutPipeName + '-worker'
}

/** id → relay */
const relays = new Map()

function flush(relay) {
  if (relay.timer) { clearTimeout(relay.timer); relay.timer = null }
  if (relay.pendingBytes === 0) return
  const data = relay.pending.length === 1 ? relay.pending[0] : Buffer.concat(relay.pending, relay.pendingBytes)
  relay.pending = []
  relay.pendingBytes = 0
  relay.lastSend = performance.now()
  let blocked = false
  for (const client of relay.clients) {
    if (!client.write(data)) {
      blocked = true
      if (!relay.waiting.has(client)) {
        relay.waiting.add(client)
        client.once('drain', () => { relay.waiting.delete(client); resume(relay) })
      }
    }
  }
  if (blocked) relay.conoutSocket.pause()
}

function resume(relay) {
  if (relay.waiting.size === 0 && !relay.ended && relays.get(relay.id) === relay) relay.conoutSocket.resume()
}

function onData(relay, chunk) {
  relay.pending.push(chunk)
  relay.pendingBytes += chunk.length
  if (relay.pendingBytes >= RELAY_BATCH_MAX_BYTES) { flush(relay); return }
  if (relay.timer) return
  const wait = relay.lastSend + RELAY_BATCH_MS - performance.now()
  if (wait <= 0) flush(relay)
  else relay.timer = setTimeout(() => { relay.timer = null; flush(relay) }, Math.ceil(wait))
}

function open(id, conoutPipeName) {
  if (relays.has(id)) return
  const relay = {
    id,
    conoutSocket: new net.Socket(),
    server: null,
    clients: new Set(),
    waiting: new Set(),
    pending: [],
    pendingBytes: 0,
    lastSend: 0,
    timer: null,
    reading: false,
    ended: false,
  }
  relays.set(id, relay)
  relay.conoutSocket.on('error', () => close(id))
  relay.conoutSocket.on('end', () => {
    relay.ended = true
    flush(relay)
    for (const client of relay.clients) client.end()
  })
  relay.conoutSocket.connect(conoutPipeName, () => {
    if (relays.get(id) !== relay) return // closed while connecting
    relay.server = net.createServer((workerSocket) => {
      relay.clients.add(workerSocket)
      workerSocket.on('error', () => {})
      workerSocket.on('close', () => {
        relay.clients.delete(workerSocket)
        relay.waiting.delete(workerSocket)
        resume(relay)
      })
      if (relay.ended) { workerSocket.end(); return }
      if (!relay.reading) {
        relay.reading = true
        relay.conoutSocket.on('data', (chunk) => onData(relay, chunk))
      }
    })
    relay.server.on('error', () => close(id))
    relay.server.listen(workerPipeName(conoutPipeName), () => {
      if (relays.get(id) !== relay) return
      parentPort.postMessage({ type: 'ready', id })
    })
  })
}

function close(id) {
  const relay = relays.get(id)
  if (!relay) return
  relays.delete(id)
  if (relay.timer) { clearTimeout(relay.timer); relay.timer = null }
  relay.pending = []
  relay.pendingBytes = 0
  relay.conoutSocket.destroy()
  for (const client of relay.clients) client.destroy()
  relay.clients.clear()
  relay.waiting.clear()
  if (relay.server) relay.server.close()
  parentPort.postMessage({ type: 'closed', id })
}

parentPort.on('message', (message) => {
  if (!message || typeof message !== 'object') return
  if (message.type === 'open' && typeof message.conoutPipeName === 'string') open(message.id, message.conoutPipeName)
  else if (message.type === 'close') close(message.id)
})
