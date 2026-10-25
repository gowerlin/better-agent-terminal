# Local Rules — better-agent-terminal

> 本文件為本專案塔台附加規則，覆蓋 Core Skills 的預設行為。
> 載入優先級：Layer 3（最高優先）。
> 建立時間：2026-04-12 (UTC+8)（T0062 遷移產出）

---

## 擴充單據類型

本專案除標準工單（T####）外，額外使用以下單據：

| 前綴 | 用途 | 狀態流 |
|------|------|--------|
| `BUG-###-xxx.md` | 獨立 Bug 報修單 | 📂 OPEN → 🔧 FIXING → ✅ FIXED → 🧪 VERIFY（選用）→ 🚫 CLOSED / WONTFIX |
| `PLAN-###-xxx.md` | 計劃 / Idea 記錄單 | 💡 IDEA → 📋 PLANNED → 🔄 IN_PROGRESS → ✅ DONE → 🚫 DROPPED |

---

## *sync 擴充掃描範圍

執行 `*sync` 時，除工單（T####）外，額外掃描以下文件：

| 檔案 | 掃描目的 |
|------|---------|
| `BUG-###-*.md` | Bug 單目前狀態（REPORTED / FIXED 等） |
| `PLAN-###-*.md` | 計劃單目前狀態（IDEA / DONE 等） |
| `_bug-tracker.md` | Open Bug 數量摘要（自動重建） |
| `_backlog.md` | Active Idea / Plan 數量摘要（自動重建） |
| `_decision-log.md` | 最新決策條目 |

---

## BUG 狀態流

OPEN → FIXING → FIXED → VERIFY → CLOSED
                               ↘ WONTFIX

| 狀態 | 觸發者 | 說明 |
|------|--------|------|
| OPEN | Tower | Bug 確認，開始追蹤 |
| FIXING | Tower 開工單 | Worker 實作修復中 |
| FIXED | Worker 回報 | 修復 commit 完成，等人工驗收 |
| VERIFY | Tower（選用）| 驗收進行中 |
| CLOSED | 使用者 → Tower | 驗收通過，正式結案 |
| WONTFIX | Tower 決策 | 確認不修復，銷單 |

### `_bug-tracker.md` Section 標題格式（Parser 必讀）

> **重要**：Bug Tracker UI 的 parser (`src/types/bug-tracker.ts: sectionToStatus`) 靠 section
> 標題判斷 BUG 狀態。每個狀態**必須獨立一個 section**，**禁止合併**。

| 狀態 | 必須使用的 Section 標題 | 禁止寫法 |
|------|------------------------|---------|
| OPEN | `## 🔴 Open / 處理中` | — |
| FIXING | `## ⏳ 修復中 (FIXING)` | — |
| FIXED | `## ✅ 已修復` | — |
| VERIFY | `## 🧪 驗收中 (VERIFY)` | — |
| CLOSED | `## 🚫 已關閉 (CLOSED)` | ❌ `## 🚫 已關閉 / WONTFIX`（會被誤判為 WONTFIX） |
| WONTFIX | `## ⛔ 不修復 (WONTFIX)` | ❌ 與 CLOSED 合併在同一 section |

**容錯**：Parser 已加入容錯邏輯，混合標題（如 `已關閉 / WONTFIX`）會 fallback 為 CLOSED。
但為避免歧義，**一律使用上表的標準格式**。

**BUG 文件內的狀態欄位**也應與 tracker section 一致：
- 表格格式：`| **狀態** | 🚫 CLOSED |`
- 列表格式：`- **狀態**：CLOSED`

---

## Bug 報修流程

**觸發**：發現新 Bug 需記錄時

**步驟**：
1. 分配下一個 BUG 編號（當前最大 + 1，3 位數）
2. 建立 `_ct-workorders/BUG-###-<title>.md`（複製模板，最少填：標題 + 現象描述）
3. 更新 `_ct-workorders/_bug-tracker.md` Open Bugs 表格
4. 更新 `_tower-state.md` 中 BUG 最大編號
5. 回塔台確認

**最少必填欄位**（其餘可後補）：
- 標題
- 嚴重度
- 現象描述（預期 vs 實際）

### VERIFY（驗收待確認）狀態說明

