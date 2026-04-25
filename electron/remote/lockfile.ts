import * as fs from 'fs'
import * as path from 'path'

export interface LockInfo {
  pid: number
  startTime: number
}

const LOCKFILE_NAME = 'lockfile.pid'

function lockfilePath(dataDir: string): string {
  return path.join(dataDir, LOCKFILE_NAME)
}

export function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export function acquireLock(dataDir: string): LockInfo {
  const filePath = lockfilePath(dataDir)
  try {
    const raw = fs.readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<LockInfo>
    if (typeof parsed.pid === 'number' && isPidAlive(parsed.pid)) {
      const startedAt =
        typeof parsed.startTime === 'number'
          ? new Date(parsed.startTime).toISOString()
          : 'unknown'
      throw new Error(
        `Another bat-server instance is already using ${dataDir} ` +
          `(pid=${parsed.pid}, startTime=${startedAt}). Stop it first or use a different --data-dir`
      )
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Another bat-server instance')) {
      throw error
    }
  }

  const lock: LockInfo = {
    pid: process.pid,
    startTime: Date.now()
  }
  fs.writeFileSync(filePath, JSON.stringify(lock, null, 2), { mode: 0o600 })
  return lock
}

export function releaseLock(dataDir: string): void {
  try {
    fs.unlinkSync(lockfilePath(dataDir))
  } catch {
    // ignore
  }
}
