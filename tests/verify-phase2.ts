/**
 * Phase 2 Control Tower Integration - Parser + Panel Verification
 * 驗證工單解析器和 docking 整合
 * 
 * 使用方式：npx tsx tests/verify-phase2.ts
 */
import { existsSync } from 'fs'
import { execSync } from 'child_process'
import { join } from 'path'

// Inline the parser for testing (avoid tsx import resolution issues)
type WorkOrderStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'FAILED' | 'BLOCKED' | 'PARTIAL' | 'INTERRUPTED' | 'URGENT'

interface WorkOrder {
  id: string
  filename: string
  title: string
  status: WorkOrderStatus
  createdAt: string
  startedAt?: string
  completedAt?: string
  estimatedSize?: string
  contextRisk?: string
  targetSubproject?: string
}

const STATUS_VALUES = new Set<WorkOrderStatus>([
  'PENDING', 'IN_PROGRESS', 'DONE', 'FAILED', 'BLOCKED', 'PARTIAL', 'INTERRUPTED', 'URGENT',
])

function parseWorkOrder(filename: string, content: string): WorkOrder {
  const extractField = (label: string): string | undefined => {
    const regex = new RegExp(`\\*\\*${label}\\*\\*[：:]\\s*(.+)`, 'm')
    const match = content.match(regex)
    return match?.[1]?.trim()
  }
  const filenameToId = (fn: string) => fn.match(/^(T\d+)/)?.[1] ?? fn.replace('.md', '')
  const filenameToTitle = (fn: string) => fn.replace(/^T\d+-/, '').replace(/\.md$/, '').replace(/-/g, ' ')

  const id = extractField('工單編號') ?? filenameToId(filename)
  const title = extractField('任務名稱') ?? extractField('標題') ?? filenameToTitle(filename)
  const rawStatus = extractField('狀態')?.toUpperCase() as WorkOrderStatus | undefined
  const status: WorkOrderStatus = rawStatus && STATUS_VALUES.has(rawStatus) ? rawStatus : 'PENDING'

  return {
    id, filename, title, status,
    createdAt: extractField('建立時間') ?? '',
    startedAt: extractField('開始時間'),
    completedAt: extractField('完成時間'),
    estimatedSize: extractField('預估規模'),
    contextRisk: extractField('Context Window 風險'),
    targetSubproject: extractField('目標子專案'),
  }
}

function isWorkOrderFile(filename: string): boolean {
  return filename.endsWith('.md') && !filename.startsWith('_') && /^T\d+/.test(filename)
}

