import { h } from 'vue'
import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import AutonomyDial from './components/AutonomyDial.vue'
import CapabilityLevels from './components/CapabilityLevels.vue'
import CardTable from './components/CardTable.vue'
import CaseCard from './components/CaseCard.vue'
import CompareMatrix from './components/CompareMatrix.vue'
import ContractFlow from './components/ContractFlow.vue'
import CtPortalLink from './components/CtPortalLink.vue'
import DemoVideo from './components/DemoVideo.vue'
import DownloadLinks from './components/DownloadLinks.vue'
import FeatureGrid from './components/FeatureGrid.vue'
import GrowthLadder from './components/GrowthLadder.vue'
import MediaFigure from './components/MediaFigure.vue'
import QuestionFlow from './components/QuestionFlow.vue'
import RemoteBridge from './components/RemoteBridge.vue'
import ShellLoop from './components/ShellLoop.vue'
import StatsCounter from './components/StatsCounter.vue'
import StoryChapter from './components/StoryChapter.vue'
import StoryIllo from './components/StoryIllo.vue'
import StoryTimeline from './components/StoryTimeline.vue'
import TicketLife from './components/TicketLife.vue'
import TicketStates from './components/TicketStates.vue'
import TourDay from './components/TourDay.vue'
import TowerDemo from './components/TowerDemo.vue'
// vitepress-portal-layout v1.1.5（BMad-Guide 的 skill，T0870 套用、T0871／T0872／T0880 升級）：主內容加寬、左右功能表收合、圖的放大檢視。
// portal-layout/ 底下的檔案保持 skill 原樣，升版時整包覆蓋；BAT 站的調整寫在 custom.css 與這個檔案。
// 第 4 項（時間軸）不套用。
import LayoutToggles from './portal-layout/components/LayoutToggles.vue'
import FigureZoom from './portal-layout/components/FigureZoom.vue'
import './portal-layout/layout.css'
import './portal-layout/figure-zoom.css'
// 站點自己的樣式放在 portal-layout 之後：覆寫 --pl-* 變數寫在 custom.css
import './custom.css'

// 收合鈕的文字（繁體中文）
const LAYOUT_TOGGLE_LABELS = {
  collapseSidebar: '收合左側選單',
  expandSidebar: '展開左側選單',
  collapseAside: '收合右側本頁目錄',
  expandAside: '展開右側本頁目錄'
}

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, {
    // 寬螢幕的左側選單、右側本頁目錄收合鈕（doc-top 只在文件頁出現）
    'doc-top': () => h(LayoutToggles, { labels: LAYOUT_TOGGLE_LABELS }),
    // 圖的放大檢視：替文中的圖加「放大檢視」按鈕（v1.1.0 起沒有 SVG／圖片的 <figure> 也會放大）；
    // 不要放大的元件（互動元件）在根元素加 data-no-zoom
    'layout-bottom': () => h(FigureZoom)
  }),
  enhanceApp({ app }) {
    app.component('AutonomyDial', AutonomyDial)
    app.component('CapabilityLevels', CapabilityLevels)
    app.component('CardTable', CardTable)
    app.component('CaseCard', CaseCard)
    app.component('CompareMatrix', CompareMatrix)
    app.component('ContractFlow', ContractFlow)
    app.component('CtPortalLink', CtPortalLink)
    app.component('DemoVideo', DemoVideo)
    app.component('DownloadLinks', DownloadLinks)
    app.component('FeatureGrid', FeatureGrid)
    app.component('GrowthLadder', GrowthLadder)
    app.component('MediaFigure', MediaFigure)
    app.component('QuestionFlow', QuestionFlow)
    app.component('RemoteBridge', RemoteBridge)
    app.component('ShellLoop', ShellLoop)
    app.component('StatsCounter', StatsCounter)
    app.component('StoryChapter', StoryChapter)
    app.component('StoryIllo', StoryIllo)
    app.component('StoryTimeline', StoryTimeline)
    app.component('TicketLife', TicketLife)
    app.component('TicketStates', TicketStates)
    app.component('TourDay', TourDay)
    app.component('TowerDemo', TowerDemo)
  }
} satisfies Theme
