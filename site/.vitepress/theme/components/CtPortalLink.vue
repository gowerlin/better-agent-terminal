<script setup lang="ts">
import { useData } from 'vitepress'
import type { ThemeConfig } from '../../config.mjs'

// 連到 Control Tower 站；網址取自 config.mts 的 CT_PORTAL_URL。
// 首頁沒有 .vp-doc，外部連結圖示改由 vp-external-link-icon 帶出
const { theme } = useData<ThemeConfig>()
</script>

<template>
  <a class="vp-external-link-icon" :href="theme.ctPortalUrl" target="_blank" rel="noreferrer"><slot>Control Tower 站</slot></a>
</template>
