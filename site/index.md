---
layout: home
markdownStyles: false
---

<main class="home">

<section class="home-hero">
<div class="home-wrap home-hero-grid">
<div class="home-hero-copy">
<h1 class="home-hero-title"><span>一個塔台，</span><span>指揮整隊 AI Agent</span></h1>
<p class="home-hero-tagline"><span class="phrase">你做決定，Agent 做事。</span><span class="phrase">開單、派工、回報、提問、收尾——</span><span class="phrase">Better Agent Terminal 與 BMad Control Tower</span> <span class="phrase">幫你串成一個會自己推進的循環。</span></p>
<div class="home-hero-actions">
<a class="home-btn is-primary" href="#download">下載最新版</a>
<a class="home-btn is-secondary" href="#story">看它怎麼運作</a>
<a class="home-btn is-secondary" href="https://github.com/gowerlin/better-agent-terminal" target="_blank" rel="noreferrer"><span class="vpi-social-github" aria-hidden="true"></span>GitHub</a>
</div>
<div class="home-hero-support">
<ul aria-label="支援的 Agent"><li>Claude Code</li><li>Codex CLI</li><li>Gemini CLI</li><li>GitHub Copilot CLI</li><li>自訂 CLI</li></ul>
<ul aria-label="支援的作業系統"><li>Windows</li><li>macOS（Apple Silicon）</li><li>Linux</li></ul>
</div>
</div>
<TowerDemo />
</div>
</section>

<section id="story" class="home-section home-story">
<div class="home-wrap">
<h2 class="home-title"><span class="phrase">AI 協作開發的</span> <span class="phrase">7 個卡關時刻</span></h2>
<p class="home-lead">一個虛構但真實的早上：你要替 <strong>demo-shop</strong> 的結帳頁加上<strong>折扣碼</strong>。</p>

<StoryTimeline>

<StoryChapter time="09:00" title="一個對話，越聊越長" illo="long-chat" :roles="[['CT', '拆工單、管脈絡'], ['BAT', '每張工單一個獨立分頁']]">
<template #before>從需求聊到實作，再聊到除錯。兩小時後，Agent 開始忘記一開始說好的規則，改 A 壞 B，你只好從頭再解釋一次。</template>
<template #after>你只跟<strong>塔台</strong>談需求。塔台把工作拆成三張<strong>工單</strong>，每張寫清楚目標、範圍、驗收條件與不准碰的東西，再為每張開一個<strong>全新的 Worker</strong>。每個 Worker 只帶一張工單的脈絡上工，塔台只保留進度與決定。</template>
</StoryChapter>

<StoryChapter time="09:20" title="你成了人肉剪貼簿" illo="dispatch" :roles="[['BAT', '派工、啟動確認、完成通知'], ['CT', '何時派、派給誰']]">
<template #before>開新終端、切到專案目錄、貼 prompt、等它做完、把結果複製回來，再開下一個。</template>
<template #after>塔台一個指令，BAT 就在<strong>同一個工作區</strong>開好 Worker 分頁，帶上這個工作區設定的 Agent 與啟動參數，並確認 Agent 真的啟動了。Worker 做完，通知<strong>直接送回塔台</strong>，塔台接手驗收。</template>
</StoryChapter>

<StoryChapter time="10:05" title="五個終端，三個在等你——是哪三個？" illo="thumbnails" :roles="[['BAT', '狀態偵測、縮圖標示、自動回收']]">
<template #before>有的停在權限確認，有的在問問題，有的早就做完了。你只能一個一個點進去看。</template>
<template #after>Worker 分頁的標題帶著它的工單編號，縮圖直接標出 <strong>⚠️ 在等你</strong>、<strong>? 在等塔台答覆</strong>、<strong>✓ 已回報</strong>。塔台收單後，分頁等輸出安靜才自動關閉；你也能一次關掉所有已回報的分頁。</template>
</StoryChapter>

<StoryChapter time="10:40" title="Agent 停下來問你，而你正在開會" illo="questions" :roles="[['BAT', '提問通道'], ['CT', '代決邊界']]">
<template #before>它問完就停著。等你回來，一小時已經過去了。</template>
<template #after>Worker 用結構化通道<strong>問塔台</strong>。「金額四捨五入還是無條件捨去？」這種範圍內的技術選擇，塔台依工單與專案慣例直接回答，並記下理由；「折扣碼能不能和會員折扣疊加？」是要你決定的商業規則，塔台才停下來問你（yolo 模式）。</template>
</StoryChapter>

<StoryChapter time="11:15" title="兩個 Agent 改了同一個檔案" illo="branches" :roles="[['CT', '重疊檢查、合併判斷'], ['BAT', 'worktree 隔離、合併前狀態']]">
<template #before>為了快，你讓它們同時開工，合併時才發現兩個都改了 <code>cart.ts</code>。</template>
<template #after>派工前，塔台先比對每張工單會動到的檔案，有重疊就提醒你。需要平行時，Worker 在<strong>獨立的 git worktree</strong>（自己的分支）裡做；收單前，塔台查清楚每條分支比主線領先多少、落後多少、有沒有未提交的變更，再決定合併順序。</template>
</StoryChapter>

