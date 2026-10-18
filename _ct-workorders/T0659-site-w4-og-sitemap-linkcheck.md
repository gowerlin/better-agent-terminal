---
schema_version: 1
schema_kind: workorder
id: T0659
title: "PLAN-049 W4：網站 OG / Twitter 分享卡片、sitemap、lychee 連結檢查 job；派工短片加 H.264 MP4 備援"
type: feature
status: TODO
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: S
created_at: "2026-10-18T19:47:34+0800"
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
