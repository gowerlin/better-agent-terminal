/**
 * SVG + virtualization commit graph — T0154 假設 1 實測用
 *
 * 設計:
 *   - 外層固定高度、捲動的 div (clientHeight 驅動 virtualization)
 *   - 內層 SVG(width = branchCols * colWidth, height = count * rowHeight)
 *     只繪製可見範圍的 commit(圓點 + parent 連線 + 短 message)
 *   - 每個 commit row 約 5-8 個 SVG element(含 parent lines),10k rows
 *     全畫會 50-80k DOM,但 virtualization 下僅畫 ~50 rows = <500 nodes
 */

import { useRef, useMemo } from 'react'
import type { SynthCommit } from './synthGen'
import { useVirtualizer } from './useVirtualizer'

interface Props {
  commits: SynthCommit[]
  height: number
  rowHeight?: number
  colWidth?: number
  branchColors?: string[]
  highlightHash?: string | null
}

const DEFAULT_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#ea580c',
  '#9333ea', '#0891b2', '#ca8a04', '#be185d',
]

export function SvgCommitGraph({
  commits,
  height,
  rowHeight = 28,
  colWidth = 18,
  branchColors = DEFAULT_COLORS,
  highlightHash = null,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)

  const { startIndex, endIndex, offsetTop, totalHeight } = useVirtualizer({
    count: commits.length,
    rowHeight,
    containerRef: scrollRef,
    overscan: 8,
  })

  // 建 hash→index map (一次性,commits 變動時才重算)
  const hashToIndex = useMemo(() => {
    const m = new Map<string, number>()
    for (let i = 0; i < commits.length; i++) m.set(commits[i].hash, i)
    return m
  }, [commits])

  // 可見範圍內的 commits
  const visibleRange = commits.slice(startIndex, endIndex)

  // 決定 SVG 寬度(branchCount * colWidth + message 區)
  const maxColumn = useMemo(() => {
    let max = 0
    for (const c of commits) if (c.branchColumn > max) max = c.branchColumn
    return max
  }, [commits])

  const graphWidth = (maxColumn + 1) * colWidth + 12
  const totalWidth = graphWidth + 600  // message 區

  return (
    <div
      ref={scrollRef}
      style={{
        height,
        overflowY: 'auto',
        overflowX: 'auto',
        fontFamily: 'monospace',
        fontSize: 11,
        background: '#0f172a',
        color: '#e2e8f0',
        position: 'relative',
      }}
    >
      <div style={{ height: totalHeight, position: 'relative', width: totalWidth }}>
        <svg
          width={totalWidth}
          height={(endIndex - startIndex) * rowHeight}
          style={{
            position: 'absolute',
            top: offsetTop,
            left: 0,
            display: 'block',
          }}
        >
          {visibleRange.map((c, i) => {
            const globalIdx = startIndex + i
            const localY = i * rowHeight + rowHeight / 2
            const cx = c.branchColumn * colWidth + colWidth / 2 + 4
            const color = branchColors[c.branchColumn % branchColors.length]
            const isHighlight = highlightHash === c.hash

            // 繪製 parent 線 (僅當 parent 也在可見範圍)
            const parentLines = c.parents.map((pHash, pIdx) => {
              const pIndex = hashToIndex.get(pHash)
              if (pIndex == null) return null
              const deltaRows = pIndex - globalIdx
              // 只畫下方的 parent(parent 在 commit 之後的 render order)
              if (deltaRows <= 0) return null
              const pY = localY + deltaRows * rowHeight
              // 限制畫線範圍(避免 very long)
              if (deltaRows > 40) return null
              const pCommit = commits[pIndex]
              const pCx = pCommit.branchColumn * colWidth + colWidth / 2 + 4
              return (
                <path
                  key={`p-${pIdx}`}
                  d={`M ${cx} ${localY} L ${cx} ${pY - 8} Q ${cx} ${pY} ${pCx} ${pY}`}
                  stroke={color}
                  strokeWidth={1.4}
                  fill="none"
                  opacity={0.7}
                />
              )
            })

            return (
              <g key={c.hash}>
                {parentLines}
                <circle
                  cx={cx}
                  cy={localY}
                  r={isHighlight ? 6 : 4}
                  fill={isHighlight ? '#fbbf24' : color}
                  stroke={isHighlight ? '#fef3c7' : '#0f172a'}
                  strokeWidth={isHighlight ? 2 : 1}
                />
                <text
                  x={graphWidth + 6}
                  y={localY + 4}
                  fill={isHighlight ? '#fde68a' : '#cbd5e1'}
                  fontSize={11}
                  style={{ userSelect: 'none' }}
                >
                  {c.hash.slice(0, 7)} {c.message.slice(0, 80)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
