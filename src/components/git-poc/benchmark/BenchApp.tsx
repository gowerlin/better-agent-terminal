/**
 * Benchmark harness UI — T0154 假設 1 實測入口。
 *
 * 流程:
 *   1. 選擇規模 (10k / 50k / 100k / 500k)
 *   2. 點「Generate」生成合成資料 (時間顯示)
 *   3. 點「Auto-scroll」啟動自動 scroll (均勻速度走完整個 graph)
 *   4. FpsMeter 累計期間的幀時,顯示 avg/p50/min FPS
 *   5. 可切換「反查 T####」模式,量測 scrollTo + highlight 的時間
 */

import { useRef, useState, useEffect } from 'react'
import type { SynthCommit } from './synthGen'
import { generateSynthCommits } from './synthGen'
import { SvgCommitGraph } from './SvgCommitGraph'
import { FpsMeter } from './fpsMeter'
import { CommitIndex } from './CommitIndex'

type Scale = 1_000 | 10_000 | 50_000 | 100_000 | 500_000

interface SuiteResult {
  scale: number
  genMs: number
  indexMs: number
  tickets: number
  fpsAvg: number
  fpsP50: number
  fpsMin: number
  fpsFrames: number
  lookupP95Ms: number
  scrollMeanMs: number
}

// 暴露結果到 window 供 evaluate_script 讀取
declare global {
  interface Window {
    __BENCH_SUITE_RESULTS__?: SuiteResult[]
    __BENCH_SUITE_STATE__?: 'idle' | 'running' | 'done' | 'error'
    __BENCH_SUITE_ERROR__?: string
  }
}

