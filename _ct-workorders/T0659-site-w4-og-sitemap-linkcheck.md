---
schema_version: 1
schema_kind: workorder
id: T0659
title: "PLAN-049 W4：網站 OG / Twitter 分享卡片、sitemap、lychee 連結檢查 job；派工短片加 H.264 MP4 備援"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: S
created_at: "2026-10-18T19:47:34+0800"
started_at: "2026-10-18T19:49:29+0800"
updated_at: "2026-10-18T19:57:59+0800"
completed_at: "2026-10-18T19:57:59+0800"
depends_on: [T0656]
related:
  - "T0622 回報區 § 5-3（SEO / OG：`head` 設 `og:*` / `twitter:card`、`sitemap.hostname`、`lang: 'zh-TW'`；連結檢查 `lycheeverse/lychee-action` v2.9.0 掃 `site/.vitepress/dist`）、W4 驗收（lychee 0 broken、分享連結預覽顯示 OG 卡片）；D160 第 2、5 點"
  - "主規格 `_ct-workorders/_spec-site-v2-bat-ct-story.md` § 9（OG 卡片可用 `anthropic-skills:canvas-design`，選用）；設計語言 `docs/design/site-design-language.md`（品牌紫、雷達語彙）；Hero 標語「一個塔台，指揮整隊 AI Agent」（D161）"
  - "T0656 回報區「給塔台的後續建議」第 4 點（WebM 在舊版 Safari 無法播放 → H.264 MP4 第二個 `<source>`）"
affects_files:
  - site/.vitepress/config.mts
  - "site/public/og-card.png（新，1200×630）與其原始檔（若有 SVG / HTML 原稿，放 `site/public/` 以外，例如 `docs/design/og-card.*`）"
  - "site/public/media/clip-dispatch.mp4（新）"
  - "site/.vitepress/theme/components/DemoVideo.vue（加第二個 `<source>`）"
  - "site/control-tower.md（只在 DemoVideo 用法需要多傳 MP4 路徑時）"
  - ".github/workflows/pages.yml（新增 lychee 連結檢查 job）"
  - "site/lychee.toml 或 .lycheeignore（若需要排除規則）"
  - _ct-workorders/T0659-site-w4-og-sitemap-linkcheck.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 開工第一步載入 **`frontend-design`** skill（OG 卡片設計）；清單裡沒有 → `BLOCKED` 回報。OG 卡片：1200×630 PNG、≤ 300 KB，品牌紫與雷達語彙、標語「一個塔台，指揮整隊 AI Agent」與產品名 Better Agent Terminal；可用 HTML / SVG 原稿以本機瀏覽器（Playwright 的 chrome channel 或 `site/` 既有工具）輸出 PNG。不放 CT 字樣以外的內部資訊、不放權杖 / 使用者路徑；不用 CT 的取得管道。"
  - "🔴 `config.mts`：`head` 加 `og:title` / `og:description` / `og:image`（絕對 URL `https://gowerlin.github.io/better-agent-terminal/og-card.png`）/ `og:url` / `og:type` / `twitter:card=summary_large_image`；每頁的 title / description 走 VitePress 的 `transformHead`（或等效）帶入頁面自己的 frontmatter；`sitemap: { hostname: 'https://gowerlin.github.io/better-agent-terminal/' }`；`lang: 'zh-TW'` 若已設就不動。"
  - "🔴 lychee：`.github/workflows/pages.yml` 新增一個 job（build 之後、對 `site/.vitepress/dist` 跑 `lycheeverse/lychee-action`，版本以 T0622 查證的 v2.9.0 為底，實作時再確認最新穩定版並寫出處；`actions/checkout` 等沿用既有版本）。**連結檢查失敗只警告、不擋部署**（`fail: false` 或獨立 job 不在 deploy 的 `needs` 裡），並寫明理由。外部連結速率限制 / GitHub 連結需排除或帶 token，寫進設定。🔴 不得改 `pre-release.yml` / `release.yml`；不得改 Pages 設定；不得 push。本機用 lychee CLI（若沒有就用 `npx linkinator` 等不寫入 repo 的方式，不新增 npm 依賴）跑一次 dist，回報 broken 數。"
  - "🔴 MP4 備援：用本機 ffmpeg 從 `site/public/media/clip-dispatch.webm` 轉 H.264（`-movflags +faststart`、無聲、≤ 1 MB 建議），`DemoVideo.vue` 先列 WebM 再列 MP4 `<source>`；T0656 的播放行為（進入視窗才播、reduced-motion 不自動播）不變。沒有 ffmpeg 就跳過並回報。"
  - "🔴 網站規則：CT 字樣 / 內部編號 / 隱私 grep = 0；`npm run build` 0 錯誤 0 死連結；手機無整頁水平捲動。**Worker 不 push、不改 GitHub 設定**；網站這批等下一個預覽版發佈後由塔台 push。預覽伺服器用 `e2e-results/site-preview/serve.mjs`（若不存在就重建；或用 T0656 的方式），用完結束（L164）。"
  - "🔴 非隔離工單。T0657（`electron/**`、`scripts/bat-hook.mjs`）、T0658（`src/components/setup-wizard/**`、`src/locales/**`、`site/public/media/wizard-*.png`、可能跑 `e2e/site-media.spec.ts`）可能同時進行，不碰它們的檔；🔴 不要跑 Playwright e2e。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF。"
