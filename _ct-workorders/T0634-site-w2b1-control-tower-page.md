---
schema_version: 1
schema_kind: workorder
id: T0634
title: "PLAN-049 W2b-1：`/control-tower` 深入頁（含 CT 進階能力三節與 FAQ）＋首頁「越用越懂你的專案」段＋nav"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: L
created_at: "2026-10-18T14:02:46+0800"
started_at: "2026-10-18T14:03:37+0800"
updated_at: "2026-10-18T14:20:29+0800"
completed_at: "2026-10-18T14:20:29+0800"
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

### 結果摘要

**DONE**。`/control-tower` 14 節依工單順序完成；首頁「越用越懂你的專案」段加在「自動，但不失控」與「實績」之間並連到 `/control-tower#learning`；首頁第 79 行的 `TODO(W2b)` 換成連到 `/control-tower#division` 的真連結；nav 與 sidebar 加上「BAT × Control Tower」。build 0 錯誤、0 死連結、console 0、手機無整頁水平捲動、內容規則 grep = 0。未 push、未改 GitHub 設定、未觸發 workflow。

### 落點檢查（Landing Zone Check）

- C-0：PASS（frontmatter `repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`）
- C-1：PASS（工單在 REPO_ROOT 內）
- C-3：PASS（`site/index.md` 等存在）
- C-2：不適用（工單沒有 `branch` 欄位；目前在 `main`）
- `CT_HOME` 未設定（非隔離工單）；`CT_MODE=yolo`、`CT_INTERACTIVE=0`；`BAT_WORKSPACE_ID=cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄）

### 變更檔案（product commit `47b24606`）

| 檔案 | 內容 |
|---|---|
| `site/control-tower.md`（新） | 14 節深入頁，頁首 `<script setup>` 放各對照表的資料；h2 用固定英文錨點（`#what` `#division` `#tower-principles` `#lifecycle` `#autonomy` `#questions` `#messy` `#parallel` `#visibility` `#permissions` `#agents` `#learning` `#integration` `#faq`）；每節開頭一句 `{.ct-lead}` 摘要 |
| `site/index.md` | 新段 `home-learning`（`FeatureGrid set="learning"` + `GrowthLadder` + 連結）；對照表下方加「看塔台、Worker 與 BAT 怎麼分工」連結，移除該處 `TODO(W2b)` |
| `site/.vitepress/config.mts` | nav 加 `BAT × Control Tower`；sidebar 加群組「BAT × Control Tower → 分工與流程」；`/cases` 以 `TODO(W2d)` 註解留位；`/features`、`/remote/`、`/faq`、`/contribute` 的 TODO 不動 |
| `site/.vitepress/theme/components/CardTable.vue`（新） | 文件頁對照表：桌面為表格，≤ 639 px 改為一列一張卡（標籤與值左右並排），支援強調列 |
| `.../components/TicketLife.vue`（新） | 一張工單的一生（對齊 → 開單 → 派工 → 執行 → 提問 → 回報 → 驗收 → 回收 → 合併），每步「示意圖 + 發生什麼 + 你要做的事」 |
| `.../components/QuestionFlow.vue`（新） | Worker → 塔台 → 代答／轉給你的流程圖，下方為工單通道後備 |
| `.../components/GrowthLadder.vue`（新） | 觀察 → 已驗證 → 標準流程 → 技能；桌面橫向、手機直向、靜態；`detailed` 顯示長文 |
| `.../components/StoryIllo.vue` | 新增 `align` / `workorder` / `running` / `report` / `recycle` 五種示意（含 `aria-label` 文字等價）；原有七種未改 |
| `.../components/FeatureGrid.vue` | 加 `set` prop（`standalone` 預設，首頁原段落輸出不變／`learning`／`messy`）與 `note` 註腳 |
| `.../theme/index.ts` | 註冊 `CardTable`、`GrowthLadder`、`QuestionFlow`、`StoryIllo`、`TicketLife` |
| `.../theme/custom.css` | 新 token `--bat-you`（「你要做的事」藍：淺色 `#0369a1`、深色 `#38bdf8`）；新元件樣式；首頁元件放進 `.vp-doc` 時擋掉 VitePress 文件預設的段落／清單／標題樣式 |

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| `npm ci` | ⚠️ 未能執行 | `EPERM unlink site/node_modules/@esbuild/win32-x64/esbuild.exe`：一個不是本單啟動的 `vitepress preview --port 4173`（node PID 3864，esbuild PID 32836）鎖住檔案。我沒有結束別人的程序，改用 `npm install --no-save` 依 lockfile 補回；`git status` 確認 `site/package.json` / `package-lock.json` 未變更 |
| `npm run build` | PASS | `build complete`，0 錯誤；VitePress 預設檢查死連結（有死連結時 build 會失敗）→ 0 死連結 |
| console | PASS | `/control-tower`（桌面深色）、首頁（手機淺色＋reduced-motion、桌面深色）error / warn 皆 0 |
| 手機無水平捲動 | PASS | 390 × 844：`/control-tower` 與首頁 `scrollWidth = 390`；`/control-tower` 逐元素檢查無超出視窗的元素 |
| reduced-motion | PASS | `prefers-reduced-motion: reduce` 下首頁 `document.getAnimations()` 執行中 = 0；新元件本身沒有動畫 |
| 內容規則 grep（`site/` 的 `index.md`、`control-tower.md`、`config.mts`、`theme/**`） | PASS = 0 | `T0\d{3}`、`D1\d{2}`、`BUG-\d+`、`PLAN-\d+`、`_ct-workorders`、`CLAUDE.md` = 0；CT skill 名稱、`ct-exec` 等、`FIELDGUIDE`、`DESIGN.md`、`skill`、CT 版本號（`v3.x`–`v5.x`）、CT 資料路徑、星號指令、`/btw`、「違憲」「教壞」「插件」= 0；權杖／使用者路徑 = 0。唯一命中是頁面網址 `/control-tower` 本身（工單指定的路由、出現在連結與 3 行原始碼註解），不是 CT skill 名稱 |
| F16 / C4 只在 FAQ | PASS | 「被慣壞」只出現在 `#faq`「塔台被慣壞了怎麼辦？」；`/cases` 未建立、首頁未提 |
| Lighthouse（選用） | 未執行 | 選用項目，略過 |

