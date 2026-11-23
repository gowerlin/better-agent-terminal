// T0889 (BUG-214) diagnostics only — never shipped. Loads the real shared conout Worker script, then answers
// `{ type: 'diag', op: 'stats' | 'gc' }` with the Worker's heap statistics and active handle counts, so the churn repro
// can tell per-connection state that is never released from V8 heap that is simply not collected yet.
// Posts no PTY output.
'use strict'

const { parentPort, workerData } = require('node:worker_threads')
const v8 = require('node:v8')
const vm = require('node:vm')

require(workerData.realWorker)

v8.setFlagsFromString('--expose-gc')
const gc = vm.runInNewContext('gc')

function handleCounts() {
  const by = {}
  // eslint-disable-next-line no-underscore-dangle
  for (const h of process._getActiveHandles()) {
    const name = h?.constructor?.name ?? typeof h
    by[name] = (by[name] ?? 0) + 1
  }
  return by
}

parentPort.on('message', (message) => {
  if (!message || message.type !== 'diag') return
  if (message.op === 'gc') { gc(); gc() }
  const h = v8.getHeapStatistics()
  const mu = process.memoryUsage()
  parentPort.postMessage({
    type: 'diag',
    seq: message.seq,
    usedHeapMB: +(h.used_heap_size / 1048576).toFixed(2),
    totalHeapMB: +(h.total_heap_size / 1048576).toFixed(2),
    externalMB: +(mu.external / 1048576).toFixed(2),
    arrayBuffersMB: +(mu.arrayBuffers / 1048576).toFixed(2),
    handles: handleCounts(),
  })
})
