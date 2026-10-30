import { describe, it, expect } from 'vitest'
import {
  dualInstallNotices,
  extractLastUpdatedLine,
  formatConfigValue,
  isListedInOverview,
  mergeTowerConfig,
  parseTowerConfigDefaults,
  parseTowerConfigYaml,
  parseTowerState,
  workOrderPhase,
} from '../ct-tower-overview'
import { parseWorkOrder, statusColor, statusLabel, type WorkOrderStatus } from '../../types/control-tower'

// T0701 (D184): Control Tower overview parsing.

const SUMMARY_V1 = `---
schema_kind: tower-state
summary_version: 1
updated_at: "2026-10-25T19:17:48+0800"
session: "第九十二 session"
next_ids:
  workorder: T0701
  decision: "D184"
  bug: BUG-171
todo:
  - "外部測試者A 驗收 BUG-165"
  - 第二則
---
# Tower State

> 最後更新：2026-10-20 10:00（舊的正文時間，不該被用）
`

describe('parseTowerState — summary present', () => {
  it('reads every v1 field', () => {
    const parsed = parseTowerState(SUMMARY_V1)
    expect(parsed.kind).toBe('summary')
    if (parsed.kind !== 'summary') return
    expect(parsed.summary).toEqual({
      summaryVersion: 1,
      updatedAt: '2026-10-25T19:17:48+0800',
      session: '第九十二 session',
      nextIds: [
        { key: 'workorder', value: 'T0701' },
        { key: 'decision', value: 'D184' },
        { key: 'bug', value: 'BUG-171' },
      ],
      todo: ['外部測試者A 驗收 BUG-165', '第二則'],
    })
  })

  it('keeps an unquoted ISO timestamp as written (no Date conversion)', () => {
    const parsed = parseTowerState('---\nschema_kind: tower-state\nsummary_version: 1\nupdated_at: 2026-10-25T19:17:48+08:00\n---\n')
    expect(parsed.kind === 'summary' && parsed.summary.updatedAt).toBe('2026-10-25T19:17:48+08:00')
  })

  it('summary_version 2: reads the known fields, ignores unknown keys', () => {
    const parsed = parseTowerState(
      '---\nschema_kind: tower-state\nsummary_version: 2\nupdated_at: "x"\nfuture_field: [1, 2]\ntodo: ["a"]\n---\nbody\n',
    )
    expect(parsed.kind).toBe('summary')
    if (parsed.kind !== 'summary') return
    expect(parsed.summary.summaryVersion).toBe(2)
    expect(parsed.summary.updatedAt).toBe('x')
    expect(parsed.summary.todo).toEqual(['a'])
    expect(parsed.summary.nextIds).toEqual([])
    expect(parsed.summary.session).toBeUndefined()
  })

  it('missing optional fields are simply absent', () => {
    const parsed = parseTowerState('---\nschema_kind: tower-state\nsummary_version: 1\n---\n')
    expect(parsed).toEqual({ kind: 'summary', summary: { summaryVersion: 1, nextIds: [], todo: [] } })
  })

  it('tolerates a UTF-8 BOM and CRLF', () => {
    const parsed = parseTowerState('﻿---\r\nschema_kind: tower-state\r\nsummary_version: 1\r\nsession: s\r\n---\r\n')
    expect(parsed.kind === 'summary' && parsed.summary.session).toBe('s')
  })

  it('returns all todo items; non-string scalars become text, maps are dropped', () => {
    const parsed = parseTowerState('---\nschema_kind: tower-state\nsummary_version: 1\ntodo: [a, b, c, d, e, f, 7, {x: 1}, ""]\n---\n')
    expect(parsed.kind === 'summary' && parsed.summary.todo).toEqual(['a', 'b', 'c', 'd', 'e', 'f', '7'])
  })
})

