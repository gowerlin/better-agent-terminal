---
schema_version: 1
schema_kind: workorder
id: T0636
title: "PLAN-049 W2b-3：「Control Tower 功能導覽」頁（`/control-tower-tour`）——CT 不開源，以「概念加細節」介紹 CT 本身"
type: feature
status: DONE
started_at: "2026-10-18T14:44:27+0800"
updated_at: "2026-10-18T14:59:19+0800"
completed_at: "2026-10-18T14:59:19+0800"
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: L
created_at: "2026-10-18T14:40:30+0800"
depends_on: [T0635]
related:
  - "D166（本單的公開程度與放置，使用者決定）；D159（CT 不開源、不提供取得管道）；D165（CT 字樣規則）"
  - "主要來源（唯讀）：`D:\\ForgejoGit\\@Gower_Labs\\BMad-Guide\\BMad-Control-Tower\\BMad-Control-Tower-v5.8.0\\docs\\BMad Control Tower 安裝(升級)與使用指南 v5.md`"
  - "輔助來源：`_ct-workorders/_spec-site-v2-ct-features-cases.md`（T0633 提案，F1–F16 已審過的寫法與公開判斷）；`site/control-tower.md`（T0634，已上線的 BAT × CT 協作頁，避免重複）"
  - "主規格：`_ct-workorders/_spec-site-v2-bat-ct-story.md` § 6、§ 7、§ 8；視覺 D164 與 `docs/design/site-design-language.md`"
affects_files:
  - "site/control-tower-tour.md（新）"
  - "site/control-tower.md（只加連到導覽頁的連結與一句說明）"
  - "site/.vitepress/config.mts（nav / sidebar）"
  - "site/.vitepress/theme/**（必要的新元件與樣式）"
  - _ct-workorders/T0636-site-w2b3-control-tower-tour.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 開工第一步載入 **`frontend-design`** skill（名稱以 skill 清單為準）；清單裡沒有 → `BLOCKED` 回報。另用 `vitepress-book`（只當參考）與 `bmad-editorial-review-prose`（文案校稿）。"
  - "🔴 **公開程度（D166，使用者決定）＝「概念加細節」**。可以寫：CT 是什麼、四級能力、基本操作流程、工單生命週期與狀態、自主模式（沿用首頁與 `/control-tower` 已用的 `off` / `ask` / `on` / `yolo` 與說法，不另取名）與斷點、自我學習、多塔台協調、Debug 三層防線、去識別化的使用情境、常見問題。**不得寫**：命令名稱（任何星號、斜線、錢字號開頭的指令）、skill 名稱、CT 版本號（含「v4.x」「v5.x」等版本演進）、取得管道或「如何取得 / 聯絡我們」、安裝 / 升級步驟、skill 檔原文、完整參數 / 設定表（可以寫「有哪些設定可以調」的概念，不列鍵名與值域）、檔案格式範本與檔名（例如塔台狀態檔、設定檔、工單資料夾的實際名稱）、內部 repo 位置與路徑。引用原文一律改寫，單段直接引用 ≤ 1 句。"
  - "🔴 **隱私**：指南 § 7「使用情境案例」與 § 9「多塔台協調」可能含真實專案或客戶名稱 → 一律改寫成虛構專案（`demo-shop` 等）；任何可能指回真實對象的內容不用，並在回報區列出。"
  - "🔴 **唯讀來源**：BMad-Guide repo 只讀不改。指南 § 3、§ 4（升級與安裝）不使用；§ 2（各版新功能）只用來理解功能，不寫版本號、不做版本時間軸；§ 12–§ 14（速查表）不轉貼。"
  - "🔴 不得誇大、不得與 BAT 的真實行為衝突：凡寫到 BAT 的部分，對得上 README 或 `docs/agent-guide/`；CT 的部分附指南章節出處（只在回報區，不上站）。回報區附「主張 → 出處」。"
  - "🔴 **Worker 不 push、不改 GitHub 設定**；只改 `affects_files`；不新增 npm 依賴；`site/` 內 grep `T0\\d{3}`、`D1\\d{2}`、`BUG-\\d+`、`PLAN-\\d+`、`_ct-workorders`、`CLAUDE.md` = 0（include 原文除外）；不放權杖、使用者路徑、帳號。預覽伺服器用完就結束（含 esbuild 子程序），回報寫明。"
  - "🔴 非隔離工單。`src/styles/settings.css` 的 M 不是你的變更，不碰；其他 Worker 的工單檔不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit（L129）。"
