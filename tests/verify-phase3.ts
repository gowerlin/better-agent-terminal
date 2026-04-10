/**
 * Phase 3: Sprint Visualization + Cross Validation + Toast Notification
 * 驗證腳本 — 靜態結構及解析邏輯檢查
 *
 * 執行方式: npx tsx tests/verify-phase3.ts
 */

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '..')
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

function fileExists(relPath: string): boolean {
  return fs.existsSync(path.join(ROOT, relPath))
}

function fileContains(relPath: string, text: string): boolean {
  const content = fs.readFileSync(path.join(ROOT, relPath), 'utf-8')
  return content.includes(text)
}

// ─── Test Groups ─────────────────────────────────────────────────────────────

console.log('\n=== Phase 3 Verification ===\n')

// 1. New Files
console.log('1. New Files')
assert('sprint-status.ts exists', fileExists('src/types/sprint-status.ts'))
assert('KanbanView.tsx exists', fileExists('src/components/KanbanView.tsx'))
assert('SprintProgress.tsx exists', fileExists('src/components/SprintProgress.tsx'))
assert('CtToast.tsx exists', fileExists('src/components/CtToast.tsx'))

// 2. Sprint Status Parser
console.log('\n2. Sprint Status Parser')
const sprintStatusSrc = fs.readFileSync(path.join(ROOT, 'src/types/sprint-status.ts'), 'utf-8')
assert('imports js-yaml', sprintStatusSrc.includes("import yaml from 'js-yaml'"))
assert('exports SprintStatus type', sprintStatusSrc.includes('export interface SprintStatus'))
assert('exports SprintStory type', sprintStatusSrc.includes('export interface SprintStory'))
assert('exports parseSprintStatus', sprintStatusSrc.includes('export function parseSprintStatus'))
assert('exports getSprintYamlPaths', sprintStatusSrc.includes('export function getSprintYamlPaths'))
assert('exports crossValidate', sprintStatusSrc.includes('export function crossValidate'))
assert('exports calculateProgress', sprintStatusSrc.includes('export function calculateProgress'))
assert('exports getKanbanLane', sprintStatusSrc.includes('export function getKanbanLane'))
assert('STATUS_MAP has all story statuses', 
  sprintStatusSrc.includes("'todo'") && 
  sprintStatusSrc.includes("'in_progress'") && 
  sprintStatusSrc.includes("'done'") &&
  sprintStatusSrc.includes("'blocked'"))
assert('Searches 5 YAML paths', sprintStatusSrc.includes('_ct-workorders/sprint-status.yaml') &&
  sprintStatusSrc.includes('_bmad-output/implementation-artifacts/sprint-status.yaml') &&
  sprintStatusSrc.includes('docs/sprint-status.yaml'))
assert('Handles array stories', sprintStatusSrc.includes('Array.isArray(storiesField)'))
assert('Handles map stories', sprintStatusSrc.includes('parseStoryFromMap'))
assert('Handles nested sprint', sprintStatusSrc.includes("'current_sprint'"))
assert('Handles epics array', sprintStatusSrc.includes("'epics'"))

// 3. Kanban View
console.log('\n3. Kanban View')
const kanbanSrc = fs.readFileSync(path.join(ROOT, 'src/components/KanbanView.tsx'), 'utf-8')
assert('Exports KanbanView component', kanbanSrc.includes('export function KanbanView'))
assert('Maps work order to lane', kanbanSrc.includes('workOrderToLane'))
assert('Has 5 lane types', kanbanSrc.includes("'TODO'") && kanbanSrc.includes("'IN_PROGRESS'") &&
  kanbanSrc.includes("'REVIEW'") && kanbanSrc.includes("'DONE'") && kanbanSrc.includes("'BLOCKED'"))
assert('Uses i18n for lane labels', kanbanSrc.includes("t(`controlTower.lane."))
assert('Has execute button', kanbanSrc.includes('onExecWorkOrder'))

// 4. Sprint Progress
console.log('\n4. Sprint Progress')
const sprintSrc = fs.readFileSync(path.join(ROOT, 'src/components/SprintProgress.tsx'), 'utf-8')
assert('Exports SprintProgress component', sprintSrc.includes('export function SprintProgress'))
assert('Shows progress bar', sprintSrc.includes('ct-progress-bar'))
assert('Shows cross validation', sprintSrc.includes('ValidationSection'))
assert('Shows story lanes', sprintSrc.includes('StoryLanes'))
assert('Uses calculateProgress', sprintSrc.includes('calculateProgress'))
assert('Uses crossValidate', sprintSrc.includes('crossValidate'))
assert('Shows mismatch count', sprintSrc.includes('mismatches.length'))

// 5. Toast Notification
console.log('\n5. Toast Notification')
const toastSrc = fs.readFileSync(path.join(ROOT, 'src/components/CtToast.tsx'), 'utf-8')
assert('Exports CtToast component', toastSrc.includes('export function CtToast'))
assert('Exports useCtToast hook', toastSrc.includes('export function useCtToast'))
assert('Has 3 toast types', toastSrc.includes("'success'") && toastSrc.includes("'info'") && toastSrc.includes("'warning'"))
assert('Auto-dismiss with timer', toastSrc.includes('setTimeout'))
assert('Fade animation', toastSrc.includes('ct-toast-fade'))

