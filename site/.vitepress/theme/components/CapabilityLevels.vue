<script setup lang="ts">
// 四級能力：第 0 級是只靠檔案的核心，其餘三級是可選的增強，可以任意組合。
// 桌面：三個增強並排，坐在第 0 級上（可任意組合，不是階梯）；窄螢幕照 DOM 順序 0 → 3。
// 虛線框 = 可選；實線 = 核心。紫色不用在這裡（錨點 A1：紫色只給塔台發出的東西）。
interface Level {
  name: string
  what: string
  fit: string
  core?: boolean
}

const LEVELS: Level[] = [
  {
    name: '自包含核心',
    what: '只靠 repo 裡的檔案，不依賴任何外部工具。工單、進度追蹤、Debug、中斷處理、多塔台協調與自我學習，都在這一級。',
    fit: '任何專案的起點。',
    core: true
  },
  {
    name: '加上 hook 觀察',
    what: '裝了以 Claude Code hook 記錄每個動作的觀察工具後，塔台的學習多一份完整的觀察來源，經驗的信心度更有依據。移除工具，已經學到的東西也不會丟。',
    fit: '想讓自我學習更完整。'
  },
  {
    name: '加上 BMad-Method 流程指引',
    what: '塔台依專案目前的階段，查出該走哪一套 BMad-Method 流程，並在工單上標出適合的 Agent 角色。',
    fit: '已經在用 BMad-Method 的團隊。'
  },
  {
    name: '加上跨機器記憶',
    what: '已經確立的規則，同步到跨機器的記憶服務，換一台電腦也帶得走。目前只單向寫出：塔台把規則存過去，還不會反過來查詢。',
    fit: '在好幾台機器上工作。'
  }
]
</script>

<template>
  <ol class="cap-levels" aria-label="四級能力">
    <li v-for="(level, i) in LEVELS" :key="level.name" class="cap-level" :class="{ 'is-core': level.core }">
      <p class="cap-head">
        <span class="cap-num">第 {{ i }} 級</span>
        <span class="cap-kind">{{ level.core ? '核心' : '可選' }}</span>
      </p>
      <p class="cap-name">{{ level.name }}</p>
      <p class="cap-what">{{ level.what }}</p>
      <p class="cap-fit"><b>適合</b>{{ level.fit }}</p>
    </li>
  </ol>
</template>
