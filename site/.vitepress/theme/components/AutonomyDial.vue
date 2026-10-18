<script setup lang="ts">
import { computed, ref } from 'vue'

type Mode = 'off' | 'ask' | 'on' | 'yolo'

interface ModeInfo {
  id: Mode
  short: string
  tower: string
  you: string
}

const MODES: ModeInfo[] = [
  {
    id: 'off',
    short: '只給你指令',
    tower: '塔台寫好工單，告訴你派工要貼什麼指令。',
    you: '自己開分頁、貼指令，Worker 做完再把結果帶回塔台。'
  },
  {
    id: 'ask',
    short: '每次先問你',
    tower: '每次派工前先問你，你同意才開 Worker 分頁。',
    you: '逐張點頭；看得最清楚，也最常被打斷。'
  },
  {
    id: 'on',
    short: '自動派工',
    tower: '直接開好 Worker 分頁並啟動；Worker 做完，它的回報會預先填進塔台的輸入列。',
    you: '看一眼回報、按下送出，塔台再接著驗收。'
  },
  {
    id: 'yolo',
    short: '自主推進',
    tower: '派工、收回報、驗收、決定下一張都自己來；Worker 的範圍內提問也代你回答。',
    you: '只在斷點出現時回來做決定。'
  }
]

const selected = ref<Mode>('yolo')
const current = computed(() => MODES.find((m) => m.id === selected.value) as ModeInfo)
const index = computed(() => MODES.findIndex((m) => m.id === selected.value))
</script>

<template>
  <div class="autonomy" :style="{ '--autonomy-index': index }">
    <div class="autonomy-track" role="group" aria-label="自主程度">
      <button
        v-for="mode in MODES"
        :key="mode.id"
        type="button"
        class="autonomy-stop"
        :class="{ 'is-selected': mode.id === selected }"
        :aria-pressed="mode.id === selected"
        @click="selected = mode.id"
      >
        <span class="autonomy-mode">{{ mode.id }}</span>
        <span class="autonomy-short">{{ mode.short }}</span>
      </button>
    </div>
    <div class="autonomy-detail" aria-live="polite">
      <p><b>塔台</b>{{ current.tower }}</p>
      <p><b>你</b>{{ current.you }}</p>
    </div>
  </div>
</template>
