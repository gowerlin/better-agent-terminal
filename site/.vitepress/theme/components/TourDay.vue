<script setup lang="ts">
// 一天的基本流程：每一步是「你說的話」與「塔台會做的事」。
// 角色色沿用設計語言：藍 = 你（--bat-you），紫 = 塔台（--bat-signal-text）。
interface Step {
  name: string
  you: string
  tower: string
}

const STEPS: Step[] = [
  {
    name: '開工',
    you: '開一個塔台分頁，說今天要接著做 demo-shop 的結帳頁。',
    tower: '讀回進度與所有工單，列出環境狀態、進行中的工作、上次留下的待決事項，再建議下一步。'
  },
  {
    name: '對齊需求',
    you: '「折扣碼要能設到期日，不能和會員折扣疊加。」',
    tower: '先聽完、再追問、用自己的話複述一次請你確認。還沒有答案的，記成待決事項，不先動手。'
  },
  {
    name: '開單',
    you: '「範圍沒問題，開單吧。」',
    tower: '拆成幾張工單，每張寫清楚目標、範圍、驗收條件與禁止事項，並比對各工單會動到的檔案有沒有重疊。'
  },
  {
    name: '派工',
    you: '依自主程度，點頭同意，或什麼都不用做。',
    tower: '在 BAT 裡開好 Worker 分頁並啟動；自主程度設在 off 時，改成告訴你要在哪裡貼什麼指令。'
  },
  {
    name: '收單',
    you: '「T1024 完成。」在 BAT 裡，這句話由 Worker 自己送回塔台。',
    tower: '讀回報區、逐項核對驗收條件、更新進度、記下這次學到的東西，再決定下一張。'
  },
  {
    name: '對帳',
    you: '「同步一下進度。」',
    tower: '掃過所有工單檔，找出和自己記憶不一致的地方，以檔案為準更正。'
  },
  {
    name: '收工交接',
    you: '「今天先到這裡。」',
    tower: '把進度、待辦與做過的決定寫進進度檔。明天不管是你、同事，還是換一個 Agent 開塔台，都從這裡接手。'
  }
]
</script>

<template>
  <ol class="tour-day" aria-label="一天的基本流程">
    <li v-for="(step, i) in STEPS" :key="step.name" class="dy-step">
      <span class="dy-marker" aria-hidden="true">{{ i + 1 }}</span>
      <div class="dy-body">
        <p class="dy-name"><span class="sr-only">第 {{ i + 1 }} 步：</span>{{ step.name }}</p>
        <p class="dy-line is-you"><b>你</b><span>{{ step.you }}</span></p>
        <p class="dy-line is-tower"><b>塔台</b><span>{{ step.tower }}</span></p>
      </div>
    </li>
  </ol>
</template>