**觸發**：Worker 回報修復完成（✅ FIXED），進入 🧪 VERIFY 等待真人或 AI 執行 runtime 驗收

> VERIFY 為選用狀態：若使用者直接回報「驗收通過」，可直接 FIXED → CLOSED。

**步驟**：
1. Worker 回報修復完成 → 狀態從 🔧 FIXING 改為 ✅ FIXED
2. （選用）Tower 標記進入 🧪 VERIFY，同步更新 `_bug-tracker.md` 狀態欄
3. 進行 runtime 驗收（見下方「驗收者」說明）
4. 驗收通過 → 狀態改為 🚫 CLOSED
5. 驗收未通過 → 見「驗收失敗處理」

### 驗收者

| 驗收類型 | 適用情境 | 備註 |
|---------|---------|------|
| 使用者 / QA（真人） | 所有情境 | 最終決定者 |
| AI sub-session | 可自動化判斷的場景（unit test、純邏輯驗證） | 需有明確判準 |
| 需真人複驗 | E2E 流程、視覺化呈現、UX 感受 | AI 難以可靠判斷 |

### 驗收失敗處理

| 失敗情境 | 處理方式 |
|---------|---------|
| 原問題未解（fix 無效） | 狀態退回 🔧 FIXING，附上驗收失敗說明，重新派修復工單 |
| 衍生問題（fix 正確但帶來新 bug） | 原 BUG 狀態改為 🚫 CLOSED（原問題已解），另開新 BUG 單報修衍生問題 |

---

## PLAN 記錄流程

**觸發**：有新 Idea 或功能需求需記錄時

**步驟**：
1. 分配下一個 PLAN 編號（當前最大 + 1，3 位數）
2. 建立 `_ct-workorders/PLAN-###-<title>.md`（複製模板，最少填：標題 + 動機）
3. 更新 `_ct-workorders/_backlog.md` Active 表格
4. 更新 `_tower-state.md` 中 PLAN 最大編號
5. 回塔台確認

**最少必填欄位**（其餘可後補）：
- 標題
- 動機 / 背景（一句話）

---

## 索引架構（D030 更新）

> 建立時間：2026-04-13（T0103 實作）

### 自動重建索引（由 `*sync` 負責）

- `_bug-tracker.md`：從 BUG-###.md 掃描重建，**人工不直接編輯**
- `_backlog.md`：從 PLAN-###.md 掃描重建，**人工不直接編輯**

### 人工維護索引

- `_decision-log.md`：直接 append 新決策，無對應源文件群
- `sprint-status.yaml`：里程碑摘要，由 Tower 在重要節點更新

### 已移除

- `_workorder-index.md`：已歸檔至 `_archive/_workorder-index.md`。Tower 直接掃描 T####.md 源文件。

### Tower 啟動行為

- 每次 Tower session 啟動，自動執行 `*sync` 確保 bug-tracker 和 backlog 準確

### 手動同步規則（仍適用）

| 修改的文件 | 必須同步更新 |
|-----------|------------|
| BUG-###.md 狀態變更 | 下次 `*sync` 自動重建 `_bug-tracker.md` |
| PLAN-###.md 狀態變更 | 下次 `*sync` 自動重建 `_backlog.md` |
| 任何上述變更 | `_tower-state.md` 基本資訊中的統計數字 |

---

## 編號規則

| 類型 | 格式 | 起始 | 範例 |
|------|------|------|------|
| 工單 | T#### | T0001 | T0063-next-task |
| Bug | BUG-### | BUG-001 | BUG-016-new-bug |
| PLAN | PLAN-### | PLAN-001 | PLAN-001-agent-orchestration |
| 決策 | D### | D001 | D018-new-decision |

塔台在 `_tower-state.md` 的「基本資訊」中維護各類型的最大編號。

---

## 模板位置

建立新單據時使用以下格式：
- BUG 格式：參考 `BUG-001-claude-oauth-paste-truncated.md` 或 T0061 回報區模板
- PLAN 格式：參考 T0061 回報區模板

---

## 歸檔原則

> 建立時間：2026-04-12（T0064 產出）
> 執行工具：`git mv`（保留版本歷史）

### 歸檔資格（所有單據類型通用）

