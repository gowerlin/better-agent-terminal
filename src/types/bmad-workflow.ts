// BMad Workflow data model — tracks 4-phase BMad-Method completion via file existence

export type PhaseStatus = 'NOT_STARTED' | 'PARTIAL' | 'DONE'

export interface BmadPhaseArtifact {
  name: string          // e.g. 'PRD.md'
  displayName: string   // e.g. 'Product Requirements Document'
  exists: boolean
  dir: string           // subdirectory within _bmad-output/
}

export interface BmadPhase {
  id: number
  name: string          // English phase name
  status: PhaseStatus
  artifacts: BmadPhaseArtifact[]
  isRequired: boolean   // Phase 1 is optional
}

export interface BmadWorkflow {
  phases: BmadPhase[]
  completedPhases: number
  totalPhases: number
}

// Phase → artifact mapping calibrated with actual BMad output
// Reference: D:\ForgejoGit\2026_Cooperative\_bmad-output\
interface PhaseDefinition {
  id: number
  name: string
  required: boolean
  artifacts: ReadonlyArray<{ name: string; displayName: string; dir: string }>
}

export const PHASE_DEFINITIONS: readonly PhaseDefinition[] = [
  {
    id: 1,
    name: 'Analysis',
    required: false,
    artifacts: [
      { name: 'product-brief.md', displayName: 'Product Brief', dir: 'planning-artifacts' },
    ],
  },
  {
    id: 2,
    name: 'Planning',
    required: true,
    artifacts: [
      { name: 'PRD.md', displayName: 'Product Requirements Document', dir: 'planning-artifacts' },
      { name: 'ux-design.md', displayName: 'UX Design', dir: 'planning-artifacts' },
    ],
  },
  {
    id: 3,
    name: 'Solutioning',
    required: true,
    artifacts: [
      { name: 'architecture.md', displayName: 'Architecture', dir: 'planning-artifacts' },
      { name: 'epics.md', displayName: 'Epics', dir: 'planning-artifacts' },
      { name: 'implementation-readiness.md', displayName: 'Implementation Readiness', dir: 'planning-artifacts' },
    ],
  },
  {
    id: 4,
    name: 'Implementation',
    required: true,
    artifacts: [
      { name: 'sprint-status.yaml', displayName: 'Sprint Status', dir: 'implementation-artifacts' },
    ],
  },
]

function computePhaseStatus(artifacts: BmadPhaseArtifact[]): PhaseStatus {
  const existCount = artifacts.filter(a => a.exists).length
  if (existCount === 0) return 'NOT_STARTED'
  if (existCount === artifacts.length) return 'DONE'
  return 'PARTIAL'
}

/** Build workflow state from a map of "dir/filename" → exists */
export function buildBmadWorkflow(
  fileExistsMap: Record<string, boolean>,
): BmadWorkflow {
  const phases: BmadPhase[] = PHASE_DEFINITIONS.map(def => {
    const artifacts: BmadPhaseArtifact[] = def.artifacts.map(a => ({
      name: a.name,
      displayName: a.displayName,
      exists: fileExistsMap[`${a.dir}/${a.name}`] ?? false,
      dir: a.dir,
    }))
    return {
      id: def.id,
      name: def.name,
      status: computePhaseStatus(artifacts),
      artifacts,
      isRequired: def.required,
    }
  })

  return {
    phases,
    completedPhases: phases.filter(p => p.status === 'DONE').length,
    totalPhases: phases.length,
  }
}

export function phaseStatusColor(status: PhaseStatus): string {
  switch (status) {
    case 'DONE': return 'ct-phase-status-done'
    case 'PARTIAL': return 'ct-phase-status-partial'
    case 'NOT_STARTED': return 'ct-phase-status-not-started'
  }
}

export function phaseStatusLabel(status: PhaseStatus): string {
  switch (status) {
    case 'DONE': return 'Done'
    case 'PARTIAL': return 'In Progress'
    case 'NOT_STARTED': return 'Not Started'
  }
}
