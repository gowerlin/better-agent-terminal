/**
 * 自製 windowed virtualization hook — 避免新增 react-window 依賴。
 *
 * 設計:
 *   - 固定 rowHeight (對 commit graph 夠用)
 *   - overscan 避免 scroll 邊緣閃爍
 *   - 回傳可見範圍 [start, end) + spacer heights
 */

import { useEffect, useState, useRef } from 'react'

export interface VirtualizerOptions {
  count: number
  rowHeight: number
  containerRef: React.RefObject<HTMLElement>
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
      // rAF coalescing — 避免 scroll event 過於頻繁 setState
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
