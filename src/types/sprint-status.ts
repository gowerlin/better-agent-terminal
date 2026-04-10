/**
 * Sprint Status YAML Parser
 * 容錯解析 sprint-status.yaml — 格式不固定（由 AI 產生），支援多種可能結構
 */
import yaml from 'js-yaml'

// ─── Types ───────────────────────────────────────────────────────────────────

export type StoryStatus =
  | 'TODO'
  | 'IN_PROGRESS'
  | 'REVIEW'
  | 'DONE'
  | 'BLOCKED'
  | 'INTERRUPTED'
  | 'PAUSED'
  | 'URGENT'

export interface SprintStory {
  id: string
  title: string
  status: StoryStatus
  workOrderId?: string   // T#### 對應
  epic?: string
}

export interface SprintStatus {
  sprintName: string
  status?: string
  stories: SprintStory[]
  raw: Record<string, unknown>  // 保留原始解析結果供 debug
}

export interface CrossValidation {
  workOrderId: string
  workOrderStatus: string
  yamlStoryId?: string
  yamlStatus?: string
  match: boolean
  issue?: string  // 描述不一致原因
}

// ─── Status Normalization ────────────────────────────────────────────────────

const STATUS_MAP: Record<string, StoryStatus> = {
  'todo': 'TODO',
  'pending': 'TODO',
  '📋': 'TODO',
  'in_progress': 'IN_PROGRESS',
  'in progress': 'IN_PROGRESS',
  'in-progress': 'IN_PROGRESS',
  'wip': 'IN_PROGRESS',
  '🔄': 'IN_PROGRESS',
  'review': 'REVIEW',
  'ready for review': 'REVIEW',
  'ready_for_review': 'REVIEW',
  'in review': 'REVIEW',
  '👀': 'REVIEW',
  'done': 'DONE',
  'completed': 'DONE',
  'complete': 'DONE',
  '✅': 'DONE',
  'blocked': 'BLOCKED',
  '❌': 'BLOCKED',
  'interrupted': 'INTERRUPTED',
  'partial': 'INTERRUPTED',
  '⚡': 'INTERRUPTED',
  'paused': 'PAUSED',
  '⏸': 'PAUSED',
  'urgent': 'URGENT',
  '🔥': 'URGENT',
}

function normalizeStatus(raw: string): StoryStatus {
  const lower = raw.trim().toLowerCase()
  return STATUS_MAP[lower] ?? 'TODO'
}

// ─── Sprint Status YAML Locations ────────────────────────────────────────────

/**
 * sprint-status.yaml 可能存在的位置（依優先順序）
 */
export function getSprintYamlPaths(workspacePath: string): string[] {
  return [
    `${workspacePath}/_ct-workorders/sprint-status.yaml`,
    `${workspacePath}/sprint-status.yaml`,
    `${workspacePath}/_bmad-output/implementation-artifacts/sprint-status.yaml`,
    `${workspacePath}/docs/sprint-status.yaml`,
    `${workspacePath}/_bmad-output/sprint-status.yaml`,
  ]
}

// ─── Parser ──────────────────────────────────────────────────────────────────

/**
 * 容錯解析 sprint-status.yaml
 * 支援多種 AI 產生的格式變體
 */
export function parseSprintStatus(yamlContent: string): SprintStatus | null {
  let parsed: unknown
  try {
    parsed = yaml.load(yamlContent)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') return null

  const obj = parsed as Record<string, unknown>
  const stories: SprintStory[] = []

  // 提取 sprint 名稱
  const sprintName = extractString(obj, ['sprint', 'sprint_name', 'name', 'current_sprint'])
    ?? 'Sprint'

  // 提取 sprint 狀態
  const status = extractString(obj, ['status', 'sprint_status'])

  // 嘗試多種 stories 結構
  extractStories(obj, stories)

  return { sprintName, status, stories, raw: obj }
}

// ─── Story Extraction ────────────────────────────────────────────────────────

function extractStories(obj: Record<string, unknown>, out: SprintStory[]): void {
  // 1. 直接 stories 陣列:  stories: [{ id, title, status }, ...]
  const storiesField = findField(obj, ['stories', 'tasks', 'items'])
  if (Array.isArray(storiesField)) {
    for (const item of storiesField) {
      const story = parseStoryItem(item)
      if (story) out.push(story)
    }
    return
  }

  // 2. stories 是 object map:  stories: { story-name: { status, ... } }
  if (storiesField && typeof storiesField === 'object' && !Array.isArray(storiesField)) {
    const map = storiesField as Record<string, unknown>
    for (const [key, value] of Object.entries(map)) {
      const story = parseStoryFromMap(key, value)
      if (story) out.push(story)
    }
    return
  }

  // 3. Nested: current_sprint.stories or sprint.stories
  for (const topKey of ['current_sprint', 'sprint', 'epic', 'epics']) {
    const nested = obj[topKey]
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      extractStories(nested as Record<string, unknown>, out)
      if (out.length > 0) return
    }
  }

  // 4. 陣列 of epics with stories inside
  const epicsField = findField(obj, ['epics'])
  if (Array.isArray(epicsField)) {
    for (const epic of epicsField) {
      if (epic && typeof epic === 'object') {
        const epicName = extractString(epic as Record<string, unknown>, ['name', 'title', 'id'])
        const epicObj = epic as Record<string, unknown>
        const innerStories = findField(epicObj, ['stories', 'tasks', 'items'])
        if (Array.isArray(innerStories)) {
          for (const item of innerStories) {
            const story = parseStoryItem(item, epicName ?? undefined)
            if (story) out.push(story)
          }
        }
      }
    }
  }
}

