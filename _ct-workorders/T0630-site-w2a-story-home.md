---
schema_version: 1
schema_kind: workorder
id: T0630
title: "PLAN-049 W2a：網站 v2 —— 依選定視覺方向實作插圖元件與故事化首頁（AI 協作開發的卡關時刻 vs BAT + CT 解法）"
type: feature
status: PENDING
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: L
created_at: "2026-10-18T13:03:16+0800"
depends_on: [T0632]
related:
  - "規格（唯一依據）：`_ct-workorders/_spec-site-v2-bat-ct-story.md`（APPROVED，D161）—— 本單做 § 4 首頁、§ 7 視覺設計、§ 8 文案規則；§ 5 / § 6 屬 W2b，不做"
  - "視覺方向：T0632 產出的 Design System / Design 畫布與 `docs/design/site-design-language.md`；使用者選定的方向見本單「選定的視覺方向」節（D162）"
  - "D159（CT 只介紹概念與整合點、不提供取得管道）、D160（VitePress 1.6.4 於 `site/`、繁中、無分析）、D161、D162"
  - "W1 成果：T0624（`site/` 骨架、`DownloadLinks`、`latest-release.mts`、`pages.yml`）"
affects_files:
  - "site/**（`index.md`、`.vitepress/config.mts`、`.vitepress/theme/**`；`install.md` / `compatibility.md` / `releases.md` / `latest-release.mts` / `package*.json` 原則上不動）"
  - _ct-workorders/T0630-site-w2a-story-home.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 開工第一步載入 **`frontend-design`** skill（T0631 安裝的 plugin；名稱以 skill 清單為準），全程依它的原則實作；清單裡沒有 → 不要用其他 skill 代替，`BLOCKED` 回報。另用 `vitepress-book`（VitePress 慣例，只當參考，不重新 scaffold）與 `bmad-editorial-review-prose`（文案校稿）。"
  - "🔴 **Worker 不 push、不改 GitHub 設定、不觸發 workflow**。預覽通過後由塔台取得使用者授權再 push（D161）。`gh` 只能唯讀且一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 只改 `affects_files` 列的路徑。`docs/design/site-design-language.md` 是 T0632 的產出，本單只讀（發現錯誤在回報區列出，不改）。不改 `README.md`、`release-note.md`、`docs/`、根目錄 `package.json` / lockfile、`.github/`、`src/`、`electron/`。不新增 npm 依賴（`site/package.json` 不動）；字型只能用選定方向指定的 Google Fonts（`config.mts` 的 `head` 載入，含 `display=swap`），動畫用 CSS / Vue 內建即可。"
  - "🔴 內容規則（D159 / 規格 § 8）：不出現 CT 取得管道、內部 repo 位置、skill 檔內容；`site/` 內 grep `T0\\d{3}`、`D1\\d{2}`、`BUG-\\d+`、`PLAN-\\d+`、`_ct-workorders`、`CLAUDE.md` = 0（include 的 README / `release-note.md` 原文除外）；示意一律用虛構專案 `demo-shop` 與虛構工單編號 `T1024`–`T1026`；不放權杖、使用者路徑、帳號、私人 repo / 工作區名稱；不用既有 `assets/screenshot-*.png`。"
  - "🔴 每個主張都要對得上 BAT 的真實行為，不得誇大（不寫「全自動」「零介入」之類）；回報區附「主張 → 出處」對照。"
  - "🔴 非隔離工單。`src/styles/settings.css` 的 M 不是你的變更，不碰；其他 Worker 的工單檔不碰。commit 用 `git commit --only <檔案>` 或精確 stage。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit（L129）。"
---

# T0630 — PLAN-049 W2a：依選定視覺方向實作故事化首頁

> **塔台補充（2026-10-18T13:08:27+0800）**：本單 13:05 第一次派工，Worker 啟動約 47 秒、尚無產出時由使用者停止。使用者要求加入 `frontend-design`、`theme-factory`、先用 Design 畫布定方向、建立 Design System（D162），所以本單改成**實作工單**：設計語言與視覺方向由 T0632 先產出、使用者選定後，塔台把結果填進下方「選定的視覺方向」節，再重新派工。

## 目標

使用者預覽 W1 後認為首頁「介紹過於簡單，沒有體現出 BAT 與 CT 整合使用的優勢」，並建議「故事性敘述：AI 協作開發常見問題 vs BAT + CT 解法」，也要求網站「美觀、有設計感」。本單依規格 `_ct-workorders/_spec-site-v2-bat-ct-story.md` 與使用者選定的視覺方向重做首頁，讓讀者 10 秒內看懂定位、60 秒內從故事裡認出自己遇過的卡關時刻並看懂 BAT + CT 怎麼解。