---

# T0636 — 「Control Tower 功能導覽」頁

## 目標

使用者決定：CT 不開源，但網站可以「稍微詳細」介紹 CT 本身（D166）。`/control-tower` 講的是 BAT 與 CT **怎麼一起用**；本單新開 `/control-tower-tour`，講 **CT 本身能做什麼、怎麼運作**，讓讀者看懂這套流程的完整樣貌——但不提供取得管道、不寫命令與版本。

## 來源與讀法

- 主要：CT 使用指南 v5 的 § 1、§ 5–§ 11（全文讀）；§ 2 只用來理解每個功能在做什麼（不寫版本）；§ 3、§ 4 不用；§ 12–§ 14 只當理解用的索引，不轉貼。
- 已審過的寫法：T0633 提案稿 § 2（F1–F16）可直接沿用或延伸，避免和已上線內容說法不一致。
- 不重複：`/control-tower` 已有的內容（機場比喻、一張工單的一生、權限模型、整合點等）在導覽頁只用一句帶過並連回去。

## 頁面結構（建議，可依內容調整並在回報說明）

1. **Control Tower 是什麼**：以檔案為核心的多 Agent 開發流程；為什麼用「塔台」管理、Worker 執行（對應指南 § 1）
2. **四級能力**：每一級能做什麼、適合什麼情境（§ 5；可做成階梯或卡片）
3. **一天的基本流程**：從啟動塔台、對齊需求、開單、派工、收單到收工交接（§ 6；不寫命令名稱，用「你說… → 塔台會…」的寫法）
4. **工單的狀態與驗收**：狀態流轉與每個狀態的意義、證據式驗收、Renew（§ 6 與相關段落；狀態名稱可以寫）
5. **自主程度與斷點**：四種模式與一定會停下來的情況（與 `/control-tower`、首頁的說法一致）
6. **自我學習**：觀察 → 已驗證 → 標準流程 → 技能、教戰手冊、視覺規範（§ 8；沿用 `GrowthLadder`）
7. **多塔台協調**：多個專案或子專案時，塔台之間怎麼分工與交接（§ 9；去識別化）
8. **Debug 三層防線**（§ 10）
9. **使用情境**：從 § 7 挑 3–4 個，寫成去識別化的小情境（每個 80–150 字）；與 W2d `/cases` 的案例不重複（`/cases` 尚未建立，不連結）
10. **常見問題**（§ 11 改寫；保留「Control Tower 去哪取得？目前未公開提供」，與 `/faq`、`/control-tower` 一致）

## 其他要做的事

- `/control-tower` 開頭或「Control Tower 是什麼」節加一句與連結：「想看 Control Tower 本身的完整介紹，見功能導覽」
- `config.mts`：nav 的「BAT × Control Tower」可改成下拉（協作 / 功能導覽），或在 sidebar 同一群組加入導覽頁；擇一並說明
- 視覺沿用 D164（A 的字體與色彩語意：紫 = 塔台、藍 = 你、中性 = Worker）與既有元件；新元件只在必要時新增

## 驗證

- `bmad-editorial-review-prose` 審導覽頁；採納 / 不採納列在回報區
- `site/` 內 `npm ci` + `npm run build`：0 錯誤、0 死連結；console 0；手機無整頁水平捲動；reduced-motion 下無動畫
- **CT 字樣 grep = 0**（網站自己的路由 `/control-tower`、`/control-tower-tour` 除外，同 T0634 的判讀）：星號 / 斜線 / 錢字號開頭的指令、skill 名稱（含 `ct-` 開頭的名稱）、`v[3-5]\.[0-9]` 版本號、CT 檔名與路徑、「取得」「下載 CT」「聯絡」等取得管道字樣（FAQ 的「目前未公開提供」除外）；加上既有的內部編號 grep
- 截圖存 `e2e-results/site-v2b3/`（不入版控）：導覽頁桌面 1440 / 手機 390 × 淺 / 深色（每個 h2 至少一張）
- 預覽伺服器用完已結束

## 驗收

- 導覽頁 10 節（或回報說明的調整版）完成，`/control-tower` 與 nav / sidebar 都連得到
- 公開程度符合 D166；CT 字樣 grep = 0；使用情境全部去識別化
- build 0 錯誤、0 死連結；console 0；手機無水平捲動
- 回報區附：截圖清單、「主張 → 出處」（含指南章節）、文案校稿採納清單、去識別化與不使用內容清單、給使用者的預覽指令
- 未 push、未改 GitHub 設定；本機沒有殘留的預覽伺服器