<StoryChapter time="12:00" title="「做完了！」——真的嗎？" illo="checklist" :roles="[['CT', '驗收與狀態']]">
<template #before>測試跑了嗎？有沒有順手改了不該改的東西？你得自己再查一遍。</template>
<template #after>工單事先寫好驗收條件與禁止事項。Worker 回報時附上證據：跑了哪些指令、結果如何、commit 是哪一個；塔台逐項核對才收單。狀態只有 <strong>DONE</strong>、<strong>PARTIAL</strong>、<strong>BLOCKED</strong>、<strong>FAILED</strong> 四種，不含糊。</template>
</StoryChapter>

<StoryChapter time="一個月後" title="當初為什麼這樣決定？" illo="files" :roles="[['CT', '檔案驅動的紀錄']]">
<template #before>理由散在聊天視窗裡，視窗一關就找不回來。</template>
<template #after>每張工單、每個決定都是 repo 裡的 Markdown 檔，和程式碼一起進版控、一起 review。換人接手、換一個 Agent，脈絡都還在。</template>
</StoryChapter>

</StoryTimeline>

<p class="story-ending">12:30，三張工單都收單，Worker 分頁已經關閉，決定都寫在 repo 裡。這個早上你只做了三個決定：要做什麼、折扣能不能疊加、要不要合併。</p>
</div>
</section>

<section class="home-section">
<div class="home-wrap">
<h2 class="home-title"><span class="phrase">BAT 提供跑道，</span><span class="phrase">Control Tower 提供調度——</span><span class="phrase">少一個，循環就斷了</span></h2>
<p class="home-lead">Control Tower 定規則，BAT 提供跑道、無線電和雷達。</p>
<CompareMatrix />
<div class="home-more">

[看塔台、Worker 與 BAT 怎麼分工](./control-tower#division)

</div>
</div>
</section>

<section class="home-section">
<div class="home-wrap">
<h2 class="home-title">自動，但不失控</h2>
<p class="home-lead">自主程度由你選。不管選哪一檔，該你決定的事都會回到你手上。</p>
<div class="home-guard-grid">
<div>
<h3 class="home-subtitle">自主程度</h3>
<AutonomyDial />
<dl class="home-guard-points">
<div>
<dt>每個分頁各有權限</dt>
<dd>每個分頁拿到的是自己的專屬權杖。塔台可以派工、關閉自己派出的 Worker；Worker 只能回報、提問給派它的塔台。</dd>
</div>
<div>
<dt>塔台不替你按鍵</dt>
<dd>Worker 停在權限確認時，只有你能在那個分頁裡回答。BAT 只標出 ⚠️ 在等你，不替你做決定。</dd>
</div>
<div>
<dt>問答不落地</dt>
<dd>Worker 問塔台的內容只存在 BAT 的記憶體裡，祕密會先遮罩；日誌只記長度與結果。</dd>
</div>
</dl>
</div>
<div>
<h3 class="home-subtitle">一定會停下來問你的時候（斷點）</h3>
<ul class="home-guard-list">
<li>範圍要擴大</li>
<li>刪除，或其他不可逆的操作</li>
<li>對外發布：push、發版</li>
<li>需要你的偏好才能決定的選擇</li>
<li>連續失敗</li>
</ul>
</div>
</div>
</div>
</section>

<section class="home-section home-learning">
<div class="home-wrap">
<h2 class="home-title">越用越懂你的專案</h2>
<p class="home-lead">第一天它照工單做事；第三個月，它照你的專案做事。</p>
<FeatureGrid set="learning" />
<h3 class="home-subtitle home-ladder-title">經驗會長大</h3>
<GrowthLadder />
<div class="home-more">

[看塔台怎麼學你的專案](./control-tower#learning)

</div>
</div>
</section>

<section class="home-section">
<div class="home-wrap">
<h2 class="home-title"><span class="phrase">BAT 自己</span><span class="phrase">就是這樣開發的</span></h2>
<p class="home-lead">從 2026 年 4 月起，BAT 的每個功能、每次修正，都由塔台開單、Worker 實作、塔台驗收。這一頁介紹的每個整合功能，都是在這個流程裡被需要、被做出來的。</p>
<StatsCounter />
<p class="home-stats-note">截至 2026 年 10 月的累計數字。</p>
</div>
</section>

<section class="home-section">
<div class="home-wrap">
<h2 class="home-title"><span class="phrase">不用 Control Tower，</span><span class="phrase">BAT 也好用</span></h2>
<p class="home-lead">只拿來開終端機和 Agent，BAT 也是順手的工作台。</p>
<!-- TODO(W2b): 「看全部功能」連到 /features（頁面在 W2b 才建立） -->
<FeatureGrid />
</div>
</section>

<section id="download" class="home-section home-download">
<div class="home-wrap">
<h2 class="home-title">下載</h2>
<DownloadLinks />

macOS 版只支援 Apple Silicon（arm64）。安裝步驟與首次執行的注意事項見[安裝](./install)。

</div>
</section>

</main>