**觸發條件**（同時滿足以下三點）：
1. **狀態為最終態**：DONE / CLOSED / WONTFIX / DROPPED
2. **超過 N 天未變更**：建議 N=7（一週），可在 `_tower-config.yaml` 中調整 `archive_days`
3. **不再需要即時回顧或參考**：
   - 無 active 工單依賴此單
   - 非當前 sprint 的關鍵決策依據

**豁免條件**（不歸檔，即使符合觸發條件）：
- 被 active 工單的「相關單據」欄位引用
- 塔台明確標記「保留」的單據
- `_tower-state.md` 起手式提及的單據
- 被產品程式碼以檔名**讀取**的單據（歸檔前 `grep -rln "<filename>" src electron scripts`，命中且會讀檔才豁免；只當路徑字串用的不算，例 `scripts/__tests__/asar-runtime-deps.test.mjs`。L133，2026-10-04 補；2026-10-17 T0577 起 parser-parity 改讀 `src/types/__tests__/fixtures/ct-workorders/` 複本，已無測試讀取真實工單檔）

> ℹ️ T0577（2026-10-17）起產品測試不再讀 `_ct-workorders/` 的真實檔案，塔台搬動 / 歸檔工單的 commit 不必再跑 `npm run test:unit`（L133 放寬）。新增讀取真實工單檔的測試前，先改用 fixture。

### 歸檔目錄結構

```
_ct-workorders/
├── _archive/
│   ├── checkpoint-2026-04.md     ← 歷史 checkpoint（特殊文件，平放）
│   ├── workorders/               ← 已結案工單（T####）
│   │   ├── T0001-xxx.md
│   │   └── T0002-xxx.md
│   ├── bugs/                     ← 已結案 BUG 單
│   │   ├── BUG-001-xxx.md
│   │   └── BUG-002-xxx.md
│   └── plans/                    ← 已結案 PLAN 單
│       └── PLAN-001-xxx.md
```

### 歸檔流程

1. 塔台（或 `*sync`）掃描所有單據
2. 篩選符合歸檔資格的單據
3. 使用 `git mv` 搬移到 `_archive/<type>/` 對應子目錄
4. 更新索引（`_bug-tracker.md`、`_backlog.md`、`_workorder-index.md`）：
   - 已歸檔單據的連結路徑改為 `_archive/<type>/FILENAME.md`
5. **不刪除任何檔案，只搬移**

### 回溯查詢

- 歸檔單據仍可透過 Glob 搜尋：`_ct-workorders/_archive/**/*.md`

---

## 工單前綴規範（分支 / 實驗 / 跨專案）

> 建立時間：2026-04-13（避免多分支/多專案並行時工單編號衝突）

### 前綴對照表

| 情境 | 格式 | 範例 | 說明 |
|------|------|------|------|
| 主線開發 | `T####` | T0084 | 繼續現有規則 |
| 實驗分支（worktree） | `EXP-[TOPIC]-###` | EXP-BUG012-001 | 實驗性修復，失敗可直接丟棄 |
| 跨專案協調 | `[PROJ]-T####` | KEENBEST-T001 | 需在另一專案追蹤的工作 |
| 子功能集群 | `[FEATURE]-###` | REMOTE-001 | 大型功能子工單群（如 PLAN-007 遠端支援） |

### 實驗分支工作流程（EXP-前綴）

1. **建立 worktree**（塔台指示，使用者執行）：
   ```bash
   git worktree add ../<repo>-<topic> -b exp/<topic>
   ```
2. 在 worktree 的 `_ct-workorders/` 建立 `EXP-[TOPIC]-###-<title>.md` 工單
3. 實驗成功 → PR 回主線，工單一併合併
4. 實驗失敗 → `git worktree remove` 丟棄，主線零污染

### `*sync` 行為

`*sync` 執行時，EXP-前綴工單**不計入**主線進度統計，列在獨立的「🧪 實驗分支」區塊。

### 命名規則

- `[TOPIC]`：2-10 字元大寫英文 + 數字，如 `BUG012`、`REMOTE`、`VSCODE`
- `###`：3 位數，從 `001` 開始，**每個 TOPIC 獨立計數**
- 工單檔名：`EXP-BUG012-001-<title>.md`
- 所有 `git mv` 操作保留完整版本歷史

