---
schema_version: 1
schema_kind: workorder
id: T0632
title: "PLAN-049 W2a-0：網站 v2 視覺方向 —— BAT 設計語言、Design System 與 Design 畫布三個方向（frontend-design / theme-factory）"
type: design
status: PENDING
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: M
created_at: "2026-10-18T13:08:27+0800"
depends_on: [T0631]
related:
  - "規格：`_ct-workorders/_spec-site-v2-bat-ct-story.md`（APPROVED，D161；§ 3 定位、§ 4 首頁內容、§ 7 視覺、§ 8 文案規則）"
  - "D162（使用者要求加入 frontend-design、theme-factory、Design 畫布先定方向、Design System）；選定方向後由 T0630 實作"
affects_files:
  - "docs/design/site-design-language.md（新）"
  - _ct-workorders/T0632-site-v2-design-directions.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 開工第一步載入 **`frontend-design`** skill（T0631 安裝的 plugin；skill 名稱可能帶 plugin 前綴，以清單為準）與 **`anthropic-skills:theme-factory`**。任一個在你的 skill 清單裡找不到 → 不要用其他 skill 代替，`BLOCKED` 回報。"
  - "🔴 本單**只做視覺方向**：不改 `site/` 任何檔案、不改 `README.md` 與其他 repo 檔案（`docs/design/site-design-language.md` 新檔除外）；不 push、不改 GitHub 設定。"
  - "🔴 Artifact 一律維持私人（不分享、不公開連結以外的任何管道）；畫布與 Design System 內容同樣遵守規格 § 8：不出現 CT 取得管道 / 內部 repo 位置 / skill 檔內容、不出現內部編號（`T0\\d{3}`、`D1\\d{2}`、`BUG-`、`PLAN-`）、不放權杖、使用者路徑、帳號、私人 repo / 工作區名稱；示意用虛構專案 `demo-shop` 與虛構工單 `T1024`–`T1026`。"
  - "🔴 非隔離工單。`src/styles/settings.css` 的 M 不是你的變更，不碰；其他 Worker 的工單檔不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit（L129）。"
---

# T0632 — 網站 v2 視覺方向

## 目標

使用者希望網站「美觀、有設計感」，並採用以下流程：**先在 Design 畫布上定方向，選定之後再做成可運作的網頁**（D162）。本單產出三樣東西，交給使用者挑選：

1. BAT 的設計語言（repo 內的唯一來源）
2. 一份 BAT **Design System**（Artifact，供 Design 畫布、日後的 OG 卡片 / 簡報沿用）
3. 一張 **Design 畫布**（Artifact），並排 **3 個視覺方向**

使用者選定（或混搭）後，塔台把結果寫進 T0630，再派 T0630 實作。本單不等使用者回覆。

## 步驟

### 1. 讀規格與載入 skill

讀 `_ct-workorders/_spec-site-v2-bat-ct-story.md` § 3、§ 4、§ 7、§ 8，以及 `_decision-log.md` D161 / D162；載入 `frontend-design`、`anthropic-skills:theme-factory`（見 frontmatter）。

### 2. 設計語言（repo，唯一來源）

用 `ct-fieldguide` 的 DESIGN.md 抽取（design from code）從 BAT 本身的 UI 抽出網站要沿用的部分，輸出到 **`docs/design/site-design-language.md`**（工單指定路徑）。至少涵蓋：

- 品牌色：`assets/icon.svg` 的紫（`#a855f7` / `#c084fc` / `#e9d5ff`）與暖色點綴（`#feca57`、`#ff6b6b`、`#ff9ff3`）
- 分頁標題格式：`<Agent 顯示名> · Tower`、`<Agent 顯示名> · Worker · T####`（以 BAT 程式碼實際格式為準，寫出處）
- Worker 縮圖狀態：⚠️ 等使用者 / `?` 等塔台答覆 / `✓` 已回報 的實際符號與顏色（讀 BAT renderer 的實作與樣式取值，寫出處檔名）
- Stepper 狀態語言（`docs/design/bat-stepper-design-language.md`）裡網站會用到的部分
- **固定錨點**（三個方向都不得改）：品牌紫是「塔台訊號色」、狀態符號與語意、分頁標題格式

