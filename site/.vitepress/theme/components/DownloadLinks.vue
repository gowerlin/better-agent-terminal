<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import type { ThemeConfig } from '../../config.mjs'

const { theme } = useData<ThemeConfig>()
const release = computed(() => theme.value.latestRelease)
</script>

<template>
  <div class="download-links">
    <p v-if="release.tag" class="download-version">
      最新版 <a :href="release.pageUrl" target="_blank" rel="noreferrer"><strong>{{ release.tag }}</strong></a>
      <span v-if="release.publishedAt">（{{ release.publishedAt }} 發佈）</span>
    </p>
    <p v-else class="download-version">
      請到 <a :href="release.pageUrl" target="_blank" rel="noreferrer">GitHub Releases</a> 選擇最新的 <code>v*</code> 版本下載。
    </p>
    <div class="download-grid">
      <a
        v-for="link in release.links"
        :key="link.platform"
        class="download-item no-icon"
        :href="link.url"
        :data-platform="link.platform"
        target="_blank"
        rel="noreferrer"
      >
        <span class="download-label">{{ link.label }}</span>
        <span class="download-note">{{ link.fileName ?? link.note }}</span>
      </a>
    </div>
  </div>
</template>
