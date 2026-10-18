<script lang="ts">
export type StoryIlloKind =
  | 'long-chat'
  | 'dispatch'
  | 'thumbnails'
  | 'questions'
  | 'branches'
  | 'checklist'
  | 'files'
  // /control-tower「一張工單的一生」另外用到的畫面
  | 'align'
  | 'workorder'
  | 'running'
  | 'report'
  | 'recycle'
</script>

<script setup lang="ts">
defineProps<{ kind: StoryIlloKind }>()

const LABELS: Record<StoryIlloKind, string> = {
  'long-chat':
    '插圖：左邊是一條越聊越長、已經到第 87 則的對話；右邊是塔台分頁與三個 Worker 分頁，每個 Worker 只帶一張工單的脈絡。',
  dispatch: '插圖：塔台分頁派工到三個 Worker 分頁，三個都確認已啟動；Worker 的完成通知送回塔台。',
  thumbnails:
    '插圖：三個 Worker 縮圖。T1024 標「⚠️ 在等你」，停在權限確認；T1025 標「? 在等塔台答覆」；T1026 標「✓ 已回報」。',
  questions:
    '插圖：兩個提問。T1025 問金額要四捨五入還是無條件捨去，塔台依專案慣例回答四捨五入；T1024 問折扣碼能不能和會員折扣疊加，塔台轉給你決定。',
  branches:
    '插圖：主線分出 ct/T1024 與 ct/T1025 兩條分支，各自在獨立的 worktree 裡工作。合併前狀態：ct/T1024 領先 3、落後 0、沒有未提交的變更。',
  checklist:
    '插圖：T1024 的驗收清單。單元測試通過、建置 0 錯誤、只改了工單列出的檔案、附上 commit，狀態 DONE。',
  files: '插圖：demo-shop 的檔案樹，程式碼旁邊是三張工單與一份決策紀錄，都是 Markdown 檔。',
  align:
    '插圖：你在塔台分頁說要替結帳頁加折扣碼；塔台反問有沒有到期日、能不能和會員折扣疊加，並把疊加規則記成待你決定。',
  workorder:
    '插圖：工單 T1024 的內容。目標是折扣碼的資料模型與驗證，範圍是 src/discount.ts 與 src/cart.ts，驗收是單元測試通過、建置 0 錯誤，不准碰結帳頁畫面。',
  running: '插圖：Worker T1024 的分頁。它讀了工單、改了兩個檔案、跑過單元測試，再做了 commit。',
  report:
    '插圖：Worker T1024 標「✓ 已回報」，完成通知送回塔台分頁，塔台的輸入列出現「T1024 完成」。',
  recycle:
    '插圖：收單後，T1024 的 Worker 分頁等輸出安靜才關閉；還在執行的 T1025 分頁不受影響。'
}
</script>

