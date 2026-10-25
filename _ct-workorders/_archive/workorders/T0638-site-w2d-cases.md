---
schema_version: 1
schema_kind: workorder
id: T0638
title: "PLAN-049 W2d：「實戰案例」頁（`/cases`）——3 個去識別化情境案例 + 「BAT 自己就是這樣開發的」3 個真實案例"
type: feature
status: DONE
repo: better-agent-terminal
project: PLAN-049
priority: P2
sizing: M
created_at: "2026-10-18T15:32:42+0800"
started_at: "2026-10-18T15:34:14+0800"
updated_at: "2026-10-18T15:45:07+0800"
completed_at: "2026-10-18T15:45:07+0800"
depends_on: [T0636]
related:
  - "D165（`/cases` 範圍與 R1 數字寫法，使用者決定）；D159（CT 不開源、不提供取得管道）；D164（視覺方向）；D166（CT 公開程度）"
  - "主要來源：`_ct-workorders/_spec-site-v2-ct-features-cases.md` § 3（C1–C3、R1–R3 已審過的文案與隱私判斷）、§ 4.1（`/cases` 版面與元件）、§ 7（上站前檢查）"
  - "主規格：`_ct-workorders/_spec-site-v2-bat-ct-story.md` § 6、§ 8；設計語言 `docs/design/site-design-language.md`"
affects_files:
  - "site/cases.md（新）"
  - "site/.vitepress/config.mts（nav / sidebar：換掉兩處 `TODO(W2d)`）"
  - "site/.vitepress/theme/**（`CaseCard` 新元件、R1 的 SVG 與樣式）"
  - "site/control-tower.md（只把 `TODO(W2d)` 註解處的四段改成連到 `/cases` 對應案例）"
  - "site/control-tower-tour.md（選做：「使用情境」節尾加一句連到 `/cases`）"
  - _ct-workorders/T0638-site-w2d-cases.md
renew_count: 0
workdir: main repo
worker_question_timeout: 30
interaction:
  mode_hint: yolo
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 開工第一步載入 **`frontend-design`** skill（名稱以 skill 清單為準）；清單裡沒有 → `BLOCKED` 回報。另用 `bmad-editorial-review-prose`（文案校稿）。"
  - "🔴 **內容範圍（D165，使用者決定）**：C1「合併之後，問題一層一層冒出來」、C2「兩個服務，同一個欄位」、C3「規劃到一半，正式站出事」；R1「BAT 定介面契約，CT 依契約撰寫」、R2「一句話變成塔台的原則」、R3「這個網站的設計語言，就是從 BAT 的程式碼抽出來的」。**C4（塔台被慣壞）不放本頁**。R1 **不寫**「CT 新版由 BAT 塔台實機驗收」或任何同義說法。"
  - "🔴 **R1 的數字**：寫「約 20 次」並標「截至 2026 年 10 月」。開工時重數一次本 repo 工單目錄（含 `_archive/`）中不同的 `CT-T###` 委派單編號（唯讀）；結果在 15–24 之間就照寫「約 20 次」，超出範圍 → 在工單提問（不得自行改寫數字）。「10 項功能」以 README「與 BMad Control Tower 協作」的版本對照表實際列數為準；列數不是 10 → 寫實際列數並在回報區說明。"
  - "🔴 **CT 字樣規則（D159 / D165 / D166）**：網站不得出現 CT 文件名、CT 版本號、星號 / 斜線 / 錢字號開頭的指令、skill 名稱、CT 資料路徑、取得管道、委派單編號、CT 的 repo 名稱、規則或決策編號。提案稿的「出處」欄只供內部核對，上站時整欄刪除。案例只用虛構專案 `demo-shop` 與 `T1024` 以後的虛構工單編號；不得出現任何真實客戶、學員、公司、產品或服務名稱。"
  - "🔴 不得誇大、不得與 BAT 的真實行為衝突：凡寫到 BAT 的部分，對得上 README 或 `docs/agent-guide/`；回報區附「主張 → 出處」。"
  - "🔴 **Worker 不 push、不改 GitHub 設定**；只改 `affects_files`；不新增 npm 依賴；`site/` 內 grep `T0\\d{3}`、`D1\\d{2}`、`BUG-\\d+`、`PLAN-\\d+`、`_ct-workorders`、`CLAUDE.md` = 0（include 原文除外）；不放權杖、使用者路徑、帳號。"
  - "🔴 **預覽伺服器**（L164）：不要用背景 shell 跑 `vitepress preview` 再靠結束 shell 收尾（Windows 上 node / esbuild 子程序會殘留並鎖住 `site/node_modules`）。改用 `e2e-results/site-preview/serve.mjs` 服務 `dist` 的複本，用完以埠查 PID 結束；回報寫明已無殘留程序。"
  - "🔴 非隔離工單。另一張工單 T0637（codex 探針）可能同時進行，它只改自己的工單檔，不碰。`src/styles/settings.css` 的 M 不是你的變更，不碰。commit 用 `git commit --only <檔案>`。禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF；含反斜線的內容用 Write / Edit（L129）。"
