import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import AutonomyDial from './components/AutonomyDial.vue'
import CompareMatrix from './components/CompareMatrix.vue'
import DownloadLinks from './components/DownloadLinks.vue'
import FeatureGrid from './components/FeatureGrid.vue'
import StatsCounter from './components/StatsCounter.vue'
import StoryChapter from './components/StoryChapter.vue'
import StoryTimeline from './components/StoryTimeline.vue'
import TowerDemo from './components/TowerDemo.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('AutonomyDial', AutonomyDial)
    app.component('CompareMatrix', CompareMatrix)
    app.component('DownloadLinks', DownloadLinks)
    app.component('FeatureGrid', FeatureGrid)
    app.component('StatsCounter', StatsCounter)
    app.component('StoryChapter', StoryChapter)
    app.component('StoryTimeline', StoryTimeline)
    app.component('TowerDemo', TowerDemo)
  }
} satisfies Theme
