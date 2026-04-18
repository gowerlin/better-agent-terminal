/**
 * T0195 — extractPriorityFromPlanContent() coverage
 *
 * Runs with: npx tsx tests/backlog-priority-parser.test.ts
 *
 * Covers BUG-045 parser face: bullet list + markdown table formats both resolve.
 */

import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { extractPriorityFromPlanContent, type PlanPriority } from '../src/types/backlog'

type SampleCase = {
  name: string
  input: string
  expected: PlanPriority
}

const inlineCases: SampleCase[] = [
  {
    name: 'bullet list — Chinese High (PLAN-012 style)',
    input: '## 元資料\n- **優先級**：🔴 High\n- **狀態**：IDEA\n',
    expected: 'High',
  },
  {
    name: 'bullet list — Chinese Low (PLAN-019 style)',
    input: '## 元資料\n- **優先級**：🟢 Low\n- **狀態**：IDEA\n',
    expected: 'Low',
  },
  {
    name: 'markdown table — Chinese Low (PLAN-003 style)',
    input: '| 欄位 | 值 |\n|------|----|\n| **優先級** | 🟢 Low (13 moderate CVE) |\n',
    expected: 'Low',
  },
  {
    name: 'markdown table — Chinese High (PLAN-016 style)',
    input: '| 欄位 | 值 |\n|------|----|\n| **優先級** | 🔴 High |\n',
    expected: 'High',
  },
  {
    name: 'markdown table — English Medium',
    input: '| Field | Value |\n|-------|-------|\n| **Priority** | Medium |\n',
    expected: 'Medium',
  },
]

const edgeCases: SampleCase[] = [
  {
    name: 'bullet list before table — bullet wins',
    input: '- **優先級**：🔴 High\n\n| **優先級** | 🟢 Low |\n',
    expected: 'High',
  },
  {
    name: 'extra whitespace in table cell',
    input: '|   **優先級**   |   🔴 High   |\n',
    expected: 'High',
  },
  {
    name: 'no priority present → Unknown',
    input: '- **狀態**：DONE\n',
    expected: 'Unknown',
  },
]

let passed = 0
let failed = 0

for (const c of [...inlineCases, ...edgeCases]) {
  const actual = extractPriorityFromPlanContent(c.input)
  if (actual === c.expected) {
    passed++
    console.log(`  ✅ ${c.name}`)
  } else {
    failed++
    console.log(`  ❌ ${c.name} — expected ${c.expected}, got ${actual}`)
  }
}

// ── Real PLAN file verification ──────────────────────────────────────────────
const workordersDir = join(__dirname, '..', '_ct-workorders')
const realPlanExpectations: Record<string, PlanPriority> = {
  'PLAN-003': 'Low',
  'PLAN-005': 'Low',
  'PLAN-012': 'High',
  'PLAN-016': 'High',
  'PLAN-019': 'Low',
}

const files = readdirSync(workordersDir)
console.log('\nReal PLAN files:')
for (const [id, expected] of Object.entries(realPlanExpectations)) {
  const match = files.find((f) => f.startsWith(`${id}-`))
  if (!match) {
    console.log(`  ⚠️  ${id} file not found, skipping`)
    continue
  }
  const content = readFileSync(join(workordersDir, match), 'utf-8')
  const actual = extractPriorityFromPlanContent(content)
  if (actual === expected) {
    passed++
    console.log(`  ✅ ${id} → ${actual}`)
  } else {
    failed++
    console.log(`  ❌ ${id} → expected ${expected}, got ${actual}`)
  }
}

console.log(`\n${passed} passed, ${failed} failed`)
assert.equal(failed, 0, `${failed} test(s) failed`)
