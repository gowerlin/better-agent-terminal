import * as fs from 'fs/promises'
import os from 'os'
import path from 'path'

/**
 * T0505: an alias is used as the whole ssh target (`ssh -- <alias>`), so only
 * names the target whitelist accepts are offered. This also drops wildcard
 * (`*`, `?`) and negated (`!name`) patterns, which are not connectable hosts.
 */
const ALIAS_RE = /^(?!-)[A-Za-z0-9._-]{1,253}$/

export function isUsableSshAlias(alias: string): boolean {
  return ALIAS_RE.test(alias)
}

export async function listSshHosts(): Promise<string[]> {
  const configPath = path.join(os.homedir(), '.ssh', 'config')
  try {
    const lines = (await fs.readFile(configPath, 'utf8')).split(/\r?\n/)
    const hosts: string[] = []
    for (const line of lines) {
      const match = /^Host\s+(.+)$/i.exec(line.trim())
      if (match) {
        hosts.push(...match[1].split(/\s+/).filter(isUsableSshAlias))
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