截圖（`e2e-results/site-v2b/`，不入版控；完整頁截圖涵蓋全部 14 個 h2）：

- `ct-desktop-1440-light-full.png`、`ct-desktop-1440-dark-full.png`、`ct-mobile-390-light-full.png`、`ct-mobile-390-dark-full.png`
- `ct-desktop-light-02-division.png`（機場比喻表）
- `home-learning-desktop-1440-light.png`、`home-learning-desktop-1440-dark.png`、`home-learning-mobile-390-light.png`、`home-learning-mobile-390-dark.png`、`home-ladder-mobile-390-dark.png`

### 主張 → 出處

| 主張（網站文案） | 出處 |
|---|---|
| 派工落在塔台所在的工作區、帶工作區的 Agent 與啟動參數、目錄不符時提醒 | README「BAT 提供的整合點」；`docs/agent-guide/logging.md`（塔台派工落點）、`workspace-agent-launch.md` |
| 沒指定 Agent：工作區 → 設定 → Claude Code | `docs/agent-guide/workspace-agent-launch.md`（查找順序）；`src/lib/agent-launch-settings.ts` |
| 啟動確認：Claude CLI、Codex CLI 0.163.0 以上；其他無法確認 | `docs/agent-guide/worker-launch-confirmation.md` |
| 等人回答偵測：Claude CLI（權限確認、提問、MCP 表單）、Codex CLI 0.163.0 以上；其他偵測不到 | `docs/agent-guide/blocked-state.md` |
| 完成通知預填／yolo 自動送出 | README「BAT 提供的整合點」（`bat-notify.mjs`：toast、徽章、預填、`--submit`） |
| 回收等輸出安靜才關、使用者輸入取消；塔台只能關自己派出的 | `docs/agent-guide/worker-tab-recycle.md` |
| 右鍵「關閉已回報的 Worker 分頁」只關 ✓ | README「Worker 縮圖狀態」；`src/locales/zh-TW.json` `workerTabs.closeReported`；`src/lib/terminal-attention.ts` |
| 縮圖 ⚠️ > ? > ✓ 優先序 | `docs/design/site-design-language.md` § 3；`workerAttention` |
| 分頁標題格式、使用者改名不覆蓋 | `docs/agent-guide/tower-tab-title.md`；`src/lib/external-terminal-title.ts` |
| worktree 隔離：repo 旁的獨立 worktree、分支 `ct/T####`、BAT 不合併不裝相依；保留（預設）／移除（不加 force、髒的不刪、分支保留）／封存（改名 `ct-archive/`） | `docs/agent-guide/worktree-isolated-dispatch.md` |
| 合併前狀態：領先／落後、未提交、改動檔案、範圍外檔案、衝突；分頁關閉後仍可查；唯讀 | `docs/agent-guide/worktree-status.md` |
| 唯讀 MCP 8 個工具、讀輸出遮罩、設定 → 進階可關 | README「BAT MCP」；`docs/agent-guide/bat-mcp-shim.md`、`helper-query-channels.md` |
| 權限表：塔台派工／關自己的 Worker／宣告塔台／答覆問自己的問題；Worker 回報、提問、輸入只送進綁定的塔台；Worker 只看得到塔台狀態看不到輸出；預設拒絕；伺服器權杖不進分頁；分頁結束權杖失效 | `electron/remote/helper-capability.ts`（`HELPER_CHANNEL_ROLES`、`authorizeHelperQueryTarget`）；`docs/agent-guide/remote-tower-notify.md`、`helper-query-channels.md` |
| 塔台要在一般分頁啟動 | README「BAT 提供的整合點」（每分頁權限列） |
| 權限只管 BAT 功能、不管塔台讀不讀程式碼 | 提案稿 F9 / F16 分工欄；`HELPER_CHANNEL_ROLES` 只涵蓋 BAT channel |
| 問答只存在記憶體、遮罩、日誌只記長度與結果；使用者輸入不取消問題；BAT 重開後問題消失（`lost`） | `docs/agent-guide/tower-questions.md` |
| BAT 重開時 Terminal Server 仍在可選擇保留分頁 | `docs/agent-guide/recovery-create-hold.md` |
| 用量限制：Codex 自動續行、Claude CLI 自行續行、預設關閉 | README「AI Agent 整合」；`docs/agent-guide/usage-limit-continue.md` |
| 遠端 WSL / SSH / Docker 同一套 helper、每分頁權杖 | README「BAT 提供的整合點」（遠端列）；`docs/agent-guide/remote-tower-notify.md` |
| 新功能兩邊版本都到位才啟用 | README「版本對照」 |
| 側欄工單看板、Sprint 進度、一鍵執行 | README「Control Tower 整合」 |
| F1–F16 的 CT 行為（規則記憶、成長管線、升級不覆蓋、規則搬家、互動探索、教戰手冊、視覺規範、分工原則、問題路由、暫停／恢復、熔斷預設三次、一層一張工單、先寫契約、子專案、被慣壞） | `_spec-site-v2-ct-features-cases.md` § 2（D165 APPROVED；出處欄未上站） |
| 這個網站的設計語言從 BAT 程式碼抽出 | `docs/design/site-design-language.md` 檔頭（提案稿 R3） |