---

# T0638 — 「實戰案例」頁（`/cases`）

## 目標

PLAN-049 網站 v2 的 W2d。首頁講「一個早上」，`/control-tower` 講分工與流程，`/control-tower-tour` 講 CT 本身；本頁用 6 個案例讓讀者看到「其他早上」：現實比計劃更混亂時，塔台與 Worker 怎麼接住。

## 頁面結構（依提案稿 § 4.1，可依內容調整並在回報說明）

1. **導語**：一兩句說明本頁是什麼（情境案例為虛構的 `demo-shop`；後半是 BAT 自己的開發紀錄）
2. **情境案例** C1–C3：每個案例用 `CaseCard`（案例標題、情境標籤、出處面向：CT / BAT / 搭配）包住，內容沿用 `StoryChapter` 的兩欄（左「以前」、右「BAT + CT」）＋分工標籤；文案以提案稿 § 3.1 為底，可微調語氣但不改事實
3. **BAT 自己就是這樣開發的** R1–R3：R1 加一張 SVG 小圖（BAT 定契約 → 委派 → CT 照契約 → 版本對照表），沿用 A 的雷達線條語彙但維持淺色；R3 刻意比其他案例短
4. 頁尾連回 `/control-tower`、`/control-tower-tour`

## 其他要做的事

- `config.mts`：nav 在「BAT × Control Tower」之後加「實戰案例」→ `/cases`；sidebar 換掉 `TODO(W2d)`；兩處 `TODO(W2d)` 註解都移除
- `site/control-tower.md`：`TODO(W2d)` 那四段（現實比計劃更混亂時）各連到 `/cases` 的對應案例（錨點），移除該註解；沒有對應案例的段落不連，回報說明
- （選做）`site/control-tower-tour.md`「使用情境」節尾加一句連到 `/cases`；導覽頁的情境與本頁不得重複
- 視覺沿用 D164（A 的字體與色彩語意：紫 = 塔台、藍 = 你、中性 = Worker）與既有元件；新元件只有 `CaseCard`（必要時再加）

## 驗證

- `bmad-editorial-review-prose` 審 `/cases`；採納 / 不採納列在回報區
- `site/` 內 `npm ci` + `npm run build`：0 錯誤、0 死連結；console 0；手機無整頁水平捲動；reduced-motion 下無動畫
- **CT 字樣 grep = 0**（網站自己的路由 `/control-tower`、`/control-tower-tour` 除外）＋既有的內部編號 grep；案例內不得出現真實名稱
- 截圖存 `e2e-results/site-w2d/`（不入版控）：`/cases` 桌面 1440 / 手機 390 × 淺 / 深色（每個 h2 至少一張）；`/control-tower` 的新連結各一張
- 預覽伺服器用完已結束（L164）

## 驗收

- `/cases` 6 個案例完成，nav / sidebar / `/control-tower` 都連得到
- 範圍符合 D165（無 C4、R1 無「代跑驗收」）；CT 字樣 grep = 0；案例全部去識別化
- build 0 錯誤、0 死連結；console 0；手機無水平捲動
- 回報區附：截圖清單、「主張 → 出處」、R1 委派單重數結果、文案校稿採納清單、給使用者的預覽指令
- 未 push、未改 GitHub 設定；本機沒有殘留的預覽伺服器

---

## 回報區

### 結果摘要

