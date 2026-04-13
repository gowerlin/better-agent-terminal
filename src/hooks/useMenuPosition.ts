import { useLayoutEffect, useRef, useState } from 'react'

interface MenuPosition {
  x: number
  y: number
}

/**
 * 計算選單位置，自動偵測 viewport 邊界並反向調整。
 * 先以隱藏方式渲染選單以取得實際尺寸，再決定最終位置。
 *
 * 用法：
 *   const [rawPos, setRawPos] = useState<{x:number,y:number}|null>(null)
 *   const { pos, menuRef } = useMenuPosition(rawPos)
 *   // 渲染時先用 rawPos 定位（visibility:hidden），再切換到 pos
 */
export function useMenuPosition(initialPos: MenuPosition | null) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<MenuPosition | null>(null)

  useLayoutEffect(() => {
    if (!initialPos) { setPos(null); return }
    if (!menuRef.current) { setPos(initialPos); return }

    const rect = menuRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    let { x, y } = initialPos

    if (x + rect.width > vw) x = Math.max(0, vw - rect.width - 4)
    if (y + rect.height > vh) y = Math.max(0, vh - rect.height - 4)

    setPos({ x, y })
  }, [initialPos])

  return { pos, menuRef }
}

/**
 * 計算子選單展開方向：預設向右，若右側超出 viewport 則向左。
 */
export function getSubmenuDirection(parentEl: HTMLElement | null, submenuWidth = 180): 'right' | 'left' {
  if (!parentEl) return 'right'
  const rect = parentEl.getBoundingClientRect()
  return rect.right + submenuWidth > window.innerWidth ? 'left' : 'right'
}