---

## Auto-Session 路由規則（BAT 內部終端）

> 建立時間：2026-04-16（T0126-T0131 實作產出）
> 上游 PR 候選：PLAN-011

### 路由決策樹

塔台派發工單後，依以下順序偵測環境決定執行方式：

> 2026-10-05 第五十五 session 修訂（T0434 回報區第 6 節，PLAN-036 K）：舊版的 raw command 形式（`bat-terminal.mjs claude "/ct-exec T####"` = `terminal:create-with-command`）在遠端會被每 PTY 權杖拒絕（`Forbidden: channel-not-allowed`），一律改用 agent 模式（`--skill` / `--workorder`）。實際派發旗標以 control-tower `references/auto-session.md` 命令表為準（`--notify-id` / `--workspace` / `--cwd` / `--mode` / `--agent default` 等，本節只示意）。

```
偵測 BAT_SESSION 環境變數？
├─ BAT_SESSION=1（BAT 終端：本機分頁，或遠端 WSL / SSH / Docker 視窗的分頁）
│  ├─ BAT_HELPER_DIR + BAT_REMOTE_PORT + BAT_REMOTE_TOKEN 皆有
│  │  └─ N="${BAT_HELPER_NODE:-node}"   （T0456：遠端 = bundle node；本機無此變數 → node。PATH 可能被 login shell 重設，勿依賴 PATH 尾端的 bundle bin）
│  │     "$N" "$BAT_HELPER_DIR/bat-terminal.mjs" --skill ct-exec --workorder T#### \
│  │       --notify-id "$BAT_TERMINAL_ID" --workspace "$BAT_WORKSPACE_ID" [--mode yolo] [--no-interactive]
│  │     → 本機：RemoteServer（全權 server token）；遠端：headless bat-server（每 PTY 權杖，PLAN-036 K）
│  │     → 新分頁出現在 Tower 所在視窗 / workspace；成功判定只看 exit code
│  └─ 任一缺少（遠端舊 server、helper 未部署）→ 直接走降級鏈；不要先嘗試 node "/bat-terminal.mjs"
├─ $WT_SESSION 存在（Windows Terminal）
│  └─ wt -w 0 nt claude "/ct-exec T####"
└─ 其他
   └─ 剪貼簿 / 文字提示降級鏈
```

遠端補充：遠端分頁可由 `BAT_REMOTE_TOKEN` 以 `batcap.` 開頭辨識（T0449）；遠端 `--submit` 需有 BAT client 連著，否則 `bat-notify` exit 1（`no-client`）→ 走手動訊息；遠端 `~/.claude/skills` 需另裝 control-tower 系列 skill；遠端權杖只允許 agent 模式派單（tower）與 notify / 預填 / keypress（worker），細節見 `CLAUDE.md`「遠端 Tower 通知（PLAN-036 K）」。

### Bash 白名單擴充

以下指令加入塔台 auto-session 白名單（本機與遠端通用）：

| 用途 | 指令 | 條件 |
|------|------|------|
| BAT 終端（本機 / 遠端） | `"$N" "$BAT_HELPER_DIR/bat-terminal.mjs" --skill ct-exec --workorder T#### --notify-id "$BAT_TERMINAL_ID" --workspace "$BAT_WORKSPACE_ID" …` | `BAT_SESSION=1` 且 helper env 齊全 |
| 同上（ct-done） | `… --skill ct-done --workorder T#### …` | 同上 |

### Agent 自訂參數自動套用

> 2026-10-14 T0529（PLAN-040 / D142）改寫：舊版寫「直接呼叫 `bat-terminal.mjs` 暫不支援、依賴 UI 按鈕」，與實況不符 —— agent 模式（`terminal:create-agent-command`）自 `3abfb98`（2026-04-25）起就會套用全域 `agentCustomArgs`；T0529 再加上工作區層級。

Agent 自訂參數有兩層（T0128 全域 + T0529 工作區）：Settings `agentCustomArgs`，以及工作區設定（工作區右鍵 → 工作區設定）以 preset 為單位的覆寫（有覆寫即整串取代全域，空字串 = 不帶參數）。預設 agent 同理：工作區 → Settings → `claude-code`（D140）。

