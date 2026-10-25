---
schema_version: 1
schema_kind: workorder
id: T0595
title: "CLAUDE.md 壓縮：各功能小節的細節原文搬到 `docs/agent-guide/`，CLAUDE.md 保留標題 + 🔴 規則 + 唯一實作位置 + 連結（≤ 80k 字元）"
type: docs
status: DONE
started_at: "2026-10-18T01:54:01+0800"
updated_at: "2026-10-18T02:01:46+0800"
completed_at: "2026-10-18T02:01:46+0800"
repo: better-agent-terminal
project: ""
priority: P1
sizing: M
created_at: "2026-10-18T01:53:20+0800"
depends_on: [T0593, T0594]
related:
  - "使用者 2026-10-18 指示：Claude Code 警告 `CLAUDE.md is over the 150.0k-char limit (158.9k chars)`，請壓縮整理"
  - "`_local-rules.md` 與歷史工單常以「CLAUDE.md『<小節標題>』節」引用內容"
affects_files:
  - CLAUDE.md
  - "docs/agent-guide/**（新）"
  - _ct-workorders/T0595-claude-md-compaction.md
renew_count: 0
workdir: main repo
interaction:
  mode_hint: on
  interactive: false
  intervention_type: fire-and-forget
memory_overrides:
  - "🔴 **只搬不刪**：除了重複的句子，原文內容一律搬到 `docs/agent-guide/` 保留（契約、欄位表、exit code、日誌格式、實測數據、已知限制、驗證清單、歷史原因）。不得改寫內容的意思；搬移時可以調整標題層級與連結，不得「順手更新」內容。發現內容與程式碼不符 → 不改，列在回報區。"
  - "🔴 只改 `CLAUDE.md` 與新增 `docs/agent-guide/**`；不改產品程式碼、測試、`_ct-workorders/`（本工單檔除外）、既有 `docs/*.md`。"
  - "🔴 不 push、不觸發 workflow、不建 tag、不改版號；禁止 `git stash` / `git reset` / `git checkout -- <path>` / `git restore`（L138）；寫檔 LF、UTF-8 無 BOM；含反斜線的內容用 Write / Edit 工具（L129）。commit 用 `git commit --only CLAUDE.md docs/agent-guide`；`src/styles/settings.css` 的 M 不是你的變更。塔台同時可能在 commit 版號 bump / 發版文件（`package.json`、`CHANGELOG.md`、`release-note.md`、`README.md`），不要碰這些檔。"
---

# T0595 — CLAUDE.md 壓縮

## 背景

`CLAUDE.md` 目前約 159k 字元（Python `len`），超過 Claude Code 的 150k 上限，每個 session 都會被警告且可能被截斷。大部分篇幅是各功能的完整契約與驗證清單，這些只有在改到該功能時才需要。

## 做法（塔台決定）

1. **新目錄 `docs/agent-guide/`**：每個要搬的 `##` 小節一個檔，英文 kebab-case 檔名（例 `worker-tab-recycle.md`、`worktree-status.md`、`bat-mcp-shim.md`），檔頭一行說明「從 CLAUDE.md 搬出（T0595）」與原小節標題。另建 `docs/agent-guide/README.md` 索引（檔名 → 主題 → 對應 CLAUDE.md 小節）。
2. **CLAUDE.md 每個被搬的小節**：
   - `##` 標題**原文不變**（工單與 `_local-rules.md` 以標題引用）。
   - 保留：一兩句用途；所有 🔴 規則（原文）；唯一實作位置（檔案 / 函式名）；改這個功能前一定要知道的不變式；一行「完整契約、日誌、已知限制、驗證清單：`docs/agent-guide/<檔>.md`」。
   - 每節以 3–12 行為原則。
3. **不搬**：已經很短的小節（約 1.5k 字元以下，例 No Regressions Policy、Frontend unit tests、Type check、Child Process Spawning、Sub-agent、React Rendering、Status Line、Control Tower 本專案規則）原樣保留。Type check、Logging 開頭的通用規則（用 logger 不用 console.log、日誌位置）屬日常必讀，留在 CLAUDE.md。
4. **防止再長回來**：CLAUDE.md 開頭加一小節「CLAUDE.md 撰寫規則」：新功能只在 CLAUDE.md 寫摘要 + 🔴 規則 + 唯一實作位置 + 連結，細節寫進 `docs/agent-guide/`；CLAUDE.md 上限 150k 字元，目標 ≤ 100k。
5. **目標**：CLAUDE.md ≤ **80k 字元**（以 Python `len(open(...,encoding='utf-8').read())` 計）。