**DONE**。`/cases` 完成：3 個情境案例（C1 合併後問題一層層冒出來、C2 兩個服務同一個欄位、C3 規劃到一半正式站出事），加上「BAT 自己就是這樣開發的」3 個真實案例（R1 契約交接附 SVG 圖、R2 一句話變成塔台的原則、R3 網站設計語言，R3 刻意寫得較短）。nav、sidebar、`/control-tower` 都已連到這一頁；`/control-tower-tour`「使用情境」節尾的選做連結也加上了。範圍符合 D165：沒有 C4，R1 沒有「代跑驗收」或同義說法。

### 落點檢查

- C-0 PASS：`repo` = `better-agent-terminal`，`basename(REPO_ROOT)` = `better-agent-terminal`（REPO_ROOT = `D:/ForgejoGit/@Gower_Labs/BMad-Guide/better-agent-terminal/better-agent-terminal`）
- C-1 PASS；C-3 PASS（`site/.vitepress/config.mts` 等已存在）；C-2 不適用（工單沒有 `branch` 欄位），目前分支 `main`
- 非隔離工單（未設 `CT_HOME`）；`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（只記錄，不比對）
- 開工第一步已載入 `frontend-design:frontend-design` skill

### 變更檔案

- `site/cases.md`（新）：頁面本體
- `site/.vitepress/theme/components/CaseCard.vue`（新）：標題（h3，帶 id 與 header-anchor，所以會出現在本頁目錄）、情境標籤、「誰出力」標示；有 `before` 插槽時用故事章節的兩欄（「以前」／「BAT + CT」）、`result` 結果列、分工標籤；沒有 `before` 時用單欄內文，`figure` 插槽放在內文旁邊；`brief` 是給 R3 的精簡版
- `site/.vitepress/theme/components/ContractFlow.vue`（新）：R1 的 SVG 圖。BAT 的塔台 → 委派單 → 介面契約 → Control Tower 的塔台 → 版本對照表。兩個塔台用雷達的同心圓與十字線，維持淺色並跟著深淺色切換；紫色只用在兩個塔台的圓點和「委派單」那一段（A1）；靜態；`figcaption` 有文字說明（sr-only）
- `site/.vitepress/theme/custom.css`：新增「/cases 實戰案例」一節（放在 reduced motion 那節之前）
- `site/.vitepress/theme/index.ts`：註冊 `CaseCard`、`ContractFlow`
- `site/.vitepress/config.mts`：nav 在「BAT × Control Tower」之後加「實戰案例」；sidebar 的「BAT × Control Tower」組加一項；兩處 `TODO(W2d)` 已移除
- `site/.vitepress/theme/components/FeatureGrid.vue`：`messy` 組三格加 `link` 連到案例錨點；`TODO(W2d)` 註解改成說明（「卡住就停」沒有對應案例，所以不連）
- `site/control-tower.md`：移除 `TODO(W2d)` 註解，在「就算 BAT 重開……」那段後面加一句連到 `/cases`
- `site/control-tower-tour.md`（選做）：「使用情境」節尾加一句連到 `/cases`。導覽頁的四個情境（新專案、舊專案、審查、換 Agent）和本頁的情境沒有重複

### `/control-tower` 四段的連結

| 卡片 | 連到 |
|---|---|
| 臨時插隊，原本的工作不會丟 | `/cases#urgent-fix`（C3） |
| 卡住就停，帶著整理好的紀錄回來 | **不連**：D165 範圍內沒有熔斷的案例 |
| 問題一層一層冒出來時，一層一張工單 | `/cases#merge-layers`（C1） |
| 兩邊都要改時，先寫契約，不要照抄 | `/cases#shared-field`（C2；R1 內文再連回 C2） |

卡片標題的連結和首頁「不用 Control Tower，BAT 也好用」用同一種寫法（`FeatureGrid` 的 `link`）。另外在網格下方加了一句總連結，讓讀者知道這些卡片背後有完整的案例。

### 頁面結構與設計決定（相對於工單的調整）