**塔台不需手動拼接參數**：

| 派工方式 | 套用的 agent / 參數 |
|---|---|
| BAT UI 按鈕（ct-exec / ct-done、新建 Agent 終端） | 該工作區的生效值 |
| helper agent 模式 `bat-terminal.mjs --skill ct-exec --workorder T#### [--agent default\|<id>] …` | **落點工作區**（T0523：`--notify-id` 塔台終端所屬工作區優先）的生效值，與 UI 按鈕一致 |
| helper raw command 模式 `bat-terminal.mjs claude "/ct-exec T####" …` | 不加任何參數（命令照原樣執行；遠端權杖也不允許此模式） |
| 遠端 Tower（headless bat-server） | 只有 server 的 `<dataDir>/settings.json`，沒有工作區層級 |

細節見 `CLAUDE.md`「工作區層級 Agent / 啟動參數」。

### 依賴的基礎設施

| 組件 | 工單 | 狀態 |
|------|------|------|
| ct-exec/ct-done 按鈕修復 | T0126 | ✅ |
| RemoteServer 自動啟動 + env vars | T0129 | ✅ |
| 外部終端 UI 同步 | T0130 | ✅ |
| CLI helper (bat-terminal.mjs) | T0131 | ✅ |
| Agent 自訂參數 | T0128 | ✅ |
| 工作區層級 Agent / 啟動參數 | T0529 | ✅ |

---

## Tower State Archive 規則（PLAN-033）

### 自動觸發（收工流程整合）

每次收工寫快照前，塔台執行：
1. 識別 `_tower-state.md` 中即將被擠出 hot path 的「前前 session 收工快照」段落
2. 依 session header ISO 日期（regex `\d{4}-\d{2}-\d{2}`）判定季度
3. Append 到 `_archive/state-snapshots/<YYYY-Q?>.md`（無檔則建）
4. 若目標季檔 size > 200 KB → 自動切割為 `<YYYY-Q?>-a.md` / `<YYYY-Q?>-b.md`（依 entry count 對半）
5. 更新 `INDEX.md`（append session row + 更新 `Last archived session #`）
6. 從 `_tower-state.md` 移除該段
7. 寫入新「本 Session」段，原「本」降級為「前」

### 補救命令：*archive --state --rebuild-index

異常情境使用：
- INDEX.md 損毀或解析失敗
- 收工流程中斷（archive 半套）
- 手動補 archive（跳過某次 session）

行為：
1. 掃 `_archive/state-snapshots/2026-Q*.md` 所有檔案
2. 抽 session header + 日期 + summary 重建 INDEX.md
3. 原 INDEX.md 備份為 `INDEX.md.bak.<UNIX_TS>`
4. 報告新增/修正/重複的 row 數

### 季檔切割規則

- 主軸：自然季度（`2026-Q1.md` / `2026-Q2.md`）
- 後備：單檔 > 200 KB 自動切 `-a/-b` 後綴
- 切割點：依 entry count 對半（非 byte 等分），確保時間軸連續性
- INDEX.md 表格 `File` 欄位記錄實際檔名（含後綴）

### INDEX.md 格式

固定欄位：`| Session | Date | File | Summary |`

- **Session**：原 header label（如「第三十五 session」），允許非整數命名
- **Date**：ISO `YYYY-MM-DD`
- **File**：實際季檔名（如 `2026-Q2-b.md`）
- **Summary**：header 後第一段截斷至 ≤ 60 字

---

## Tower State Size 檢查（PLAN-033）

啟動 Step 0（Full Scan / Fast Path）額外驗證 `_tower-state.md` 大小：

| 大小 | 行為 |
|------|------|
| < 30 KB | ✅ 正常 |
| 30 KB ~ 60 KB | ⚠️ 軟警告 — 顯示「state 已超軟警告閾值，建議下次收工後跑 *archive --state」 |
| 60 KB ~ 256 KB | 🔴 強制提示 — 顯示「state 接近 Read 上限，建議**立即** *archive --state --rebuild-index」 |
| > 256 KB | ❌ Read 工具上限觸發 — 強制走 `limit=N` + grep 降級恢復 |

