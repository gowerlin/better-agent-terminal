<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

// 「現在」線跟著捲動沿時間軸前進；目前讀到的那一章加上 is-now
const root = ref<HTMLElement | null>(null)
const progress = ref(0)
const nowLabel = ref('09:00')
const settled = ref(false)

let frame = 0
let motionQuery: MediaQueryList | null = null

function chapters() {
  return root.value ? Array.from(root.value.querySelectorAll<HTMLElement>('.story-chapter')) : []
}

function markChapters(current: HTMLElement | null) {
  for (const el of chapters()) {
    el.classList.toggle('is-now', el === current)
  }
}

function measure() {
  frame = 0
  const el = root.value
  if (!el) return
  if (settled.value) {
    progress.value = 1
    const all = chapters()
    nowLabel.value = all.at(-1)?.dataset.time ?? ''
    markChapters(null)
    return
  }
  const anchor = window.innerHeight * 0.4
  const rect = el.getBoundingClientRect()
  progress.value = Math.min(1, Math.max(0, (anchor - rect.top) / rect.height))

  let current: HTMLElement | null = null
  for (const chapter of chapters()) {
    if (chapter.getBoundingClientRect().top <= anchor) current = chapter
  }
  const first = chapters()[0] ?? null
  nowLabel.value = (current ?? first)?.dataset.time ?? ''
  markChapters(current ?? first)
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(measure)
}

function onMotionChange() {
  settled.value = !!motionQuery?.matches
  schedule()
}

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  settled.value = motionQuery.matches
  motionQuery.addEventListener('change', onMotionChange)
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule)
  measure()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  motionQuery?.removeEventListener('change', onMotionChange)
  window.removeEventListener('scroll', schedule)
  window.removeEventListener('resize', schedule)
})
</script>

<template>
  <div ref="root" class="story-timeline" :class="{ 'is-settled': settled }" :style="{ '--story-progress': progress }">
    <div class="story-rail" aria-hidden="true">
      <div class="story-rail-fill" />
      <div class="story-now">
        <span class="story-now-label">現在 <span class="story-now-time">{{ nowLabel }}</span></span>
      </div>
    </div>
    <ol class="story-chapters">
      <slot />
    </ol>
  </div>
</template>