describe('parseTowerState — no summary', () => {
  it('no frontmatter: last-updated line from the body', () => {
    expect(parseTowerState('# Tower State\n\n> 最後更新:2026-10-25 09:17 (UTC+8) — 第九十二 session\n')).toEqual({
      kind: 'no-summary',
      lastUpdated: '2026-10-25 09:17 (UTC+8) — 第九十二 session',
    })
  })

  it('no frontmatter and no last-updated line', () => {
    expect(parseTowerState('# Tower State\n')).toEqual({ kind: 'no-summary', lastUpdated: null })
  })

  it('broken YAML: no summary, error reported, never throws', () => {
    const parsed = parseTowerState('---\nschema_kind: tower-state\nsummary_version: [1\n---\n最後更新：A\n')
    expect(parsed.kind).toBe('no-summary')
    if (parsed.kind !== 'no-summary') return
    expect(parsed.summaryError).toMatch(/YAML parse error/)
    expect(parsed.lastUpdated).toBe('A')
  })

  it.each([
    ['wrong schema_kind', 'schema_kind: workorder\nsummary_version: 1'],
    ['missing summary_version', 'schema_kind: tower-state'],
    ['summary_version 0', 'schema_kind: tower-state\nsummary_version: 0'],
    ['summary_version 1.5', 'schema_kind: tower-state\nsummary_version: 1.5'],
    ['summary_version as string', 'schema_kind: tower-state\nsummary_version: "1"'],
  ])('%s → no summary', (_name, fm) => {
    const parsed = parseTowerState(`---\n${fm}\n---\n> 最後更新：B\n`)
    expect(parsed.kind).toBe('no-summary')
    expect(parsed.kind === 'no-summary' && parsed.lastUpdated).toBe('B')
    expect(parsed.kind === 'no-summary' && parsed.summaryError).toBeTruthy()
  })
})

describe('extractLastUpdatedLine', () => {
  it('first match wins; full-width and half-width colons', () => {
    expect(extractLastUpdatedLine('x\n> 最後更新：one\n最後更新:two')).toBe('one')
    expect(extractLastUpdatedLine('最後更新 : spaced')).toBe('spaced')
  })

  it('skips a label with nothing after it', () => {
    expect(extractLastUpdatedLine('最後更新：\n最後更新：real')).toBe('real')
  })
})

const DEFAULTS_MD = `# 塔台設定系統

## \`*config\` 命令

| 不是 | 這張 | 表 |
|---|---|---|
| \`x\` | y | z |

### 可用選項

| 選項 | 有效值 | 預設 | 說明 |
|------|--------|------|------|
| \`alignment-rounds\` | \`0\` - \`5\` | \`3\` | 需求對齊最少提問輪數 |
| \`auto-session\` | \`on\` / \`ask\` / \`off\` / \`yolo\` | \`ask\` | 自動開新 session |
| \`project-prefix\` | \`2-4 字元大寫英文\` / 空 | 空 | 專案前綴 |
| \`auto_commit_format\` | 字串模板 | \`"chore: {description} ({scope})"\` | commit 格式 |

### experience-level 行為差異

| 選項 | 有效值 | 預設 | 說明 |
|---|---|---|---|
| \`not-a-key\` | a | b | c |
`

describe('parseTowerConfigDefaults', () => {
  it('reads only the § 可用選項 table, strips backticks', () => {
    expect(parseTowerConfigDefaults(DEFAULTS_MD)).toEqual([
      { key: 'alignment-rounds', validValues: '0 - 5', defaultValue: '3', description: '需求對齊最少提問輪數' },
      { key: 'auto-session', validValues: 'on / ask / off / yolo', defaultValue: 'ask', description: '自動開新 session' },
      { key: 'project-prefix', validValues: '2-4 字元大寫英文 / 空', defaultValue: '空', description: '專案前綴' },
      { key: 'auto_commit_format', validValues: '字串模板', defaultValue: '"chore: {description} ({scope})"', description: 'commit 格式' },
    ])
  })

  it('no § 可用選項 heading → no rows', () => {
    expect(parseTowerConfigDefaults('# x\n| `a` | b | c | d |\n')).toEqual([])
  })
})

describe('parseTowerConfigYaml', () => {
  it('flat file (BAT style)', () => {
    const { values, error } = parseTowerConfigYaml('# c\nauto-session: on\narchive_days: 2\nenable_bug_tracking: true\nproject-prefix: ""\n')
    expect(error).toBeUndefined()
    expect([...values]).toEqual([
      ['auto-session', 'on'],
      ['archive_days', '2'],
      ['enable_bug_tracking', 'true'],
      ['project-prefix', '""'],
    ])
  })

  it('nested under control-tower (CT style); nested wins over a flat duplicate', () => {
    const { values } = parseTowerConfigYaml('verbose: off\ncontrol-tower:\n  verbose: on\n  archive_days: 7\n')
    expect(values.get('verbose')).toBe('on')
    expect(values.get('archive_days')).toBe('7')
    expect(values.has('control-tower')).toBe(false)
  })

  it('empty file → no keys; broken YAML → error, no keys', () => {
    expect(parseTowerConfigYaml('# only comments\n').values.size).toBe(0)
    const broken = parseTowerConfigYaml('a: [1\n')
    expect(broken.values.size).toBe(0)
    expect(broken.error).toMatch(/YAML parse error/)
  })

  it('formatConfigValue', () => {
    expect(formatConfigValue('')).toBe('""')
    expect(formatConfigValue(null)).toBe('null')
    expect(formatConfigValue([1, 'a'])).toBe('[1,"a"]')
    expect(formatConfigValue(false)).toBe('false')
  })
})

