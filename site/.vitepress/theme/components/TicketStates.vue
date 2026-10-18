<script setup lang="ts">
// 工單的狀態流轉：待派工 → 執行中（可暫停再恢復）→ 五種結果之一。
// 符號與色沿用設計語言 § 4 的流程狀態（○ pending、✓ completed、✗ failed、awaiting-input 的藍點），
// 狀態一律「符號 + 文字」（錨點 A2），不只靠顏色。
interface State {
  key: string
  mark: string
  name: string
  text: string
  tone: 'pending' | 'running' | 'paused' | 'done' | 'partial' | 'blocked' | 'failed'
}

const FLOW: State[] = [
  { key: 'PENDING', mark: '○', name: '待派工', text: '工單寫好了，還沒有 Worker 接手。', tone: 'pending' },
  { key: 'IN_PROGRESS', mark: '●', name: '執行中', text: 'Worker 開工時先標上，才開始動手。', tone: 'running' }
]

const PAUSED: State = {
  key: 'PAUSED',
  mark: '‖',
  name: '暫停',
  text: '替緊急事件讓路；恢復後回到執行中。',
  tone: 'paused'
}

const ENDS: State[] = [
  { key: 'DONE', mark: '✓', name: '完成', text: '每一項驗收條件都有證據證明通過。', tone: 'done' },
  { key: 'FIXED', mark: '✓', name: '已修復', text: 'Bug 修好了，等你或 QA 實際驗證。', tone: 'done' },
  { key: 'PARTIAL', mark: '◐', name: '部分完成', text: '有些驗收項目還沒過；卡點解除後補正為完成。', tone: 'partial' },
  { key: 'BLOCKED', mark: '●', name: '受阻', text: '在等外部條件：權限、環境、別人的回覆，或塔台的決定。', tone: 'blocked' },
  { key: 'FAILED', mark: '✗', name: '失敗', text: '試過的做法沒有達成目標，交回塔台換個角度。', tone: 'failed' }
]
</script>

<template>
  <div class="ticket-states" role="group" aria-label="工單的狀態流轉">
    <div class="ts-path">
      <template v-for="(s, i) in FLOW" :key="s.key">
        <span v-if="i > 0" class="ts-arrow" aria-hidden="true" />
        <div class="ts-state" :class="`is-${s.tone}`">
          <p class="ts-head"><span class="ts-mark" aria-hidden="true">{{ s.mark }}</span><code>{{ s.key }}</code></p>
          <p class="ts-name">{{ s.name }}</p>
          <p class="ts-text">{{ s.text }}</p>
        </div>
      </template>
      <div class="ts-state ts-side" :class="`is-${PAUSED.tone}`">
        <p class="ts-head"><span class="ts-mark" aria-hidden="true">{{ PAUSED.mark }}</span><code>{{ PAUSED.key }}</code></p>
        <p class="ts-name">{{ PAUSED.name }}</p>
        <p class="ts-text">{{ PAUSED.text }}</p>
      </div>
    </div>

    <p class="ts-ends-label">收尾時，Worker 依證據標成其中一種</p>
    <ul class="ts-ends">
      <li v-for="s in ENDS" :key="s.key" class="ts-state" :class="`is-${s.tone}`">
        <p class="ts-head"><span class="ts-mark" aria-hidden="true">{{ s.mark }}</span><code>{{ s.key }}</code></p>
        <p class="ts-name">{{ s.name }}</p>
        <p class="ts-text">{{ s.text }}</p>
      </li>
    </ul>
  </div>
</template>
