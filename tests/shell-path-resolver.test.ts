import * as assert from 'assert'

import { resolvePersistedShellPath, resolvePersistedShellPathWithDiagnostics, resolveShellPath } from '../electron/shell-path-resolver'

let passed = 0
let failed = 0

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✅ ${name}`)
    passed++
  } catch (error) {
    console.log(`  ❌ ${name}`)
    console.log(`     ${(error as Error).message}`)
    failed++
  }
}

console.log('\nresolveShellPath:')

test('windows git-bash prefers discovered bash.exe', () => {
  const result = resolveShellPath('git-bash', {
    platform: 'win32',
    env: { LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local' },
    existsSync: (candidate) => candidate === 'C:\\Users\\tester\\AppData\\Local\\Programs\\Git\\bin\\bash.exe',
  })
  assert.strictEqual(result, 'C:\\Users\\tester\\AppData\\Local\\Programs\\Git\\bin\\bash.exe')
})

test('windows auto falls back to powershell when pwsh is unavailable', () => {
  const result = resolveShellPath('auto', {
    platform: 'win32',
    env: { LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local' },
    existsSync: () => false,
  })
  assert.strictEqual(result, 'powershell.exe')
})

console.log('\nresolvePersistedShellPath:')

test('custom shell uses persisted customShellPath', () => {
  const result = resolvePersistedShellPath(
    { shell: 'custom', customShellPath: 'D:\\tools\\nu\\nu.exe' },
    { platform: 'win32', env: {}, existsSync: () => false }
  )
  assert.strictEqual(result, 'D:\\tools\\nu\\nu.exe')
})

test('persisted git-bash resolves to git bash path', () => {
  const result = resolvePersistedShellPath(
    { shell: 'git-bash' },
    {
      platform: 'win32',
      env: { LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local' },
      existsSync: (candidate) => candidate === 'C:\\Program Files\\Git\\bin\\bash.exe',
    }
  )
  assert.strictEqual(result, 'C:\\Program Files\\Git\\bin\\bash.exe')
})

test('actual settings shape with empty customShellPath falls back to default shell', () => {
  const result = resolvePersistedShellPathWithDiagnostics(
    { shell: 'custom', customShellPath: '' },
    { platform: 'win32', env: {}, existsSync: () => false }
  )
  assert.strictEqual(result.shellPath, undefined)
  assert.strictEqual(result.persistedShell, 'custom')
  assert.strictEqual(result.fallback, true)
  assert.strictEqual(result.fallbackReason, 'empty-custom-shell-path')
})

test('persisted git-bash reports fallback when known executables are missing', () => {
  const result = resolvePersistedShellPathWithDiagnostics(
    { shell: 'git-bash' },
    {
      platform: 'win32',
      env: { LOCALAPPDATA: 'C:\\Users\\tester\\AppData\\Local' },
      existsSync: () => false,
    }
  )
  assert.strictEqual(result.shellPath, 'C:\\Program Files\\Git\\bin\\bash.exe')
  assert.strictEqual(result.persistedShell, 'git-bash')
  assert.strictEqual(result.fallback, true)
  assert.strictEqual(result.fallbackReason, 'missing-known-executable')
})

test('missing persisted shell returns undefined', () => {
  const result = resolvePersistedShellPath(null, {
    platform: 'win32',
    env: {},
    existsSync: () => false,
  })
  assert.strictEqual(result, undefined)
})

console.log(`\n${'='.repeat(40)}`)
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