<template>
  <figure class="story-illo" :class="`is-${kind}`" role="img" :aria-label="LABELS[kind]">
    <template v-if="kind === 'long-chat'">
      <div class="si-col" aria-hidden="true">
        <p class="si-caption">一個對話</p>
        <div class="si-chat">
          <p><b>你</b>折扣碼要能設定到期日</p>
          <p><b>Agent</b>好，我先改資料模型……</p>
          <p class="si-fade">⋮</p>
          <p class="si-dim"><span class="si-mono">#87</span> <b>你</b>一開始說好不能改 cart.ts 呢？</p>
        </div>
      </div>
      <div class="si-col" aria-hidden="true">
        <p class="si-caption">一個塔台、三個乾淨的 Worker</p>
        <ul class="si-tabs">
          <li class="si-tab is-tower"><span class="si-agent is-claude">▶</span>Claude CLI · Tower <span class="si-note">進度與決定</span></li>
          <li class="si-tab"><span class="si-agent is-claude">▶</span>Claude CLI · Worker · T1024 <span class="si-note">只帶 T1024</span></li>
          <li class="si-tab"><span class="si-agent is-codex">▶</span>Codex CLI · Worker · T1025 <span class="si-note">只帶 T1025</span></li>
          <li class="si-tab"><span class="si-agent is-claude">▶</span>Claude CLI · Worker · T1026 <span class="si-note">只帶 T1026</span></li>
        </ul>
      </div>
    </template>

    <template v-else-if="kind === 'dispatch'">
      <div class="si-dispatch" aria-hidden="true">
        <span class="si-tab is-tower"><span class="si-agent is-claude">▶</span>Claude CLI · Tower</span>
        <span class="si-arrows">
          <span class="si-arrow is-out">派工</span>
          <span class="si-arrow is-back">完成通知</span>
        </span>
        <ul class="si-tabs">
          <li class="si-tab"><span class="si-agent is-claude">▶</span>Claude CLI · Worker · T1024 <span class="si-ok">已啟動</span></li>
          <li class="si-tab"><span class="si-agent is-codex">▶</span>Codex CLI · Worker · T1025 <span class="si-ok">已啟動</span></li>
          <li class="si-tab"><span class="si-agent is-claude">▶</span>Claude CLI · Worker · T1026 <span class="si-ok">已啟動</span></li>
        </ul>
      </div>
    </template>

    <template v-else-if="kind === 'thumbnails'">
      <div class="si-thumbs" aria-hidden="true">
        <div class="si-thumb">
          <p class="si-thumb-head"><span class="si-agent is-claude">▶</span>Claude CLI · Worker · T1024</p>
          <pre class="si-screen">Edit src/discount.ts?
1. Yes  2. No</pre>
          <p class="si-badge is-blocked"><span>⚠️</span>在等你</p>
        </div>
        <div class="si-thumb">
          <p class="si-thumb-head"><span class="si-agent is-codex">▶</span>Codex CLI · Worker · T1025</p>
          <pre class="si-screen">已問塔台：四捨五入？
等待答覆</pre>
          <p class="si-badge is-question"><span>?</span>在等塔台答覆</p>
        </div>
        <div class="si-thumb">
          <p class="si-thumb-head"><span class="si-agent is-claude">▶</span>Claude CLI · Worker · T1026</p>
          <pre class="si-screen">T1026 完成
已回報塔台</pre>
          <p class="si-badge is-reported"><span>✓</span>已回報</p>
        </div>
      </div>
    </template>

    <template v-else-if="kind === 'questions'">
      <div class="si-qa" aria-hidden="true">
        <div class="si-thread">
          <p class="si-bubble is-worker"><span class="si-who">T1025</span>金額四捨五入還是無條件捨去？</p>
          <p class="si-bubble is-tower"><span class="si-who">塔台</span>四捨五入，依專案慣例。理由已記下。</p>
        </div>
        <div class="si-thread">
          <p class="si-bubble is-worker"><span class="si-who">T1024</span>折扣碼能不能和會員折扣疊加？</p>
          <p class="si-bubble is-you"><span class="si-who">塔台 → 你</span>這是商業規則，請你決定。</p>
        </div>
      </div>
    </template>

    <template v-else-if="kind === 'branches'">
      <div class="si-branches" aria-hidden="true">
        <svg viewBox="0 0 520 150" class="si-graph">
          <line x1="20" y1="75" x2="500" y2="75" class="si-g-main" />
          <path d="M80 75 C 120 75, 120 28, 160 28 L 360 28 C 400 28, 400 75, 440 75" class="si-g-branch is-a" />
          <path d="M120 75 C 160 75, 160 122, 200 122 L 300 122" class="si-g-branch is-b" />
          <circle cx="80" cy="75" r="6" class="si-g-node" />
          <circle cx="440" cy="75" r="6" class="si-g-node is-merge" />
          <circle cx="220" cy="28" r="4" class="si-g-commit is-a" />
          <circle cx="280" cy="28" r="4" class="si-g-commit is-a" />
          <circle cx="340" cy="28" r="4" class="si-g-commit is-a" />
          <circle cx="250" cy="122" r="4" class="si-g-commit is-b" />
          <circle cx="300" cy="122" r="4" class="si-g-commit is-b" />
          <text x="24" y="62" class="si-g-label">main</text>
          <text x="170" y="16" class="si-g-label is-a">ct/T1024</text>
          <text x="210" y="146" class="si-g-label is-b">ct/T1025</text>
        </svg>
        <pre class="si-screen is-wide">ct/T1024  領先 3  落後 0  未提交 0  → 可直接合併