## 驗收條件

1. CLAUDE.md ≤ 80,000 字元；所有原 `##` 標題仍在且文字相同（以腳本比對搬移前後的 `##` 標題清單）。
2. **無遺失檢查**：寫一個暫存腳本（放 scratchpad，不進 repo），把搬移前 CLAUDE.md（`git show HEAD:CLAUDE.md`）的每一個非空行，去掉開頭的 `- ` / 空白與結尾空白後，確認出現在新 CLAUDE.md 或 `docs/agent-guide/*.md` 之一；未出現的行逐條列在回報區並說明（例：重複內容合併、標題層級調整）。目標：未出現 = 0，或每條都有理由。
3. 所有新連結（`docs/agent-guide/...`）指向的檔案存在；🔴 規則條數搬移前後相同（以 `🔴` 出現次數比對，搬到 docs 的 🔴 規則也必須在 CLAUDE.md 保留一份）。
4. 回報區附：搬移前 / 後字元數、每個 docs 檔與字元數、標題比對結果、無遺失檢查結果、🔴 計數。

---

## 回報區

> 以下由 sub-session 填寫，請勿在指揮塔 session 中編輯

### 完成狀態

DONE（四項驗收條件全部通過）

### 產出摘要

**落點檢查**：PASS。C-0 `repo: better-agent-terminal` = `basename(REPO_ROOT)` `better-agent-terminal`；C-1 工單在 REPO_ROOT 下；C-3 `CLAUDE.md` 存在（`docs/agent-guide/**` 為萬用字元、`_ct-workorders/` 排除）；C-2 無 `branch` 欄位。`CT_HOME` 未設定（非 worktree）。`BAT_WORKSPACE_ID` = `cc0afc4a-57e9-4f41-b2ed-a2d8bac9e36b`（僅記錄）。

**commit**：`081f3c47` docs: compact CLAUDE.md, move section details to docs/agent-guide (T0595)（`git commit --only CLAUDE.md docs/agent-guide`；`src/styles/settings.css` 未動）。

**做法**
- `docs/agent-guide/` 每個搬出的 `##` 小節一個檔：內容 = 該節**完整原文逐字**（以腳本從 `git show HEAD:CLAUDE.md` 切出，不經人工轉抄）；檔頭 `# <原標題>` + 一行「從 CLAUDE.md「…」節搬出（T0595）」；節內 `###` 降為 `##`（標題層級調整，文字不變）。
- CLAUDE.md 每個被搬的小節：`##` / `###` 標題原文不變；保留用途、所有 🔴 規則（以腳本依原行號帶入原句）、唯一實作位置、主要不變式與一行 docs 連結。
- 原樣保留未搬（腳本逐字帶入）：No Regressions Policy、Frontend unit tests、Type check、新 PTY 的初始尺寸（T0572 / BUG-145）、Child Process Spawning、Sub-agent / Active Tasks Tracking、React Rendering、Status Line、Electron Runtime、Control Tower 本專案規則（含 `### 工單與文件撰寫慣例`）。Logging 開頭 4 條通用規則（renderer / backend logger、不用 console.log、日誌位置）逐字保留。
- CLAUDE.md 開頭新增 `## CLAUDE.md 撰寫規則（T0595）`（上限 150k、目標 ≤ 100k、新功能只寫摘要 + 必守規則 + 唯一實作位置 + 連結、細節進 docs、`##` 標題不改名）。此節刻意不用 🔴 符號，讓 🔴 計數維持可比對。

**字元數**（Python `len`，UTF-8）
- CLAUDE.md：搬移前 **161,690** → 搬移後 **32,758**（≤ 80,000 ✅）
- docs/agent-guide（合計 160,874）：