---

## 回報區

### 結果摘要

**DONE**。新增 `/control-tower-tour`「Control Tower 功能導覽」，照工單建議的 10 節完成，第 1 節另加一個 h3「為什麼分成塔台與 Worker」；`/control-tower` 與 nav / sidebar 都連得到。公開程度符合 D166：沒有命令名稱、skill 名稱、CT 版本號、取得管道、安裝 / 升級步驟、設定鍵名、檔名或路徑。build 0 錯誤、0 死連結；console 0；1440 / 390 × 淺 / 深色都沒有整頁水平捲動；reduced-motion 下 `document.getAnimations()` = 0。

### 落點檢查（Landing Zone）

- **PASS**。C-0：frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`。
- C-1：工單在 REPO_ROOT 下。
- C-3：`site/control-tower.md`、`site/.vitepress/config.mts` 存在；`site/control-tower-tour.md` 不存在，但上層 `site/` 存在，判為 present。
- C-2：工單沒有 `branch` 欄位，未比對；目前在 `main`。
- `CT_HOME` 未設定（非隔離工單）；觀察到的 `BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）。

### 變更檔案（commit `61ccfef1`）

| 檔案 | 內容 |
|---|---|
| `site/control-tower-tour.md`（新） | 導覽頁本文 |
| `site/.vitepress/theme/components/CapabilityLevels.vue`（新） | 四級能力：三個可選增強並排，坐在第 0 級的地基上（可任意組合，所以不畫成階梯）；手機依序堆疊 |
| `site/.vitepress/theme/components/TourDay.vue`（新） | 一天的基本流程：每步「你（藍）說的話 / 塔台（紫）會做的事」 |
| `site/.vitepress/theme/components/TicketStates.vue`（新） | 工單狀態流轉圖：待派工 → 執行中（⇄ 暫停）→ 五種結果；狀態一律「符號 + 狀態名 + 中文」 |
| `site/.vitepress/theme/index.ts` | 註冊三個新元件 |
| `site/.vitepress/theme/custom.css` | 新增「/control-tower-tour 功能導覽」區段：流程色 tokens（`--tour-*`，淺色同色相降明度）、三個元件、`.tour-layers`（Debug 三層）、`.tour-result` |
| `site/.vitepress/config.mts` | nav 的「BAT × Control Tower」改成下拉（分工與流程 / Control Tower 功能導覽）；sidebar 同一群組加入導覽頁 |
| `site/control-tower.md` | 「Control Tower 是什麼」節尾加一句與連結：「想看 Control Tower 本身的完整介紹……見功能導覽」 |

**nav / sidebar 的選擇**：兩邊都加了。nav 改成下拉，讓頂端導覽連得到；sidebar 也一定要加，否則導覽頁在文件側欄裡沒有位置，上一頁 / 下一頁也接不上。工單寫「擇一」，這裡兩者都做，列為偏差，見下文。

**元件**：只新增上面三個，因為這三種內容（可組合的能力層、雙角色對話、狀態圖）既有元件都無法表達。其餘沿用既有元件：`CardTable`（信心度）、`GrowthLadder`（成長管線）、`.ct-concepts`（核心原則、多塔台機制）、`.ct-lead` / `.ct-intro`。視覺依 D164 / 設計語言：紫 = 塔台、藍 = 你、中性 = Worker；工單狀態色取自設計語言 § 4（Stepper）。

**實作中修正**：`TourDay` 原本用 `td-` 前綴，與 TowerDemo 的 `.td-body` 撞名，桌面版面因此錯位；已改成 `dy-`，截圖確認正常。

### 頁面結構（對照工單建議）

1. Control Tower 是什麼（含 h3「為什麼分成塔台與 Worker」）
2. 四級能力
3. 一天的基本流程（7 步）
4. 工單的狀態與驗收（狀態圖；h3：證據式驗收、回報先寫完才改狀態、Worker 開工前先檢查、補充說明、研究型工單、不只工單）
5. 自主程度與斷點（四種模式、一定會停下來問你的時候、yolo 模式另外會暫停的時候）
6. 自我學習（從回報到規則、信心度、你的糾正、`GrowthLadder`、回頭看你們怎麼工作）
7. 多塔台協調
8. Debug 三層防線（含品質閘門）
9. 使用情境（4 個）
10. 常見問題（7 題）