實作位置：Step 0 偵測完成後、面板顯示前。

---

## Quick Recovery Hygiene（PLAN-033 補規）

### 設計原則

`_tower-state.md` 開頭的 🌅 起手式（Quick Recovery）區段語意為「**最新狀態指引**」，不應內嵌歷史 session 完整摘要。

### 違規情境

T0347 落地後實測：起手式內嵌 Session 31 收工快照大段（~234 行），導致瘦身後 hot path 仍 48 KB（超 30 KB 軟警告）。

### 規則

1. ✅ 起手式可包含：
   - 立即待辦（≤ 5 條）
   - 近期完成摘要（≤ 5 條，每條一行）
   - 快速連結（指向其他文件）
   - 編號起始（T#### / BUG-### / PLAN-### / D###）

2. ❌ 起手式禁止內嵌：
   - 完整 session 收工快照（屬 archive 範圍）
   - 大段時間線（> 10 行）
   - 詳細統計表格（屬本 session / 前 session 區段）

3. **若起手式因任何理由超過 50 行**：
   - 視為違規，需重構
   - 大段內容應移到對應 session 收工快照區段
   - 若內容屬「跨 session 持續性指引」，移到 `_local-rules.md` 或獨立文件

### 自動偵測（Step 0 整合）

Step 0 額外掃 🌅 起手式區段行數：
- > 30 行 → ⚠️ 軟警告
- > 60 行 → 🔴 強制提示重構

---

## GitHub CLI 鐵則（L122，2026-09-01 第四十七 session）

### 規則

**本專案所有 `gh` 指令必須顯式帶 `-R gowerlin/better-agent-terminal`。**

### 為什麼

本 repo 有**三個 remote**：

| remote | URL |
|--------|-----|
| `origin` | `https://github.com/gowerlin/better-agent-terminal.git` ← **我們的** |
| `upstream` | `https://github.com/tony1223/better-agent-terminal.git` |
| `scandnavik` | `https://github.com/scandnavik/better-agent-terminal.git` |

`gh` 的預設 repo 解析在多 remote 情境下**會選到 `upstream`**。實測（2026-09-01）：

```
gh workflow run pre-release.yml -f version=0.5.9-pre.1
→ HTTP 404: workflow pre-release.yml not found on the default branch
  (https://api.github.com/repos/tony1223/better-agent-terminal/actions/workflows/pre-release.yml)
```

該次是**唯讀操作**，只是報錯。但 `gh release create` / `gh pr create` / `gh issue create`
等**寫入操作**若解析錯 repo，會把內容送進上游或第三方 fork —— 後果不可逆。

### 檢查點

若你正要送出一個 `gh` 指令而指令中沒有 `-R`，**停下來補上**。

---

## Release 流程實況（L123 / L124，2026-09-01 修正）

> ⚠️ CLAUDE.md「Release」節的描述**與實際 workflow 不符**，以本節為準。

### 觸發方式

| workflow | 觸發 | 說明 |
|----------|------|------|
| `pre-release.yml` | **`workflow_dispatch` only** | push tag **不會**觸發。用 `gh workflow run pre-release.yml -R gowerlin/better-agent-terminal -f version=<X.Y.Z-pre.N>` |
| `release.yml` | `push` tag `v*` | 正式版線 |
| `build-server-bundle.yml` | `workflow_dispatch` + tag `server-bundle-v*` | 手動備援線。自 D120（T0365）起 `pre-release.yml` / `release.yml` 發 desktop release 時**同時自動發** `server-bundle-v<版號>`，同版號不要兩線都發 |

### 版本號必須顯式指定

`pre-release.yml` 的自動遞增邏輯是：

```
git tag -l 'v*' --sort=-v:refname | head -1
```

本 repo 有 **257 個 tag、三條混雜版本線**（`v0.x` 主線 / `v2.2.x` / `v4.0.x`），
`-v:refname` 會取到 **`v4.0.3-pre.1`** → 產出 `4.0.4-pre.1`，與主線完全脫節。

**留空版本號 = 版本號暴衝。一律顯式指定。**

判定下一版的正確做法：找**本 fork 主線**的最新 tag（`v0.x` 那條），而非 `--sort=-v:refname` 的第一名。

