<script setup lang="ts">
// 經驗的成長管線：觀察 → 已驗證 → 標準流程 → 技能。靜態，不做動畫。
// 紫色只用在「塔台記下規則」的第一格（錨點 A1：紫色只給塔台發出的東西）；
// 「你決定」的兩格用「你要做的事」的藍框，和工單流程的示意一致。
withDefaults(defineProps<{ detailed?: boolean }>(), { detailed: false })

interface Rung {
  name: string
  who: string
  short: string
  long: string
  tower?: boolean
  you?: boolean
}

const RUNGS: Rung[] = [
  {
    name: '觀察',
    who: '塔台記下',
    short: '從做完的工單裡記下一條觀察',
    long: '塔台從做完的工單回報裡，整理出值得記住的做法或踩過的坑。',
    tower: true
  },
  {
    name: '已驗證',
    who: '幾張工單之後',
    short: '同一個做法一再有效，之後主動套用',
    long: '同一個做法在幾張工單裡都有效，就升級成已驗證；之後遇到類似情境，塔台會主動套用。'
  },
  {
    name: '標準流程',
    who: '你決定',
    short: '夠成熟了，定成一套標準工單流程',
    long: '你覺得夠成熟時，可以把它定成一套標準工單流程，之後同類工作都照這個流程開單。',
    you: true
  },
  {
    name: '技能',
    who: '你決定',
    short: '做成任何專案都能用的技能',
    long: '最後再做成技能，帶到任何專案都能用。',
    you: true
  }
]
</script>

<template>
  <ol class="growth-ladder" :class="{ 'is-detailed': detailed }" aria-label="經驗的成長管線">
    <li v-for="rung in RUNGS" :key="rung.name" class="gl-rung" :class="{ 'is-tower': rung.tower, 'is-you': rung.you }">
      <span class="gl-node" aria-hidden="true" />
      <p class="gl-name">{{ rung.name }}</p>
      <p class="gl-who">{{ rung.who }}</p>
      <p class="gl-text">{{ detailed ? rung.long : rung.short }}</p>
    </li>
  </ol>
</template>
