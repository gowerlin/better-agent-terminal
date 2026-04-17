/**
 * RAF-based FPS meter — benchmark 可見的即時幀率量測。
 *
 * 使用方式:
 *   const meter = new FpsMeter()
 *   meter.start()
 *   // ... 滾動操作 ...
 *   meter.stop()
 *   console.log(meter.summary())
 */

export interface FpsSample {
  avg: number
  min: number
  p5: number     // 最低 5% 幀 (卡頓指標)
  p50: number
  frames: number
  durationMs: number
}

export class FpsMeter {
  private frameTimes: number[] = []
  private lastTs = 0
  private running = false
  private rafId: number | null = null
  private startTs = 0
  private endTs = 0

  /** 即時 FPS(最近 1 秒) — 供 UI 顯示 */
  liveFps = 0

  start(): void {
    this.frameTimes = []
    this.lastTs = performance.now()
    this.startTs = this.lastTs
    this.running = true
    this.loop()
  }

  stop(): FpsSample {
    this.running = false
    if (this.rafId != null) cancelAnimationFrame(this.rafId)
    this.endTs = performance.now()
    return this.summary()
  }

  private loop = (): void => {
    if (!this.running) return
    const now = performance.now()
    const delta = now - this.lastTs
    this.lastTs = now
    if (delta > 0 && delta < 1000) {  // 過濾 tab 切換造成的大間隔
      this.frameTimes.push(delta)
    }

    // 更新即時 FPS (最近 ~60 frames)
    if (this.frameTimes.length > 0) {
      const recent = this.frameTimes.slice(-60)
      const avgDelta = recent.reduce((s, v) => s + v, 0) / recent.length
      this.liveFps = 1000 / avgDelta
    }

    this.rafId = requestAnimationFrame(this.loop)
  }

  summary(): FpsSample {
    const n = this.frameTimes.length
    if (n === 0) {
      return { avg: 0, min: 0, p5: 0, p50: 0, frames: 0, durationMs: 0 }
    }
    const sorted = [...this.frameTimes].sort((a, b) => a - b)
    const avgDelta = this.frameTimes.reduce((s, v) => s + v, 0) / n
    // p5 of frame deltas = 最短幀 (最高 FPS); p95 delta = 最長幀 (最低 FPS)
    // 「p5 FPS」= 最低 5% 幀的 FPS,對應 p95 delta
    const p95Delta = sorted[Math.floor(sorted.length * 0.95)]
    const maxDelta = sorted[sorted.length - 1]
    const medianDelta = sorted[Math.floor(sorted.length * 0.5)]
    return {
      avg: 1000 / avgDelta,
      min: 1000 / maxDelta,
      p5: 1000 / p95Delta,
      p50: 1000 / medianDelta,
      frames: n,
      durationMs: this.endTs - this.startTs,
    }
  }
}