ct/T1025  領先 2  落後 3  未提交 0  → 先更新再合併</pre>
      </div>
    </template>

    <template v-else-if="kind === 'checklist'">
      <pre class="si-screen is-wide is-check" aria-hidden="true"><span class="si-title">T1024 驗收</span>
<span class="si-done">✓</span> npm run test:unit      214 passed
<span class="si-done">✓</span> npm run build          0 errors
<span class="si-done">✓</span> 只改 src/discount.ts、src/cart.ts
<span class="si-done">✓</span> commit 3f2a9c1
狀態 <span class="si-state">DONE</span></pre>
    </template>

    <template v-else-if="kind === 'files'">
      <pre class="si-screen is-wide" aria-hidden="true">demo-shop/
├─ src/
│  ├─ cart.ts
│  └─ discount.ts
└─ work-orders/
   ├─ T1024-discount-code.md
   ├─ T1025-rounding.md
   ├─ T1026-checkout-ui.md
   └─ decision-log.md</pre>
    </template>

    <template v-else-if="kind === 'align'">
      <div class="si-col" aria-hidden="true">
        <p class="si-tab is-tower"><span class="si-agent is-claude">▶</span>Claude CLI · Tower</p>
        <div class="si-chat is-under-tab">
          <p><b>你</b>結帳頁要能輸入折扣碼</p>
          <p class="is-tower"><b>塔台</b>折扣碼有到期日嗎？能和會員折扣疊加嗎？</p>
          <p><b>你</b>有到期日。疊加我再想想</p>
          <p class="is-tower"><b>塔台</b>記下了：疊加規則等你決定。我拆成三張工單。</p>
        </div>
      </div>
    </template>

    <template v-else-if="kind === 'workorder'">
      <pre class="si-screen is-wide" aria-hidden="true"><span class="si-title">work-orders/T1024-discount-code.md</span>
目標    折扣碼的資料模型與驗證
範圍    src/discount.ts、src/cart.ts
驗收    單元測試通過、建置 0 錯誤
不准碰  結帳頁畫面（T1026 負責）
回報    （Worker 做完填寫）</pre>
    </template>

    <template v-else-if="kind === 'running'">
      <div class="si-col" aria-hidden="true">
        <p class="si-thumb-head"><span class="si-agent is-claude">▶</span>Claude CLI · Worker · T1024</p>
        <pre class="si-screen is-wide is-under-tab">讀取工單 T1024
改 src/discount.ts
改 src/cart.ts
$ npm run test:unit    214 passed
$ git commit -m "T1024 折扣碼驗證"</pre>
      </div>
    </template>

    <template v-else-if="kind === 'report'">
      <div class="si-dispatch is-report" aria-hidden="true">
        <div class="si-col">
          <p class="si-tab is-tower"><span class="si-agent is-claude">▶</span>Claude CLI · Tower</p>
          <pre class="si-screen is-under-tab"><span class="si-prompt">›</span> T1024 完成</pre>
        </div>
        <span class="si-arrows">
          <span class="si-arrow is-back">完成通知</span>
        </span>
        <div class="si-thumb">
          <p class="si-thumb-head"><span class="si-agent is-claude">▶</span>Claude CLI · Worker · T1024</p>
          <p class="si-badge is-reported"><span>✓</span>已回報</p>
        </div>
      </div>
    </template>

    <template v-else-if="kind === 'recycle'">
      <ul class="si-tabs is-full" aria-hidden="true">
        <li class="si-tab is-tower"><span class="si-agent is-claude">▶</span>Claude CLI · Tower <span class="si-note">T1024 收單</span></li>
        <li class="si-tab is-closing"><span class="si-agent is-claude">▶</span>Claude CLI · Worker · T1024 <span class="si-note">輸出安靜後關閉</span></li>
        <li class="si-tab"><span class="si-agent is-codex">▶</span>Codex CLI · Worker · T1025 <span class="si-note">還在執行，不動</span></li>
      </ul>
    </template>
  </figure>
</template>