- 結構照工單：導語 → `## 情境案例` → `## BAT 自己就是這樣開發的` → 頁尾一段連回 `/control-tower`、`/control-tower-tour`（用既有的 `.ct-note` 樣式，沒有另開 h2）
- **沒有直接重用 `StoryChapter`**：它是 `<li>`，必須包在 `StoryTimeline` 裡，`illo` 也是必填（只有故事用的插圖種類）。`CaseCard` 改用同一組 class（`story-pair`、`story-card is-before / is-after`、`story-roles`），外觀和首頁故事一致，又不需要時間軸
- 案例之間不做成卡片框，而是每個案例上方一條 2 px 粗線，和 `/control-tower` 的 `ct-concepts` 同一套語彙；R3 用 1 px 細線、較小的標題，看得出是附註
- 「誰出力」：一開始用紫色文字，截圖後發現看起來像連結，改成中性色文字加圓點（實心紫 = Control Tower、空心 = BAT、搭配兩個都有）。A1 規定紫色文字留給連結
- R1 的圖原本寬 260 px，SVG 文字縮到大約 11 px；改成 300 px，以 1:1 顯示。手機版圖放在內文下方
- 情境導語原本寫「左邊是以前、右邊是 BAT + CT」，但手機版是上下排列，改成直接引用欄位名稱

### R1 委派單重數（唯讀，2026-10-18）

- 檔名：工單目錄含 `_archive/` 共有 **20** 個不同的 `CT-T###`（`CT-T001`–`CT-T020`；`CT-T001`–`CT-T010` 在 `_archive/workorders/`，`CT-T011`–`CT-T020` 在根目錄）。檔案內容另外出現 `CT-T021`，但只在 `_tower-state.md` 的「下一個編號」欄位裡，那張委派單還沒建立
- 20 在 15–24 之間 → 照寫「約 20 次」，並標「截至 2026 年 10 月」。最早一張 `CT-T001` 的 `created_at` 是 2026-04-17，所以「從 2026 年 4 月起」有根據
- **「10 項功能」→ 改寫成實際列數 11**：README「版本對照」表目前有 **11** 列（T0633 數的時候是 10 列，之後多了 Codex OSC 那一列）。其中 2 列（唯讀查詢 MCP、Worker 縮圖）的 CT 欄是「不需要」，所以不能寫成「11 項需要兩邊配合」。網站寫的是「[版本對照表](./compatibility)列了 11 項整合功能各自需要的版本」。版本對照表本身已經說明「新功能要兩邊的版本都到位」

### 主張 → 出處（只供內部核對，不上站）

| 頁面主張 | 出處 |
|---|---|
| C1：先盤點、分四類開單、換一層就回報部分完成並另開；本機能驗證的先做完 | 提案 § 3.1 C1、F13（CT）；「部分完成」通知 = `bat-notify` 的 `T#### 部分完成`（README「BAT 提供的整合點」Worker 回報） |
| C1：每張新工單一個新分頁 | README「協作流程」（派工開 Worker 分頁）；`docs/agent-guide/logging.md`「塔台派工落點」 |
| C2：先寫契約、兩邊各自實作、最後比對 | 提案 § 3.1 C2、F14（CT） |
| C3：暫停 → 優先工單 → 接回；進度在檔案裡 | 提案 § 3.1 C3、F11（v5 暫停 / 恢復概念，沒有寫語法） |
| C3：已在執行的 Worker 分頁照常做事 | Worker 是獨立的 PTY 分頁，塔台暫停規劃不影響它們（README「協作流程」）；沒有寫 BAT 重開後一定保留 |
| R1：兩個專案、兩個塔台；BAT 定介面契約（參數、結束代碼、環境變數、回傳欄位），CT 只看結束代碼判斷成敗 | README「與 BMad Control Tower 協作」第 2 段 |
| R1：兩邊版本都到位才啟用，任一邊較舊時其餘流程照舊 | README「版本對照」region 第一句（`/compatibility` include 同一段） |
| R1：例如 Worker 問塔台 | README 版本對照「Worker 問塔台」列；`docs/agent-guide/tower-questions.md` |
| R1：約 20 次、截至 2026 年 10 月；11 項 | 上面的重數結果 |
| R2：自動產生的版本說明只有一行；漏寫兩次；一句「加入塔台原則，每次發布都要加」；升級成規則，包含格式、來源、收尾檢查 | `_local-rules.md`「更版重點（Release notes）必寫」（原文引用使用者的話、`generate_release_notes` 一行、v0.6.0-pre.8 與 v0.6.1-pre.2 兩次漏寫、格式 / 來源 / 收尾檢查各一條） |
| R2：從那以後每一版都在建置完成後補上 | 同一條規則的「CI 跑完立刻補上」；`release-note.md` v0.7.0-pre.2–pre.9 每一版都有更版重點 |
| R3：Worker 用 CT 的視覺規範擷取掃描 BAT UI 程式碼，抽出品牌紫、⚠️ / ? / ✓、分頁標題格式，每個值附出處 | `docs/design/site-design-language.md` 檔頭（擷取方式）與 § 0 錨點 A1–A3 |