**版號線（D143 → D151，2026-10-17）**：預覽版目前走 `0.7.0-pre.N`（`v0.7.0-pre.1` 起，重大改版：本機範圍權杖）。兩位數 `-pre.N` 在 GitHub Release 等字串排序列表中會錯位，**`-pre.N` 最多到 `pre.9`，不發 `pre.10`**；需要第十個預覽版時改升版號線（例 `0.7.1-pre.1`），並先與使用者確認。重大改版時由使用者決定升 minor。

### package.json 版本

CI 會用 `VERSION` env 覆寫（`scripts/build-version.js` 優先序：env > git tag > timestamp），
所以 package.json 落後**不影響安裝檔**，但會讓本機 `npm run dev` 顯示錯誤版本。
發布後順手同步：`npm version --no-git-tag-version --allow-same-version <version>`（同步 package.json + lock）。

### 更版重點（Release notes）必寫（L150 晉升，2026-10-15 使用者指示「加入塔台原則，每次發布都要加」）

**每次發佈（預覽版與正式版）都要寫更版重點，CI 跑完立刻補上，不得只留 workflow 自動產生的內容。**

- workflow 以 `generate_release_notes: true` 建立 release，內容只有一行 Full Changelog，而且比較基準常被誤抓成 `server-bundle-v*` tag（例：pre.2 自動產生 `server-bundle-v0.6.1-pre.1...v0.6.1-pre.2`）。
- 做法：release 建立後，以 `gh release edit v<版號> -R gowerlin/better-agent-terminal --notes-file <檔>` 改寫 body。草稿可在 CI 跑的同時先寫好。
- 內容格式（沿用 `v0.6.1-pre.1` 起的寫法，繁體中文、寫給使用者看）：
  - 第一行：「版號 X.Y.Z-pre.N，接續 `v<上一版>`。」
  - `## 新增` / `## 修正` / `## 更新`（依實際內容取用）：每項以使用者看得到的行為描述，附 BUG / PLAN 編號；不寫內部實作細節
  - `## 已知事項`：未實機驗證的平台、仍在診斷的問題、需要搭配的外部版本（例如 Control Tower 版本）
  - `## 歡迎協助測試`（D153，2026-10-18 使用者指示）：本版有 codex 相關變更（codex 分頁啟動參數、BAT MCP、派工、通知、用量限制等），或 BAT 內嵌的 codex 升版時必寫。請 codex 使用者以 Codex CLI 當 Worker 跑一次 Tower / Worker 流程並回報結果。用使用者看得懂的步驟寫：開 Codex CLI 分頁 → 呼叫 MCP tool `bat_whoami` 看 `role` / `agent` → 由塔台派一張小工單給 Codex Worker → 確認 Worker 完成後通知回到塔台、分頁被回收；附回報管道（GitHub issue）與 BAT / codex 版本。沒有 codex 相關變更時省略
  - 結尾：`macOS 仍只提供 Apple Silicon（arm64）版。` 與 `**Full Changelog**: …/compare/v<上一版>...v<本版>`（基準一律是上一個 desktop tag，不是 server-bundle tag）
- 來源：上一版 tag 到本版之間非 `(ct)` 的 commit（`git log --oneline v<上一版>..HEAD | grep -v "(ct)$"`；只排除標題結尾的塔台記帳 commit，`fix(ct): …` 要保留，L154）與對應工單回報區。
- 收尾檢查：`gh release view v<版號> -R gowerlin/better-agent-terminal --json body` 確認已不是自動內容，再向使用者回報發佈完成。
- 緣由：`v0.6.0-pre.8` 漏寫（L150，2026-10-14）；L150 停在「候選晉升」，`v0.6.1-pre.2` 又漏寫，使用者指出後於 2026-10-15 補上並晉升為本規則。

### 發佈後同步 repo 文件（2026-10-16 使用者指示：「發布版本後也要更新 repo README.md release-note.md CHANGELOG.md」）

**每次發佈（預覽版與正式版）在寫完 GitHub 更版重點之後，同一輪更新 repo 內三個文件並 commit，才算發佈完成。**

