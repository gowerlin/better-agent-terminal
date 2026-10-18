---
schema_version: 1
schema_kind: workorder
id: T0634
title: "PLAN-049 W2b-1：`/control-tower` 深入頁（含 CT 進階能力三節與 FAQ）＋首頁「越用越懂你的專案」段＋nav"
type: feature
status: PENDING
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: L
created_at: "2026-10-18T14:02:46+0800"
depends_on: [T0630]
related:
  - "主規格：`_ct-workorders/_spec-site-v2-bat-ct-story.md`（§ 3 三根支柱〔第三根已延伸〕、§ 4.4a 首頁新段、§ 5 `/control-tower` 全 12 點、§ 7 視覺、§ 8 文案規則）"
  - "CT 進階能力提案：`_ct-workorders/_spec-site-v2-ct-features-cases.md`（APPROVED，D165；§ 2 F1–F16 文案草稿與公開判斷、§ 4.1 元件需求、§ 7 上站前檢查）"
  - "視覺：D164（A「進場雷達」+ C 時間軸）；`docs/design/site-design-language.md`；Design System https://claude.ai/artifact/FgvvUnYMgJwsEkrS2ATCBj；Design 畫布 https://claude.ai/artifact/2LN8rmZ3VbGwZSLpN18mPv"
  - "W2a 成果：T0630（`7d22cb8b`，已上線）的元件：`TowerDemo`、`StoryTimeline` / `StoryChapter` / `StoryIllo`、`CompareMatrix`、`AutonomyDial`、`StatsCounter`、`FeatureGrid`"
  - "後續：T0635（`/features`、`/faq`、`/contribute`、頁尾）、W2d（`/cases`）"
affects_files:
  - "site/control-tower.md（新）"
  - "site/index.md"
  - "site/.vitepress/config.mts（nav / sidebar）"
  - "site/.vitepress/theme/**（新元件 `GrowthLadder` 等、樣式）"
  - _ct-workorders/T0634-site-w2b1-control-tower-page.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 開工第一步載入 **`frontend-design`** skill（名稱以 skill 清單為準，T0630 實際是 `frontend-design:frontend-design`），全程依它的原則；清單裡沒有 → `BLOCKED` 回報。另用 `vitepress-book`（只當參考）與 `bmad-editorial-review-prose`（文案校稿）。"
  - "🔴 **Worker 不 push、不改 GitHub 設定、不觸發 workflow**。預覽通過後由塔台取得使用者授權再 push。`gh` 只能唯讀且一律帶 `-R gowerlin/better-agent-terminal`（L122）。"
  - "🔴 只改 `affects_files` 列的路徑；不改 `install.md` / `compatibility.md` / `releases.md` / `latest-release.mts` / `site/package*.json`、`README.md`、`docs/`、`src/`、`electron/`、`.github/`；不新增 npm 依賴；字型沿用 T0630 已載入的 Google Fonts。"
  - "🔴 **CT 公開範圍（D159 / D165）**：只寫概念與整合點。網站不得出現 CT 取得管道、內部 repo 位置、skill 檔內容、CT 文件名、CT 版本號、星號開頭的塔台指令、斜線開頭的 CT skill 名稱、CT 資料存放路徑；提案稿的「出處」欄不上站。F17 不用；F3、F11 依提案稿 ⚠️ 欄的改寫要求寫；F16 / C4 只放本頁 FAQ。`site/` 內 grep `T0\\d{3}`、`D1\\d{2}`、`BUG-\\d+`、`PLAN-\\d+`、`_ct-workorders`、`CLAUDE.md` = 0（include 的 README / `release-note.md` 原文除外）；示意只用 `demo-shop` 與 `T1024` 以後的虛構編號。"
  - "🔴 每個主張都要對得上 BAT 的真實行為（README、`docs/agent-guide/`），不得誇大；BAT 不阻止塔台讀程式碼（F16 分工欄），文案不得暗示 BAT 會擋；回報區附「主張 → 出處」對照。"
  - "🔴 非隔離工單。`src/styles/settings.css` 的 M 不是你的變更，不碰；其他 Worker 的工單檔不碰。commit 用 `git commit --only <檔案>` 或精確 stage。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit（L129）。"
---

# T0634 — PLAN-049 W2b-1：`/control-tower` 深入頁＋首頁「越用越懂你的專案」

## 目標

首頁（W2a）已上線，讓讀者在 60 秒內看懂 BAT + CT 的定位與故事。本單做「3 分鐘看懂」的那一層：`/control-tower` 深入頁，並在首頁加上「越用越懂你的專案」一段（D165），讓讀者看到長期價值。

**先讀**：主規格 § 3、§ 4.4a、§ 5（第 1–12 點）、§ 7、§ 8；提案稿 § 2、§ 4.1、§ 7；設計語言檔；T0630 的元件與 `custom.css`（沿用同一套 tokens、字體與視覺語彙，不另起一套）。

