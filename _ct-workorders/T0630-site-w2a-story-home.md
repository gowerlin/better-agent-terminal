---
schema_version: 1
schema_kind: workorder
id: T0630
title: "PLAN-049 W2a：網站 v2 —— 設計語言、插圖元件與故事化首頁（AI 協作開發的卡關時刻 vs BAT + CT 解法）"
type: feature
status: PENDING
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: L
created_at: "2026-10-18T13:03:16+0800"
depends_on: [T0624]
related:
  - "規格（唯一依據）：`_ct-workorders/_spec-site-v2-bat-ct-story.md`（APPROVED，D161）—— 本單做 § 4 首頁、§ 7 視覺設計、§ 8 文案規則；§ 5 / § 6 屬 W2b，不做"
  - "D159（CT 只介紹概念與整合點、不提供取得管道）、D160（VitePress 1.6.4 於 `site/`、繁中、無分析）、D161（本單方向與使用者決定）"
  - "W1 成果：T0624（`site/` 骨架、`DownloadLinks`、`latest-release.mts`、`pages.yml`）"
affects_files:
  - "site/**（`index.md`、`.vitepress/config.mts`、`.vitepress/theme/**`；`install.md` / `compatibility.md` / `releases.md` / `latest-release.mts` / `package*.json` 原則上不動）"
  - "docs/design/site-design-language.md（新）"
  - _ct-workorders/T0630-site-w2a-story-home.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 **Worker 不 push、不改 GitHub 設定、不觸發 workflow**。預覽通過後由塔台取得使用者授權再 push（D161）。`gh` 只能唯讀且一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 只改 `affects_files` 列的路徑。不改 `README.md`、`release-note.md`、`docs/`（`docs/design/site-design-language.md` 新檔除外）、根目錄 `package.json` / lockfile、`.github/`、`src/`、`electron/`。不新增 npm 依賴（`site/package.json` 不動）；動畫用 CSS / Vue 內建即可。"
  - "🔴 內容規則（D159 / 規格 § 8）：不出現 CT 取得管道、內部 repo 位置、skill 檔內容；`site/` 內 grep `T0\\d{3}`、`D1\\d{2}`、`BUG-\\d+`、`PLAN-\\d+`、`_ct-workorders`、`CLAUDE.md` = 0（include 的 README / `release-note.md` 原文除外）；示意一律用虛構專案 `demo-shop` 與虛構工單編號 `T1024`–`T1026`；不放權杖、使用者路徑、帳號、私人 repo / 工作區名稱；不用既有 `assets/screenshot-*.png`。"
  - "🔴 每個主張都要對得上 BAT 的真實行為，不得誇大（不寫「全自動」「零介入」之類）；回報區附「主張 → 出處」對照。"
  - "🔴 非隔離工單。`src/styles/settings.css` 的 M 不是你的變更，不碰；其他 Worker 的工單檔不碰。commit 用 `git commit --only <檔案>` 或精確 stage。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit（L129）。"
---

# T0630 — PLAN-049 W2a：設計語言、插圖元件與故事化首頁

## 目標

使用者預覽 W1 後認為首頁「介紹過於簡單，沒有體現出 BAT 與 CT 整合使用的優勢」，並建議「故事性敘述：AI 協作開發常見問題 vs BAT + CT 解法」。本單依規格 `_ct-workorders/_spec-site-v2-bat-ct-story.md` 重做首頁，讓讀者 10 秒內看懂定位、60 秒內從故事裡認出自己遇過的卡關時刻並看懂 BAT + CT 怎麼解。

**先完整讀規格**（§ 0–§ 4、§ 7、§ 8 是本單範圍；§ 4 的文案初稿可潤飾，但意思、章節與順序不改；實質改動在回報區列出）。

## 要做的事

### 1. 設計語言（先做）

用 `ct-fieldguide` 的 DESIGN.md 抽取（design from code）從 BAT 本身的 UI 抽出網站要沿用的視覺語言，輸出到 **`docs/design/site-design-language.md`**（工單指定路徑，不放 `site/`，避免被渲染成頁面）。至少涵蓋：

