import assert from 'node:assert/strict'
import * as fs from 'fs/promises'
import os from 'os'
import path from 'path'
import test from 'node:test'
import { listSshHosts } from '../electron/remote/ssh-config-parser'

const originalHomedir = os.homedir

function useHome(homePath: string) {
  ;(os as typeof os & { homedir: typeof os.homedir }).homedir = () => homePath
}

async function withConfig(configText: string | null, fn: () => Promise<void>) {
  const tempHome = await fs.mkdtemp(path.join(process.cwd(), 'tmp-ssh-config-'))
  const sshDir = path.join(tempHome, '.ssh')
  try {
    await fs.mkdir(sshDir, { recursive: true })
    if (configText !== null) {
      await fs.writeFile(path.join(sshDir, 'config'), configText, 'utf8')
    }
    useHome(tempHome)
    await fn()
  } finally {
    ;(os as typeof os & { homedir: typeof os.homedir }).homedir = originalHomedir
    await fs.rm(tempHome, { recursive: true, force: true })
  }
}

test('returns [] when config is missing', async () => {
  await withConfig(null, async () => {
    assert.deepStrictEqual(await listSshHosts(), [])
  })
})

test('reads a single Host alias', async () => {
  await withConfig('Host devbox\n  HostName dev.example.com\n', async () => {
    assert.deepStrictEqual(await listSshHosts(), ['devbox'])
  })
})

test('splits multiple aliases from one Host line', async () => {
  await withConfig('Host a b c\n', async () => {
    assert.deepStrictEqual(await listSshHosts(), ['a', 'b', 'c'])
  })
})

test('ignores wildcard-only Host entries', async () => {
  await withConfig('Host *.example.com\n', async () => {
    assert.deepStrictEqual(await listSshHosts(), [])
  })
})

test('keeps literal aliases and drops wildcard aliases on the same line', async () => {
  await withConfig('Host foo *.bar ?baz\n', async () => {
    assert.deepStrictEqual(await listSshHosts(), ['foo'])
  })
})

test('comment lines do not affect parsing', async () => {
  await withConfig('# comment\nHost devbox\n# Host ignored\n', async () => {
    assert.deepStrictEqual(await listSshHosts(), ['devbox'])
  })
})

test('matches lowercase host keyword', async () => {
  await withConfig('host devbox\n', async () => {
    assert.deepStrictEqual(await listSshHosts(), ['devbox'])
  })
})

test('dedupes aliases across multiple Host blocks', async () => {
  await withConfig('Host devbox\nHost devbox other\n', async () => {
    assert.deepStrictEqual(await listSshHosts(), ['devbox', 'other'])
  })
})