## 要做的事

### 1. `/control-tower`（`site/control-tower.md`，新頁）

依主規格 § 5 的 12 點與順序，插入 D165 的三節：

1. Control Tower 是什麼（塔台 / Worker / 工單 / 決策紀錄四個概念）
2. 分工：機場比喻表（主規格 § 3），加一列「塔台不上飛機」
3. **塔台的分工原則**（D165：F9 塔台刻意不讀程式碼、F10「做什麼」問塔台、「怎麼做」問 Worker）
4. 一張工單的一生（沿用 demo-shop 故事，逐步：對齊 → 開單 → 派工〔含啟動確認〕→ 執行 → 提問 → 回報 → 驗收 → 回收 → 合併；每步「畫面示意 + 發生什麼 + 你要做什麼」，示意可沿用 `StoryIllo` / `TowerDemo` 的視覺語彙）
5. 自主程度與斷點（可沿用 `AutonomyDial`）
6. Worker 問塔台（流程圖：Worker → 塔台代答 / 轉給你；工單通道作後備）
7. **現實比計劃更混亂時**（D165：F11 臨時插隊、F12 熔斷、F13 一層一張工單、F14 先寫契約；各一小段。`/cases` 尚未建立 → 不連結，以 `<!-- TODO(W2d): … -->` 留位置）
8. 平行與 worktree 隔離（重疊檢查、隔離分支、合併前狀態、保留 / 移除 / 封存）
9. 看得見每個 Agent（分頁標題、縮圖狀態、等人回答偵測〔Claude / Codex〕、唯讀 MCP 查詢）
10. 權限模型（塔台可以 / Worker 可以 對照表；用主規格 § 4.4 修正後的說法）
11. 支援的 Agent 與遠端
12. **越用越懂你的專案**完整版（D165：F1–F8；沿用新元件 `GrowthLadder`）
13. BAT 提供的整合點（README 整合點表改寫成使用者語氣；版本需求連到 `/compatibility`）
14. 常見問題：Control Tower 去哪取得？（「目前未公開提供」；BAT 的派工、回報、問答介面是公開的，可以接自己的流程）／沒有 CT 能用 BAT 嗎？／Codex 可以當 Worker 嗎？／塔台被慣壞怎麼辦？（F16 / C4，用「守住分工」「被慣壞」的說法）／一個塔台能管幾個子專案？（F15）

頁面很長：加頁內目錄（VitePress outline 已開 h2 / h3），每節開頭一句話摘要；手機版不得整頁水平捲動。

### 2. 首頁新段「越用越懂你的專案」（主規格 § 4.4a）

- 位置：「自動，但不失控」之後、「實績」之前；導語「第一天它照工單做事；第三個月，它照你的專案做事。」
- 3 張卡（說一次，之後每張工單都記得／教戰手冊／從程式碼抽出視覺規範，附「這個網站的設計語言就是這樣從 BAT 的程式碼抽出來的」註腳）＋ 4 格成長管線 `GrowthLadder`（觀察 → 已驗證 → 標準流程 → 技能；手機改直向；靜態不動畫；紫色只用在「塔台記下規則」的節點）
- 段尾連到 `/control-tower` 的「越用越懂你的專案」節

### 3. 連結與 nav

- `site/index.md` 第 79 行一帶的 `TODO(W2b)`（連到 `/control-tower` 的分工段落）→ 換成真連結
- `/features`（T0635 才做）的 TODO 維持不動
- `config.mts`：nav 加「BAT × Control Tower」（`/control-tower`）；sidebar 加對應群組；其他 W2b / W2d 項目維持 TODO 註解

### 4. 文案校稿與驗證

- `bmad-editorial-review-prose` 審新頁與首頁新段，採納 / 不採納列在回報區
- `site/` 內 `npm ci` + `npm run build`：0 錯誤、0 死連結；console 0 錯誤；手機無整頁水平捲動；reduced-motion 下無動畫
- 截圖存 `e2e-results/site-v2b/`（不入版控）：`/control-tower` 桌面 1440 與手機 390 × 淺 / 深色（每個 h2 至少一張）、首頁新段（桌面 / 手機）
- 內容規則 grep = 0（含上方 CT 公開範圍的字樣）；（選用）Lighthouse `/control-tower`
- `frontend-design` 自評（字體、色彩、版面節奏、細節，指出不夠好的地方）

## 驗收

- `/control-tower` 14 節完成、順序依上；首頁新段完成並連到 `/control-tower`
- build 0 錯誤、0 死連結；console 0 錯誤；手機無水平捲動
- 內容規則與 CT 公開範圍 grep = 0；F16 / C4 只在 FAQ
- 回報區附：截圖清單、「主張 → 出處」、文案校稿採納清單、與規格 / 提案稿的差異、給使用者的預覽指令
- 未 push、未改 GitHub 設定

---

## 回報區

（Worker 填寫）