與 `/control-tower` 重複的內容（機場比喻、一張工單的一生、自主程度對照表、Worker 問塔台、臨時插隊 / 卡住就停 / 兩邊都要改、團隊規矩 / 教戰手冊 / 視覺規範、一個塔台管幾個子專案）都只用一句帶過，再連回去。

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| `site/` `npm ci` + `npm run build` | PASS | `build complete`，0 錯誤；VitePress 預設遇死連結即失敗，build 通過 = 0 死連結 |
| console | PASS | 用 Playwright（chromium headless shell 1243）開 `/control-tower-tour`、`/control-tower`，1440 / 390 × 淺 / 深色共 8 種組合，error / warning / pageerror 都是 0 |
| 手機無整頁水平捲動 | PASS | 8 種組合的 `scrollWidth == clientWidth`（1440 / 390）；`.vp-doc` 內沒有元素超出右緣 |
| reduced-motion | PASS | `reducedMotion: reduce` 捲到底後，`document.getAnimations()` 是空陣列（導覽頁本身沒有動畫） |
| 連結 | PASS | dist：`control-tower.html` 有 3 處連到導覽頁（nav / sidebar / 本文），`index.html` 有 1 處（nav） |
| 內部編號 grep（`site/`，排除 node_modules / dist / cache） | PASS = 0 | `T0\d{3}`、`D1\d{2}`、`BUG-\d+`、`PLAN-\d+`、`_ct-workorders`、`CLAUDE.md` |
| CT 字樣 grep（導覽頁 + 3 個新元件） | PASS = 0 | 星號 / 斜線 / 錢字號開頭的指令；Worker / 塔台 skill 名稱（`ct-` 開頭七個）、`bmad-guide`、`ECC`、`mem0`、`FIELDGUIDE`、`DESIGN.md`、`playbook`；`v[3-5]\.[0-9]`；CT 檔名與路徑樣式（塔台狀態檔、local rules、決策紀錄檔、學習檔、playbook 目錄、設定檔、`.claude`、`skills/`、`~/`） |
| 取得管道字樣 | PASS（2 處命中，都是允許的例外） | 「取得」只出現在 FAQ 標題「Control Tower 去哪取得？」（答案是目前未公開提供，與 `/faq`、`/control-tower` 一致）；「安裝」只出現在「安裝包驗證」（指產品安裝包的驗證項目，不是安裝 CT）。下載 / 聯絡 / 升級 = 0 |
| 權杖 / 使用者路徑 / 帳號 grep | PASS = 0 | |
| 預覽伺服器 | 已結束 | `vitepress preview --port 4199` 跑了 3 次（rebuild 後 sirv 會沿用舊的檔案清單，所以每次重啟），最後一次用 `taskkill /T` 結束整個行程樹；port 4199 沒有 listener，`vitepress` / `esbuild` 行程數 = 0 |

### 截圖清單（`e2e-results/site-v2b3/`，不入版控，共 48 張）

- 導覽頁每個 h2 各一張 × 桌面 1440 / 手機 390 × 淺 / 深色：`control-tower-tour-{desktop-1440,mobile-390}-{light,dark}-{what,levels,daily,states,autonomy,learning,multi-tower,debug,scenarios,faq}.png`（40 張）
- 導覽頁整頁：`control-tower-tour-{desktop-1440,mobile-390}-{light,dark}-full.png`（4 張）
- `/control-tower` 整頁（確認新增的連結與 nav 下拉）：`control-tower-{desktop-1440,mobile-390}-{light,dark}-full.png`（4 張）
- 截圖腳本放在 scratchpad（`shots.cjs`），沒有進 repo

### 主張 → 出處（只供內部核對，不上站）

指南 = CT 使用指南 v5（唯讀）；提案 = `_spec-site-v2-ct-features-cases.md`。