describe('mergeTowerConfig', () => {
  const defaults = parseTowerConfigDefaults(DEFAULTS_MD)
  const map = (o: Record<string, string>) => new Map(Object.entries(o))

  it('project > global > default, with every layer value kept', () => {
    const entries = mergeTowerConfig({
      defaults,
      global: map({ 'auto-session': 'on', 'alignment-rounds': '1' }),
      project: map({ 'auto-session': 'yolo' }),
    })
    const bySession = entries.find(e => e.key === 'auto-session')!
    expect(bySession).toMatchObject({ effective: 'yolo', source: 'project', layers: { default: 'ask', global: 'on', project: 'yolo' } })
    expect(entries.find(e => e.key === 'alignment-rounds')).toMatchObject({ effective: '1', source: 'global' })
    expect(entries.find(e => e.key === 'project-prefix')).toMatchObject({ effective: '空', source: 'default' })
  })

  it('keys only in global / project are listed, after the table keys, alphabetically', () => {
    const entries = mergeTowerConfig({
      defaults,
      global: map({ methodology_zeta: 'g' }),
      project: map({ methodology: 'bmad', 'auto-session': 'on' }),
    })
    expect(entries.map(e => e.key)).toEqual([
      'alignment-rounds', 'auto-session', 'project-prefix', 'auto_commit_format', 'methodology', 'methodology_zeta',
    ])
    expect(entries.find(e => e.key === 'methodology')).toMatchObject({ source: 'project', layers: { project: 'bmad' } })
    expect(entries.find(e => e.key === 'methodology')!.description).toBeUndefined()
  })

  it.each([
    ['no defaults', { defaults: null, global: new Map([['a', '1']]), project: new Map([['a', '2']]) }, [['a', '2', 'project']]],
    ['no global', { defaults: null, global: null, project: new Map([['a', '2']]) }, [['a', '2', 'project']]],
    ['no project', { defaults: null, global: new Map([['a', '1']]), project: null }, [['a', '1', 'global']]],
    ['nothing', { defaults: null, global: null, project: null }, []],
  ] as const)('%s', (_name, input, expected) => {
    expect(mergeTowerConfig(input).map(e => [e.key, e.effective, e.source])).toEqual(expected)
  })

  it('missing defaults layer: only file keys', () => {
    const entries = mergeTowerConfig({ defaults: null, global: null, project: map({ verbose: 'on' }) })
    expect(entries).toEqual([{ key: 'verbose', effective: 'on', source: 'project', layers: { project: 'on' } }])
  })
})

describe('work order phase', () => {
  it.each<[WorkOrderStatus, 'open' | 'closed' | 'unknown', boolean]>([
    ['PENDING', 'open', true],
    ['URGENT', 'open', true],
    ['IN_PROGRESS', 'open', true],
    ['BLOCKED', 'open', true],
    ['PARTIAL', 'open', true],
    ['INTERRUPTED', 'open', true],
    ['PAUSED', 'open', true],
    ['FAILED', 'open', true],
    ['DONE', 'closed', false],
    ['FIXED', 'closed', false],
    ['ABANDONED', 'closed', false],
    ['INVALID', 'unknown', true],
    ['UNKNOWN', 'unknown', false],
  ])('%s → %s (listed: %s)', (status, phase, listed) => {
    expect(workOrderPhase(status)).toBe(phase)
    expect(isListedInOverview(status)).toBe(listed)
  })
})

