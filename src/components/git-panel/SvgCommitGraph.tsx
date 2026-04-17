/**
 * Phase 3 Tα2 — SVG commit graph driven by real git-scaffold IPC data.
 *
 * Migrated from `src/components/git-poc/benchmark/SvgCommitGraph.tsx` (T0154):
 *   - Type 改為 `GitScaffoldCommit`(真實 IPC 資料)
 *   - 移除 benchmark 專用 `branchColumn` / ticket highlight props
 *   - 簡化版 layout:所有 commits 單一 lane(column 0),parent 連線直線
 *     垂直連接(不做 lane assignment),完整 branch layout 留給 Tα3
 *   - Inline style → CSS class(dynamic 維度/偏移仍維持 inline)
 *
 * Virtualization 透過 `useVirtualizer` 達成:只渲染可見範圍的 SVG nodes,
 * 配合 500k commits 仍可維持 60FPS(T0154 已驗證)。
 */

import { useRef, useMemo } from 'react'
import type { GitScaffoldCommit } from '../../lib/git-scaffold'
import { useVirtualizer } from './useVirtualizer'

interface Props {
  commits: GitScaffoldCommit[]
  height: number
  rowHeight?: number
  colWidth?: number
  highlightHash?: string | null
}

const LANE_COLOR = '#2563eb'
// parent line 最大繪製距離(避免 very-long edges 拖慢渲染)。實際 Tα3 會被 lane
// routing 取代。單純的直線 edge 在 40 rows 以內視覺上已夠清楚。
const MAX_EDGE_ROWS = 40

export function SvgCommitGraph({
  commits,
  height,
  rowHeight = 28,
  colWidth = 18,
  highlightHash = null,
}: Readonly<Props>) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const { startIndex, endIndex, offsetTop, totalHeight } = useVirtualizer({
    count: commits.length,
    rowHeight,
    containerRef: scrollRef,
    overscan: 8,
  })

  // hash → index 對照表:O(1) parent 查詢,僅 commits 變動時重算。
  const hashToIndex = useMemo(() => {
    const m = new Map<string, number>()
    for (let i = 0; i < commits.length; i++) m.set(commits[i].hash, i)
    return m
  }, [commits])

  const visibleRange = commits.slice(startIndex, endIndex)

  // 單 lane 簡化版:graph 欄固定寬度,message 區 640px。
  const graphWidth = colWidth + 12
  const totalWidth = graphWidth + 640
  const laneCx = colWidth / 2 + 4

  return (
    <div ref={scrollRef} className="git-graph-scroll" style={{ height }}>
      <div className="git-graph-inner" style={{ height: totalHeight, width: totalWidth }}>
        <svg
          width={totalWidth}
          height={(endIndex - startIndex) * rowHeight}
          className="git-graph-svg"
          style={{ top: offsetTop }}
        >
          {visibleRange.map((c, i) => {
            const globalIdx = startIndex + i
            const localY = i * rowHeight + rowHeight / 2
            const isHighlight = highlightHash === c.hash

            // 簡化 layout:parent 線一律從當前 commit 直直往下連到 parent row。
            // 完整 lane assignment / edge routing 為 Tα3 範圍。
            const parentLines = c.parents
              .map((pHash, pIdx) => {
                const pIndex = hashToIndex.get(pHash)
                if (pIndex == null) return null
                const deltaRows = pIndex - globalIdx
                if (deltaRows <= 0) return null
                if (deltaRows > MAX_EDGE_ROWS) return null
                const pY = localY + deltaRows * rowHeight
                return (
                  <path
                    key={`p-${pIdx}`}
                    d={`M ${laneCx} ${localY} L ${laneCx} ${pY}`}
                    stroke={LANE_COLOR}
                    strokeWidth={1.4}
                    fill="none"
                    opacity={0.65}
                  />
                )
              })
              .filter(Boolean)

            const circleClass = isHighlight
              ? 'git-graph-commit git-graph-commit-highlight'
              : 'git-graph-commit'
            const subjectClass = isHighlight
              ? 'git-graph-subject git-graph-subject-highlight'
              : 'git-graph-subject'

            return (
              <g key={c.hash}>
                {parentLines}
                <circle
                  cx={laneCx}
                  cy={localY}
                  r={isHighlight ? 6 : 4}
                  fill={isHighlight ? '#fbbf24' : LANE_COLOR}
                  className={circleClass}
                />
                <text
                  x={graphWidth + 6}
                  y={localY + 4}
                  className={subjectClass}
                >
                  {c.abbrevHash} {c.subject.slice(0, 100)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
