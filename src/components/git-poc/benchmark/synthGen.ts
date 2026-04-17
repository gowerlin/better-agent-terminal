/**
 * 合成 Git commit 資料生成器 (T0154 benchmark 用)
 *
 * 模擬真實 repo 特性:
 * - 主線 + 分支 merge 模式
 * - ~30% commits 含 T#### ticket 參照
 * - hash 為偽 SHA-1 (40 chars hex)
 * - parent commits 建立 DAG
 */

export interface SynthCommit {
  hash: string
  parents: string[]
  message: string
  author: string
  timestamp: number
  branchColumn: number
  tickets: string[]
}

const AUTHORS = ['Gower', 'alice', 'bob', 'carol', 'dave', 'eve']
const COMMIT_VERBS = ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'perf']
const SUBJECTS = [
  'update auth middleware',
  'handle edge case in parser',
  'optimize render pipeline',
  'add test coverage',
  'refactor state management',
  'fix regression in sidebar',
  'improve error messages',
  'update dependencies',
  'simplify config loader',
  'restructure module layout',
]

function pseudoHash(seed: number): string {
  // 穩定偽 SHA-1 (benchmark 可重現)
  let h = seed >>> 0
  let out = ''
  for (let i = 0; i < 5; i++) {
    h = ((h * 1103515245 + 12345) >>> 0) ^ ((h << 13) >>> 0)
    out += h.toString(16).padStart(8, '0').slice(0, 8)
  }
  return out.slice(0, 40)
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface GenOptions {
  count: number
  ticketRate?: number    // 含 T#### 的比例 (default 0.3)
  branchCount?: number   // 並行分支欄位數 (default 6)
  mergeRate?: number     // merge commit 比例 (default 0.08)
  seed?: number
}

/**
 * 生成 N 個合成 commits。
 *
 * 大規模生成 (500k+) 會在 Node 中約 200-500ms,可接受。
 */
export function generateSynthCommits(opts: GenOptions): SynthCommit[] {
  const { count, ticketRate = 0.3, branchCount = 6, mergeRate = 0.08, seed = 42 } = opts
  const rand = mulberry32(seed)
  const commits: SynthCommit[] = new Array(count)

  // 時間從現在往回推,每 commit 間隔 2-30 分鐘
  let t = Date.now()

  // 每個分支 column 的最後 commit hash (用於 merge)
  const columnHeads: (string | null)[] = new Array(branchCount).fill(null)

  // 追蹤每個 ticket 的可被參照 commits (讓反查合理)
  const ticketPool = Math.floor(count * ticketRate / 4) + 50  // 假設每 4 commit 一個新 ticket
  const baseTicketNum = 100

  for (let i = 0; i < count; i++) {
    const hash = pseudoHash(seed * 73856093 + i * 19349663)
    const column = Math.floor(rand() * branchCount)

    // Parent 決定:
    // - 第一個 parent: 同 column 的前一個 commit
    // - 如果是 merge commit (mergeRate 機率,且非首 commit): 加第二個 parent (另一個 column)
    const parents: string[] = []
    if (columnHeads[column]) {
      parents.push(columnHeads[column] as string)
    } else if (i > 0 && commits[i - 1]) {
      // 新分支第一個 commit,parent 是前一個 commit
      parents.push(commits[i - 1].hash)
    }
    if (i > 5 && rand() < mergeRate) {
      // merge: 挑另一個 column
      const otherCol = (column + 1 + Math.floor(rand() * (branchCount - 1))) % branchCount
      if (columnHeads[otherCol]) {
        parents.push(columnHeads[otherCol] as string)
      }
    }

    // Ticket refs
    const tickets: string[] = []
    if (rand() < ticketRate) {
      const ticketNum = baseTicketNum + Math.floor(rand() * ticketPool)
      tickets.push(`T${String(ticketNum).padStart(4, '0')}`)
      // 10% 機率雙 ticket
      if (rand() < 0.1) {
        const t2 = baseTicketNum + Math.floor(rand() * ticketPool)
        if (t2 !== ticketNum) tickets.push(`T${String(t2).padStart(4, '0')}`)
      }
    }

    const verb = COMMIT_VERBS[Math.floor(rand() * COMMIT_VERBS.length)]
    const subject = SUBJECTS[Math.floor(rand() * SUBJECTS.length)]
    const ticketSuffix = tickets.length ? ` (${tickets.join(', ')})` : ''
    const message = `${verb}: ${subject}${ticketSuffix}`

    const author = AUTHORS[Math.floor(rand() * AUTHORS.length)]
    t -= 60 * 1000 * (2 + Math.floor(rand() * 28))  // 2-30 分鐘

    commits[i] = {
      hash,
      parents,
      message,
      author,
      timestamp: t,
      branchColumn: column,
      tickets,
    }

    columnHeads[column] = hash
  }

  return commits
}
