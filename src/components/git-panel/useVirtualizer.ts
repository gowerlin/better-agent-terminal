/**
 * Phase 3 Tα2 — 自製 windowed virtualization hook for the Git Graph panel.
 *
 * Migrated from `src/components/git-poc/benchmark/useVirtualizer.ts` (T0154).
 * T0154 實測已證實 500k rows @ 60FPS。保留核心邏輯、移除 benchmark 專用 prop。
 *
 * 設計:
 *   - 固定 rowHeight(commit graph 夠用)
 *   - rAF coalescing 合併 scroll 事件,避免 setState 過度觸發
 *   - ResizeObserver 追蹤容器高度變化
 *   - overscan 避免 scroll 邊緣閃爍
 */

import { useEffect, useState, useRef, type RefObject } from 'react'

export interface VirtualizerOptions {
  count: number
  rowHeight: number
  containerRef: RefObject<HTMLElement>
  overscan?: number
}

export interface VirtualizerResult {
  startIndex: number
  endIndex: number           // exclusive
  offsetTop: number          // spacer before visible rows
  totalHeight: number
  scrollTo: (index: number) => void
}

export function useVirtualizer(opts: VirtualizerOptions): VirtualizerResult {
  const { count, rowHeight, containerRef, overscan = 5 } = opts
  const [scrollTop, setScrollTop] = useState(0)
  const [clientHeight, setClientHeight] = useState(600)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    setClientHeight(el.clientHeight)

    const onScroll = () => {
      if (rafRef.current != null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        setScrollTop(el.scrollTop)
      })
    }

    const onResize = () => {
      setClientHeight(el.clientHeight)
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(onResize)
    ro.observe(el)

    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [containerRef])

  const totalHeight = count * rowHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const visibleCount = Math.ceil(clientHeight / rowHeight) + overscan * 2
  const endIndex = Math.min(count, startIndex + visibleCount)
  const offsetTop = startIndex * rowHeight

  const scrollTo = (index: number): void => {
    const el = containerRef.current
    if (!el) return
    const target = index * rowHeight - clientHeight / 2
    el.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })
  }

  return { startIndex, endIndex, offsetTop, totalHeight, scrollTo }
}