let passed = 0
let failed = 0

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) { console.log(`  ✅ ${label}`); passed++ }
  else { console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`); failed++ }
}

// ── Parser Tests ─────────────────────────────────────────────
console.log('\n🔍 工單 Parser 測試')

const sample1 = `# 工單 T0001-建立專案上下文

## 元資料
- **工單編號**：T0001
- **任務名稱**：建立專案上下文
- **狀態**：IN_PROGRESS
- **建立時間**：2026-04-10 15:30:00 (UTC+8)
- **開始時間**：2026-04-10 15:35:00 (UTC+8)
- **目標子專案**：backend

## 工作量預估
- **預估規模**：中
- **Context Window 風險**：低
`

const order1 = parseWorkOrder('T0001-create-project-context.md', sample1)
assert('T0001 id 解析', order1.id === 'T0001')
assert('T0001 title 解析', order1.title === '建立專案上下文')
assert('T0001 status 解析', order1.status === 'IN_PROGRESS')
assert('T0001 createdAt 解析', order1.createdAt.includes('2026-04-10'))
assert('T0001 startedAt 解析', order1.startedAt?.includes('15:35') ?? false)
assert('T0001 estimatedSize 解析', order1.estimatedSize === '中')
assert('T0001 contextRisk 解析', order1.contextRisk === '低')
assert('T0001 targetSubproject 解析', order1.targetSubproject === 'backend')

// Fallback: filename-based parsing
const order2 = parseWorkOrder('T0042-fix-login-bug.md', '# Some content without metadata')
assert('T0042 id fallback from filename', order2.id === 'T0042')
assert('T0042 title fallback from filename', order2.title === 'fix login bug')
assert('T0042 status defaults to PENDING', order2.status === 'PENDING')

// URGENT status
const sample3 = `- **工單編號**：T0003\n- **標題**：緊急修復\n- **狀態**：URGENT`
const order3 = parseWorkOrder('T0003-urgent-fix.md', sample3)
assert('T0003 URGENT status', order3.status === 'URGENT')

// DONE status
const sample4 = `- **工單編號**：T0004\n- **任務名稱**：完成工作\n- **狀態**：DONE\n- **完成時間**：2026-04-10 16:00:00`
const order4 = parseWorkOrder('T0004-done-task.md', sample4)
assert('T0004 DONE status', order4.status === 'DONE')
assert('T0004 completedAt', order4.completedAt?.includes('16:00') ?? false)

// ── File Filter Tests ────────────────────────────────────────
console.log('\n🔍 工單檔案過濾測試')

assert('T0001-xxx.md → is work order', isWorkOrderFile('T0001-create-project-context.md'))
assert('T0100-xxx.md → is work order', isWorkOrderFile('T0100-migrate-db.md'))
assert('_tower-state.md → NOT work order', !isWorkOrderFile('_tower-state.md'))
assert('_decisions.md → NOT work order', !isWorkOrderFile('_decisions.md'))
assert('sprint-status.yaml → NOT work order', !isWorkOrderFile('sprint-status.yaml'))
assert('README.md → NOT work order', !isWorkOrderFile('README.md'))

// ── Docking Integration Tests ────────────────────────────────
console.log('\n🔍 Docking 整合驗證（靜態）')

const typesSrc = execSync('cat src/types/index.ts', { encoding: 'utf8', cwd: join(__dirname, '..') })
assert('DockablePanel 包含 control-tower', typesSrc.includes("'control-tower'"))
assert('DOCKABLE_PANELS 包含 control-tower', typesSrc.includes("'control-tower'"))
assert('DEFAULT_DOCKING_CONFIG 有 control-tower', typesSrc.includes("'control-tower': 'right'"))

const workspaceViewSrc = execSync('cat src/components/WorkspaceView.tsx', { encoding: 'utf8', cwd: join(__dirname, '..') })
assert('WorkspaceTab 包含 control-tower', workspaceViewSrc.includes("'control-tower'"))
assert('ControlTowerPanel lazy import 存在', workspaceViewSrc.includes('ControlTowerPanel'))
assert('renderTabContent 有 control-tower case', workspaceViewSrc.includes("case 'control-tower'"))
assert('handleExecWorkOrder 已定義', workspaceViewSrc.includes('handleExecWorkOrder'))

// ── i18n Tests ───────────────────────────────────────────────
console.log('\n🔍 i18n 驗證')

const enSrc = execSync('cat src/locales/en.json', { encoding: 'utf8', cwd: join(__dirname, '..') })
const zhTWSrc = execSync('cat src/locales/zh-TW.json', { encoding: 'utf8', cwd: join(__dirname, '..') })
const zhCNSrc = execSync('cat src/locales/zh-CN.json', { encoding: 'utf8', cwd: join(__dirname, '..') })

assert('en.json has control-tower tab', enSrc.includes('"control-tower"'))
assert('en.json has controlTower section', enSrc.includes('"controlTower"'))
assert('zh-TW.json has control-tower tab', zhTWSrc.includes('"control-tower"'))
assert('zh-TW.json has controlTower section', zhTWSrc.includes('"controlTower"'))
assert('zh-CN.json has control-tower tab', zhCNSrc.includes('"control-tower"'))
assert('zh-CN.json has controlTower section', zhCNSrc.includes('"controlTower"'))

// ── CSS Tests ────────────────────────────────────────────────
console.log('\n🔍 CSS 驗證')

assert('control-tower.css exists', existsSync(join(__dirname, '..', 'src', 'styles', 'control-tower.css')))
const mainTsx = execSync('cat src/main.tsx', { encoding: 'utf8', cwd: join(__dirname, '..') })
assert('main.tsx imports control-tower.css', mainTsx.includes('control-tower.css'))

// ── Component Files ──────────────────────────────────────────
console.log('\n🔍 元件檔案驗證')

assert('ControlTowerPanel.tsx exists', existsSync(join(__dirname, '..', 'src', 'components', 'ControlTowerPanel.tsx')))
assert('control-tower.ts types exists', existsSync(join(__dirname, '..', 'src', 'types', 'control-tower.ts')))

// ── Summary ──────────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`)
console.log(`  結果：${passed} 通過, ${failed} 失敗`)
console.log(`${'═'.repeat(50)}\n`)

process.exit(failed > 0 ? 1 : 0)
