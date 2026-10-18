---
schema_version: 1
schema_kind: workorder
id: T0633
title: "研究：從 CT 文件萃取網站可用的功能特點與案例（自助擴充、DESIGN.md、FIELDGUIDE、實戰補充）"
type: research
status: PENDING
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: M
created_at: "2026-10-18T13:36:55+0800"
depends_on: []
related:
  - "使用者 2026-10-18 13:36 補充：「下列資訊也可研究做為案例或功能特點」（4 個 CT 文件路徑，見下方「來源」）"
  - "網站規格：`_ct-workorders/_spec-site-v2-bat-ct-story.md`（D161；§ 3 定位與三根支柱、§ 4 首頁、§ 5 `/control-tower` 深入頁、§ 8 文案規則）；D159（CT 只介紹概念與整合點）、D162 / D164"
  - "並行中：T0630（首頁實作，只動 `site/`）——本單不碰 `site/`"
affects_files:
  - "_ct-workorders/_spec-site-v2-ct-features-cases.md（新，提案稿）"
  - _ct-workorders/T0633-research-ct-docs-site-features-cases.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 **唯讀研究**：來源文件在 BMad-Guide repo，只讀不改；不改 `site/`、`README.md`、任何產品檔；不 push。只新增 / 修改 `affects_files` 列的兩個檔案，commit 用 `git commit --only <檔案>`。"
  - "🔴 **CT 公開範圍（D159）**：CT 未開源。提案只能用**概念層**的描述（它能做什麼、解決什麼問題、與 BAT 怎麼搭配）；不得出現 CT 取得管道、內部 repo 位置或路徑、skill 檔內容、指令全文 / 參數表 / 檔案格式範本的大段轉貼。引用原文一律改寫，單段直接引用 ≤ 1 句。提案稿本身也遵守這條（它之後會被拿來寫網站）。"
  - "🔴 **隱私**：「實戰補充（學員系列）」是依實際對話整理的。案例一律去識別化：不得出現學員 / 客戶 / 其他專案的名稱、公司、產品名、人名、路徑或可推回身分的細節；改寫成通用情境（例如虛構專案 `demo-shop`）。對任何可能指向真實對象的內容，在提案中標「需使用者確認」，不自行決定公開。"
  - "🔴 **不得誇大**：每個功能特點都要寫出處（來源檔名 + 章節標題），並標明它是 CT 的能力、BAT 的能力，還是兩者搭配；BAT 端的說法要能對到 BAT 的真實行為（`README.md`、`docs/agent-guide/`）。"
  - "🔴 非隔離工單。`src/styles/settings.css` 的 M 不是你的變更，不碰；其他 Worker 的工單檔（例如 T0630）不碰。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit（L129）。"
---

# T0633 — 研究：CT 文件 → 網站的功能特點與案例

## 目標

使用者希望網站除了「AI 協作開發的 7 個卡關時刻」故事外，也能用 CT 的進階能力與實戰情境當作**功能特點**或**案例**，讓讀者看到 BAT + CT 不只會自動派工，還會越用越懂你的專案、能處理現實中的混亂。本單把 4 份 CT 文件讀完，產出一份可直接拿來寫網站的提案稿，交給使用者決定要用哪些、放在哪裡。

## 來源（唯讀）

根目錄：`D:\ForgejoGit\@Gower_Labs\BMad-Guide\BMad-Control-Tower\BMad-Control-Tower-v5.8.0\docs\`

1. `Control Tower 自助擴充指南：教塔台學新技能 v4.md`
2. `Control Tower DESIGN.md 視覺規範指南 v4.md`
3. `Control Tower FIELDGUIDE 教戰手冊指南 v4.md`
4. `Control Tower 實戰補充\`（8 篇，先讀 `CT實戰補充-學員系列-索引.md`）

## 要回答的問題

### Q1 — 功能特點

列出可上網站的 CT 能力（例如：塔台學會專案規則、經驗沉澱成教戰手冊、從程式碼抽出視覺規範、遇到中斷或緊急任務時怎麼處理、跨專案契約變更怎麼協調、為什麼塔台刻意不讀程式碼）。每一項給：

- 一句標題 + 2–3 句使用者語氣的說明（繁中、第二人稱，符合規格 § 8）
- 它解決的痛點（能不能接到 7 個卡關時刻之一，或是新的痛點）
- 分工：CT 的能力 / BAT 的能力 / 兩者搭配（BAT 部分寫出 BAT 實際提供什麼）
- 出處（檔名 + 章節）
- 公開判斷：✅ 可公開（概念層）/ ⚠️ 需改寫或使用者確認 / ❌ 不公開，附理由

### Q2 — 案例

從「實戰補充」挑 3–5 個適合做成網站案例的情境，每個寫成 120–200 字的去識別化小故事（虛構專案名，問題 → 塔台怎麼處理 → 結果），附原文出處與隱私判斷。另外評估：BAT 自己的開發經驗（例如 BAT 與 CT 以「BAT 定介面契約、CT 依契約撰寫」跨專案同步演進，資訊來源 `README.md`「與 BMad Control Tower 協作」）能否做成一個**真實案例**，並寫出可公開的版本。

### Q3 — 放在網站哪裡

依規格 § 4（首頁）與 § 5（`/control-tower`）的結構提出建議：首頁要不要新增一段（例如「越用越懂你的專案」），還是全部放 `/control-tower`，或另開 `/cases` 案例頁；每個建議寫出對應的元件需求（可沿用 D164 的 A「進場雷達」+ C 時間軸視覺）與工作量。

### Q4 — 與現有規格的衝突或補強

逐條檢查提案和規格 § 3–§ 8、D159 / D161 / D164 有沒有衝突，或可以補強哪一段（例如「自動，但不失控」可以補上「塔台違規與問題路由」的概念）。

## 交付

- `_ct-workorders/_spec-site-v2-ct-features-cases.md`（提案稿，Status: DRAFT）：Q1 表、Q2 案例全文、Q3 建議、Q4 對照，以及「需要使用者決定的事項」清單（附你的推薦）
- 本工單回報區：摘要、推薦、每份來源讀了哪些章節、隱私與公開判斷的總表

## 驗收

- 4 份來源都有讀，回報區列出各自讀過的章節
- 每個功能特點與案例都有出處與公開判斷；案例全部去識別化
- 提案稿裡沒有 CT 取得管道、內部路徑、skill 檔內容、大段原文
- 未改 `site/` 與其他檔案；未 push

---

## 回報區

（Worker 填寫）