describe('R4: a work order file without any status is not pending', () => {
  it('report without frontmatter or status field → UNKNOWN', () => {
    const wo = parseWorkOrder('T0022-research-report.md', '# T0022 研究報告\n\n> **工單**：T0022-x\n> **日期**：2026-04-06\n')
    expect(wo.status).toBe('UNKNOWN')
    expect(wo.parseSource).toBe('legacy_markdown')
  })

  it('legacy file with a status still parses it', () => {
    expect(parseWorkOrder('T0001-x.md', '# T0001\n\n- **狀態**：PENDING\n').status).toBe('PENDING')
    expect(parseWorkOrder('T0002-x.md', '# T0002\n\n| **狀態** | ✅ DONE |\n').status).toBe('DONE')
  })
})

// T0702 (D185): blockquote status lines, PAUSED, TODO as a PENDING alias.

/** Header of BMad-Guide `T0098-ct-v44-clt-alignment-meta-plan.md` as on disk (no frontmatter). */
const BMAD_GUIDE_T0098_HEAD = `# T0098 — CT v4.4.x:CLT 對齊 6 項系統性改良(meta-PLAN)

> 建立時間:2026-04-22 11:20 (UTC+8)
> 類型:planning(meta-PLAN)
> 優先級:🟡 Medium
> Renew 次數:0
> 狀態:✅ DONE（原 💡 IDEA 未隨結案更新；2026-10-18 00:32 *sync 補正，見文末 Post-resolution note）
> 開始時間:(待 Phase 1 實際啟動時填寫)
> 完成時間:(待 Phase 4 結案)

---

本 meta-PLAN 狀態推進規則:

- **📋 PLANNED**:Phase 1 全部啟動(T0099-T0101 狀態進入 IN_PROGRESS 以上)
`

/** Header of BMad-Guide `T0099-audit-report.md` (a report: blockquote metadata, no status). */
const BMAD_GUIDE_T0099_REPORT_HEAD = `# T0099 Audit Report — \`_tower-state.md\` 資訊密度

> 量測時間:2026-04-22 13:18 (UTC+8)
> Auditor:Worker (ct-exec T0099)
> Audit-only — 未修改任何 state file,未自動建立後續工單

---

## _tower-state.md 資訊密度 audit

1. Glob 列出 \`_ct-workorders/T*.md\`，篩選狀態為 DONE 的工單
`

function frontmatterOrder(status: string, body = ''): string {
  return `---\nschema_version: 1\nschema_kind: workorder\nid: T9100\ntitle: x\nstatus: ${status}\n---\n\n# T9100\n${body}`
}

describe('T0702: legacy status in a blockquote', () => {
  it('BMad-Guide T0098 header (half-width colon, emoji) → DONE', () => {
    const wo = parseWorkOrder('T0098-ct-v44-clt-alignment-meta-plan.md', BMAD_GUIDE_T0098_HEAD)
    expect(wo.parseSource).toBe('legacy_markdown')
    expect(wo.status).toBe('DONE')
    // only the status reads blockquotes; the other fields keep their pre-T0702 reading
    expect(wo.startedAt).toBeUndefined()
    expect(wo.id).toBe('T0098')
  })

  it.each([
    ['> 狀態：DONE', 'DONE'],
    ['> 狀態:✅ DONE（部分採納）', 'DONE'],
    ['>狀態 : 🔄 IN_PROGRESS', 'IN_PROGRESS'],
    ['> > 狀態:⏸ PAUSED', 'PAUSED'],
    ['> 狀態：📋 PENDING', 'PENDING'],
  ])('%s → %s', (line, status) => {
    expect(parseWorkOrder('T0001-x.md', `# T0001\n\n${line}\n`).status).toBe(status)
  })

  it('a report with blockquote metadata but no status stays UNKNOWN', () => {
    expect(parseWorkOrder('T0099-audit-report.md', BMAD_GUIDE_T0099_REPORT_HEAD).status).toBe('UNKNOWN')
    // 狀態 not at the start of the quoted line, or a quoted value without a status keyword
    expect(parseWorkOrder('T0022-research-report.md', '# T0022\n\n> 本報告的狀態:草稿\n').status).toBe('UNKNOWN')
    expect(parseWorkOrder('T0022-research-report.md', '# T0022\n\n> 狀態:草稿\n').status).toBe('UNKNOWN')
    // not a blockquote
    expect(parseWorkOrder('T0022-research-report.md', '# T0022\n\n狀態:DONE\n').status).toBe('UNKNOWN')
  })

  it('a table header with a 狀態 column does not hide the blockquote status (archived T0104)', () => {
    const content = '# T0104\n\n> 狀態:✅ DONE\n\n## AC\n\n| AC | 狀態 | 落地位置 |\n|---|---|---|\n| AC-1 | ✅ | x |\n'
    expect(parseWorkOrder('T0104-x.md', content).status).toBe('DONE')
  })

  it('the list / table / bold forms still win over a blockquote line', () => {
    expect(parseWorkOrder('T0001-x.md', '# T0001\n\n- **狀態**：PENDING\n\n> 狀態:✅ DONE\n').status).toBe('PENDING')
  })
})