- `CHANGELOG.md`：新增 `## [<版號>] — <發佈日期>` 段（日期取自 `gh release view --json publishedAt`），內容與更版重點一致（`Added` / `Fixed` / `Changed`，附 BUG / PLAN / T 編號）；`[Unreleased]` 中已發佈的項目移入該段。
- `release-note.md`：最新版放最上面，內容 = 該版 GitHub 更版重點（繁體中文）。
- `README.md`：只在功能、安裝、平台支援、版號範例等描述與本版不符時才改；無需修改時在回報中寫明「README 無需更新」。
- **README 必含「與 BMad Control Tower 協作」章節**（2026-10-17 使用者指示：「BAT 的 README.md 更新時，要加一章節說明與 BMad-Control-Tower 的協作與整合」）：每次更新 README 時一併檢查該章節（協作流程、BAT 整合點表、版本對照表）。BAT ↔ CT 介面契約有新增或改變（新 helper 參數、新功能需要對應 CT 版本）時，同步更新整合點表與版本對照表（BAT 最低版號 + CT 最低版號）。~~CT 維持未開源：README 不放 CT 的取得連結或內部 repo 位置~~（使用者 2026-10-17 指示；2026-10-25 D183 改寫）**CT 已公開（MIT）：README 的協作章節可寫取得方式並連到 CT Portal 安裝頁；安裝 / 升級步驟與 CT Release 直連仍只留在 Portal**（既有的 skill 名稱說明與版本對照表的 CT 最低版號照舊）。
- 順序：CI 綠 → `gh release edit`（更版重點）→ 三文件 commit（`docs: release notes for v<版號> (ct)`）→ push（依當次授權）→ 回報發佈完成。
- **網站同步確認**（PLAN-049 W4 / T0659，D160 第 3 點）：三文件 push 會觸發 Pages workflow（`.github/workflows/pages.yml`）。確認該 run 綠燈、網站首頁下載區的版號 = 本版；並打開 `link-check` job 的 summary，有 broken 連結就開單修（該 job 只警告、不擋部署，不看就不會有人發現）。

### 下游發佈（D137 / T0476）

`release.yml` 的 Homebrew tap dispatch 與 Chocolatey push 皆為 **opt-in、預設跳過**：分別需 repo variable `HOMEBREW_TAP_REPO`（tap `owner/name`，+ secret `TAP_GITHUB_TOKEN`）與 `CHOCOLATEY_PUBLISH == 'true'`（+ secret `CHOCO_API_KEY`），且 tag 不含 `-pre`。本 fork 目前未設定，正式版不會動上游 `tonyq-org/homebrew-tap` 或 chocolatey.org 上的 `better-agent-terminal`（該 package id 與 `choco/better-agent-terminal.nuspec` 的 authors / owners 屬上游，自發 choco 前需另案處理）。`pre-release.yml` 無此兩 step。

---

## 公開 repo 去識別化（D176，2026-10-21）

> 本 repo 在 GitHub 公開，`_ct-workorders/` 也公開（網站有連結）。工單、決策、學習、狀態快照、CHANGELOG、更版重點與網站都適用。

- **客戶與外部專案一律用代稱**：專案A、專案B、專案C（新的依序往下編）；外部測試者用「外部測試者A」（新的依序往下編）。真名與代稱的對照只存本機 `.private/`（`.gitignore` 擋住），不寫進任何追蹤檔、commit 訊息、工單或 BUG 單。
- **路徑**：使用者家目錄寫成 `<使用者資料夾>`；測試檔的範例路徑用 `C:\Users\demo`、`/Users/tester`。
- **不 commit 工具自動產生的記憶檔**：claude-mem 會把其他專案的紀錄寫進 `AGENTS.md`，`.gitignore` 已擋 `AGENTS.md`；`Claude outputs/` 也不 commit。
- **寫工單時**：字詞檢查清單不要直接列出真名，寫「依 `.private/` 的檢查樣式」。
- **push 前**（塔台收工或使用者要求 push 時）：跑 `.private/` 對照表裡的檢查樣式，對象是要推的 commit 與追蹤檔；有命中先處理再 push。另掃一次常見金鑰樣式（`sk-ant-`、`ghp_`、`github_pat_`、`AKIA`、`AIza`、`PRIVATE KEY`、真的 `batcap.` 權杖）。