| 檔案 | 字元數 | 對應 CLAUDE.md 小節 |
|---|---:|---|
| README.md | 3,607 | （索引） |
| bat-mcp-shim.md | 11,342 | BAT MCP shim（PLAN-047 M1 / T0584） |
| blocked-state.md | 11,915 | blocked 狀態偵測（PLAN-047 M1b / T0590） |
| build-toolchain.md | 2,160 | Build Toolchain（含 electron-builder 26 migration notes） |
| claude-agent-sdk-cli.md | 9,990 | Claude Agent SDK / CLI（含 Runtime Selection、auto-update 停用） |
| detached-workspace.md | 2,840 | Detached workspace 視窗的持久化（T0453 / T0491） |
| dialog-close-and-escape.md | 3,176 | Dialog 不因點擊外部關閉（T0563）、Esc 統一（T0567） |
| helper-query-channels.md | 6,857 | helper 唯讀查詢 channel（PLAN-047 M1 / T0582） |
| logging.md | 7,670 | Logging |
| multi-remote-profiles.md | 2,685 | 多 remote profile 同時連線（PLAN-039） |
| npm12-install-scripts.md | 4,878 | 本機開發：npm 12 install scripts（T0471 / T0473） |
| packaging-release-checks.md | 17,493 | Packaging / Release 前置檢查（含 Server bundle baseline） |
| pty-process-tree.md | 2,880 | 關閉分頁時的程序樹（T0540 / PLAN-042） |
| recovery-create-hold.md | 4,559 | Recovery 提示期間的 `pty:create`（T0578 / BUG-146） |
| release.md | 3,772 | Release（含 prerelease 標記、Server bundle tag 線） |
| remote-security.md | 5,693 | Remote 資安（PLAN-018 T0182） |
| remote-tower-notify.md | 12,447 | 遠端 Tower 通知（PLAN-036 K） |
| terminal-context-menu.md | 4,201 | 終端分頁右鍵選單與滑鼠追蹤（T0568 / BUG-142） |
| tower-tab-title.md | 5,889 | 塔台分頁標題（T0562，D147） |
| usage-limit-continue.md | 6,745 | 用量限制自動繼續（PLAN-044 / T0566，D148） |
| worker-tab-recycle.md | 10,873 | Worker 分頁回收（PLAN-041 / T0535，D144；等安靜 T0545，D145） |
| workspace-agent-launch.md | 2,654 | 工作區層級 Agent / 啟動參數（PLAN-040 / T0529，D142） |
| worktree-isolated-dispatch.md | 6,347 | worktree 隔離派工（PLAN-047 W1 / T0583，D150 / D152） |
| worktree-status.md | 10,201 | worktree 狀態查詢（PLAN-047 W1 / T0585） |

**驗收結果**（scratchpad 腳本 `verify.py`，不進 repo）
1. 字元數 32,758 ≤ 80,000 ✅。`##` 標題：搬移前 33 個全部仍在、文字相同、順序相同；新增 1 個（`## CLAUDE.md 撰寫規則（T0595）`）。`###` 標題：搬移前 7 個全部仍在 CLAUDE.md ✅。
2. 無遺失檢查：搬移前 500 個非空行（去開頭 `- ` / 空白與結尾空白）逐行比對新 CLAUDE.md 與 `docs/agent-guide/*.md`，**未出現 = 0** ✅（docs 檔為逐字原文，所以每一行都在）。
3. 連結：CLAUDE.md 與 docs 內 47 個 `docs/agent-guide/…` / README 相對連結，損壞 0 ✅。🔴：搬移前 27 → CLAUDE.md 搬移後 27 ✅（docs 另有原文的 27 個）。逐條比對原 🔴 句（🔴 起 40 字前綴）：26 / 27 逐字相同；差異 1 條見下方「遭遇問題」。
4. 本區即回報內容。另檢查：所有新檔與 CLAUDE.md 皆 LF、UTF-8 無 BOM。

### 互動紀錄

無（`CT_INTERACTIVE=0`，fire-and-forget）。

### Renew 歷程

無。

### 遭遇問題

- **🔴 句 1 條非整句逐字**：原 CLAUDE.md L73（T0538 批次關閉）的 🔴 出現在括號內句中「…列出工單編號 + 標題，🔴 不得改用 `window.confirm`），確認後逐一 …」，整句拆出會括號不成對。CLAUDE.md 摘要保留為「批次關閉的頁內確認 `.worker-batch-close-dialog`（列出工單編號 + 標題，🔴 不得改用 `window.confirm`）」，規則文字本身不變；原整句在 `docs/agent-guide/worker-tab-recycle.md`。
- 未發現內容與程式碼不符之處（本單未逐項核對程式碼，只搬移）。
- 保留節中的內部參照（例 Electron Runtime 的「見下節「根 `postinstall`」」、Type check 的「Packaging / Release 前置檢查」的 **Typecheck gate**）指向的細節現在在對應 docs 檔；標題仍在 CLAUDE.md，該節有 docs 連結，未改寫保留節原文。
- docs 檔內原文的交叉參照（例「見「遠端 Tower 通知」節」）照原文保留，仍以 CLAUDE.md 小節標題指稱（標題未變，可經 CLAUDE.md 連結找到 docs 檔）。

### 回報時間

2026-10-18T02:01:06+0800