---

# T0659 — 網站 W4：分享卡片、sitemap、連結檢查

## 目標

PLAN-049 網站 v2 的最後一張（W4）。讓網站連結貼到社群 / 聊天工具時有像樣的預覽卡片、搜尋引擎拿得到 sitemap、每次部署自動檢查死連結；順手補上 T0656 短片在舊版 Safari 的 MP4 備援。

## 要做的事

1. OG 卡片設計與輸出（`site/public/og-card.png`）。
2. `config.mts`：OG / Twitter meta（每頁帶自己的 title / description）、sitemap。
3. `pages.yml`：lychee 連結檢查 job（只警告、不擋部署）。
4. 派工短片的 MP4 備援。
5. 截圖（不入版控）：OG 卡片本身；首頁 `<head>` 的 meta 擷取（`curl` dist 的 HTML 或 DevTools）。

## 驗證

- `site/` `npm run build`：0 錯誤、0 死連結；dist 有 `sitemap.xml`，每頁 HTML 有 `og:*` / `twitter:*`
- 本機連結檢查 dist：broken 數（外部連結受限的情況寫明）
- `actionlint`（若本機有）或以 YAML 解析檢查 `pages.yml` 語法
- 短片：Chromium 播 WebM；MP4 用 ffprobe 確認 H.264 / faststart

## 驗收

- OG 卡片 1200×630、≤ 300 KB，meta 正確；sitemap 產生；lychee job 加入且不擋部署；MP4 備援可用
- 回報區附：OG 卡片設計說明、meta 擷取、連結檢查結果、`pages.yml` diff 摘要、給使用者的預覽指令、commit，以及塔台要在 `_local-rules.md` 發版流程加的一句（建議文字）
- 未 push、未改 GitHub 設定

## 回報區

### 結果摘要

全部完成：OG 分享卡片（1200×630、143 KB）、每頁 OG / Twitter meta、sitemap、`pages.yml` 的 lychee 連結檢查 job（只警告、不擋部署）、派工短片的 H.264 MP4 備援。產品 commit `3d1ca713`。未 push、未改 GitHub 設定、未跑 Playwright e2e（只用 Playwright 的 chrome channel 擷取 OG 卡片與檢查影片，腳本在 scratchpad、不進 repo）。

### 落點檢查

