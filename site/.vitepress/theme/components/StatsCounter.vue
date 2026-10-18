<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

interface Stat {
  value: number
  label: string
}

const STATS: Stat[] = [
  { value: 600, label: '張工單' },
  { value: 150, label: '張 bug 單' },
  { value: 60, label: '個預覽版' },
  { value: 5000, label: '個單元測試' }
]

const DURATION_MS = 1200

// SSR 與 reduced motion 都直接顯示最終數字；只有捲進畫面時從 0 數到最終值一次
const shown = ref(STATS.map((s) => s.value))
const root = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
let frame = 0

function format(n: number) {
  return n.toLocaleString('en-US')
}

function run() {
  const start = performance.now()
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / DURATION_MS)
    const eased = 1 - Math.pow(1 - t, 3)
    shown.value = STATS.map((s) => Math.round(s.value * eased))
    if (t < 1) frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
}

onMounted(() => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !root.value) return
  const rect = root.value.getBoundingClientRect()
  // 已經在畫面上就不重數，避免數字在使用者眼前歸零
  if (rect.top < window.innerHeight && rect.bottom > 0) return
  shown.value = STATS.map(() => 0)
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer?.disconnect()
        run()
      }
    },
    { threshold: 0.4 }
  )
  observer.observe(root.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(frame)
})
</script>

<template>
  <dl ref="root" class="stats">
    <div v-for="(stat, i) in STATS" :key="stat.label" class="stat">
      <dt class="stat-label">{{ stat.label }}</dt>
      <dd class="stat-value">
        <span aria-hidden="true">{{ format(shown[i]) }}+</span>
        <span class="sr-only">{{ format(stat.value) }}+</span>
      </dd>
    </div>
  </dl>
</template>
