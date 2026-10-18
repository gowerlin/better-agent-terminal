<script setup lang="ts">
import { computed, useSlots } from 'vue'

// /cases 的一個案例。有 before 插槽時沿用故事章節的兩欄（左「以前」、右「BAT + CT」）；
// 沒有時是 BAT 自己的真實案例，內文放在預設插槽，figure 插槽放在內文旁邊。
type CaseFacet = 'ct' | 'bat' | 'both'

const props = defineProps<{
  id: string
  title: string
  // 情境標籤：合併後除錯、緊急插隊……
  tag: string
  facet: CaseFacet
  // 分工標籤：['CT', '先寫契約'] 之類
  roles: Array<[string, string]>
  // 刻意比其他案例短的註腳型案例
  brief?: boolean
}>()

const FACETS: Record<CaseFacet, string> = {
  ct: 'Control Tower 的做法',
  bat: 'BAT 的功能',
  both: 'BAT 與 Control Tower 搭配'
}

const slots = useSlots()
const facetLabel = computed(() => FACETS[props.facet])
</script>

<template>
  <section class="case-card" :class="{ 'is-brief': brief, 'has-figure': !!slots.figure }" :aria-labelledby="id">
    <h3 :id="id" class="case-title" tabindex="-1">
      {{ title }}
      <a class="header-anchor" :href="`#${id}`" :aria-label="`連到「${title}」`">&#8203;</a>
    </h3>
    <p class="case-meta">
      <span class="case-tag"><span class="sr-only">情境：</span>{{ tag }}</span>
      <span class="case-facet" :class="`is-${facet}`"><span class="sr-only">誰出力：</span>{{ facetLabel }}</span>
    </p>

    <div v-if="slots.before" class="story-pair case-pair">
      <section class="story-card is-before">
        <h4>以前</h4>
        <p><slot name="before" /></p>
      </section>
      <section class="story-card is-after">
        <h4>BAT + CT</h4>
        <p><slot name="after" /></p>
      </section>
    </div>

    <div v-else class="case-body">
      <div class="case-text"><slot /></div>
      <div v-if="slots.figure" class="case-figure"><slot name="figure" /></div>
    </div>

    <p v-if="slots.result" class="case-result"><b>結果</b><slot name="result" /></p>

    <ul class="story-roles" aria-label="分工">
      <li v-for="[who, what] in roles" :key="who" class="story-role" :class="who === 'CT' ? 'is-ct' : 'is-bat'">
        <b>{{ who }}</b>：{{ what }}
      </li>
    </ul>
  </section>
</template>
