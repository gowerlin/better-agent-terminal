<script setup lang="ts">
// 真實截圖：補充、不取代旁邊的示意元件。素材由 e2e/site-media.spec.ts 產生（示範專案 demo-shop），
// 放在 site/public/media/。點圖開原尺寸，手機上看得清楚小字。
import { withBase } from 'vitepress'

const props = withDefaults(
  defineProps<{
    src: string
    alt: string
    caption?: string
    width?: number
    height?: number
  }>(),
  // 素材以 1280×800 的視窗、1.5 倍顯示縮放拍攝（實際 1922×1202）
  { width: 1922, height: 1202 },
)

const url = withBase(props.src)
</script>

<template>
  <figure class="bat-media">
    <a class="bat-media-frame" :href="url" target="_blank" rel="noopener">
      <img :src="url" :alt="alt" :width="width" :height="height" loading="lazy" decoding="async" />
    </a>
    <figcaption v-if="caption || $slots.default" class="bat-media-caption">
      <slot>{{ caption }}</slot>
    </figcaption>
  </figure>
</template>