- C-0：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal` → PASS
- C-1：工單在 `REPO_ROOT/_ct-workorders/` 下 → PASS
- C-3：`site/.vitepress/config.mts`、`DemoVideo.vue`、`site/control-tower.md`、`.github/workflows/pages.yml` 皆存在 → PASS（資訊性）
- C-2：工單沒有 `branch` 欄位，目前 `main` → 不適用
- `CT_HOME` 未設定（非隔離）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- 結論：PASS

### 開工

- 第一步載入 `frontend-design` skill（清單內有 `frontend-design:frontend-design`），已載入。

### 1. OG 卡片設計說明

- 檔案：`site/public/og-card.png`（1200×630，142,795 bytes）；原稿 `docs/design/og-card.html`（不在 `site/public/`）。
- 版面：左側是產品名（附 `logo.svg`）＋ Hero 標語「一個塔台，／指揮整隊 AI Agent」（Chiron Hei HK 900，78 px，兩行固定斷行）＋一句說明「開單、派工、回報、提問、收尾，／串成一個會自己推進的循環。」（Noto Sans TC）＋站台網址（Martian Mono）；右側是首頁 Hero 的雷達，中心偏右、外圈被卡片邊緣裁切。
- 設計語言對應（`docs/design/site-design-language.md`）：
  - 底色 `#10172e` + 48 px 網格、雷達 `#0f2547` / `#2a3f6b`，與首頁 Hero 相同。
  - 紫色只給塔台（錨點 A1）：掃描線、掃描殘影、中心點與 `Tower` 字樣；Worker 不用紫色。
  - Worker 光點用縮圖狀態色，且一律符號＋文字（錨點 A2）：`✓ 已回報 T1024`（`#98c379`）、`? 等塔台答覆 T1025`（`#61afef`）、`T1026 執行中`（中性灰，無符號）。工單編號沿用網站示意用的 T1024 / T1025 系列。
  - 不放中點分隔的 meta 字串、不做單字強調色、不用暖色大面積。
- 不含 CT 字樣、內部編號、權杖、使用者路徑；只出現公開網址 `gowerlin.github.io/better-agent-terminal`。
- 輸出方式：Playwright（`channel: 'chrome'`）開原稿，viewport 1200×630、`deviceScaleFactor: 1`，等 `document.fonts.ready`（確認 Chiron Hei HK 900、Martian Mono 400/500、Noto Sans TC 400/700 都已載入）後擷取。重新輸出時照同樣方式即可。
- 截圖（不入版控）：`<使用者資料夾>/AppData/Local/Temp/claude/D--ForgejoGit--Gower-Labs-BMad-Guide-better-agent-terminal-better-agent-terminal/610ec208-25fb-41a9-b2b8-611a75abfe1d/scratchpad/og-card.png`

### 2. `config.mts`

- 共用 meta（`head`）：`og:type=website`、`og:site_name`、`og:locale=zh_TW`、`og:image`（`https://gowerlin.github.io/better-agent-terminal/og-card.png`）、`og:image:width/height/alt`、`twitter:card=summary_large_image`、`twitter:image`。
- 每頁（`transformHead`）：`og:title` / `twitter:title` = VitePress 算好的頁面標題（`<頁面 title> | Better Agent Terminal`，首頁是站名），`og:description` / `twitter:description` = 頁面 frontmatter `description`（沒寫就是站點說明，與 `<meta name="description">` 一致），`og:url` = 絕對網址（cleanUrls：`cases.md` → `/cases`、`remote/index.md` → `/remote/`、`index.md` → 首頁）；404 頁不輸出 `og:url`。
- `sitemap: { hostname: 'https://gowerlin.github.io/better-agent-terminal/' }`；`lang: 'zh-TW'` 原本就有，未動。
- meta 擷取（dist `index.html`；全文存於 scratchpad `meta-index.txt`）：

```html
<title>Better Agent Terminal</title>
<meta name="description" content="一個塔台，指揮整隊 AI Agent：Better Agent Terminal 與 BMad Control Tower 把開單、派工、回報、提問、收尾串成一個會自己推進的循環。">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Better Agent Terminal">
<meta property="og:locale" content="zh_TW">
<meta property="og:image" content="https://gowerlin.github.io/better-agent-terminal/og-card.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Better Agent Terminal：一個塔台，指揮整隊 AI Agent">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://gowerlin.github.io/better-agent-terminal/og-card.png">
<meta property="og:title" content="Better Agent Terminal">
<meta property="og:description" content="（同 description）">
<meta name="twitter:title" content="Better Agent Terminal">
<meta name="twitter:description" content="（同 description）">
<meta property="og:url" content="https://gowerlin.github.io/better-agent-terminal/">
```

另抽查 `cases.html`（`實戰案例 | Better Agent Terminal`、頁面自己的 description、`og:url …/cases`）、`remote/index.html`（`og:url …/remote/`）、`install.html`、`404.html`，皆正確。

### 3. `pages.yml` diff 摘要（+38 行，只新增 job）

