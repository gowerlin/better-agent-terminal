<script setup lang="ts">
// 真實操作短片（WebM，無聲）。畫面進入視窗才播放、捲出就暫停；
// prefers-reduced-motion 時不自動播放，只顯示 poster 與播放控制。使用者自己按暫停後不再自動播放。
// 文字等價說明放在 slot（圖說），內容要能單獨讀懂。
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { withBase } from 'vitepress'

const props = withDefaults(
  defineProps<{
    src: string
    poster: string
    label: string
    width?: number
    height?: number
  }>(),
  { width: 1280, height: 800 },
)

const video = ref<HTMLVideoElement | null>(null)
let observer: IntersectionObserver | undefined
let motionQuery: MediaQueryList | undefined
let inView = false
let userPaused = false
let pausingForScroll = false

function update() {
  const el = video.value
  if (!el) return
  if (inView && !userPaused && !motionQuery?.matches) {
    el.play().catch(() => undefined)
  } else if (!el.paused) {
    pausingForScroll = true
    el.pause()
  }
}

function onPause() {
  if (pausingForScroll) pausingForScroll = false
  else if (inView) userPaused = true
}

function onPlay() {
  userPaused = false
}

onMounted(() => {
  const el = video.value
  if (!el) return
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  motionQuery.addEventListener('change', update)
  el.addEventListener('pause', onPause)
  el.addEventListener('play', onPlay)
  observer = new IntersectionObserver(
    (entries) => {
      inView = entries.some((e) => e.isIntersecting)
      update()
    },
    { threshold: 0.5 },
  )
  observer.observe(el)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  motionQuery?.removeEventListener('change', update)
})
</script>

<template>
  <figure class="bat-media">
    <div class="bat-media-frame">
      <video
        ref="video"
        :poster="withBase(props.poster)"
        :aria-label="label"
        :width="width"
        :height="height"
        muted
        loop
        playsinline
        controls
        preload="none"
      >
        <source :src="withBase(props.src)" type="video/webm" />
      </video>
    </div>
    <figcaption class="bat-media-caption">
      <slot />
    </figcaption>
  </figure>
</template>