**先完整讀規格**（§ 0–§ 4、§ 7、§ 8 是本單範圍；§ 4 的文案初稿可潤飾，但意思、章節與順序不改；實質改動在回報區列出）。

## 選定的視覺方向（塔台於派工前填寫）

（待 T0632 完成、使用者選定後填寫：方向名稱、Design 畫布與 Design System 連結、使用者的調整意見）

## 要做的事

### 1. 讀設計來源

- `docs/design/site-design-language.md`（repo 內唯一來源，固定錨點不得改）
- 上方「選定的視覺方向」節的 Design 畫布與 Design System（用 Artifact 工具 `action: read` 讀取）
- 兩者不一致時以 repo 檔為準，並在回報區列出差異

### 2. 元件（`site/.vitepress/theme/components/`）

依規格 § 7 元件清單：`TowerDemo`、`StoryTimeline`（+ `StoryChapter`）、`CompareMatrix`、`AutonomyDial`、`StatsCounter`、`FeatureGrid`；`DownloadLinks` 沿用（只可調整樣式）。

- 外觀依選定方向；插圖用 HTML / CSS / SVG 做「BAT UI 風格示意」，跟著深淺色切換；`TowerDemo` 的分頁標題、狀態符號、事件文字要符合真實行為（規格 § 4.1）
- 動畫：`prefers-reduced-motion: reduce` → 靜態最終畫面；捲出畫面暫停（IntersectionObserver）；不得造成版面跳動
- 每個插圖有文字等價說明（`aria-label` 或隱藏描述）；狀態不只靠顏色
- 樣式寫在 `site/.vitepress/theme/custom.css`（或元件 scoped style），色票與字體取自設計來源

### 3. 首頁（`site/index.md`）

依規格 § 4.1–§ 4.7 的順序與內容：Hero（主標「**一個塔台，指揮整隊 AI Agent**」、副標、三個按鈕、`TowerDemo`、支援列）→ 故事「AI 協作開發的 7 個卡關時刻」（`#story`，7 章 + 結尾句）→ 三欄對照 → 自動但不失控 → 實績（`600+` / `150+` / `60+` / `5,000+`，標「截至 2026 年 10 月」）→ 不用 Control Tower 也好用 → 下載（`#download`）。

- 尚不存在的頁面（`/control-tower`、`/features`，W2b 才做）**不得連結**（VitePress 會擋死連結）：以 `<!-- TODO(W2b): … -->` 註解留位置
- `config.mts` 只在需要時調整（例如 `head` 的字型與 description、主題色）；nav / sidebar 的 W2b 項目維持 TODO 註解

### 4. 文案校稿

用 `bmad-editorial-review-prose` 審首頁文案（故事 7 章、對照表、各段標題），採納後的修改與不採納的理由列在回報區。

### 5. 驗證與預覽素材

- `site/` 內 `npm ci` + `npm run build`：0 錯誤、0 死連結
- 本機預覽（`npm run preview` 或 `npm run dev`）截圖，存到 **`e2e-results/site-v2/`**（已在 `.gitignore`，不入版控）：桌面 1440×900 與手機 390×844，各淺色 / 深色；首頁每個區段至少一張；另附一張 `prefers-reduced-motion: reduce` 的 hero；並附與 Design 畫布選定方向對應 artboard 的對照（並排或逐項說明差異）
- `frontend-design` 自評：字體、色彩、版面節奏、細節（逐項一兩句，指出還不夠好的地方）
- 手機寬度無整頁水平捲動（量 `document.documentElement.scrollWidth <= innerWidth`）
- 瀏覽器 console 0 錯誤；（選用，有工具就跑）Lighthouse 首頁 Accessibility / Best Practices 分數
- 內部編號 grep（`site/` 原始碼，排除 `node_modules` / `dist` / `cache`）= 0
- 根目錄 `npx vite build` 成功（確認未受影響）

## 驗收

- 首頁依規格 § 4 的七個區段完成，故事 7 章各有「以前 / BAT + CT / 分工標籤 / 插圖」，外觀符合選定方向
- build 0 錯誤、0 死連結；console 0 錯誤；手機無水平捲動；reduced-motion 下無動畫
- 內容規則 grep = 0；沒有 CT 取得管道
- 回報區附：截圖清單（路徑）、與選定方向的對照、`frontend-design` 自評、「主張 → 出處」對照表、文案校稿採納清單、與規格的差異、給使用者的預覽指令（`cd site && npm run dev` 或 `npm run build && npm run preview` 與網址）
- 未 push、未改 GitHub 設定

---

## 回報區

（Worker 填寫）
