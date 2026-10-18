<script setup lang="ts">
interface Row {
  topic: string
  bat: string
  ct: string
  both: string
}

const ROWS: Row[] = [
  { topic: '拆工作、定範圍', bat: '你自己想', ct: '塔台拆成工單', both: '塔台拆成工單' },
  {
    topic: '開 Worker',
    bat: '手動開分頁、輸入指令',
    ct: '塔台給你指令去開（部分終端能自動開分頁），沒有啟動確認',
    both: '塔台直接開好分頁、放進對的工作區、確認啟動'
  },
  { topic: '做完之後', bat: '你自己去看', ct: 'Worker 印出訊息，你貼回塔台', both: '通知自動送回塔台，塔台接手驗收' },
  {
    topic: 'Agent 有問題',
    bat: '停下來等你',
    ct: '寫進工單，等你轉告塔台',
    both: '結構化問塔台：範圍內代答，其餘轉給你'
  },
  { topic: '誰在等你', bat: '縮圖標示 ⚠️ 在等你', ct: '逐一查看', both: '縮圖 ⚠️ 在等你、? 在等塔台、✓ 已回報，一眼看清' },
  {
    topic: '平行開工',
    bat: '自己避開衝突',
    ct: '有重疊檢查，隔離要自己做',
    both: '重疊檢查 + worktree 隔離 + 合併前狀態'
  },
  { topic: '收尾', bat: '手動關分頁', ct: '手動關分頁', both: '已回報的分頁自動回收' },
  { topic: '紀錄', bat: '聊天紀錄', ct: '工單與決策紀錄', both: '工單與決策紀錄' }
]
</script>

<template>
  <div class="compare">
    <table class="compare-table">
      <thead>
        <tr>
          <th scope="col"><span class="sr-only">項目</span></th>
          <th scope="col">只用 BAT</th>
          <th scope="col">只用 Control Tower</th>
          <th scope="col" class="is-both">BAT + Control Tower</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in ROWS" :key="row.topic">
          <th scope="row">{{ row.topic }}</th>
          <td>{{ row.bat }}</td>
          <td>{{ row.ct }}</td>
          <td class="is-both">{{ row.both }}</td>
        </tr>
      </tbody>
    </table>

    <ul class="compare-cards">
      <li v-for="row in ROWS" :key="row.topic" class="compare-card">
        <h3 class="compare-topic">{{ row.topic }}</h3>
        <p class="compare-both"><span class="compare-who">BAT + Control Tower</span>{{ row.both }}</p>
        <details class="compare-others">
          <summary>只用其中一個時</summary>
          <dl>
            <dt>只用 BAT</dt>
            <dd>{{ row.bat }}</dd>
            <dt>只用 Control Tower</dt>
            <dd>{{ row.ct }}</dd>
          </dl>
        </details>
      </li>
    </ul>
  </div>
</template>