// 6. ControlTowerPanel Integration
console.log('\n6. ControlTowerPanel Integration')
const ctPanelSrc = fs.readFileSync(path.join(ROOT, 'src/components/ControlTowerPanel.tsx'), 'utf-8')
assert('Imports sprint-status types', ctPanelSrc.includes("from '../types/sprint-status'"))
assert('Imports KanbanView', ctPanelSrc.includes("from './KanbanView'"))
assert('Imports SprintProgress', ctPanelSrc.includes("from './SprintProgress'"))
assert('Imports CtToast', ctPanelSrc.includes("from './CtToast'"))
assert('Has CtTab type', ctPanelSrc.includes("type CtTab = 'orders' | 'kanban' | 'sprint'"))
assert('Loads sprint status YAML', ctPanelSrc.includes('loadSprintStatus'))
assert('Has tab switching UI', ctPanelSrc.includes('ct-tabs') && ctPanelSrc.includes('setActiveTab'))
assert('Tab: orders', ctPanelSrc.includes("activeTab === 'orders'"))
assert('Tab: kanban', ctPanelSrc.includes("activeTab === 'kanban'"))
assert('Tab: sprint (conditional)', ctPanelSrc.includes('sprintStatus &&'))
assert('Detects status changes', ctPanelSrc.includes('detectStatusChanges'))
assert('Toast on DONE', ctPanelSrc.includes("wo.status === 'DONE'"))
assert('Toast on new order', ctPanelSrc.includes('toast.newOrder'))
assert('Reloads sprint on fs change', ctPanelSrc.includes('loadSprintStatus()'))

// 7. i18n Keys
console.log('\n7. i18n Keys')
const enJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/locales/en.json'), 'utf-8'))
const twJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/locales/zh-TW.json'), 'utf-8'))
const cnJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/locales/zh-CN.json'), 'utf-8'))

for (const [lang, json] of [['en', enJson], ['zh-TW', twJson], ['zh-CN', cnJson]] as const) {
  const ct = json.controlTower
  assert(`${lang}: tab.orders`, ct?.tab?.orders !== undefined)
  assert(`${lang}: tab.kanban`, ct?.tab?.kanban !== undefined)
  assert(`${lang}: tab.sprint`, ct?.tab?.sprint !== undefined)
  assert(`${lang}: lane.TODO`, ct?.lane?.TODO !== undefined)
  assert(`${lang}: lane.DONE`, ct?.lane?.DONE !== undefined)
  assert(`${lang}: toast.completed`, ct?.toast?.completed !== undefined)
  assert(`${lang}: toast.started`, ct?.toast?.started !== undefined)
  assert(`${lang}: toast.newOrder`, ct?.toast?.newOrder !== undefined)
  assert(`${lang}: validation.title`, ct?.validation?.title !== undefined)
  assert(`${lang}: validation.allMatch`, ct?.validation?.allMatch !== undefined)
  assert(`${lang}: validation.mismatch`, ct?.validation?.mismatch !== undefined)
}

// 8. CSS
console.log('\n8. CSS')
const cssSrc = fs.readFileSync(path.join(ROOT, 'src/styles/control-tower.css'), 'utf-8')
assert('Has .ct-tabs', cssSrc.includes('.ct-tabs'))
assert('Has .ct-tab.active', cssSrc.includes('.ct-tab.active'))
assert('Has .ct-kanban', cssSrc.includes('.ct-kanban'))
assert('Has .ct-kanban-lane', cssSrc.includes('.ct-kanban-lane'))
assert('Has .ct-kanban-card', cssSrc.includes('.ct-kanban-card'))
assert('Has .ct-sprint', cssSrc.includes('.ct-sprint'))
assert('Has .ct-progress-bar', cssSrc.includes('.ct-progress-bar'))
assert('Has .ct-prog-done/active/blocked', cssSrc.includes('.ct-prog-done') && cssSrc.includes('.ct-prog-active') && cssSrc.includes('.ct-prog-blocked'))
assert('Has .ct-validation', cssSrc.includes('.ct-validation'))
assert('Has .ct-toast', cssSrc.includes('.ct-toast'))
assert('Has toast animation', cssSrc.includes('@keyframes ct-toast-in'))
assert('Has lane bg colors', cssSrc.includes('.ct-lane-bg-in_progress') && cssSrc.includes('.ct-lane-bg-done'))

// 9. Dependencies
console.log('\n9. Dependencies')
const pkgJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'))
assert('js-yaml in dependencies', pkgJson.dependencies?.['js-yaml'] !== undefined)
assert('@types/js-yaml in devDependencies', pkgJson.devDependencies?.['@types/js-yaml'] !== undefined)

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed, ${passed + failed} total ===\n`)
process.exit(failed > 0 ? 1 : 0)