- 新 job `link-check`：`needs: build`，**不在 `deploy` 的 `needs` 裡**，與 deploy 並行。
- 步驟：`actions/checkout@v7`（沿用既有版本）→ `actions/download-artifact@v8`（repo 其他 workflow 已用 v8）下載 `github-pages` artifact → 解 `artifact.tar` 到 `_lychee/better-agent-terminal/`（站內連結是 `/better-agent-terminal/<頁面>`）→ `lycheeverse/lychee-action@v2.9.0`（`--config site/lychee.toml --root-dir ${{ github.workspace }}/_lychee --no-progress '_lychee/better-agent-terminal/**/*.html'`、`fail: false`、`failIfEmpty: false`）→ exit code ≠ 0 時發 `::warning` annotation。結果看 job summary（action 預設寫入）。
- 版本出處：`lycheeverse/lychee-action` 最新穩定版仍是 v2.9.0（`gh api repos/lycheeverse/lychee-action/releases/latest` → v2.9.0，2026-07-09，https://github.com/lycheeverse/lychee-action/releases/tag/v2.9.0），預設 lychee v0.24.2。
- 只警告的理由（寫在 job 註解）：站內死連結在 build 時已由 VitePress 擋下（config 沒有 `ignoreDeadLinks`，預設遇死連結 build 失敗）；這個 job 多抓的是外部連結與靜態資源，外部網站的暫時性失敗（逾時、速率限制、對方改版）不該讓已 build 好的網站發不出去。
- 速率限制 / GitHub 連結：action 的 `token` 預設 `github.token`，entrypoint 匯出成 `GITHUB_TOKEN`，lychee 查 GitHub 連結不受匿名限制；`site/lychee.toml` 另把 `429` 列入 `accept`、`max_retries = 3`、`timeout = 20`、`max_concurrency = 16`、`exclude_loopback = true`。
- `site/lychee.toml`：`fallback_extensions = ["html"]`、`index_files = ["index.html"]`（對應 cleanUrls）；`root_dir` 必須是絕對路徑，所以放在 job 指令列。
- 語法：`actionlint` 1.7.12（下載到 scratchpad，checksum 相符）檢查 `.github/workflows/pages.yml` → exit 0、0 問題。
- 未改 `pre-release.yml` / `release.yml`、未改 Pages 設定。

### 4. MP4 備援

- `site/public/media/clip-dispatch.mp4`：ffmpeg 9.0.2 由 `clip-dispatch.webm`（VP9 1280×800、16.24 s、216 KB）轉出；`libx264 -profile:v high -level 4.0 -pix_fmt yuv420p -preset veryslow -crf 26 -tune stillimage -movflags +faststart -an`。
- ffprobe：`h264` / `High` / 1280×800 / `yuv420p`、16.2 s、192,229 bytes、無音軌；atom 順序 `ftyp → moov → mdat`（faststart）。與 WebM 的 SSIM All = 0.998。
- `DemoVideo.vue`：新增選用 prop `mp4`，在 WebM `<source>` 之後加 `<source v-if="props.mp4" … type="video/mp4">`；播放邏輯未動。`site/control-tower.md` 的 `<DemoVideo>` 多傳 `mp4="/media/clip-dispatch.mp4"`。
- Chromium（Chrome channel）實測（`vitepress preview`，用完已停止）：
  - 預設：`currentSrc` = `clip-dispatch.webm`，捲入畫面後自動播放（`paused: false`、2.5 s 後 `currentTime` 2.51、`readyState` 4）。
  - 移除 WebM `<source>` 模擬不支援 WebM：改播 `clip-dispatch.mp4`，`videoWidth/Height` 1280×800、無 error。
  - `reducedMotion: 'reduce'`：不自動播放（`paused: true`、`currentTime` 0）。

### 驗證

