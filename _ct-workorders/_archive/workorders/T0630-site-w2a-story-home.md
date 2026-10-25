---
schema_version: 1
schema_kind: workorder
id: T0630
title: "PLAN-049 W2a：網站 v2 —— 依選定視覺方向實作插圖元件與故事化首頁（AI 協作開發的卡關時刻 vs BAT + CT 解法）"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: L
created_at: "2026-10-18T13:03:16+0800"
started_at: "2026-10-18T13:34:06+0800"
updated_at: "2026-10-18T13:59:00+0800"
completed_at: "2026-10-18T13:59:00+0800"
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

使用者選定（D164）：**A「進場雷達」為主 + C「一個早上」的故事時間軸**（即 T0632 的推薦）。

- **來源**（用 Artifact 工具 `action: read` 讀取；兩者都是私人 Artifact）：
  - Design 畫布「BAT 網站視覺方向」：https://claude.ai/artifact/2LN8rmZ3VbGwZSLpN18mPv —— 讀 **A 列四張**（Hero 桌面 / 故事 09:20 / 三欄對照 / Hero 手機）與 **C 列的故事 09:20**；每列右側便利貼是方向說明
  - Design System「Better Agent Terminal」：https://claude.ai/artifact/FgvvUnYMgJwsEkrS2ATCBj
  - 設計語言（repo 唯一來源，固定錨點 A1–A3）：`docs/design/site-design-language.md`（`647bfeca`）
- **怎麼混**：
  - **A 負責**：Hero（BAT 視窗：分頁列 + 雷達幕〔塔台在圓心、Worker 是標 ⚠️ / `?` / `✓` 的光點〕+ 三行事件紀錄）、終端 / 示意區塊、三欄對照的外觀、整站字體系統與品牌色。Hero 與終端區塊在淺色、深色模式都維持深色帶（規格 § 7）
  - **C 負責**：故事「7 個卡關時刻」的**版面**——每章一個大時間數字、時間軸上的「現在」線隨捲動前進、以前 / BAT + CT 兩欄；這一段回到淺色長篇閱讀（深色模式照 VitePress 深色）
  - 🔴 **全站只用一套字體系統（A）**：C 只借版面與時間敘事，不另引 C 的明體 / Bodoni，避免兩套風格打架。大時間數字的字體由你依 `frontend-design` 原則從 A 的字族中選（例如 Martian Mono 或 Chiron Hei HK 900），回報區說明理由
- **字體**（塔台已確認 Google Fonts css2 皆回 200）：Chiron Hei HK 900（標題）/ Noto Sans TC（內文）/ Martian Mono（終端、數字）；css2 分段載入、`display=swap`；淺色模式的紫色文字用 `#7c3aed`、狀態色用設計語言檔的淺色 AA 版
- **T0632 已知風險，實作時要處理**：雷達容易被讀成資安 / 駭客風 → 用事件紀錄與分頁標題把它錨定在「工作進度」，避免綠色螢光、矩陣字雨之類的語彙；深色 Hero 與淺色故事段的銜接要自然（漸層或分隔帶）；Chiron Hei HK 載入失敗時退回 Noto Sans TC 900
- **動態**：A 的掃描線（約 6 秒一圈，掃到的光點換狀態，約 20 秒一輪，事件紀錄同步）＋ C 的捲動「現在」線；`prefers-reduced-motion` 一律停在最終狀態

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

### 結果摘要

**DONE**。首頁依規格 § 4 的七個區段重做完成：Hero（雷達 `TowerDemo`）→ 故事「AI 協作開發的 7 個卡關時刻」→ 三欄對照 → 自動，但不失控 → 實績 → 不用 Control Tower 也好用 → 下載。視覺方向採用 A「進場雷達」（Hero、終端示意、對照表、字體、品牌色），故事段採用 C「一個早上」的版面（每章一個大時鐘、捲動前進的「現在」線、以前 / BAT + CT 兩欄）。全站只用一套字體：Chiron Hei HK 900 / Noto Sans TC / Martian Mono。build 0 錯誤、0 死連結，console 0 錯誤，手機無水平捲動，reduced motion 下沒有動畫，內容規則 grep = 0。未 push，也沒有改 GitHub 設定。

