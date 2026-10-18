<script setup lang="ts">
import StoryIllo, { type StoryIlloKind } from './StoryIllo.vue'

// 一張工單的一生：沿用首頁 demo-shop 的故事，每步「畫面示意 + 發生什麼 + 你要做什麼」
interface Step {
  name: string
  illo: StoryIlloKind
  what: string
  you: string
}

const STEPS: Step[] = [
  {
    name: '對齊',
    illo: 'align',
    what: '你跟塔台說，要替 demo-shop 的結帳頁加上折扣碼。塔台把不清楚的地方問清楚：折扣碼有沒有到期日？能不能和會員折扣疊加？還沒有答案的，它先記成待決事項。',
    you: '說清楚要什麼、什麼不要。這是整個流程裡最需要你花心思的一步。'
  },
  {
    name: '開單',
    illo: 'workorder',
    what: '塔台拆成三張工單：T1024 折扣碼的資料與驗證、T1025 金額計算、T1026 結帳頁畫面。每張寫清楚目標、範圍、驗收條件與不准碰的東西，存成 repo 裡的 Markdown 檔。',
    you: '看一眼範圍對不對。自主程度設在 ask 時，塔台派工前會先問你。'
  },
  {
    name: '派工',
    illo: 'dispatch',
    what: '塔台請 BAT 開 Worker 分頁。分頁開在塔台所在的工作區，帶上這個工作區設定的 Agent 與啟動參數，標題就是工單編號。Claude CLI 與新版 Codex CLI 的分頁，BAT 還會確認 Agent 真的啟動了。',
    you: '不用動手。自主程度設在 off 時，塔台會把指令給你，由你自己開分頁、貼上。'
  },
  {
    name: '執行',
    illo: 'running',
    what: 'Worker 讀工單、改程式、跑測試、commit，只帶這張工單的脈絡。塔台不用進分頁看：它可以用 BAT 的唯讀查詢看每個 Worker 的狀態與輸出。',
    you: 'Worker 停在權限確認時，縮圖會標「⚠️ 在等你」。只有你能在那個分頁裡回答。'
  },
  {
    name: '提問',
    illo: 'questions',
    what: 'yolo 模式下，Worker 遇到範圍內的選擇，會用 BAT 的提問通道問塔台，縮圖標「? 在等塔台答覆」。塔台依工單與專案慣例回答並記下理由；屬於商業規則的，才轉給你。',
    you: '只回答塔台轉給你的問題，例如折扣碼能不能和會員折扣疊加。'
  },
  {
    name: '回報',
    illo: 'report',
    what: 'Worker 把結果寫進工單的回報區：做了什麼、跑了哪些指令、結果如何、commit 是哪一個。BAT 把「T1024 完成」送回塔台分頁，縮圖標「✓ 已回報」。',
    you: 'yolo 模式下通知會自動送出；on 模式下它會先填進塔台的輸入列，由你按下送出。'
  },
  {
    name: '驗收',
    illo: 'checklist',
    what: '塔台逐項核對驗收條件與禁止事項，再把工單標成 DONE、PARTIAL、BLOCKED 或 FAILED。沒過的，塔台補充說明請 Worker 再做一輪，或另開一張工單。',
    you: '通常不用做事。結果需要你判斷時，塔台會停下來問你。'
  },
  {
    name: '回收',
    illo: 'recycle',
    what: '收單後，塔台請 BAT 關掉這個 Worker 分頁。BAT 會等分頁的輸出安靜下來才關；塔台也只能關自己派出的 Worker。',
    you: '想留著分頁，就在裡面打個字，關閉會取消。你也可以按右鍵，一次關掉所有已回報的 Worker 分頁。'
  },
  {
    name: '合併',
    illo: 'branches',
    what: '用了 worktree 隔離的工單，Worker 是在自己的分支上做的。合併前，塔台向 BAT 查這條分支比主線領先多少、落後多少、有沒有未提交的變更、會不會衝突，再排出合併順序。',
    you: '決定要不要合併。push 與發版一定等你點頭。'
  }
]
</script>

<template>
  <ol class="ticket-life">
    <li v-for="(step, i) in STEPS" :key="step.name" class="tl-step">
      <span class="tl-marker" aria-hidden="true">{{ i + 1 }}</span>
      <div class="tl-body">
        <h3 class="tl-name"><span class="sr-only">第 {{ i + 1 }} 步：</span>{{ step.name }}</h3>
        <StoryIllo :kind="step.illo" />
        <p class="tl-what">{{ step.what }}</p>
        <p class="tl-you"><b>你要做的事</b>{{ step.you }}</p>
      </div>
    </li>
  </ol>
</template>
