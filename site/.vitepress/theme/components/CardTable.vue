<script setup lang="ts">
// 文件頁用的對照表：桌面是表格，窄螢幕改成一列一張卡（第一欄當卡片標題），不讓整頁水平捲動。
withDefaults(
  defineProps<{
    columns: string[]
    rows: string[][]
    // 要強調的列（0 起算），例：機場比喻的「塔台不上飛機」
    highlight?: number[]
    caption?: string
  }>(),
  { highlight: () => [] }
)
</script>

<template>
  <div class="card-table">
    <table class="ct-grid">
      <caption v-if="caption" class="sr-only">{{ caption }}</caption>
      <thead>
        <tr>
          <th v-for="(col, i) in columns" :key="i" scope="col">
            <span v-if="!col" class="sr-only">項目</span>{{ col }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, r) in rows" :key="r" :class="{ 'is-highlight': highlight.includes(r) }">
          <th scope="row">{{ row[0] }}</th>
          <td v-for="(cell, c) in row.slice(1)" :key="c">{{ cell }}</td>
        </tr>
      </tbody>
    </table>

    <ul class="ct-cards" :aria-label="caption">
      <li v-for="(row, r) in rows" :key="r" class="ct-card" :class="{ 'is-highlight': highlight.includes(r) }">
        <p class="ct-card-title">{{ row[0] }}</p>
        <dl>
          <template v-for="(cell, c) in row.slice(1)" :key="c">
            <dt v-if="columns[c + 1]">{{ columns[c + 1] }}</dt>
            <dd>{{ cell }}</dd>
          </template>
        </dl>
      </li>
    </ul>
  </div>
</template>