- 品牌色：`assets/icon.svg` 的紫（`#a855f7` / `#c084fc` / `#e9d5ff`）→ VitePress `--vp-c-brand-1/2/3/soft` 的對應（淺色 / 深色兩組，對比 ≥ WCAG AA）；暖色點綴的用法
- 分頁標題格式：`<Agent 顯示名> · Tower`、`<Agent 顯示名> · Worker · T####`（以 BAT 程式碼實際格式為準）
- Worker 縮圖狀態：⚠️ 等使用者 / `?` 等塔台答覆 / `✓` 已回報 的實際符號與顏色（讀 BAT renderer 的實作與樣式取值，寫明出處檔名）
- Stepper 狀態語言（`docs/design/bat-stepper-design-language.md`）中網站會用到的部分
- 網站元件規則：故事章節（以前 / BAT + CT 卡）、分工標籤（`BAT：…` / `CT：…`）、對照表、動畫與 `prefers-reduced-motion`、手機版規則

### 2. 元件（`site/.vitepress/theme/components/`）

依規格 § 7 元件清單：`TowerDemo`、`StoryTimeline`（+ `StoryChapter`）、`CompareMatrix`、`AutonomyDial`、`StatsCounter`、`FeatureGrid`；`DownloadLinks` 沿用（只可調整樣式）。

- 插圖用 HTML / CSS / SVG 做「BAT UI 風格示意」，跟著深淺色切換；`TowerDemo` 的分頁標題、狀態符號、事件文字要符合真實行為（規格 § 4.1）
- 動畫：`prefers-reduced-motion: reduce` → 靜態最終畫面；捲出畫面暫停（IntersectionObserver）；不得造成版面跳動
- 每個插圖有文字等價說明（`aria-label` 或隱藏描述）；狀態不只靠顏色
- 樣式寫在 `site/.vitepress/theme/custom.css`（或元件 scoped style），色票取自第 1 步的設計語言

### 3. 首頁（`site/index.md`）

依規格 § 4.1–§ 4.7 的順序與內容：Hero（主標「**一個塔台，指揮整隊 AI Agent**」、副標、三個按鈕、`TowerDemo`、支援列）→ 故事「AI 協作開發的 7 個卡關時刻」（`#story`，7 章 + 結尾句）→ 三欄對照 → 自動但不失控 → 實績（`600+` / `150+` / `60+` / `5,000+`，標「截至 2026 年 10 月」）→ 不用 Control Tower 也好用 → 下載（`#download`）。

- 尚不存在的頁面（`/control-tower`、`/features`，W2b 才做）**不得連結**（VitePress 會擋死連結）：以 `<!-- TODO(W2b): … -->` 註解留位置
- `config.mts` 只在需要時調整（例如 `head` 的 description、主題色）；nav / sidebar 的 W2b 項目維持 TODO 註解

### 4. 文案校稿

用 `bmad-editorial-review-prose` 審首頁文案（故事 7 章、對照表、各段標題），採納後的修改與不採納的理由列在回報區。

### 5. 驗證與預覽素材

- `site/` 內 `npm ci` + `npm run build`：0 錯誤、0 死連結
- 本機預覽（`npm run preview` 或 `npm run dev`）截圖，存到 **`e2e-results/site-v2/`**（已在 `.gitignore`，不入版控）：桌面 1440×900 與手機 390×844，各淺色 / 深色；首頁每個區段至少一張；另附一張 `prefers-reduced-motion: reduce` 的 hero
- 手機寬度無整頁水平捲動（量 `document.documentElement.scrollWidth <= innerWidth`）
- 瀏覽器 console 0 錯誤；（選用，有工具就跑）Lighthouse 首頁 Accessibility / Best Practices 分數
- 內部編號 grep（`site/` 原始碼，排除 `node_modules` / `dist` / `cache`）= 0
- 根目錄 `npx vite build` 成功（確認未受影響）

## 驗收

- 首頁依規格 § 4 的七個區段完成，故事 7 章各有「以前 / BAT + CT / 分工標籤 / 插圖」
- `docs/design/site-design-language.md` 存在，色票與狀態符號註明出處
- build 0 錯誤、0 死連結；console 0 錯誤；手機無水平捲動；reduced-motion 下無動畫
- 內容規則 grep = 0；沒有 CT 取得管道
- 回報區附：截圖清單（路徑）、「主張 → 出處」對照表、文案校稿採納清單、與規格的差異、給使用者的預覽指令（`cd site && npm run dev` 或 `npm run build && npm run preview` 與網址）
- 未 push、未改 GitHub 設定

---

## 回報區

（Worker 填寫）
