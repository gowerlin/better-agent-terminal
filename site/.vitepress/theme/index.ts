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
import './custom.css'

export default {
  extends: DefaultTheme,
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
