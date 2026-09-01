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

```
偵測 BAT_SESSION 環境變數？
├─ BAT_SESSION=1（在 BAT 內部終端）
│  └─ 使用 BAT 內部終端：
│     node "$BAT_HELPER_DIR/bat-terminal.mjs" claude "/ct-exec T####"
│     → WebSocket → RemoteServer → BAT 內建新終端分頁
│     → 縮圖自動出現 + xterm 綁定 + 自動聚焦
├─ $WT_SESSION 存在（Windows Terminal）
│  └─ wt -w 0 nt claude "/ct-exec T####"
└─ 其他
   └─ 剪貼簿 / 文字提示降級鏈
```

### Bash 白名單擴充

以下指令加入塔台 auto-session 白名單：

| 用途 | 指令 | 條件 |
|------|------|------|
| BAT 內部終端 | `node "$BAT_HELPER_DIR/bat-terminal.mjs" claude "/ct-exec T####"` | `BAT_SESSION=1` |
| BAT 內部終端 | `node "$BAT_HELPER_DIR/bat-terminal.mjs" claude "/ct-done T####"` | `BAT_SESSION=1` |

### Agent 自訂參數自動套用

T0128 實作了 Settings 中的 Agent 自訂參數（`agentCustomArgs`）。塔台派發時需套用：

```
# 假設 claude-code preset 設定了 --dangerously-skip-permissions
node "$BAT_HELPER_DIR/bat-terminal.mjs" claude "/ct-exec T####" --dangerously-skip-permissions
```

塔台不需手動拼接參數 — BAT UI 的按鈕已自動套用。但若塔台直接呼叫 `bat-terminal.mjs`，需自行從 Settings 讀取（目前暫不支援，依賴 UI 按鈕觸發）。

### 依賴的基礎設施

| 組件 | 工單 | 狀態 |
|------|------|------|
| ct-exec/ct-done 按鈕修復 | T0126 | ✅ |
| RemoteServer 自動啟動 + env vars | T0129 | ✅ |
| 外部終端 UI 同步 | T0130 | ✅ |
| CLI helper (bat-terminal.mjs) | T0131 | ✅ |
| Agent 自訂參數 | T0128 | ✅ |

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
| `build-server-bundle.yml` | `workflow_dispatch` + tag `server-bundle-v*` | 與 desktop release 解耦 |

### 版本號必須顯式指定

`pre-release.yml` 的自動遞增邏輯是：

```
git tag -l 'v*' --sort=-v:refname | head -1
```

本 repo 有 **257 個 tag、三條混雜版本線**（`v0.x` 主線 / `v2.2.x` / `v4.0.x`），
`-v:refname` 會取到 **`v4.0.3-pre.1`** → 產出 `4.0.4-pre.1`，與主線完全脫節。

**留空版本號 = 版本號暴衝。一律顯式指定。**

判定下一版的正確做法：找**本 fork 主線**的最新 tag（`v0.x` 那條），而非 `--sort=-v:refname` 的第一名。

### package.json 版本

CI 會用 `VERSION` env 覆寫（`scripts/build-version.js` 優先序：env > git tag > timestamp），
所以 package.json 落後**不影響安裝檔**，但會讓本機 `npm run dev` 顯示錯誤版本。
發布後順手同步：`npm version --no-git-tag-version --allow-same-version <version>`（同步 package.json + lock）。