| 項目 | 結果 |
|---|---|
| `site/` `npm run build` | PASS：0 錯誤、0 死連結（VitePress 死連結檢查開著）；`generating sitemap` ✓ |
| `dist/sitemap.xml` | PASS：14 個 `<loc>`，全部 `https://gowerlin.github.io/better-agent-terminal/…`，不含 404 |
| 每頁 `og:*` / `twitter:*` | PASS（見上方擷取） |
| 本機連結檢查 dist | PASS：lychee 0.24.2（與 CI 同版，Windows 版下載到 scratchpad，SHA-256 與官方 `.sha256` 相符）、同一份 `site/lychee.toml`、帶 `gh auth token`：Total 1131 / Unique 536 / Successful 1131 / Errors 0 / Timeouts 0 / Redirected 9 / Excluded 0，**broken = 0**。外部連結有實際連線檢查，沒有被限流。反向測試：放一個 `/better-agent-terminal/no-such-page` 會報 `File not found`，`/cases`、`/remote/`、`/media/clip-dispatch.mp4` 都能解析，證明 root-dir / cleanUrls 設定有效。 |
| `pages.yml` 語法 | PASS：actionlint 1.7.12 exit 0 |
| 短片 | PASS：Chromium 播 WebM；MP4 H.264 + faststart（ffprobe）且可在 Chromium 播放 |
| 手機寬度 | PASS：375 px 下 `/` 與 `/control-tower` 的 `scrollWidth` = `clientWidth` = 375 |
| 網站 grep | PASS：`site/`（排除 node_modules / dist / cache）`T0\d{3}` / `D1\d{2}` / `BUG-\d+` / `PLAN-\d+` / `_ct-workorders` / `CLAUDE.md` = 0；本單 site / workflow diff 的 CT 字樣（`ct-exec` / `bat-terminal` / `CT_` / `.claude` / `skills/`）= 0；隱私 grep（`gower` 但排除 `gowerlin`、`C:\Users`、`/Users/`、`tonyqwang`、`batcap.`、`server-token`、email）= 0。`docs/design/og-card.html` 的註解提到本工單編號（在 docs/，不發佈到網站）。 |
| 換行 | PASS：本單文字檔 `git ls-files --eol` 皆 `i/lf w/lf` |

### 給使用者的預覽指令

```bash
cd site
npm run build
npx vitepress preview          # 開 http://localhost:4173/better-agent-terminal/
# 看 meta（另開一個終端）：
curl -s http://localhost:4173/better-agent-terminal/ | grep -o '<meta [^>]*og:[^>]*>'
# 看卡片本身：site/public/og-card.png
```

社群平台的實際卡片預覽要等網站部署後才看得到（`og:image` 是正式網址）；部署後可用各平台的分享偵錯工具重新抓取。

### Commit

- 產品：`3d1ca713` feat(site): share card, sitemap, lychee link check, MP4 fallback for the dispatch clip (T0659)（8 個檔案：`pages.yml`、`docs/design/og-card.html`、`config.mts`、`DemoVideo.vue`、`control-tower.md`、`site/lychee.toml`、`clip-dispatch.mp4`、`og-card.png`）
- 工單：本次回報 commit（`git commit --only`）
- 未 push。

### 建議塔台加進 `_local-rules.md` 發版流程的一句

> 網站有變更的發佈，push 後等 Pages workflow 跑完，打開 `link-check` job 的 summary：有 broken 連結就開單修（這個 job 只警告、不擋部署，不看就不會有人發現）。

### 偏離與注意事項

- 工單原 `status: TODO`（不是 `PENDING`），開工時改成 `IN_PROGRESS`。
- lychee 0.24.2 不抽取 `<link rel="preconnect">`（Excluded 0；`--dump` 只有 Google Fonts stylesheet 一筆且檢查通過），所以 `lychee.toml` 沒有加 Google Fonts 排除規則。
- 預覽伺服器沒有用 `e2e-results/site-preview/serve.mjs`（不存在）；改用 `npx vitepress preview --port 4319 --host 127.0.0.1`，驗證後已停止。
- 工作樹裡 T0658 的變更（`src/components/setup-wizard/**`、`src/locales/**`、`src/styles/setup-wizard.css`、T0658 工單）與 `src/styles/settings.css` 都不是本單的，未碰、未納入 commit。

### 給塔台的後續建議

1. `install.md`、`compatibility.md`、`releases.md` 沒有 frontmatter `description`，分享卡片的說明會退回站點說明；可補每頁自己的一句。
2. 404 頁的 `og:description` 是 VitePress 預設的 `Not Found`（英文）；影響很小，要改可在 `transformHead` 對 `isNotFound` 改寫。
3. 之後若有其他 `DemoVideo` 短片，同樣用上面的 ffmpeg 參數轉 MP4 並傳 `mp4` prop。

### 互動紀錄

（無：本單沒有向塔台提問）
