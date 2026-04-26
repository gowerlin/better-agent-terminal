import * as fs from 'fs/promises'
import os from 'os'
import path from 'path'

export async function listSshHosts(): Promise<string[]> {
  const configPath = path.join(os.homedir(), '.ssh', 'config')
  try {
    const lines = (await fs.readFile(configPath, 'utf8')).split(/\r?\n/)
    const hosts: string[] = []
    for (const line of lines) {
      const match = /^Host\s+(.+)$/i.exec(line.trim())
      if (match) {
        hosts.push(...match[1].split(/\s+/).filter((host) => !host.includes('*') && !host.includes('?')))
      }
    }
    return [...new Set(hosts)]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }
}