export function BenchApp() {
  const [scale, setScale] = useState<Scale>(10_000)
  const [commits, setCommits] = useState<SynthCommit[]>([])
  const [genMs, setGenMs] = useState<number | null>(null)
  const [indexMs, setIndexMs] = useState<number | null>(null)
  const [highlightHash, setHighlightHash] = useState<string | null>(null)
  const [fpsLive, setFpsLive] = useState(0)
  const [fpsSummary, setFpsSummary] = useState<null | {
    avg: number; p50: number; min: number; frames: number; durationMs: number
  }>(null)
  const [lookupSummary, setLookupSummary] = useState<null | {
    samples: number; meanMs: number; p95Ms: number; scrollMeanMs: number
  }>(null)
  const [autoScrolling, setAutoScrolling] = useState(false)
  const [suiteProgress, setSuiteProgress] = useState<string>('')
  const [, setSuiteResults] = useState<SuiteResult[] | null>(null)

  const indexRef = useRef<CommitIndex | null>(null)
  const graphScrollerRef = useRef<HTMLElement | null>(null)
  const fpsMeterRef = useRef<FpsMeter | null>(null)

  // 捕捉 SvgCommitGraph 內部的 scroll container
  useEffect(() => {
    const el = (document.querySelector('[data-benchmark-graph]') as HTMLElement)?.firstElementChild as HTMLElement | null
    graphScrollerRef.current = el
  }, [commits])

  const handleGenerate = () => {
    setFpsSummary(null)
    setLookupSummary(null)
    setHighlightHash(null)
    const t0 = performance.now()
    const data = generateSynthCommits({ count: scale, seed: 42 + scale })
    const t1 = performance.now()
    setGenMs(t1 - t0)
    setCommits(data)

    // 建索引
    const idx = new CommitIndex()
    const ti0 = performance.now()
    idx.buildFromMessages(data)
    const ti1 = performance.now()
    setIndexMs(ti1 - ti0)
    indexRef.current = idx
  }

  const handleAutoScroll = async () => {
    const el = graphScrollerRef.current
    if (!el || autoScrolling) return

    setAutoScrolling(true)
    setFpsSummary(null)
    const meter = new FpsMeter()
    fpsMeterRef.current = meter
    meter.start()

    const fpsInterval = setInterval(() => {
      setFpsLive(meter.liveFps)
    }, 100)

    // 均勻 scroll 到底再回到頂(約 6 秒)
    const duration = 6000
    const startTs = performance.now()
    const totalScroll = el.scrollHeight - el.clientHeight

    await new Promise<void>((resolve) => {
      function step() {
        const elapsed = performance.now() - startTs
        const progress = Math.min(1, elapsed / duration)
        // 前半往下,後半回頂
        const pos = progress < 0.5
          ? (progress * 2) * totalScroll
          : ((1 - progress) * 2) * totalScroll
        el!.scrollTop = pos
        if (progress < 1) {
          requestAnimationFrame(step)
        } else {
          resolve()
        }
      }
      requestAnimationFrame(step)
    })

    clearInterval(fpsInterval)
    const summary = meter.stop()
    setFpsSummary(summary)
    setFpsLive(0)
    setAutoScrolling(false)
  }

  const handleLookupBench = async () => {
    const idx = indexRef.current
    const el = graphScrollerRef.current
    if (!idx || !el || commits.length === 0) return

    const allTickets = [...idx.ticketToCommits.keys()]
    if (allTickets.length === 0) return

    const sampleCount = 20
    const lookupTimes: number[] = []
    const scrollTimes: number[] = []

    // hash → index map (一次建,避免每次 O(N))
    const hashToIdx = new Map<string, number>()
    for (let i = 0; i < commits.length; i++) hashToIdx.set(commits[i].hash, i)

    for (let i = 0; i < sampleCount; i++) {
      const ticket = allTickets[i * Math.floor(allTickets.length / sampleCount)]
      // 1. 索引查詢
      const t0 = performance.now()
      const hashes = idx.lookupCommitsByTicket(ticket)
      const t1 = performance.now()
      lookupTimes.push(t1 - t0)

      if (hashes.length === 0) continue

      // 2. scrollTo 第一個 commit + 等一幀 render
      const targetIdx = hashToIdx.get(hashes[0])
      if (targetIdx == null) continue

      const rowHeight = 28
      const targetScroll = Math.max(0, targetIdx * rowHeight - el.clientHeight / 2)
      const s0 = performance.now()
      el.scrollTop = targetScroll
      setHighlightHash(hashes[0])
      // 等一個 rAF 確保 render 完成
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      const s1 = performance.now()
      scrollTimes.push(s1 - s0)
    }

    const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length
    const p95 = (arr: number[]) => {
      const s = [...arr].sort((a, b) => a - b)
      return s[Math.floor(s.length * 0.95)]
    }

    setLookupSummary({
      samples: sampleCount,
      meanMs: mean(lookupTimes),
      p95Ms: p95(lookupTimes),
      scrollMeanMs: mean(scrollTimes),
    })
  }

  const fmt = (n: number | null) => n == null ? '-' : n < 1 ? `${(n * 1000).toFixed(1)}μs` : `${n.toFixed(2)}ms`

  // Auto-suite:完整跑完 3 個規模,寫到 window 供外部讀取
  const runAutoSuite = async () => {
    window.__BENCH_SUITE_STATE__ = 'running'
    window.__BENCH_SUITE_RESULTS__ = []
    const results: SuiteResult[] = []
    // Scales from window override (for 500k stress test) or defaults
    const scales: Scale[] = (window as any).__BENCH_SCALES_OVERRIDE__ ?? [10_000, 50_000, 100_000]

    try {
      for (const s of scales) {
        setSuiteProgress(`Scale ${s.toLocaleString()}:generating...`)
        // 生成
        const t0 = performance.now()
        const data = generateSynthCommits({ count: s, seed: 42 + s })
        const genMsLocal = performance.now() - t0
        setGenMs(genMsLocal)

        // 索引
        const idx = new CommitIndex()
        const ti0 = performance.now()
        idx.buildFromMessages(data)
        const indexMsLocal = performance.now() - ti0
        setIndexMs(indexMsLocal)
        indexRef.current = idx

        // 等 React render 生效
        setCommits(data)
        await new Promise<void>((r) => setTimeout(r, 500))

        // 重新抓 scroller (commits 改變會觸發 effect)
        const el = (document.querySelector('[data-benchmark-graph]') as HTMLElement)
          ?.firstElementChild as HTMLElement | null
        if (!el) throw new Error('scroller not found')
        graphScrollerRef.current = el

        setSuiteProgress(`Scale ${s.toLocaleString()}:auto-scroll (6s)...`)
        // FPS 測
        const meter = new FpsMeter()
        meter.start()
        const duration = 6000
        const startTs = performance.now()
        const totalScroll = el.scrollHeight - el.clientHeight
        await new Promise<void>((resolve) => {
          function step() {
            const elapsed = performance.now() - startTs
            const progress = Math.min(1, elapsed / duration)
            const pos = progress < 0.5
              ? (progress * 2) * totalScroll
              : ((1 - progress) * 2) * totalScroll
            el!.scrollTop = pos
            if (progress < 1) requestAnimationFrame(step)
            else resolve()
          }
          requestAnimationFrame(step)
        })
        const fpsSum = meter.stop()

        setSuiteProgress(`Scale ${s.toLocaleString()}:lookup benchmark...`)
        // Lookup
        const allTickets = [...idx.ticketToCommits.keys()]
        const hashToIdx = new Map<string, number>()
        for (let i = 0; i < data.length; i++) hashToIdx.set(data[i].hash, i)

        const lookupTimes: number[] = []
        const scrollTimes: number[] = []
        const sampleCount = 20
        for (let i = 0; i < sampleCount && allTickets.length > 0; i++) {
          const ticket = allTickets[i * Math.floor(allTickets.length / sampleCount)]
          const l0 = performance.now()
          const hashes = idx.lookupCommitsByTicket(ticket)
          lookupTimes.push(performance.now() - l0)
          if (hashes.length === 0) continue
          const targetIdx = hashToIdx.get(hashes[0])
          if (targetIdx == null) continue
          const rowHeight = 28
          const target = Math.max(0, targetIdx * rowHeight - el.clientHeight / 2)
          const s0 = performance.now()
          el.scrollTop = target
          setHighlightHash(hashes[0])
          await new Promise<void>((r) => requestAnimationFrame(() => r()))
          await new Promise<void>((r) => requestAnimationFrame(() => r()))
          scrollTimes.push(performance.now() - s0)
        }

        const sortedLookup = [...lookupTimes].sort((a, b) => a - b)
        const p95 = sortedLookup[Math.floor(sortedLookup.length * 0.95)] ?? 0
        const scrollMean = scrollTimes.length
          ? scrollTimes.reduce((s, v) => s + v, 0) / scrollTimes.length : 0

        const result: SuiteResult = {
          scale: s,
          genMs: genMsLocal,
          indexMs: indexMsLocal,
          tickets: idx.stats().tickets,
          fpsAvg: fpsSum.avg,
          fpsP50: fpsSum.p50,
          fpsMin: fpsSum.min,
          fpsFrames: fpsSum.frames,
          lookupP95Ms: p95,
          scrollMeanMs: scrollMean,
        }
        results.push(result)
        window.__BENCH_SUITE_RESULTS__ = [...results]
      }

      setSuiteResults(results)
      setSuiteProgress(`Done. ${results.length} scales tested.`)
      window.__BENCH_SUITE_STATE__ = 'done'
    } catch (e: any) {
      window.__BENCH_SUITE_STATE__ = 'error'
      window.__BENCH_SUITE_ERROR__ = String(e?.message ?? e)
      setSuiteProgress(`Error: ${String(e?.message ?? e)}`)
    }
  }

  return (
    <div style={{
      fontFamily: 'ui-monospace, Menlo, monospace',
      fontSize: 12,
      color: '#e2e8f0',
      background: '#020617',
      minHeight: '100vh',
      padding: 16,
    }}>
      <h2 style={{ color: '#f1f5f9', margin: '0 0 12px' }}>
        T0154 Git GUI Benchmark — SVG + virtualization + CT 反查
      </h2>

      <div style={{
        display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center',
        padding: 10, background: '#1e293b', borderRadius: 6, marginBottom: 10,
      }}>
        <label>
          規模:
          <select
            value={scale}
            onChange={(e) => setScale(Number(e.target.value) as Scale)}
            style={{ marginLeft: 4, padding: '2px 6px' }}
          >
            <option value={1_000}>1,000</option>
            <option value={10_000}>10,000</option>
            <option value={50_000}>50,000</option>
            <option value={100_000}>100,000</option>
            <option value={500_000}>500,000</option>
          </select>
        </label>
        <button onClick={handleGenerate} style={btnStyle()}>Generate</button>
        <button
          onClick={handleAutoScroll}
          disabled={commits.length === 0 || autoScrolling}
          style={btnStyle(commits.length === 0 || autoScrolling)}
        >
          {autoScrolling ? 'Scrolling...' : 'Auto-scroll (6s, 測 FPS)'}
        </button>
        <button
          onClick={handleLookupBench}
          disabled={commits.length === 0}
          style={btnStyle(commits.length === 0)}
        >
          反查 benchmark (20 次)
        </button>
        <button
          id="run-auto-suite"
          onClick={runAutoSuite}
          style={{ ...btnStyle(), background: '#16a34a' }}
        >
          ▶ Run auto-suite (10k/50k/100k)
        </button>
        {suiteProgress && (
          <span style={{ color: '#fbbf24', marginLeft: 8 }}>{suiteProgress}</span>
        )}

        <span style={{ marginLeft: 'auto', color: '#94a3b8' }}>
          live FPS: <strong style={{ color: '#f59e0b' }}>{fpsLive.toFixed(1)}</strong>
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 8,
        padding: 10, background: '#1e293b', borderRadius: 6, marginBottom: 10,
      }}>
        <Metric label="Commits" value={commits.length.toLocaleString()} />
        <Metric label="Generate" value={fmt(genMs)} />
        <Metric label="Index build" value={fmt(indexMs)} />
        <Metric
          label="Tickets indexed"
          value={indexRef.current ? String(indexRef.current.stats().tickets) : '-'}
        />
        <Metric
          label="FPS avg (scroll)"
          value={fpsSummary ? fpsSummary.avg.toFixed(1) : '-'}
          color={fpsSummary ? (fpsSummary.avg >= 55 ? '#22c55e' : fpsSummary.avg >= 30 ? '#f59e0b' : '#ef4444') : undefined}
        />
        <Metric
          label="FPS p50"
          value={fpsSummary ? fpsSummary.p50.toFixed(1) : '-'}
        />
        <Metric
          label="FPS min (worst)"
          value={fpsSummary ? fpsSummary.min.toFixed(1) : '-'}
        />
        <Metric
          label="Frames sampled"
          value={fpsSummary ? String(fpsSummary.frames) : '-'}
        />
        <Metric
          label="Lookup p95 (index)"
          value={lookupSummary ? fmt(lookupSummary.p95Ms) : '-'}
        />
        <Metric
          label="Scroll+render mean"
          value={lookupSummary ? fmt(lookupSummary.scrollMeanMs) : '-'}
        />
      </div>

      <div data-benchmark-graph style={{ height: 520, background: '#0f172a', borderRadius: 6 }}>
        {commits.length > 0 ? (
          <SvgCommitGraph
            commits={commits}
            height={520}
            highlightHash={highlightHash}
          />
        ) : (
          <div style={{ padding: 24, color: '#64748b' }}>
            選規模 → 點 Generate 開始。
          </div>
        )}
      </div>

      <details style={{ marginTop: 12, color: '#94a3b8' }}>
        <summary style={{ cursor: 'pointer' }}>關於此 benchmark</summary>
        <ul style={{ paddingLeft: 20 }}>
          <li>合成資料 — 不 clone 真實 repo,避免網路/磁碟成本</li>
          <li>SVG + 自製 windowed virtualization (非 react-window)</li>
          <li>Auto-scroll 6 秒均勻往返,FpsMeter 用 rAF delta 計算 FPS</li>
          <li>反查 benchmark:索引 lookup + 2 個 rAF 等 render 完成</li>
          <li>結果請對照 T0153 估算(見 _report-git-gui-poc-findings.md)</li>
        </ul>
      </details>
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ padding: 6, background: '#0f172a', borderRadius: 4 }}>
      <div style={{ color: '#64748b', fontSize: 10, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ color: color || '#e2e8f0', fontSize: 16, fontWeight: 600 }}>
        {value}
      </div>
    </div>
  )
}

function btnStyle(disabled = false): React.CSSProperties {
  return {
    padding: '4px 10px',
    background: disabled ? '#334155' : '#2563eb',
    color: '#f1f5f9',
    border: 'none',
    borderRadius: 4,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: 12,
  }
}
