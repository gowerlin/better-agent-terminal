<script setup lang="ts">
// /why「只自動化外殼」：外圈是每張工單都一樣的五步（交給塔台與 BAT），內圈是每次不同的內容（留給判斷）。
// 沿用 ContractFlow 的雷達線條語彙，跟著頁面深淺色；不用紫色（外圈不是單一塔台動作）。靜態，不做動畫。
const CX = 200
const CY = 176
const R = 118

interface Step {
  name: string
  // 角度：-90 = 正上方，順時針
  deg: number
  anchor: 'start' | 'middle' | 'end'
  dx: number
  dy: number
}

const STEPS: Step[] = [
  { name: '開單', deg: -90, anchor: 'middle', dx: 0, dy: -16 },
  { name: '派工', deg: -18, anchor: 'start', dx: 12, dy: 5 },
  { name: '回報', deg: 54, anchor: 'start', dx: 10, dy: 22 },
  { name: '收尾', deg: 126, anchor: 'end', dx: -10, dy: 22 },
  { name: '記下經驗', deg: 198, anchor: 'end', dx: -12, dy: 5 }
]

const INSIDE = ['要做什麼判斷', '會碰到哪些例外', '規格缺了哪一塊']

function at(deg: number, r = R) {
  const rad = (deg * Math.PI) / 180
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

// 兩步之間放一個順時針的箭頭
const ARROWS = STEPS.map((s) => {
  const deg = s.deg + 36
  const p = at(deg)
  return `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${deg + 90})`
})
</script>

<template>
  <figure class="shell-loop">
    <svg viewBox="0 0 400 340" class="sl-svg" aria-hidden="true">
      <circle :cx="CX" :cy="CY" :r="R" class="sl-ring" />
      <path v-for="t in ARROWS" :key="t" d="M-5 -5 L5 0 L-5 5 z" :transform="t" class="sl-arrow" />
      <g v-for="s in STEPS" :key="s.name">
        <circle :cx="at(s.deg).x" :cy="at(s.deg).y" r="6" class="sl-node" />
        <text :x="at(s.deg).x + s.dx" :y="at(s.deg).y + s.dy" :text-anchor="s.anchor" class="sl-step">{{ s.name }}</text>
      </g>
      <circle :cx="CX" :cy="CY" r="74" class="sl-core" />
      <text :x="CX" :y="CY - 30" class="sl-core-title">每次不同</text>
      <text v-for="(line, i) in INSIDE" :key="line" :x="CX" :y="CY - 2 + i * 22" class="sl-core-line">{{ line }}</text>
    </svg>
    <figcaption class="sl-caption">
      <span>外圈：每張工單都走的五步。</span>
      <span>內圈：每張工單不同的內容。</span>
    </figcaption>
    <p class="sr-only">
      圖：外圈是每張工單都會走的五步，開單、派工、回報、收尾、記下經驗，依序循環；
      內圈是每張工單不同的內容：要做什麼判斷、會碰到哪些例外、規格缺了哪一塊。
    </p>
  </figure>
</template>