| 頁面主張 | 出處 |
|---|---|
| 塔台不寫程式、工單是唯一交接、檔案說了算、每次經驗都留下來 | 指南 § 1、§ 12「關鍵原則」 |
| 分成塔台與 Worker 的理由（脈絡） | 提案 F9；指南 § 1 |
| 對話斷了 / 換 Agent 從檔案接手 | 指南 § 7 情境 7、§ 11 |
| 四級能力內容；啟動自動偵測；可任意組合 | 指南 § 5、§ 12「能力等級」 |
| 第 1 級：移除工具不丟知識 | 指南 § 8「ECC 增強」 |
| 第 3 級：目前只單向寫出、不會查詢（不寫向量搜尋） | 指南 § 5「v5.0.9 註」、§ 4.6 註 |
| 一天的流程：啟動讀進度、對齊（聽 / 問 / 複述 / 確認）、開單、派工、收單、對帳、收工交接 | 指南 § 6.1–§ 6.3、§ 4.4（關卡 1–4）、§ 1；收工交接 = 指南 § 2 Phase 6「Tower State 結構化」 |
| 開單時比對會動到的檔案 | `/control-tower#parallel`（已上線）；提案 |
| 派工：BAT 開分頁；off 時給指令 | 指南 § 2.5、§ 2.6；BAT README「BAT 提供的整合點」 |
| 狀態清單與流轉、PAUSED、PARTIAL 補正 | 指南 § 12「狀態流轉」、§ 2.13 |
| 各狀態的意義（DONE / FIXED / PARTIAL / BLOCKED / FAILED） | Worker 執行規則的「Status rules」（與指南一致） |
| 證據分項記錄、跑不了的不算通過 | Worker 執行規則「Phase 3: Verify」 |
| 先 commit、再寫回報、再改狀態、再通知 | Worker 執行規則「Phase 4」；指南 § 2 Phase 3「反序寫入」、§ 2.37 |
| 落點檢查、範圍守護（三選一） | 指南 § 2.15、§ 2.16；§ 2 Phase 3「範圍守護」 |
| Renew、次數過多是斷點 | 指南 § 2 Phase 2、§ 2.6 斷點 B-1 |
| 研究型工單 | 指南 § 2 Phase 2；Worker 執行規則「For research work」 |
| Bug / 計畫 / 實驗單、決策紀錄、歸檔與還原 | 指南 § 2 Phase 1、Phase 5 |
| 四種模式 | 指南 § 2.6；文字與 `/control-tower#autonomy`、首頁一致 |
| 一定會停下來問你的五項 | 首頁 / `/control-tower`（已上線）；指南 § 2.33「塔台代決邊界」 |
| yolo 另外暫停的情況（回報非預期 / Renew 過多 / 跨計畫） | 指南 § 2.6 斷點 A、B-1、C |
| 連續失敗上限可調，第一次可先調低 | 指南 § 2.6「安全建議」 |
| 塔台查到 Worker 在等你時用分頁標題告訴你，不代答、不按鍵，其他照常 | 指南 § 2.33 斷點 D |
| yolo 歷程有記錄 | 指南 § 2.6「啟動面板識別」 |
| 學習管線、信心度四級與行為 | 指南 § 8（不寫具體次數，只寫「驗證過一次」「不只一個專案」「一再被驗證」） |
| 一連串工單 → 提議標準工單流程 | 指南 § 7 情境 6、§ 8 管線；提案 F2 |
| 使用者糾正最有價值 | 指南 § 8「使用者糾正」 |
| 使用模式分析（好習慣 / 壞習慣 / 原則衝突、三種範圍） | 指南 § 4.5 |
| 多塔台：登記、留言板、工單鎖定、心跳 | 指南 § 9 |
| 多塔台的例子 | 指南 § 7 情境 9（去識別化） |
| Debug 三層、品質閘門 | 指南 § 10 |
| 情境「從零開始的新專案」 | 指南 § 7 情境 1 |
| 情境「接手只有 README 的舊專案」 | 指南 § 7 情境 2、§ 6.1 範例 |
| 情境「審查挑出嚴重問題」 | 指南 § 7 情境 5 |
| 情境「換一個 Agent 接手」 | 指南 § 7 情境 7 |
| FAQ：取得 | `/faq`、`/control-tower`（已上線，D159） |
| FAQ：Claude Code / Codex 都能當塔台與 Worker、可以混用 | 指南 § 1、§ 11；BAT `/control-tower#agents` |
| FAQ：BMad-Method 非必要，沒有時標「自訂」 | 指南 § 11 |
| FAQ：對話斷了 | 指南 § 11 |
| FAQ：沒有 BAT 時改用其他終端或手動 | 指南 § 2.5「不在 BAT 環境的行為」 |
| FAQ：相依工具更新 | 指南 § 11 |
| FAQ：新手教學模式（分關、保護較多） | 指南 § 4.4 |
| 寫到 BAT 行為的句子（開分頁、通知、回報填進輸入列、提問通道、狀態查詢、回收） | README「與 BMad Control Tower 協作」；`docs/agent-guide/worker-tab-recycle.md`、`tower-questions.md`、`helper-query-channels.md`；與已上線的 `/control-tower` 用語一致 |

### 文案校稿（`bmad-editorial-review-prose`）

