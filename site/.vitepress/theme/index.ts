import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import DownloadLinks from './components/DownloadLinks.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('DownloadLinks', DownloadLinks)
  }
} satisfies Theme