commit 這個檔案（`docs: site design language from BAT UI (T0632)`）。

### 3. Design System（Artifact）

以 Artifact 的 **Design System** 類型（`type_url: https://claude.ai/artifact/5M7UeXXcx16TP3vzVFNDzd`，照 Artifact 工具說明建立）建立「Better Agent Terminal」：

- README：BAT 是什麼、塔台 / Worker 的視覺隱喻、語氣
- tokens：淺色 / 深色色票、字體與字級（**含繁體中文字體**）、間距、圓角
- 元件（附即時預覽）：分頁標題（Tower / Worker）、Worker 縮圖（⚠️ / `?` / `✓`）、狀態標籤、終端區塊、故事章節卡（以前 / BAT + CT）、分工標籤（`BAT：…` / `CT：…`）
- 素材：App 圖示

數值以第 2 步的 repo 檔為準；兩邊不一致時以 repo 檔為準並修正 Artifact。

### 4. 三個主題（theme-factory）

用 `theme-factory` 產生 3 組主題（配色氛圍、字體搭配、質感），全部保留第 2 步的固定錨點，彼此差異要明顯。依 `frontend-design` 的原則：每個方向都要有大膽而明確的美學取向，避開「一看就是 AI 模板」的做法（預設無襯線字體、白底紫色漸層、平均排列的卡片格）。繁體中文是主要文字，字體搭配要先解決中文（中文標題 / 內文 + 英文 / 等寬點綴）。

方向種子（只是參考，可以換成你認為更好的）：

- **A 管制室**：深色為主，航管雷達語彙（網格、掃描線、狀態燈），等寬字點綴，品牌紫是塔台訊號
- **B 工程藍圖**：淺色紙感，工單 = 飛行計畫表單，細線框與標註，強調可追溯與秩序
- **C 編輯式敘事**：大字標題、雜誌式章節排版，故事時間軸是主角

### 5. Design 畫布（Artifact）

以 Artifact 的 **Design** 類型（`type_url: https://claude.ai/artifact/QKN21svewxgyPb6SYRqWnd`）建立「BAT 網站視覺方向」，套用第 3 步的 Design System。每個方向 4 張 artboard，用規格 § 4 的真實文案：

1. Hero（桌面 1440 寬）：主標「一個塔台，指揮整隊 AI Agent」、副標、按鈕、分頁列示意（`Claude CLI · Tower` + 三個 Worker 分頁）
2. 故事章節一章（桌面）：用「09:20 你成了人肉剪貼簿」——以前 vs BAT + CT、分工標籤、小插圖
3. 三欄對照（桌面）：只用 BAT / 只用 Control Tower / BAT + Control Tower
4. Hero（手機 390 寬）

每個方向附：名稱、一段概念說明、字體搭配、色票、動態構想（要能在 `prefers-reduced-motion` 下退回靜態）。

### 6. 可行性備註（給 T0630）

每個方向寫出在 VitePress 1.6.4 上實作的要點與風險：中文字體載入方式與大小（Google Fonts 分段載入 vs 自帶字型）、需要的自訂元件、動畫成本、淺色 / 深色兩種模式怎麼處理、手機版。

### 7. 退路

Artifact 的 Design / Design System 類型在你的 session 不能用 → 改把三個方向做成一個靜態 HTML，放 `e2e-results/site-v2-directions/index.html`（已在 `.gitignore`，不入版控），回報路徑；Design System 改寫進 `docs/design/site-design-language.md` 的附錄。不要因此 `BLOCKED`。

## 驗收

- `docs/design/site-design-language.md` 存在、已 commit，色票與狀態符號都有出處
- Design System 與 Design 畫布各一個 Artifact（或第 7 步的退路檔），三個方向 × 4 張 artboard
- 回報區附：兩個 Artifact 連結、三個方向的摘要表（概念 / 字體 / 色票 / 動態 / 實作風險）、你的推薦與理由、`frontend-design` 與 `theme-factory` 實際載入的名稱
- 未改 `site/`、未 push

---

## 回報區

（Worker 填寫）