全部採納（5 項）：

1. 「讓你選：……」→「停下來問你（yolo 模式下改問塔台）：……還是……」：原句沒寫 yolo 模式改由塔台決定，讀者會以為每次都要自己回答
2. 「最後才把狀態改成最終值」→「最後才改狀態」：「最終值」是內部用語
3. 「不讓舊狀態留在紀錄裡」→「紀錄不會停在舊的狀態」：原句可能被讀成「把舊狀態刪掉」
4. 斷點 D 那一長句拆成兩句
5. `TourDay`「找出和自己記得的不一致的地方」→「找出和自己記憶不一致的地方」：連用兩個「的」，讀起來拗口

不採納：0 項。另外，我對照出處自己改了 7 處，避免誇大或用錯名詞：

- playbook 對應到「標準工單流程」，不叫「教戰手冊」；`/control-tower` 的教戰手冊另有所指
- 品質閘門情境原本寫「修完重新審查」，指南沒有這一步，已刪除
- 心跳原本寫「不會一直卡著其他塔台」，屬於推論，改成「其他塔台就知道它已經不在」
- 歸檔原本寫「只搬移、不刪除」，這是本專案的 local rule，改成指南寫的「需要時也能搬回來」
- 計畫單的狀態細節出自本專案 local rule，已刪除
- Debug 第一層原本寫「問題就不會悄悄回來」，改成「之後同一個地方再壞，測試會先抓到」
- `<dd>` 內的 Markdown 連結不會被渲染，已移除

### 去識別化與不使用的內容

- **改寫成虛構內容**：專案一律用 `demo-shop`，工單編號只用 `T1024`–`T1026`。
  - 情境 1 的「全新 SaaS，.NET 8 + React 18」改成「demo-shop 的新會員系統，技術選型已定」
  - 情境 2 的「709 個 C# 檔」改成「幾百個檔案」
  - 情境 5 的「8 CRITICAL + 8 HIGH」改成「兩個嚴重、三個高風險」，工單換成 T1025 / T1026
  - 情境 9 的「Redis pool」改成「連線池」，塔台 A / B 改成 demo-shop 的前台 / 付款服務
  - 情境 7 的「GPT」改成 Codex
- **指南 § 7 / § 9 沒有真實客戶或專案名稱**，以上都是技術細節的去具體化。
- **不使用**：
  - § 3、§ 4 安裝升級；§ 2 的版本號與版本時間軸；§ 12–§ 14 的速查表、命令與設定表
  - 外部工具名稱（ECC、mem0、bmad-guide、claude-mem），改寫成「hook 觀察工具」「BMad-Method 流程指引」「跨機器記憶服務」
  - 心跳的具體時間（2 小時）、連續失敗上限等設定的鍵名與值域、日誌行數上限的確切數字（改寫成「幾十行」）、信心度晉升的確切次數
  - 情境 3 / 4（緊急中斷 / 恢復）：與 W2d `/cases` 的 C3 重複，已由 `/control-tower#messy` 涵蓋，只連過去
  - 情境 8（mono-repo）：已在 `/control-tower` FAQ
  - 情境 10（視覺規範）：已在 `/control-tower#learning`
  - 指南 § 2.6 的面板警語原文、指令示意（含 helper 路徑）

### 給使用者的預覽指令

```bash
cd site
npm ci
npm run build
npx vitepress preview --port 4173
# 開 http://localhost:4173/better-agent-terminal/control-tower-tour
# 用完 Ctrl+C 結束
```

### 偏差與後續

- **nav / sidebar 兩者都做**（工單寫「擇一」），理由見上文。若只要其中一個，刪掉 `config.mts` 的 nav 下拉即可，sidebar 仍需保留。
- 狀態圖用了全部常用狀態（含 FIXED、PAUSED），沒有用設計語言 § 4 寫的「只有四種」：工單允許寫狀態名稱，而導覽頁要完整呈現狀態流轉。INTERRUPTED / URGENT 是內部訊號，沒有列出。
- 建議（不在本單範圍）：W2d `/cases` 建立後，導覽頁「規劃到一半有緊急事件」那一句可以再連到 `/cases` 的 C3。

### Commit

- 產品：`61ccfef1` feat(site): /control-tower-tour Control Tower feature tour page and nav (T0636)
- 工單：本次收尾 commit（只含本工單檔）
- 未 push、未改 GitHub 設定；`src/styles/settings.css` 的 M 沒有動。

### 互動紀錄

無（yolo，沒有向塔台提問）。