### 文案校稿（`bmad-editorial-review-prose`）

全部採納，無不採納項：

| 原文 | 改為 | 理由 |
|---|---|---|
| 接著換建置流程失敗。 | 接著建置流程也失敗了。 | 語意不通 |
| 同一個問題試了三種方法還沒解決（預設三次） | 同一個問題換了三種做法還沒解決（次數可以調整，預設三次） | 「三種方法」與「三次」並列易誤讀 |
| 只要背景的終端伺服器還在執行 | 只要背景的 Terminal Server 還在執行 | 與 App 介面用語一致 |
| …安裝相依套件；這兩件事由工單決定怎麼做。 | …安裝相依套件：合併由塔台安排，相依套件由 Worker 依專案的說明安裝。 | 「由工單決定」指涉不明 |
| Claude CLI 與 Codex 分頁 | Claude CLI 與 Codex CLI 分頁 | 名稱一致 |
| BAT 都能知道， | BAT 都能知道（支援範圍見下表）， | 「都能」與下表限制衝突 |

### 與規格／提案稿的差異

1. **節次**：依工單「要做的事」1–14 的順序（主規格 § 5 的 12 點加 D165 三節），不是主規格 § 5 原編號。
2. **自主程度**：沒有沿用互動式 `AutonomyDial`，改用靜態對照表（off / ask / on / yolo × 塔台／你／Worker 有問題時）。理由：3 分鐘閱讀層要一次看完四檔，而且主規格 § 5.4 寫的是「對照表」；表內文字沿用 `AutonomyDial` 的說法以保持一致。首頁的 `AutonomyDial` 不動。
3. **「現實比計劃更混亂時」**的四張卡用 `FeatureGrid` 加 `set` prop 實作，沒有另做元件；`/cases` 連結以 `<!-- TODO(W2d) -->`（`control-tower.md` 與 `FeatureGrid.vue` 各一處）留位。
4. **GrowthLadder**：紫色只在「觀察」節點（塔台記下）；「標準流程」「技能」兩格標「你決定」，用 `--bat-you` 藍框，與「一張工單的一生」的「你要做的事」框同一個語意（紫 = 塔台、藍 = 你、中性 = Worker）。`--bat-you` 是新 token，設計語言檔（`docs/`，不在本單範圍）尚未記載，建議下次更新設計語言時補上。
5. **首頁連結**：除了工單指定的 `#division` 連結，首頁新段尾連到 `#learning`。
6. **F3 / F11 依 ⚠️ 改寫**：F3 只寫「分開存放、升級不覆蓋、優先於預設」，不寫層級與路徑；F11 寫暫停／恢復概念，BAT 的保留分頁寫成「可以選擇保留」並寫出前提（Terminal Server 仍在執行）。F17 未使用。
7. **FAQ「沒有 Control Tower 能用 BAT 嗎」**：`/features` 還沒建立，以 `<!-- TODO(W2b) -->` 留位。
8. **網址 `/control-tower`**：頁面路由與 CT 的 skill 名稱同形；這是工單指定的路由，只出現在網址、連結與原始碼註解，頁面可見文字沒有斜線開頭的 skill 名稱。