function parseStoryItem(item: unknown, epicName?: string): SprintStory | null {
  if (!item || typeof item !== 'object') return null
  const obj = item as Record<string, unknown>

  const id = extractString(obj, ['id', 'story_id', 'name']) ?? ''
  const title = extractString(obj, ['title', 'name', 'description']) ?? id
  const rawStatus = extractString(obj, ['status', 'state'])
  const workOrderId = extractString(obj, ['work_order', 'work_order_id', 'workorder', 'wo'])

  if (!id && !title) return null

  return {
    id: id || title,
    title,
    status: rawStatus ? normalizeStatus(rawStatus) : 'TODO',
    workOrderId: workOrderId ?? undefined,
    epic: epicName,
  }
}

function parseStoryFromMap(key: string, value: unknown): SprintStory | null {
  if (typeof value === 'string') {
    return {
      id: key,
      title: key.replace(/-/g, ' '),
      status: normalizeStatus(value),
    }
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const title = extractString(obj, ['title', 'name']) ?? key.replace(/-/g, ' ')
    const rawStatus = extractString(obj, ['status', 'state']) ?? 'TODO'
    const workOrderId = extractString(obj, ['work_order', 'work_order_id', 'workorder', 'wo'])
    return {
      id: key,
      title,
      status: normalizeStatus(rawStatus),
      workOrderId: workOrderId ?? undefined,
    }
  }
  return null
}

// ─── Cross Validation ────────────────────────────────────────────────────────

/**
 * 比對工單狀態與 sprint-status.yaml 中的狀態
 * 基於 BMad 原則：工單檔案 > sprint-status.yaml > 塔台記憶
 */
export function crossValidate(
  workOrders: Array<{ id: string; status: string }>,
  sprint: SprintStatus,
): CrossValidation[] {
  const results: CrossValidation[] = []

  // 建立 story workOrderId → story 索引
  const storyByWoId = new Map<string, SprintStory>()
  for (const story of sprint.stories) {
    if (story.workOrderId) {
      storyByWoId.set(story.workOrderId, story)
    }
  }

  // 狀態對應表：WorkOrder status → 預期 Story status
  const woToStoryStatus: Record<string, StoryStatus[]> = {
    'PENDING': ['TODO'],
    'URGENT': ['TODO', 'URGENT'],
    'IN_PROGRESS': ['IN_PROGRESS'],
    'DONE': ['DONE'],
    'FAILED': ['BLOCKED'],
    'BLOCKED': ['BLOCKED'],
    'PARTIAL': ['INTERRUPTED', 'IN_PROGRESS'],
    'INTERRUPTED': ['INTERRUPTED', 'PAUSED'],
  }

  for (const wo of workOrders) {
    const story = storyByWoId.get(wo.id)
    if (!story) {
      results.push({
        workOrderId: wo.id,
        workOrderStatus: wo.status,
        match: true, // 沒有對應 story 不算不一致
      })
      continue
    }

    const expectedStatuses = woToStoryStatus[wo.status] ?? []
    const isMatch = expectedStatuses.includes(story.status)

    results.push({
      workOrderId: wo.id,
      workOrderStatus: wo.status,
      yamlStoryId: story.id,
      yamlStatus: story.status,
      match: isMatch,
      issue: isMatch
        ? undefined
        : `工單 ${wo.id} 狀態 ${wo.status}，但 YAML 中為 ${story.status}`,
    })
  }

  return results
}

// ─── Progress Calculation ────────────────────────────────────────────────────

export interface SprintProgress {
  total: number
  done: number
  inProgress: number
  review: number
  blocked: number
  todo: number
  percentage: number
}

export function calculateProgress(stories: SprintStory[]): SprintProgress {
  const total = stories.length
  const done = stories.filter(s => s.status === 'DONE').length
  const inProgress = stories.filter(s => s.status === 'IN_PROGRESS' || s.status === 'URGENT').length
  const review = stories.filter(s => s.status === 'REVIEW').length
  const blocked = stories.filter(s => s.status === 'BLOCKED' || s.status === 'INTERRUPTED').length
  const todo = total - done - inProgress - review - blocked

  return {
    total,
    done,
    inProgress,
    review,
    blocked,
    todo,
    percentage: total > 0 ? Math.round((done / total) * 100) : 0,
  }
}

// ─── Kanban Lane Helpers ─────────────────────────────────────────────────────

export type KanbanLane = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'BLOCKED'

export function getKanbanLane(status: StoryStatus): KanbanLane {
  switch (status) {
    case 'TODO': return 'TODO'
    case 'URGENT': return 'TODO'
    case 'IN_PROGRESS': return 'IN_PROGRESS'
    case 'REVIEW': return 'REVIEW'
    case 'DONE': return 'DONE'
    case 'BLOCKED': return 'BLOCKED'
    case 'INTERRUPTED': return 'BLOCKED'
    case 'PAUSED': return 'TODO'
    default: return 'TODO'
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function extractString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const val = obj[key]
    if (typeof val === 'string') return val
    if (typeof val === 'number') return String(val)
  }
  return null
}

function findField(obj: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in obj) return obj[key]
  }
  return undefined
}