沒有寫的內容：C4（D165）、R1 的「代跑驗收」（D165 Q6）、委派單編號、CT 的 repo 名稱、CT 文件名 / 版本號 / 指令 / skill 名稱、對方塔台的工單、提案稿「出處」欄（整欄沒有上站）。

### 文案校稿（`bmad-editorial-review-prose`，`site/cases.md`）

| 原文 | 修訂 | 採納 |
|---|---|---|
| 這一頁是其他的早上 | 這一頁講其他的早上 | ✅（主詞和述語搭不起來） |
| C3 的「計畫」兩處 / 導語的「計劃」 | 一律用「計劃」 | ✅（同頁用字不一致；全站既有標題「現實比計劃更混亂時」用的是「計劃」） |
| 每次要加整合功能，例如 Worker 問塔台，BAT 先把… | 每次要加整合功能（例如 Worker 問塔台），BAT 先把… | ✅（插入語把主句切斷） |
| 這件事被記成一條觀察 | 塔台把這件事記成一條觀察 | ✅（被動句沒寫出是誰記的） |
| 先用 Control Tower 的視覺規範擷取，掃描… | 先用 Control Tower 的視覺規範擷取功能，掃描… | ✅（「擷取」單獨當名詞容易被讀成動詞） |

校稿前我自己也改了兩處：C3「以前」那欄的原文是「你正和塔台排工單」，但「以前」那欄的情境裡還沒有塔台，改成「你正和 Agent 討論折扣碼的做法」，塔台的部分移到右欄；情境導語的「左邊 / 右邊」改成欄位名稱（手機版是上下排列）。

### 驗證

| 項目 | 結果 | 證據 |
|---|---|---|
| `site/` `npm ci` + `npm run build` | PASS | `build complete in 2.58s.`，0 錯誤；VitePress 預設遇到死連結就會失敗，build 通過 = 0 死連結（markdown 連結 `./compatibility`、`./control-tower#learning`、`#shared-field`、`./cases`） |
| 元件內的連結（build 不會檢查） | PASS | Playwright 開 `/cases#urgent-fix`、`#merge-layers`、`#shared-field`，三個錨點都捲到對應案例（距離頂端 < 200 px）；`/control-tower` 的 messy 網格三個 href 正確 |
| console | PASS | 1440 / 390 × 淺 / 深色共 4 種組合，開過 `/cases` 和 `/control-tower`，error / warning / pageerror 都是 0 |
| 手機無整頁水平捲動 | PASS | 4 種組合 `scrollWidth == clientWidth`（1440 / 390），`.vp-doc` 內沒有元素超出右緣 |
| reduced-motion | PASS | `reducedMotion: reduce` 捲到底後，`document.getAnimations().length` = 0（本頁沒有動畫） |
| nav / sidebar | PASS | 桌面 nav：…「Control Tower 功能導覽」、**「實戰案例」**、「版本對照」…；4 種組合的 sidebar 都有「實戰案例」；本頁目錄列出 2 個 h2 + 6 個案例 |
| 內部編號 grep（`site/`，排除 node_modules / dist / cache） | PASS = 0 | `T0\d{3}`、`D1\d{2}`、`BUG-\d+`、`PLAN-\d+`、`_ct-workorders`、`CLAUDE.md` |
| CT 字樣 grep（本單改過的 7 個檔案，網站路由 `/control-tower`、`/control-tower-tour` 除外） | PASS = 0 | 星號 / 斜線 / 錢字號開頭的指令、`ct-` 開頭的 skill 名稱、`bmad-guide`、`FIELDGUIDE`、`DESIGN.md`、`playbook`、`v[3-5]\.[0-9]`、`CT-T\d`、塔台狀態 / local rules / 決策紀錄的檔名樣式、`.claude`、`skills/`、`~/`、`L1\d{2}`。只有 `control-tower-tour.md` 107–110 行命中，那是既有的 markdown 粗體 `**off**`，是 regex 誤判，不是指令 |
| 取得管道 / skill 字樣（`cases.md` + 2 個新元件） | PASS = 0 | `skill`、`取得`、`下載`、`聯絡`、`安裝`、`委派單編號` |
| 去識別化 | PASS | 案例只用 `demo-shop`；欄位名稱 `createdAt` / `placedAt` / `placedTimestamp` 都是通用名稱；沒有真實客戶、學員、公司、產品或服務名稱；沒有用工單編號 |
| 權杖 / 使用者路徑 / 帳號 grep | PASS = 0 | `batcap.`、`BAT_REMOTE_TOKEN=`、`C:\Users`、`/Users/`、email、帳號名稱 |
| 預覽伺服器（L164） | 已結束 | 用 `e2e-results/site-preview/serve.mjs` 服務 dist 的複本（`e2e-results/site-preview/better-agent-terminal/`，已換成本次 build），用完以 port 4173 查到 PID 32780 並結束；之後 port 4173 沒有 listener，`vitepress` / `esbuild` / `serve.mjs` 行程數 = 0。沒有跑 `vitepress preview` |

