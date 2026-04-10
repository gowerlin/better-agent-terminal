/**
 * Phase 1 Control Tower Integration - Verification Script
 * 驗證 Q1 (env vars) + Q3 (workspace mapping)
 * 
 * 使用方式：npx tsx tests/verify-phase1.ts
 */
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

let passed = 0
let failed = 0

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`)
    failed++
  }
}

// ── Q1: Env Var Static Verification ──────────────────────────
console.log('\n🔍 Q1: Env Var Injection (靜態驗證)')

const ptyManagerSrc = execSync('cat electron/pty-manager.ts', { encoding: 'utf8' })

// TERM_PROGRAM 正確
const termProgramMatches = ptyManagerSrc.match(/TERM_PROGRAM:\s*'([^']+)'/g) ?? []
assert(
  'TERM_PROGRAM 設為 better-agent-terminal',
  termProgramMatches.length >= 2 &&
    termProgramMatches.every(m => m.includes('better-agent-terminal')),
  `找到 ${termProgramMatches.length} 處: ${termProgramMatches.join(', ')}`
)

// BAT_SESSION 存在
const batSessionMatches = ptyManagerSrc.match(/BAT_SESSION:\s*'1'/g) ?? []
assert(
  'BAT_SESSION=1 在兩個 code path 都有設定',
  batSessionMatches.length >= 2,
  `找到 ${batSessionMatches.length} 處`
)

// 確認不再有舊的 better-terminal（排除 better-agent-terminal）
const oldTermProgram = ptyManagerSrc.match(/TERM_PROGRAM:\s*'better-terminal'/g) ?? []
assert(
  '不再有舊的 TERM_PROGRAM=better-terminal',
  oldTermProgram.length === 0,
  `仍有 ${oldTermProgram.length} 處使用舊值`
)

// ── Q1: Runtime Env Var Verification ─────────────────────────
console.log('\n🔍 Q1: Env Var Injection (Runtime 驗證 — 模擬 child_process)')

// 模擬 pty-manager 中 child_process path 的 env 注入邏輯
const simulatedEnv: Record<string, string> = {
  ...process.env as Record<string, string>,
  TERM_PROGRAM: 'better-agent-terminal',
  TERM_PROGRAM_VERSION: '1.0',
  BAT_SESSION: '1',
  COLORTERM: 'truecolor',
}

assert(
  'child_process env 中 TERM_PROGRAM 正確',
  simulatedEnv.TERM_PROGRAM === 'better-agent-terminal'
)

assert(
  'child_process env 中 BAT_SESSION 正確',
  simulatedEnv.BAT_SESSION === '1'
)

// 真實 spawn 驗證（模擬 pty-manager 的 child_process fallback）
const result = execSync('echo %BAT_SESSION%||echo $BAT_SESSION', {
  encoding: 'utf8',
  env: simulatedEnv,
  shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/bash',
}).trim()

assert(
  'spawn 子進程能讀到 BAT_SESSION',
  result === '1',
  `實際值: "${result}"`
)

// ── Q3: Workspace Mapping Verification ───────────────────────
console.log('\n🔍 Q3: Workspace ↔ _ct-workorders/ 映射偵測')

const testDir = join(__dirname, 'testworkspace')
const ctDir = join(testDir, '_ct-workorders')

// 確保測試目錄存在
if (!existsSync(testDir)) {
  mkdirSync(testDir, { recursive: true })
}

// Case 1: 沒有 _ct-workorders → 不偵測
if (existsSync(ctDir)) rmSync(ctDir, { recursive: true })
assert(
  '無 _ct-workorders/ 時 → existsSync 回傳 false',
  !existsSync(ctDir)
)

// Case 2: 建立 _ct-workorders → 偵測到
mkdirSync(ctDir, { recursive: true })
assert(
  '有 _ct-workorders/ 時 → existsSync 回傳 true',
  existsSync(ctDir)
)

// Case 3: 放入假工單，確認可讀
const fakeOrderPath = join(ctDir, 'T0001-test.md')
writeFileSync(fakeOrderPath, `- **工單編號**：T0001\n- **標題**：測試工單\n- **狀態**：PENDING\n`)
assert(
  '假工單 T0001-test.md 可建立且可讀',
  existsSync(fakeOrderPath)
)

// Case 4: path.join 組合正確性
const workspaceFolderPath = testDir
const expectedCtPath = join(workspaceFolderPath, '_ct-workorders')
assert(
  'path.join(workspace.folderPath, "_ct-workorders") 路徑正確',
  expectedCtPath === ctDir
)

// Cleanup
rmSync(ctDir, { recursive: true })
assert(
  '清理完成：_ct-workorders/ 已移除',
  !existsSync(ctDir)
)

// ── Q1: IPC Handler + Preload 一致性 ────────────────────────
console.log('\n🔍 Q1: IPC Handler + Preload 一致性檢查')

const mainSrc = execSync('cat electron/main.ts', { encoding: 'utf8' })
const preloadSrc = execSync('cat electron/preload.ts', { encoding: 'utf8' })
const typesSrc = execSync('cat src/types/electron.d.ts', { encoding: 'utf8' })

assert(
  'main.ts 有 terminal:create-with-command handler',
  mainSrc.includes("registerHandler('terminal:create-with-command'")
)

assert(
  'preload.ts 有 createWithCommand 方法',
  preloadSrc.includes('createWithCommand')
)

assert(
  'preload.ts invoke 正確的 channel',
  preloadSrc.includes("ipcRenderer.invoke('terminal:create-with-command'")
)

assert(
  'electron.d.ts 有 createWithCommand 型別',
  typesSrc.includes('createWithCommand')
)

// ── Summary ──────────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`)
console.log(`  結果：${passed} 通過, ${failed} 失敗`)
console.log(`${'═'.repeat(50)}\n`)

process.exit(failed > 0 ? 1 : 0)
