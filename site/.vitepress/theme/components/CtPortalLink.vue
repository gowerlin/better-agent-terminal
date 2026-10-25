<script setup lang="ts">
import { computed } from 'vue'
import { useData } from 'vitepress'
import type { ThemeConfig } from '../../config.mjs'

// 連到 Control Tower 站；網址取自 config.mts 的 CT_PORTAL_URL，to="install" 連到安裝頁（CT_INSTALL_URL）。
// 首頁沒有 .vp-doc，外部連結圖示改由 vp-external-link-icon 帶出
const props = defineProps<{ to?: 'install' }>()
const { theme } = useData<ThemeConfig>()
const href = computed(() => (props.to === 'install' ? theme.value.ctInstallUrl : theme.value.ctPortalUrl))
</script>

<template>
  <a class="vp-external-link-icon" :href="href" target="_blank" rel="noreferrer"><slot>{{ to === 'install' ? 'Control Tower 安裝頁' : 'Control Tower 站' }}</slot></a>
</template>