describe('T0702: PAUSED', () => {
  it('frontmatter PAUSED is a status of its own, not INVALID', () => {
    const wo = parseWorkOrder('T9100-x.md', frontmatterOrder('PAUSED'))
    expect(wo.status).toBe('PAUSED')
    expect(wo.parseWarnings).toBeUndefined()
    expect(statusLabel('PAUSED')).toBe('⏸ Paused')
    expect(statusColor('PAUSED')).toBe('ct-status-paused')
  })

  it('legacy ⏸ PAUSED (CT interrupt-protocol table form)', () => {
    expect(parseWorkOrder('T0005-x.md', '# T0005\n\n| **狀態** | ⏸ PAUSED |\n').status).toBe('PAUSED')
  })
})

describe('T0702: TODO is an alias of PENDING', () => {
  it.each(['TODO', 'todo'])('frontmatter status: %s → PENDING, no warning', raw => {
    const wo = parseWorkOrder('T9100-x.md', frontmatterOrder(raw))
    expect(wo.status).toBe('PENDING')
    expect(wo.parseWarnings).toBeUndefined()
    expect(workOrderPhase(wo.status)).toBe('open')
  })

  it('a body PENDING next to frontmatter TODO is not drift', () => {
    const wo = parseWorkOrder('T9100-x.md', frontmatterOrder('TODO', '\n| 狀態 | 📋 PENDING |\n'))
    expect(wo.status).toBe('PENDING')
    expect(wo.parseWarnings).toBeUndefined()
  })

  it('a body status that disagrees with the alias is still drift', () => {
    const wo = parseWorkOrder('T9100-x.md', frontmatterOrder('TODO', '\n| 狀態 | ✅ DONE |\n'))
    expect(wo.status).toBe('PENDING')
    expect(wo.parseWarnings?.map(w => w.kind)).toEqual(['metadata_drift'])
  })

  it('other unknown values stay INVALID', () => {
    expect(parseWorkOrder('T9100-x.md', frontmatterOrder('CLOSED')).status).toBe('INVALID')
  })
})

// T0711: one notice per agent with both a zip install and the plugin.
describe('dualInstallNotices', () => {
  const none = { manual: null, plugin: null }

  it('only manual / only plugin / nothing → no notice', () => {
    expect(dualInstallNotices({
      claude: { manual: { version: '5.14.0' }, plugin: null },
      codex: { manual: null, plugin: { version: '5.14.0', marketplace: 'm' } },
    })).toEqual([])
    expect(dualInstallNotices({ claude: none, codex: none })).toEqual([])
  })

  it('both, same version → info; different → warn; Claude first', () => {
    expect(dualInstallNotices({
      codex: { manual: { version: '5.13.2' }, plugin: { version: '5.14.0', marketplace: 'm' } },
      claude: { manual: { version: '5.14.0' }, plugin: { version: '5.14.0', marketplace: 'm' } },
    })).toEqual([
      { agent: 'claude', manualVersion: '5.14.0', pluginVersion: '5.14.0', level: 'info' },
      { agent: 'codex', manualVersion: '5.13.2', pluginVersion: '5.14.0', level: 'warn' },
    ])
  })

  it('a version that cannot be read → info, version null', () => {
    expect(dualInstallNotices({
      claude: { manual: { version: null }, plugin: { version: '5.14.0', marketplace: 'm' } },
      codex: none,
    })).toEqual([{ agent: 'claude', manualVersion: null, pluginVersion: '5.14.0', level: 'info' }])
  })

  it('older server (no field) or a malformed field → no notice, no throw', () => {
    expect(dualInstallNotices(undefined)).toEqual([])
    expect(dualInstallNotices('x')).toEqual([])
    expect(dualInstallNotices({ claude: 'x', codex: { manual: 1, plugin: {} } })).toEqual([])
  })
})
