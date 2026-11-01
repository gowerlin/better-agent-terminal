// @vitest-environment node
/**
 * T0732 / BUG-179 (D198): the headless bat-server rotates <dataDir>/Logs/bat-scripts.log — the
 * file its PTYs' helpers write (BAT_HELPER_LOG_DIR) — once when it starts. Temp dataDirs only.
 */
import * as fs from 'fs'
import * as path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { BAT_SCRIPTS_LOG_ROTATE_BYTES, batScriptsLogStamp } from '../../bat-scripts-log-rotation'
import { createHeadlessServer, type HeadlessServer } from '../headless-entry'
import { makeHeadlessDataDir, removeHeadlessDataDir } from './helpers/headless-harness'

const dataDirs: string[] = []
const servers: HeadlessServer[] = []

function recordingLogger() {
  const lines: string[] = []
  return {
    lines,
    logger: {
      log: (...args: unknown[]) => { lines.push(args.map(String).join(' ')) },
      warn: () => {},
      error: () => {},
    },
  }
}

function writeSized(file: string, size: number): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, '')
  fs.truncateSync(file, size)
}

async function startServer(dataDir: string, logger: ReturnType<typeof recordingLogger>['logger']) {
  const server = await createHeadlessServer({ dataDir, port: 0, logger })
  servers.push(server)
  await server.start()
  return server
}

afterEach(async () => {
  for (const s of servers.splice(0)) await s.stop()
  for (const dir of dataDirs.splice(0)) removeHeadlessDataDir(dir)
})

describe('headless bat-server — bat-scripts.log rotation', { timeout: 30_000 }, () => {
  it('rotates the helper log dir (<dataDir>/Logs) when the file is over 10 MiB', async () => {
    const dataDir = makeHeadlessDataDir('bat-scripts-rotate')
    dataDirs.push(dataDir)
    const logDir = path.join(dataDir, 'Logs')
    writeSized(path.join(logDir, 'bat-scripts.log'), BAT_SCRIPTS_LOG_ROTATE_BYTES + 1)
    for (let day = 1; day <= 4; day++) fs.writeFileSync(path.join(logDir, `bat-scripts-2026100${day}-000000.log`), '')
    const before = batScriptsLogStamp(new Date())
    const { lines, logger } = recordingLogger()

    await startServer(dataDir, logger)

    const names = fs.readdirSync(logDir).filter(n => n.startsWith('bat-scripts')).sort()
    expect(names).not.toContain('bat-scripts.log')
    expect(names).toHaveLength(3)
    const fresh = names.filter(n => !n.startsWith('bat-scripts-202610'))
    expect(fresh).toHaveLength(1)
    expect(fresh[0] >= `bat-scripts-${before}.log`).toBe(true)
    expect(names).toEqual(['bat-scripts-20261003-000000.log', 'bat-scripts-20261004-000000.log', fresh[0]])
    expect(lines.some(l => l.startsWith('[bat-scripts-log] rotated bat-scripts.log'))).toBe(true)
  })

  it('leaves a small file alone and starts normally', async () => {
    const dataDir = makeHeadlessDataDir('bat-scripts-small')
    dataDirs.push(dataDir)
    const file = path.join(dataDir, 'Logs', 'bat-scripts.log')
    writeSized(file, 1024)
    const { lines, logger } = recordingLogger()

    const server = await startServer(dataDir, logger)

    expect(server.getInfo().port).toBeGreaterThan(0)
    expect(fs.statSync(file).size).toBe(1024)
    expect(lines.filter(l => l.startsWith('[bat-scripts-log]'))).toEqual([])
  })

  it('starts normally when there is no Logs directory', async () => {
    const dataDir = makeHeadlessDataDir('bat-scripts-none')
    dataDirs.push(dataDir)
    const { logger } = recordingLogger()
    const server = await startServer(dataDir, logger)
    expect(server.getInfo().port).toBeGreaterThan(0)
  })

  it('rotates the same directory its helpers log to (BAT_HELPER_LOG_DIR = endpoint.logDir)', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', 'headless-entry.ts'), 'utf-8')
    expect(src).toContain("const helperLogDir = path.join(opts.dataDir, 'Logs')")
    expect(src).toContain('logDir: helperLogDir,')
    expect(src).toContain('rotateBatScriptsLog(helperLogDir,')
  })
})