### 落點檢查（Landing Zone Check）

- 結果：**PASS**
- C-0：工單 `repo` = `better-agent-terminal`；`basename(REPO_ROOT)` = `better-agent-terminal` → PASS（REPO_ROOT `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1：工單位於 REPO_ROOT 下 → PASS
- C-3：`site/**` 含萬用字元、另一項在 `_ct-workorders/` 下 → `C-3 not applicable`
- C-2：工單沒有 `branch` 欄位；目前分支 `main`
- `CT_HOME` 未設定（非隔離工單）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- `CT_MODE=yolo`、`CT_INTERACTIVE=0`

### 變更檔案（commit `7d22cb8b`）

| 檔案 | 內容 |
|---|---|
| `site/index.md` | 首頁改為 `layout: home` + `markdownStyles: false`，七個區段；W2b 頁面以 `<!-- TODO(W2b) -->` 留位置，沒有連到不存在的頁面 |
| `site/.vitepress/config.mts` | `head` 加 Google Fonts css2（Chiron Hei HK 900、Martian Mono 300/400/500、Noto Sans TC 400/500/700/900，`display=swap`）與 preconnect、`theme-color`；`description` 改成新定位。nav / sidebar 不動（TODO 註解保留） |
| `site/.vitepress/theme/index.ts` | 註冊 8 個元件 |
| `site/.vitepress/theme/custom.css` | tokens（淺 / 深）、VitePress brand 色、全站字體、首頁所有樣式；`DownloadLinks` 樣式保留 |
| `site/.vitepress/theme/components/TowerDemo.vue` | Hero 雷達示意（見下） |
| `…/StoryTimeline.vue`、`…/StoryChapter.vue` | 故事時間軸與章節 |
| `…/StoryIllo.vue` | 7 張章節插圖（StoryChapter 內部使用；規格清單外新增，見「與規格的差異」） |
| `…/CompareMatrix.vue`、`…/AutonomyDial.vue`、`…/StatsCounter.vue`、`…/FeatureGrid.vue` | 對照表、自主程度、實績計數、六格功能 |

沒有改到的：`install.md` / `compatibility.md` / `releases.md` / `latest-release.mts` / `site/package*.json` / `DownloadLinks.vue`；`src/styles/settings.css` 的 M 不是本單的變更，沒有碰。沒有新增任何 npm 依賴。

### 元件重點

- **TowerDemo**：桌面版的分頁列（`Claude CLI · Tower` + 三個 Worker 分頁）直排在雷達左側，雷達圓心是塔台（紫），三個光點是 Worker。掃描線 5 秒一圈，4 圈一輪（20 秒）。光點的狀態只在掃描線掃過時改變，事件紀錄同時多一行，時間戳把一輪換算成 09:00 → 12:30。每個光點與分頁都是「符號 + 文字」（`⚠️ T1026 在等你` / `? T1025 在等塔台答覆` / `✓ T1024 已回報` / `T1024 執行中`）。
  - 播放控制：用 IntersectionObserver，捲出畫面就暫停；分頁切到背景也暫停；另有「暫停動畫」按鈕（WCAG 2.2.2）。
  - `prefers-reduced-motion: reduce`：直接顯示靜止畫面（T1024 ✓、T1025 ?、T1026 ⚠️，與 A 畫布 Hero 的狀態相同），按鈕改成「已依你的系統設定停止動畫」。SSR 輸出的也是這個靜止畫面。
  - 文字等價：整段有 `figcaption`（sr-only）描述，動態部分 `aria-hidden`。
- **StoryTimeline / StoryChapter**：左側是時間軸。已讀過的部分實線填滿，還沒讀到的是虛線；黃色「現在」刻度與「現在 10:05」標籤以視窗 40% 高度為基準，跟著捲動前進。目前讀到的那一章，大時鐘變成全黑並加黃色底線；桌面版時鐘 sticky。reduced motion 時時間軸停在終點，每章都是完成狀態。手機版時鐘移到章節上方、兩張卡上下堆疊（先以前、後解法），「現在」只留刻度、不顯示標籤。
- **CompareMatrix**：桌面是表格，BAT + CT 那一欄用紫框加淺紫底。768 px 以下改成卡片：只顯示 BAT + CT 的答案，其他兩欄收進 `<details>`「只用其中一個時」。
- **AutonomyDial**：`off` / `ask` / `on` / `yolo` 四檔按鈕（`aria-pressed`），下方用「塔台 / 你」各一句說明（`aria-live="polite"`）。
- **StatsCounter**：`600+` / `150+` / `60+` / `5,000+`，標「截至 2026 年 10 月的累計數字」。只在捲進畫面時數一次（1.2 s）；載入時已在畫面上就不重數；SSR 與 reduced motion 都直接顯示最終數字；另有 sr-only 的最終值。

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| `site/` `npm ci` + `npm run build` | PASS | `build complete`，0 error / 0 warning；VitePress 預設死連結檢查通過（最後一次 build 在 commit 前） |
| 本機預覽截圖 | PASS | `npx vitepress preview --port 4173`（正式產物），Chrome 模擬 1440×900 與 390×844（DPR 2、mobile），淺 / 深色；清單見下 |
| reduced motion | PASS | 模擬 `prefers-reduced-motion: reduce`：間隔 2.5 s 量兩次，雷達都是 `rotate(130.00 200 200)`、事件紀錄不變；`.story-timeline` 有 `is-settled`、`--story-progress: 1`；計數器直接是最終值 |
| 手機無整頁水平捲動 | PASS | 390 寬：`document.documentElement.scrollWidth` = 390 = `innerWidth`（淺 / 深色各量一次）；分頁列只在自己的條內橫向捲動 |
| console 0 錯誤 | PASS | preview 首頁 `list_console_messages`（error / warn）= 0 |
| Lighthouse（桌面，選用） | Accessibility **100**、Best Practices **100**、SEO 100 | 修正前 95：插圖內小字 `#888` 在 `#2a2a2a` 上只有 4.04 → 改 `#a3a3a3`；首頁沒有 `main` landmark → `.home` 改用 `<main>`。剩下一項 `label-content-name-mismatch` 是 VitePress 內建搜尋按鈕（`aria-label="搜尋"`），不在本單範圍。報告在 `e2e-results/site-v2/lighthouse/report.html`。行動版 Lighthouse 未跑 |
| 內部編號 grep | PASS（0） | `grep -rnE 'T0[0-9]{3}\|D1[0-9]{2}\|BUG-[0-9]+\|PLAN-[0-9]+\|_ct-workorders\|CLAUDE\.md'`（排除 node_modules / dist / cache）→ 無結果 |
| 誇大用語 grep | PASS（0） | `全自動\|零介入` → 無結果 |
| 隱私 | PASS | 只出現公開 repo 網址 `github.com/gowerlin/better-agent-terminal`（W1 已有）；沒有權杖、使用者路徑、帳號、私人 repo / 工作區名稱；沒有用 `assets/screenshot-*.png`；沒有 CT 取得管道 |
| 根目錄 `npx vite build` | PASS | exit 0，`dist-electron/terminal-server.js` built |
| 其他頁未受影響 | PASS | `/install` 截圖：h1 / h2 換成 Chiron Hei HK，其他照舊（`desktop-light-install-page.png`） |

### 截圖清單（`e2e-results/site-v2/`，不入版控）

- 桌面 1440×900 淺色：`desktop-light-1-hero.png`、`-2-story.png`、`-3-story-0920.png`、`-4-compare.png`、`-5-autonomy.png`、`-6-stats-features.png`、`-7-features-download.png`
- 桌面深色：`desktop-dark-1-hero.png` … `desktop-dark-7-features-download.png`（同上七張）
- 手機 390×844 淺色：`mobile-light-1-hero.png`、`-2-hero-demo.png`、`-3-story.png`、`-4-story-0920.png`、`-5-compare.png`（展開一張卡的 details）、`-6-autonomy.png`、`-7-stats.png`、`-8-features.png`、`-9-download.png`
- 手機深色：`mobile-dark-1-hero.png` … `mobile-dark-9-download.png`（同上九張）
- reduced motion Hero：`desktop-light-hero-reduced-motion.png`
- 其他頁：`desktop-light-install-page.png`
- 註：commit 前最後幾個小修正在部分截圖拍完後才做：插圖小字 `#888` → `#a3a3a3`、光點角度、`<main>`、手機 details 的 ▸ 符號。受影響的 Hero（4 張）、手機對照（2 張）、reduced motion（1 張）都已重拍；其餘截圖只差插圖小字的灰階，肉眼幾乎分不出來。

### 與選定方向（Design 畫布）的對照

| Artboard | 對應截圖 | 一致 | 差異與原因 |
|---|---|---|---|
| A · Hero 桌面（`Main.dc.html`） | `desktop-*-1-hero.png`、`desktop-light-hero-reduced-motion.png` | 夜空 `#10172e` + 48 px 格線、雷達幕 `#0f2547` / `#2a3f6b`、紫色只給塔台分頁與掃描線、狀態色 `#e06c75` / `#61afef` / `#98c379`、三行事件紀錄、主副標與兩顆按鈕、支援列 | ① 主標最大 56 px（畫布 72 px），「指揮整隊 AI Agent」不斷行，大小合乎 Design System 的 `display` 56。② 分頁列在桌面改成直排在雷達左側：四個完整標題在 Hero 寬度內放不下，橫排只能截字（試過，`C·· T1024` 不可讀）；直排就是 BAT 縮圖列的樣子。③ 多一顆 GitHub 按鈕（規格 § 4.1）。④ 導覽列沿用 VitePress，畫布上的「故事 / Control Tower / 功能 / 常見問題」要等 W2b 頁面出來才加。⑤ 多一個「暫停動畫」按鈕 |
| A · 故事 09:20（`A-Story.dc.html`） | `desktop-*-3-story-0920.png` | 派工插圖（塔台 chip → 派工 / 完成通知 → 三個 Worker chip）、分工標籤 BAT（中性）/ CT（`signal-soft`） | 依工單，故事段改用 C 的淺色長篇版面，A 的深色故事段不用；Worker chip 另加 `✓ 已啟動`（啟動確認） |
| A · 三欄對照（`A-Compare.dc.html`） | `desktop-*-4-compare.png`、`mobile-*-5-compare.png` | 表格結構、BAT + CT 欄的紫框圓角與底色、列標題 | 淺色模式換成淺色 tokens（`--bat-raised` `#f5f3ff`），深色模式接近畫布；標題依語意分三行（`.phrase`）；手機改成卡片 + details |
| A · Hero 手機（`A-Mobile.dc.html`） | `mobile-*-1-hero.png`、`mobile-*-2-hero-demo.png` | 分頁列是可橫向捲動的條、雷達滿寬、按鈕滿寬堆疊 | 畫布在雷達下另列一份 Worker 狀態清單；這裡直接標在雷達的光點上，事件紀錄改成每則兩行（時間 / 內容），所以不重複列；按鈕多一顆 GitHub |
| C · 故事 09:20（`C-Story.dc.html`） | `desktop-*-3-story-0920.png`、`mobile-*-4-story-0920.png` | 左邊大時間數字 + 黃色底線、右邊標題與以前 / BAT + CT 兩欄、分工標籤 | 依工單只借版面：不用 Noto Serif TC / Bodoni，大時鐘改用 Martian Mono 300（88 px，畫布是 Bodoni 200 px）；背景不換晨光色 `#f1edfa`，維持頁面底色（深色模式照 VitePress）；新增可捲動的「現在」線 |

**大時鐘的字體：Martian Mono 300**。它和 Hero 事件紀錄的時間戳是同一個字族，讀者會把故事的 09:00 → 12:00 當成雷達同一座鐘往下走，Hero 和故事就接上了。等寬數字讓 09:00、10:40、12:00 寬度一致，捲動時欄位不會跳。細字重和 Chiron Hei HK 900 的章節標題一輕一重，層級分明。Chiron 900 的數字會跟標題搶重量，所以沒有選。只有「一個月後」不是數字，改用 Chiron 900（Martian Mono 沒有中文字）。

### `frontend-design` 自評

- **字體**：Chiron Hei HK 900 撐起標題的個性，Martian Mono 讓「儀表」語彙貫穿 Hero 與故事。不夠好的地方：Chiron Hei HK 是港式字形，載入紀錄看到 Noto Sans TC 900 也被下載，代表有些字退回 Noto，標題裡偶爾會混到兩種字形；Martian Mono 很寬，事件紀錄在手機上只能每則拆成兩行。
- **色彩**：紫色只出現在塔台的東西上（塔台分頁、掃描線、BAT + CT 欄、主按鈕、連結），黃色只用在時鐘底線與「現在」刻度，狀態色沿用 App。不夠好的地方：Hero 底部從夜色漸層到白底，中段在桌面上會有一點灰；Hero 以下的淺色頁面偏素，視覺重量幾乎都在 Hero 和大時鐘上。
- **版面節奏**：深色、密集的 Hero → 長篇淺色故事（大時鐘 sticky）→ 表格 → 兩欄 → 一排數字 → 六格 → 下載。疏密交替，內容一律靠左。不夠好的地方：七章插圖都是同一種深色框，讀到後段會覺得重複；手機版故事很長（7 章約 7000 px）；「自動，但不失控」的右欄在桌面上比左欄短。
- **細節**：分頁標題完全照 `<Agent> · Worker · <工單>` 格式；狀態一律符號 + 文字；中點只用在分頁標題；標籤沒有全大寫、沒有 eyebrow、按鈕沒有加「→」；focus 是 2 px 紫框；reduced motion 時的靜止畫面就是 A 畫布 Hero 的狀態組合。不夠好的地方：雷達標籤位置是對著靜止畫面手動調的，桌面雷達只有約 280 px，12 px 標籤放進去有點擠；桌面的分頁欄在 4 個分頁下方留了空白。

### 主張 → 出處

| 首頁主張 | 出處 |
|---|---|
| 塔台一個指令就在同一個工作區開好 Worker 分頁 | README「與 BMad Control Tower 協作 › BAT 提供的整合點」（派工到正確的工作區）；`docs/agent-guide/logging.md`（塔台派工落點） |
| 帶上這個工作區設定的 Agent 與啟動參數 | `docs/agent-guide/workspace-agent-launch.md`（helper 派工套用落點工作區的生效參數） |
| 確認 Agent 真的啟動了 | `docs/agent-guide/worker-launch-confirmation.md`（`--wait-started`、`agentStarted`） |
| 通知直接送回塔台、yolo 時自動送出；`on` 時預填塔台輸入列 | README 整合點表「Worker 回報」（`bat-notify.mjs`，預填、`--submit`）；`docs/agent-guide/remote-tower-notify.md` |
| Worker 分頁標題帶著工單編號；塔台分頁 `<Agent> · Tower` | README「Control Tower 整合 › 塔台 / Worker 分頁」；`docs/agent-guide/tower-tab-title.md` |
| 縮圖標 ⚠️ 在等你 / ? 在等塔台答覆 / ✓ 已回報；只用 BAT 時也有 ⚠️ | README 整合點表「Worker 縮圖狀態」「等人回答偵測」；`docs/agent-guide/blocked-state.md`；`docs/agent-guide/worker-tab-recycle.md`（標示、attention） |
| 塔台收單後，分頁等輸出安靜才自動關閉；可一次關掉所有已回報的分頁 | README 整合點表「分頁回收」；`docs/agent-guide/worker-tab-recycle.md`（等安靜、批次關閉只計 ✓） |
| Worker 用結構化通道問塔台，塔台代答或轉給你 | README 整合點表「Worker 問塔台」；`docs/agent-guide/tower-questions.md` |
| 問答只存在 BAT 記憶體、祕密先遮罩、日誌只記長度與結果 | `docs/agent-guide/tower-questions.md`（不寫入檔案、`redactTerminalSecrets`、日誌只記 id / 長度 / 數量 / 結果） |
| 獨立 git worktree（自己的分支） | README「Control Tower 整合 › worktree 隔離派工」；`docs/agent-guide/worktree-isolated-dispatch.md`（分支 `ct/<工單>`） |
| 收單前查領先、落後、未提交變更 | `docs/agent-guide/worktree-status.md`（`behind`、`dirty`，`--ff-only` 判準） |
| 每個分頁有自己的權杖；塔台可派工、關閉自己派出的 Worker；Worker 只能回報、提問給派它的塔台 | README 整合點表「每分頁權限」；`docs/agent-guide/remote-tower-notify.md`（權杖範圍表） |
| 塔台不替你按鍵；BAT 只標出 ⚠️，不替你做決定 | `docs/agent-guide/remote-tower-notify.md`（塔台沒有對 Worker 的 `pty:write`）；`docs/agent-guide/blocked-state.md`（hook 一律 exit 0、stdout 不輸出，不替使用者做決定） |
| 用量限制自動繼續、預設關閉 | README「AI Agent 整合」；`docs/agent-guide/usage-limit-continue.md` |
| 支援 Claude Code / Codex / Gemini / GitHub Copilot / 自訂 CLI；Windows / macOS（Apple Silicon）/ Linux | README「AI Agent 整合」「快速開始」；`site/install.md` |
| 六格功能（多工作區與獨立視窗、Claude Code 面板與狀態列、遠端 WSL / SSH / Docker、檔案瀏覽器與 Git、Snippet 與語音輸入、用量限制自動繼續） | README「功能特色」各節（工作區管理、AI Agent 整合、Remote dev support、狀態列、其他功能、語音輸入） |
| 拆工單、重疊檢查、驗收證據、四種狀態、斷點、`off` / `ask` / `on` / `yolo` | Control Tower 的流程概念（規格 § 4.2–§ 4.4 原文）；只介紹概念，沒有放取得管道或 skill 內容（D159） |
| 600+ 工單、150+ bug 單、60+ 預覽版、5,000+ 單元測試，2026 年 4 月起 | 規格 § 4.5 實測（2026-10-18：工單 649、bug 單 154、預覽版 tag 67、unit test 5298、最早 commit 2026-04-10） |

### 文案校稿（`bmad-editorial-review-prose`）

採納：

| 原文 | 修訂 | 理由 |
|---|---|---|
| 帶上這個專案設定的 Agent 與參數（09:20） | 帶上這個工作區設定的 Agent 與啟動參數 | 原句不清楚；設定實際在工作區這一層 |
| Worker 分頁的標題就是它的工單編號（10:05） | Worker 分頁的標題帶著它的工單編號 | 標題還有 Agent 名與 Worker，「就是」不精確 |
| 做完的分頁等輸出安靜後自動關閉（10:05） | 塔台收單後，分頁等輸出安靜才自動關閉 | 補上觸發條件，避免讀成每個分頁都會自己關 |
| 塔台查清楚領先多少、落後多少（11:15） | 塔台查清楚每條分支比主線領先多少、落後多少 | 領先 / 落後缺少比較對象 |
| 不管選哪一段（自主程度） | 不管選哪一檔 | 用在旋鈕上，「檔」較貼切 |
| 回報會出現在塔台的輸入列（`on`） | 它的回報會預先填進塔台的輸入列 | 原句沒說出「預填、等你送出」 |
| 也可以用說的輸入提示詞 | 也可以用語音輸入提示詞 | 口語且含糊 |
| 同一個 BAT 視窗驅動 WSL… | 在同一個 BAT 視窗裡驅動 WSL… | 補介詞，句子才完整 |

未採納：沒有。其餘句子沿用規格 § 4 初稿，校稿沒有找到妨礙理解的問題；實績段的被動句「被需要、被做出來」照規格原文保留。

### 與規格的差異

1. **支援列**不用「Claude Code · Codex CLI · …」的中點串接，改成有間距的清單。依據：設計語言 § 2，中點只代表分頁標題。
2. **§ 4.4「不代你按鍵」縮小範圍**。規格原文是「BAT 與塔台都不會在 Worker 分頁替你輸入或按鍵」，改成「塔台不替你按鍵：Worker 停在權限確認時，只有你能在那個分頁裡回答。BAT 只標出 ⚠️ 在等你，不替你做決定」。原因：BAT 的「用量限制自動繼續」（opt-in）會在 Codex 的 yolo 分頁輸入續行文字，派工時也會把啟動指令寫進新分頁，所以「BAT 不會替你輸入」並不總是成立。
3. **§ 4.4 權限分離**：規格原文「塔台只能派工、關閉自己派出的 Worker」改成「塔台可以派工、關閉自己派出的 Worker；Worker 只能回報、提問給派它的塔台」。塔台還能宣告角色、回答提問、唯讀查詢，「只能」不精確；Worker 也能提問。
4. **Hero 事件紀錄**：規格例句「分頁 10 秒後回收」改成「排程回收分頁」→（下一圈）「輸出安靜 → 分頁已回收」，符合 `--close-worker` 的等安靜規則。T1026 示意 ⚠️（權限確認，等你回答）→ 你允許了 → 繼續執行，讓三種狀態都出現。
5. **TowerDemo 一輪**：規格寫的是「分頁出現 → 執行中 → ? → 執行中 → ✓ → 分頁關閉」，這裡改成三個 Worker 各走各的路徑。一輪 4 圈 × 5 秒 = 20 秒，對應規格「約 6 秒一圈、約 20 秒一輪」。
6. **桌面 Hero 的分頁列改成直排**（見對照表）；手機維持橫向條。
7. **§ 4.6 FeatureGrid**：規格只給六個標題，每格的一句說明依 README 補寫。沒有連到 `/features`（W2b 才做，留 TODO 註解）。
8. **AutonomyDial** 加上每一檔「塔台 / 你」的一句說明，規格只有一行概述。
9. **新增 `StoryIllo.vue`**（7 張插圖，StoryChapter 內部使用），以及 Hero 的「暫停動畫」按鈕（無障礙），兩者都不在規格清單裡。
10. **實績註記**是「截至 2026 年 10 月的累計數字。」；「2026 年 4 月起」寫在該段導言。
11. C 方向的「頁面光線隨早晨推移」沒有實作。工單只指定借用 C 的版面與時間敘事。

### 設計來源不一致 / 待塔台確認

- **計數器動畫與設計語言衝突**：設計語言 `docs/design/site-design-language.md` § 6 寫「一頁只有一個主要動態時刻（Hero）；其他區塊不做進場動畫」，規格 § 4.5 卻要求「動畫計數器（`<StatsCounter>`）」。目前的折衷：只在捲進畫面時數一次（1.2 s）、載入時已在畫面上就不數、reduced motion 不數。如果要嚴守 § 6，可以把 `run()` 拿掉，直接顯示數字。設計語言檔本單只讀，沒有修改。
- **等寬字族**：Design System Artifact 的 `mono` 是 IBM Plex Mono，工單與 A 畫布指定 Martian Mono。依工單用 Martian Mono；repo 檔 § 5 寫「由方向決定」，兩者不衝突。
- **字級**：Design System 的 `heading-1` 40 / `heading-2` 28，這裡的區段標題最大 44、章節標題 32，稍大於 DS，用來配合 C 的長篇閱讀版面。`display` 56 一致。
- 設計語言檔沒有發現錯誤。

### 給使用者的預覽指令

```bash
cd site
npm ci          # 第一次
npm run dev     # → http://localhost:5173/better-agent-terminal/
# 或用正式產物預覽：
npm run build && npm run preview   # → http://localhost:4173/better-agent-terminal/
```

注意：`vitepress preview` 啟動時會快取檔案清單。重新 build 後要重開 preview，否則頁面會缺 CSS / JS。

### commit

- 產品：`7d22cb8b` feat(site): story-driven home page with radar TowerDemo and morning timeline (T0630)
- 工單檔：本次回報另一個 commit（只含本檔）
- 未 push、未改 GitHub 設定、未觸發 workflow

### 互動紀錄

無（沒有需要問塔台的問題）。

### 後續建議

- W2b 補 `/control-tower`、`/features` 後，把 `index.md` 與 `FeatureGrid.vue` 的 `TODO(W2b)` 換成連結，nav 也一起補上。
- 如果要讓 Hero 以下更有層次，可以考慮把 7 張插圖分成兩三種不同的形式（目前都是深色框）。這是視覺取捨，留給使用者預覽後決定。