### frontend-design 自評

- **字體**：沿用 T0630 的 Chiron Hei HK（h1 / h2 / 步驟名 / 成長管線階段名）＋ Noto Sans TC 內文＋ Martian Mono（只用在步驟編號、工單編號與終端示意）。沒有新增字型。
- **色彩**：延續錨點 A1（紫 = 塔台）；新增一個語意色「你」= 藍，對應 Stepper 的 `awaiting-input`（中性等待）。淺色模式的藍降到 `#0369a1` 以達 AA；終端示意維持 App 的深色。
- **版面節奏**：文件頁保留 VitePress 的側欄與頁內目錄（h2 / h3）。最突出的是「一張工單的一生」那條帶編號的軌道（內容真的是九步序列），其餘區塊都收斂成細線表格與純文字。
- **不夠好的地方**：
  - 頁面很長。「一張工單的一生」九張示意圖占了大部分；可以考慮預設只展開前三步，或改成可切換的步驟器。
  - 「做什麼問塔台」與機場比喻兩張表的視覺重量跟其他表一樣，強調不足。
  - 手機上「Worker 問塔台」流程圖的兩個分支改成上下堆疊後，看不出是二選一，只能靠標題文字分辨。
  - `StoryIllo` 的 `checklist` 示意（T0630 原件）在手機上等寬字會折行，對齊跑掉；本單沒有改它。
  - 示意圖是靜態 HTML，沒有真實截圖（W3 範圍）。

### 給使用者的預覽指令

```bash
cd site
npm run dev                 # 開發伺服器，開 http://localhost:5173/better-agent-terminal/control-tower
# 或看正式 build 的結果：
npm run build && npx vitepress preview --port 4188
```

⚠️ 本機有一個不是本單啟動的 `vitepress preview --port 4173` 還在跑（node PID 3864）。它啟動後才 build 的新檔案它讀不到（sirv 只在啟動時讀一次 dist），看 4173 可能會看到沒有樣式的頁面；它也鎖住 `esbuild.exe`，讓 `npm ci` 失敗。若沒有在用，建議先結束它再 `npm ci`。

### Commit

- product：`47b24606`（`feat(site): /control-tower deep-dive page, home learning section and nav (T0634)`），只含 `site/` 下 11 個檔案
- 工單：另一個 commit（本檔）
- 未 push；`src/styles/settings.css` 的既有修改未碰

### 互動紀錄

無（yolo，未向塔台提問）。
