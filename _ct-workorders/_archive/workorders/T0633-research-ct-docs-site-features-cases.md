---
schema_version: 1
schema_kind: workorder
id: T0633
title: "研究：從 CT 文件萃取網站可用的功能特點與案例（自助擴充、DESIGN.md、FIELDGUIDE、實戰補充）"
type: research
status: DONE
started_at: "2026-10-18T13:37:50+08:00"
updated_at: "2026-10-18T13:43:37+08:00"
completed_at: "2026-10-18T13:43:37+08:00"
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

### 結果摘要

- 狀態：**DONE**。研究型工單，交付提案稿 `_ct-workorders/_spec-site-v2-ct-features-cases.md`（Status: DRAFT，commit `714ba3b1`）
- Q1：17 個功能點，分兩組：「越用越懂你的專案」F1–F8、「現實比計劃更混亂時」F9–F17。每點都寫了文案草稿、對應的故事章節、分工（CT / BAT / 搭配）、出處與公開判斷。結果：13 點可公開（✅；其中 F8 的「業界背景」段不上站），3 點需改寫或使用者確認（⚠️：F3、F11、F16），1 點不公開（❌：F17）
- Q2：4 個情境案例（C1 合併後的洋蔥式除錯、C2 兩個服務同一個欄位、C3 正式站插隊、C4 塔台被慣壞〔備選〕），全部改寫成 `demo-shop`；另有 3 個 BAT 真實案例（R1 BAT 定契約 / CT 依契約、R2 一句話變成塔台原則、R3 網站設計語言從 BAT UI 抽出）
- Q3：首頁加一段「越用越懂你的專案」（S–M）；`/control-tower` 加 3 節加 FAQ（M，併入 W2b）；新增 `/cases`（M，獨立 W2d）
- Q4：12 條對照，沒有硬衝突。主要補強是支柱 2 加入熔斷、支柱 3 延伸成「還會長大」。潛在衝突是來源文件充滿指令名、路徑與版本號，與 D159 / 規格 § 8 相抵，所以網站只寫概念

### 推薦

1. 首頁加「越用越懂你的專案」：3 張卡（說一次就記得 / 教戰手冊 / 視覺規範）加一條 4 格成長管線，排進 W2b，不改進行中的 T0630
2. 開 `/cases`（W2d）：首批放 C1–C3 與 R1–R3；C4 / F16 只放 `/control-tower` FAQ
3. 網站不寫任何 CT 指令名稱、檔名、存放路徑或 CT 版本號
4. 「需要使用者決定的事項」共 7 題，列在提案稿 § 6，每題都附了推薦

### 各來源讀過的章節

| 來源 | 讀取範圍 |
|---|---|
| 自助擴充指南 v4 | 全文（769 行）：為什麼可以自己擴充、基本原理、四步流程、實戰範例 1–6、AI 輔助設計、擴充邊界、常見問題、一句話總結、v4.0 章節 A–D |
| DESIGN.md 視覺規範指南 v4 | 全文（464 行）：什麼是 DESIGN.md、與 FIELDGUIDE 關係、業界背景、快速開始、擷取管線 Step 0.5–9、URL 靜態分析、瀏覽器即時擷取、適用場景、跨專案一致性、九章節格式、常見問題、進階技巧 |
| FIELDGUIDE 教戰手冊指南 v4 | 全文（461 行）：什麼是 FIELDGUIDE、三層結構、快速開始、五大子命令、三層撰寫指引、Global vs Project、回報標記、常見問題、進階技巧 |
| 實戰補充（8 篇） | 全部全文：索引、（一）、（一-A）、（一-B）、（一-C）、（四）、（五）、參考篇「資深開發者除錯模式分析」 |
| 補充查證（非指定來源，只查關鍵字） | 同目錄 v5 使用指南：確認學規則、經驗萃取、教戰手冊、DESIGN.md、互動探索、安全匯入、熔斷在 v5 仍存在；中斷語法 v5 改為暫停 / 恢復；REVIEW 狀態在 v5 已移除 |
| BAT 端核對 | `README.md`「功能特色」「與 BMad Control Tower 協作」（整合點表、版本對照表 10 列）；`docs/agent-guide/` 的 workspace-agent-launch、helper-query-channels、bat-mcp-shim、tower-questions、recovery-create-hold、logging（確認檔案存在）；`docs/design/site-design-language.md` 檔頭；規格 `_spec-site-v2-bat-ct-story.md` 全文；決策 D159 / D160 / D162–D164 |