### 截圖清單（`e2e-results/site-w2d/`，不入版控，共 42 張）

- `/cases` 每個 h2 與每個案例各一張 × 桌面 1440 / 手機 390 × 淺 / 深色：`cases-{desktop-1440,mobile-390}-{light,dark}-{scenarios,merge-layers,shared-field,urgent-fix,bat-itself,contract,one-sentence-rule,design-language}.png`（32 張）
- `/cases` 整頁：`cases-{desktop-1440,mobile-390}-{light,dark}-full.png`（4 張）
- `/control-tower` 的新連結：`control-tower-{desktop-1440,mobile-390}-{light,dark}-messy.png`（4 張）；桌面 nav：`control-tower-desktop-1440-{light,dark}-nav.png`（2 張）
- 截圖腳本放在 scratchpad（`shots.cjs`），沒有進 repo。root 的 playwright 1.59.1 要的瀏覽器版本（1217）沒有安裝，所以用 `executablePath` 指到已安裝的 chromium headless shell 1243

### 給使用者的預覽指令

```bash
cd site
npm ci
npm run build
npx vitepress preview --port 4173
# 開 http://localhost:4173/better-agent-terminal/cases
# 用完 Ctrl+C 結束（Windows 上若有殘留：用 port 4173 查 PID 再結束）
```

### 偏差與後續

- **「10 項功能」改成 11 項**，而且沒有寫「需要兩邊配合」，原因見「R1 委派單重數」。
- **`StoryChapter` 沒有直接重用**，改用它的 class，原因見「頁面結構與設計決定」。
- **R1 標題**寫「Control Tower 依契約撰寫」，沒有用簡寫「CT」，和頁面內文一致。分工標籤照首頁慣例仍用 `CT`。
- 建議（不在本單範圍）：README 版本對照表新增一列時，R1 的「11 項」要一起改。可以考慮在發版的同步清單裡加這一項，或把頁面上的數字拿掉。

### Commit

- 產品：`0d4c7ae3` feat(site): /cases case studies page, CaseCard and contract flow figure (T0638)
- 工單：本次收尾 commit（只含本工單檔）
- 未 push、未改 GitHub 設定；`src/styles/settings.css` 與 `_ct-workorders/T0639-*.md` 的 M 都不是我的變更，沒有動

### 互動紀錄

無（yolo、`CT_INTERACTIVE=0`；沒有需要問塔台的問題）。

### 遭遇問題

- 第一次跑截圖腳本時，Git Bash 的 `$PWD` 變成 `/d/...`，Node 解析失敗；改用 `pwd -W`。
- root 的 playwright 要的瀏覽器版本沒有安裝，改用已安裝的 1243（見截圖清單）。
