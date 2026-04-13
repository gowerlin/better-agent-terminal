// BMad Epic/Story data model — parses epics.md for Epic/Story hierarchy display

export type EpicStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE'
export type StoryStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'BLOCKED'

export interface BmadStory {
  id: string           // e.g. '1.1', '1.2'
  title: string
  status: StoryStatus
  workOrderId?: string // T#### association (optional)
}

export interface BmadEpic {
  id: number           // e.g. 1, 2, 3
  title: string        // e.g. 'Epic 1: 專案基礎與本地帳號認證'
  description: string  // paragraph after title
  stories: BmadStory[]
  status: EpicStatus   // derived from stories
  frs?: string         // FRs covered line
}

// ─── Status Utilities ──────────────────────────────────────────────────────

export function epicStatusColor(status: EpicStatus): string {
  switch (status) {
    case 'DONE': return 'ct-epic-status-done'
    case 'IN_PROGRESS': return 'ct-epic-status-in-progress'
    case 'NOT_STARTED': return 'ct-epic-status-not-started'
  }
}

export function epicStatusLabel(status: EpicStatus): string {
  switch (status) {
    case 'DONE': return 'Done'
    case 'IN_PROGRESS': return 'In Progress'
    case 'NOT_STARTED': return 'Not Started'
  }
}

export function storyStatusColor(status: StoryStatus): string {
  switch (status) {
    case 'DONE': return 'ct-story-status-done'
    case 'IN_PROGRESS': return 'ct-story-status-in-progress'
    case 'REVIEW': return 'ct-story-status-review'
    case 'BLOCKED': return 'ct-story-status-blocked'
    case 'TODO': return 'ct-story-status-todo'
  }
}

export function storyStatusLabel(status: StoryStatus): string {
  switch (status) {
    case 'DONE': return 'Done'
    case 'IN_PROGRESS': return 'In Progress'
    case 'REVIEW': return 'Review'
    case 'BLOCKED': return 'Blocked'
    case 'TODO': return 'Todo'
  }
}

// ─── Derive Epic Status ────────────────────────────────────────────────────

function deriveEpicStatus(stories: BmadStory[]): EpicStatus {
  if (stories.length === 0) return 'NOT_STARTED'
  const allDone = stories.every(s => s.status === 'DONE')
  if (allDone) return 'DONE'
  const anyStarted = stories.some(s => s.status !== 'TODO')
  if (anyStarted) return 'IN_PROGRESS'
  return 'NOT_STARTED'
}

// ─── Parser ────────────────────────────────────────────────────────────────

/**
 * Parse a single epics.md file (BMad planning artifact).
 *
 * Expected format (from real BMad output):
 *   ## Epic N: Title
 *   Description paragraph...
 *   **FRs covered:** FR-01, FR-06, FR-09
 *   ### Story N.M: Title
 *   As a ..., I want ..., So that ...
 *   **Acceptance Criteria:** ...
 */
export function parseEpicsFile(
  content: string,
  sprintStoryMap?: Map<string, { status: StoryStatus; workOrderId?: string }>,
): BmadEpic[] {
  const epics: BmadEpic[] = []
  const lines = content.split('\n')

  let currentEpic: {
    id: number
    title: string
    description: string
    frs?: string
    stories: BmadStory[]
    descLines: string[]
  } | null = null

  let currentStory: { id: string; title: string } | null = null
  let inEpicList = false // track when inside "## Epic List" summary section

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Detect "## Epic List" summary section — skip it (we want the detailed sections)
    if (/^##\s+Epic\s+List\s*$/i.test(line)) {
      inEpicList = true
      continue
    }

    // Detect detailed epic section: ## Epic N: Title
    const epicMatch = line.match(/^##\s+Epic\s+(\d+)\s*[:\uff1a]\s*(.+)$/i)
    if (epicMatch) {
      // Flush previous epic
      if (currentEpic) {
        flushEpic(currentEpic, epics, sprintStoryMap)
      }
      inEpicList = false
      currentStory = null
      currentEpic = {
        id: parseInt(epicMatch[1], 10),
        title: epicMatch[2].trim(),
        description: '',
        stories: [],
        descLines: [],
      }
      continue
    }

    // If we're in the summary Epic List section, skip lines until next H2
    if (inEpicList) continue

    // We need a current epic context for the rest
    if (!currentEpic) continue

    // Story heading: ### Story N.M: Title
    const storyMatch = line.match(/^###\s+Story\s+([\d.]+)\s*[:\uff1a]\s*(.+)$/i)
    if (storyMatch) {
      currentStory = {
        id: storyMatch[1],
        title: storyMatch[2].trim(),
      }
      // Default status; may be overridden by sprint map
      const sprintInfo = sprintStoryMap?.get(`story-${currentStory.id}`)
        ?? sprintStoryMap?.get(currentStory.id)
      currentEpic.stories.push({
        id: currentStory.id,
        title: currentStory.title,
        status: sprintInfo?.status ?? 'TODO',
        workOrderId: sprintInfo?.workOrderId,
      })
      continue
    }

    // FRs covered line
    const frsMatch = line.match(/^\*\*FRs?\s+covered\s*[:\uff1a]\*\*\s*(.+)/i)
    if (frsMatch && !currentStory) {
      currentEpic.frs = frsMatch[1].trim()
      continue
    }

    // Description lines (between epic heading and first story)
    if (!currentStory && line.trim() && !line.startsWith('**')) {
      currentEpic.descLines.push(line.trim())
    }
  }

  // Flush last epic
  if (currentEpic) {
    flushEpic(currentEpic, epics, sprintStoryMap)
  }

  return epics
}

function flushEpic(
  raw: {
    id: number
    title: string
    description: string
    frs?: string
    stories: BmadStory[]
    descLines: string[]
  },
  out: BmadEpic[],
  _sprintMap?: Map<string, { status: StoryStatus; workOrderId?: string }>,
): void {
  out.push({
    id: raw.id,
    title: raw.title,
    description: raw.descLines.join(' '),
    stories: raw.stories,
    status: deriveEpicStatus(raw.stories),
    frs: raw.frs,
  })
}

/**
 * Build a sprint story lookup map from sprint-status stories.
 * Key formats tried: "story-1.1", "1.1", "Story 1.1"
 */
export function buildSprintStoryMap(
  sprintStories: Array<{ id: string; status: string; workOrderId?: string }>,
): Map<string, { status: StoryStatus; workOrderId?: string }> {
  const map = new Map<string, { status: StoryStatus; workOrderId?: string }>()
  const statusNorm: Record<string, StoryStatus> = {
    'todo': 'TODO', 'pending': 'TODO',
    'in_progress': 'IN_PROGRESS', 'in progress': 'IN_PROGRESS', 'in-progress': 'IN_PROGRESS', 'wip': 'IN_PROGRESS',
    'review': 'REVIEW', 'ready for review': 'REVIEW', 'in review': 'REVIEW',
    'done': 'DONE', 'completed': 'DONE', 'complete': 'DONE',
    'blocked': 'BLOCKED',
  }

  for (const s of sprintStories) {
    const status = statusNorm[s.status.toLowerCase()] ?? 'TODO'
    const entry = { status, workOrderId: s.workOrderId }
    map.set(s.id, entry)
    // Also index without "story-" prefix or with it
    if (s.id.startsWith('story-')) {
      map.set(s.id.replace('story-', ''), entry)
    } else {
      map.set(`story-${s.id}`, entry)
    }
  }
  return map
}