### 隱私與公開判斷總表

| 項目 | 判斷 | 理由 |
|---|---|---|
| F1、F2、F4–F10、F12–F15 | ✅ | 概念層 |
| F3 | ⚠️ 改寫 | 原文以內部層級與存放路徑說明 |
| F8「業界背景」段 | ⚠️ 不上站 | 第三方說法未查證 |
| F11 | ⚠️ 改寫 | 原文語法在 v5 已改；BAT 保留分頁有前提條件 |
| F16、C4 | ⚠️ 使用者確認 | 內容偏負面；推薦只放 FAQ |
| F17（除錯模式分析整份） | ❌ | 含真實客戶名稱、系統識別碼、內部元件與 log 細節 |
| C1–C3 | ✅ | 改寫成 `demo-shop`；原文的子專案名、產品名、時間戳、人物與自述都不使用 |
| R1 | ✅（數字 ⚠️） | 依 README 公開段落；「約 20 次」與「CT 新版由 BAT 實機驗收」一句交使用者決定（推薦：數字上站，驗收那句不加） |
| R2、R3 | ✅ | 只涉及 BAT 自己 |
| 學員自述 / 人格描述 | ❌ 一律不用 | 可推回身分 |

### 驗證

- 來源覆蓋：4 份來源全文讀完（見上表）：PASS
- 出處與公開判斷：F1–F17、C1–C4、R1–R3 每項都有：PASS
- 去識別化：grep 提案稿中的原文專有名詞（兩個子專案名、客戶名、CTI 元件名、訊息佇列產品名等）、CT 指令（星號 / 斜線開頭）、CT 資料目錄路徑、BMad-Guide 路徑，命中 0：PASS
- 案例字數（中文字元，不含標點）：C1 195、C2 169、C3 147、C4 161，都在 120–200 之間。R1 約 150、R2 124；R3 約 70，因為用作註腳，刻意寫短。工單的字數規定只適用於實戰補充的案例：PASS
- R1 數字實測（2026-10-18）：本 repo 工單目錄含歸檔共 20 個不同的 CT 委派單編號，最早一張建立於 2026-04-17；README 版本對照表 10 列
- 未改 `site/`、`README.md`、`src/`；`src/styles/settings.css` 的 M 與 `site/` 的未追蹤檔不是本單的變更，沒有動；未 push：PASS
- 寫檔 LF（`\r` 計數 0）

### Landing check

- C-0：`repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`：PASS
- C-1：工單位於 REPO_ROOT 之下：PASS
- C-3：`affects_files` 全在 `_ct-workorders/`：不適用
- C-2：無 `branch` 欄位；目前在 `main`
- `CT_HOME` 未設（非隔離）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）
- 結果：PASS

### Commit

- `714ba3b1` docs(ct): T0633 site v2 CT features and cases proposal (DRAFT)：只含提案稿
- 工單檔：本次回報另行 `git commit --only`

### 偏差 / 阻礙 / 後續

- 沒有偏差、沒有阻礙；沒有向塔台提問（`CT_MODE=yolo`，範圍內的選擇都依工單與規格自行決定，理由寫在提案稿）
- 範圍外的觀察：CT 端 4 份 v4 文件有過時處（中斷語法、REVIEW 狀態），屬於 CT 文件維護，只記錄、未處理
- 後續建議：使用者回覆提案稿 § 6 之後，由塔台把結論併入 `_spec-site-v2-bat-ct-story.md`（§ 3 支柱 3、§ 4.4、§ 5、§ 8、§ 10），再開 W2b / W2d

### 互動紀錄

- 無（fire-and-forget，未向使用者或塔台提問）
