/**
 * Node.js microbenchmark — 假設 2 實測 (T0154)
 *
 * 執行:
 *   npx tsx src/components/git-poc/benchmark/indexBench.ts
 *
 * 量測:
 *   1. 合成 commits 生成時間 (基準)
 *   2. 索引建構時間 (from message regex scan) for 10k/100k/500k
 *   3. 反查延遲 (p50/p95/p99) — 索引查詢 vs linear scan
 *
 * 對照 T0153 估算:
 *   - 索引建構 100k commits: 2-5s
 *   - 反查 p95 (有索引): <50ms
 *   - 反查 p95 (無索引): 200-500ms
 */

import { generateSynthCommits } from './synthGen'
import { CommitIndex, scanCommitsByTicketLinear } from './CommitIndex'

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p))
  return sorted[idx]
}

function fmt(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  if (ms >= 1) return `${ms.toFixed(2)}ms`
  return `${(ms * 1000).toFixed(1)}μs`
}

interface BenchResult {
  scale: number
  genMs: number
  buildMs: number
  buildMsPer1k: number
  indexedLookups: { p50: number; p95: number; p99: number; mean: number }
  linearLookups: { p50: number; p95: number; p99: number; mean: number } | null
  indexStats: { tickets: number; commitsWithTickets: number }
}

async function runScale(count: number, doLinearScan: boolean): Promise<BenchResult> {
  console.log(`\n=== Scale: ${count.toLocaleString()} commits ===`)

  // 1. 生成
  const t0 = performance.now()
  const commits = generateSynthCommits({ count, seed: 42 + count })
  const t1 = performance.now()
  const genMs = t1 - t0
  console.log(`  [1] Generate commits: ${fmt(genMs)}`)

  // 2. 索引建構 (regex 掃 message)
  const idx = new CommitIndex()
  const tb0 = performance.now()
  idx.buildFromMessages(commits)
  const tb1 = performance.now()
  const buildMs = tb1 - tb0
  const stats = idx.stats()
  console.log(
    `  [2] Build index (regex scan): ${fmt(buildMs)} | ` +
    `${stats.tickets} tickets, ${stats.commitsWithTickets} commits with refs`
  )

  // 3. 反查 benchmark
  // 取前 200 個 ticket 來測試 (避免受 Map cache 影響)
  const allTickets = [...idx.ticketToCommits.keys()]
  const sampleCount = Math.min(500, allTickets.length)
  const sampleTickets: string[] = []
  for (let i = 0; i < sampleCount; i++) {
    sampleTickets.push(allTickets[i % allTickets.length])
  }

  // 3a. 索引查詢
  const indexedTimes: number[] = []
  for (const t of sampleTickets) {
    const s = performance.now()
    idx.lookupCommitsByTicket(t)
    indexedTimes.push(performance.now() - s)
  }
  indexedTimes.sort((a, b) => a - b)
  const indexedLookups = {
    p50: percentile(indexedTimes, 0.5),
    p95: percentile(indexedTimes, 0.95),
    p99: percentile(indexedTimes, 0.99),
    mean: indexedTimes.reduce((s, v) => s + v, 0) / indexedTimes.length,
  }
  console.log(
    `  [3a] Indexed lookup (${sampleCount} queries): ` +
    `mean=${fmt(indexedLookups.mean)}, p50=${fmt(indexedLookups.p50)}, ` +
    `p95=${fmt(indexedLookups.p95)}, p99=${fmt(indexedLookups.p99)}`
  )

  // 3b. Linear scan (對照組,僅在 <=100k 跑,避免花太久)
  let linearLookups: BenchResult['linearLookups'] = null
  if (doLinearScan) {
    const linearTimes: number[] = []
    // 只取前 50 次取樣 (linear scan 很慢)
    const linearSample = sampleTickets.slice(0, 50)
    for (const t of linearSample) {
      const s = performance.now()
      scanCommitsByTicketLinear(commits, t)
      linearTimes.push(performance.now() - s)
    }
    linearTimes.sort((a, b) => a - b)
    linearLookups = {
      p50: percentile(linearTimes, 0.5),
      p95: percentile(linearTimes, 0.95),
      p99: percentile(linearTimes, 0.99),
      mean: linearTimes.reduce((s, v) => s + v, 0) / linearTimes.length,
    }
    console.log(
      `  [3b] Linear scan (${linearSample.length} queries): ` +
      `mean=${fmt(linearLookups.mean)}, p50=${fmt(linearLookups.p50)}, ` +
      `p95=${fmt(linearLookups.p95)}, p99=${fmt(linearLookups.p99)}`
    )
  }

  return {
    scale: count,
    genMs,
    buildMs,
    buildMsPer1k: buildMs / (count / 1000),
    indexedLookups,
    linearLookups,
    indexStats: stats,
  }
}

async function main() {
  console.log('T0154 — 假設 2 (CT 工單反查) Node.js microbenchmark')
  console.log(`Node ${process.version} | platform=${process.platform} | ` +
              `arch=${process.arch}`)
  console.log(`CPU count=${require('os').cpus().length}, ` +
              `model=${require('os').cpus()[0]?.model ?? 'unknown'}`)

  const results: BenchResult[] = []

  // 熱身:Node/V8 JIT 需要熱身才有穩定數據
  generateSynthCommits({ count: 1000, seed: 1 })

  // 三種規模
  results.push(await runScale(10_000, true))
  results.push(await runScale(100_000, true))
  results.push(await runScale(500_000, false))  // 500k linear scan 太慢,跳過

  // 輸出對照表
  console.log('\n\n=== 實測 vs T0153 估算對比 ===\n')
  console.log('| Scale | 索引建構 | per 1k | 索引反查 p95 | Linear p95 | 建構估算對比 |')
  console.log('|-------|---------|--------|-------------|-----------|---------------|')
  for (const r of results) {
    // T0153 估算對比
    let est = '-'
    if (r.scale === 100_000) {
      est = `T0153: 2-5s | 實測 ${fmt(r.buildMs)} → ${r.buildMs < 5000 ? '✅ 優於估算' : r.buildMs < 10000 ? '🟡 符合' : '🔴 超標'}`
    }
    console.log(
      `| ${r.scale.toLocaleString().padStart(7)} | ` +
      `${fmt(r.buildMs).padStart(8)} | ` +
      `${fmt(r.buildMsPer1k).padStart(6)} | ` +
      `${fmt(r.indexedLookups.p95).padStart(11)} | ` +
      `${r.linearLookups ? fmt(r.linearLookups.p95).padStart(9) : '(跳過)'.padStart(9)} | ` +
      `${est}`
    )
  }

  // 輸出 JSON 給報告使用
  const report = {
    env: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpu: require('os').cpus()[0]?.model ?? 'unknown',
      timestamp: new Date().toISOString(),
    },
    results,
  }
  const fs = require('fs')
  const outPath = 'src/components/git-poc/benchmark/_bench-index-result.json'
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2))
  console.log(`\n結果 JSON 寫入:${outPath}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
