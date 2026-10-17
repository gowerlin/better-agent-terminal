---
schema_version: 1
schema_kind: workorder
id: T0595
title: "CLAUDE.md 壓縮：各功能小節的細節原文搬到 `docs/agent-guide/`，CLAUDE.md 保留標題 + 🔴 規則 + 唯一實作位置 + 連結（≤ 80k 字元）"
type: docs
status: PENDING
started_at: null
updated_at: "2026-10-18T01:53:20+0800"
completed_at: null
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

### 產出摘要

### 互動紀錄

### Renew 歷程

### 遭遇問題

### 回報時間
