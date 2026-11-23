// T0887 (PLAN-066, D308): the one conout Worker of the Terminal Server on Windows (electron/terminal-server/shared-conout.ts).
//
// @lydell/node-pty 1.1.0 starts one worker_threads Worker per PTY (worker/conoutSocketWorker.js, ~14 MB each) whose only
// job is to drain the ConPTY output pipe off the main thread — ClosePseudoConsole waits for that pipe to drain, so the
// main thread must never be the reader (microsoft/node-pty#375). This Worker does the same relay for every PTY of the
// process: connect to the PTY's conout pipe, listen on `<pipe>-worker`, pipe the conout data to whoever connects (the
// PTY agent's out socket on the main thread). Each relay is independent: an error ends only that relay.
//
// Messages: main → worker `{ type: 'open', id, conoutPipeName }` / `{ type: 'close', id }`;
//           worker → main `{ type: 'ready', id }` (the `<pipe>-worker` server listens) / `{ type: 'closed', id }`.
// Never logs and never posts PTY output: the data goes from the conout pipe straight into the worker-pipe sockets.
'use strict'

const { parentPort } = require('node:worker_threads')
const net = require('node:net')

/** Same name as node-pty's shared/conout.js getWorkerPipeName (written out so no package-internal path is required). */
function workerPipeName(conoutPipeName) {
  return conoutPipeName + '-worker'
}

/** id → { conoutSocket, server, clients } */
const relays = new Map()

function open(id, conoutPipeName) {
  if (relays.has(id)) return
  const relay = { conoutSocket: new net.Socket(), server: null, clients: new Set() }
  relays.set(id, relay)
  relay.conoutSocket.setEncoding('utf8')
  relay.conoutSocket.on('error', () => close(id))
  relay.conoutSocket.connect(conoutPipeName, () => {
    if (relays.get(id) !== relay) return // closed while connecting
    relay.server = net.createServer((workerSocket) => {
      relay.clients.add(workerSocket)
      workerSocket.on('error', () => {})
      workerSocket.on('close', () => relay.clients.delete(workerSocket))
      relay.conoutSocket.pipe(workerSocket)
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
  relay.conoutSocket.destroy()
  for (const client of relay.clients) client.destroy()
  if (relay.server) relay.server.close()
  parentPort.postMessage({ type: 'closed', id })
}

parentPort.on('message', (message) => {
  if (!message || typeof message !== 'object') return
  if (message.type === 'open' && typeof message.conoutPipeName === 'string') open(message.id, message.conoutPipeName)
  else if (message.type === 'close') close(message.id)
})
